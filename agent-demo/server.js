/**
 * Digital Coach — agent demo server. Minimal Node (no dependencies):
 * - Anthropic API (key from ../.env, never committed), streaming via SSE
 * - Server-side guardrail enforcement (shared/guardrails.js): advice-line +
 *   escalation detection on every user turn, confirmation-gated writes,
 *   honest degraded state when the model/key is unavailable
 * - Faithfulness computed for real: every numeric claim in a reply is
 *   checked against this turn's tool/RAG outputs
 * - Telemetry uses the exact schema from shared/telemetry.js
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectAdviceLine, detectEscalationTriggers, ADVICE_LINE, ESCALATION_OFFER, DEGRADATION } from '../shared/guardrails.js';
import { canTransition, INITIAL_STATE } from '../shared/states.js';
import { createTelemetry } from '../shared/telemetry.js';
import { compileSystemPrompt } from './agent/system-prompt.js';
import { TOOL_DEFINITIONS, runTool, confirmProposal, declineProposal, rollbackAction } from './agent/tools.js';
import { getDoc } from './agent/rag.js';
import * as memoryStore from './agent/memory-store.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* ---------------- .env ---------------- */
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const ENV = { ...loadEnv(), ...process.env };
const API_KEY = ENV.ANTHROPIC_API_KEY;
const MODEL = ENV.ANTHROPIC_MODEL || 'claude-sonnet-5';
const PORT = +(ENV.PORT || 8787);

/* ---------------- server state ---------------- */
const T = createTelemetry();
const SYSTEM_PROMPT = compileSystemPrompt();
const sessions = new Map(); // sessionId -> {history:[], state, turns}

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { history: [], state: INITIAL_STATE, turns: 0 });
  return sessions.get(id);
}

function setState(session, next) {
  if (session.state === next) return session.state;
  if (!canTransition(session.state, next)) {
    // bridge through planning where the machine requires it
    if (canTransition(session.state, 'planning') && canTransition('planning', next)) session.state = 'planning';
  }
  if (canTransition(session.state, next)) session.state = next;
  return session.state;
}

/* ---------------- faithfulness ---------------- */

const NUM_RE = /\$?\d[\d,]*(?:\.\d+)?%?/g;
const normNum = s => parseFloat(s.replace(/[$,%\s]/g, ''));

/** Numbers present in this turn's grounding material (tool results + RAG snippets). */
function groundingNumbers(toolOutputs) {
  const set = new Set();
  for (const out of toolOutputs) {
    for (const m of JSON.stringify(out).match(NUM_RE) || []) set.add(normNum(m));
  }
  return set;
}

/**
 * Check each numeric claim in the reply: grounded = the number appears in a
 * tool/RAG output this turn AND its sentence carries a [src:...] citation.
 */
function checkFaithfulness(text, grounded) {
  const plain = text.replace(/<[^>]+>/g, ' ');
  const sentences = plain.split(/(?<=[.!?])\s+|<br\s*\/?>/i);
  let total = 0, ok = 0;
  const misses = [];
  for (const s of sentences) {
    const nums = (s.replace(/\[src:[\w-]+\]/g, '').match(NUM_RE) || [])
      .filter(n => !/^\d$/.test(n)); // single bare digits ("4 scenarios") aren't claims
    if (!nums.length) continue;
    const hasCite = /\[src:[\w-]+\]/.test(s);
    for (const n of nums) {
      total++;
      if (grounded.has(normNum(n)) && hasCite) ok++;
      else misses.push({ number: n, cited: hasCite, sentence: s.trim().slice(0, 120) });
    }
  }
  return { total, ok, misses };
}

/* ---------------- Anthropic streaming call ---------------- */

async function* anthropicStream(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      stream: true,
      system: SYSTEM_PROMPT + memoryContext(),
      tools: TOOL_DEFINITIONS,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      const dataLine = part.split('\n').find(l => l.startsWith('data:'));
      if (dataLine) yield JSON.parse(dataLine.slice(5));
    }
  }
}

function memoryContext() {
  const mems = memoryStore.usableMemories();
  if (!mems.length) return '\n\n# Current consented memories\n(none yet)';
  return '\n\n# Current consented memories\n' + mems.map(m => `- [${m.type}] ${m.text}`).join('\n');
}

/* ---------------- the agent loop (one user turn) ---------------- */

async function handleChat(session, userText, send) {
  // --- server-side guardrail pre-pass (does not depend on the model) ---
  const adviceLineHit = detectAdviceLine(userText);
  const triggers = detectEscalationTriggers(userText);

  const serverNotes = [];
  if (adviceLineHit) serverNotes.push(`Advice-line guardrail triggered. Refuse per the guardrails section — open with the canonical refusal copy verbatim, then redirect.`);
  if (triggers.length) serverNotes.push(`Escalation triggers detected: ${triggers.join(', ')}. Acknowledge feelings first, ground any education in search_guidance, call escalate_to_human with a context summary, and offer the human handoff.`);

  const userContent = [{ type: 'text', text: userText }];
  if (serverNotes.length) userContent.push({ type: 'text', text: `[server guardrail note — not from the user: ${serverNotes.join(' ')}]` });
  session.history.push({ role: 'user', content: userContent });

  const toolOutputs = [];
  const turnEvents = [];
  let finalText = '';

  for (let iter = 0; iter < 6; iter++) {
    const blocks = [];
    let current = null;
    let stopReason = null;

    for await (const ev of anthropicStream(session.history)) {
      if (ev.type === 'content_block_start') {
        current = ev.content_block.type === 'tool_use'
          ? { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, inputJson: '' }
          : { type: 'text', text: '' };
      } else if (ev.type === 'content_block_delta') {
        if (ev.delta.type === 'text_delta') { current.text += ev.delta.text; send({ type: 'delta', text: ev.delta.text }); }
        else if (ev.delta.type === 'input_json_delta') current.inputJson += ev.delta.partial_json;
      } else if (ev.type === 'content_block_stop') {
        if (current?.type === 'tool_use') current.input = current.inputJson ? JSON.parse(current.inputJson) : {};
        blocks.push(current); current = null;
      } else if (ev.type === 'message_delta') {
        stopReason = ev.delta.stop_reason;
      } else if (ev.type === 'error') {
        throw new Error(ev.error?.message || 'stream error');
      }
    }

    const apiBlocks = blocks.map(b => b.type === 'text'
      ? { type: 'text', text: b.text }
      : { type: 'tool_use', id: b.id, name: b.name, input: b.input });
    session.history.push({ role: 'assistant', content: apiBlocks });
    finalText += blocks.filter(b => b.type === 'text').map(b => b.text).join('');

    if (stopReason !== 'tool_use') break;

    const results = [];
    for (const b of blocks.filter(b => b.type === 'tool_use')) {
      const { result, events } = runTool(b.name, b.input);
      toolOutputs.push(result);
      turnEvents.push(...events);
      send({ type: 'tool', name: b.name, input: b.input });
      for (const e of events) send(e);
      results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(result) });
    }
    session.history.push({ role: 'user', content: results });
  }

  // --- post-turn: state, guardrail telemetry, faithfulness, citations ---
  session.turns++;
  const proposed = turnEvents.some(e => e.type === 'proposal');
  const next = triggers.length ? 'escalation' : proposed ? 'action' : session.turns > 1 ? 'planning' : 'orientation';
  send({ type: 'state', to: setState(session, next) });

  if (adviceLineHit) {
    T.log('refusals'); T.impact('refusal');
    send({ type: 'guardrail', id: ADVICE_LINE.id, evalLabel: ADVICE_LINE.refusal.evalLabel, banner: ADVICE_LINE.refusal.banner });
  }
  if (triggers.length) {
    // deterministic server-side offer — shown even if the model forgot
    send({ type: 'escalation_offer', triggers, copy: ESCALATION_OFFER.copy, button: ESCALATION_OFFER.button });
  }
  if (proposed) T.log('actionsProposed');
  for (const e of turnEvents) {
    if (e.type === 'memory_written') T.log('memWrites');
    if (e.type === 'consent_request') T.log('consentAsks');
  }

  const faith = checkFaithfulness(finalText, groundingNumbers(toolOutputs));
  T.log('claimsTotal', faith.total);
  T.log('claimsGrounded', faith.ok);
  if (faith.total > 0 && faith.ok === faith.total) T.impact('groundedClaims');
  for (let i = 0; i < faith.total - faith.ok; i++) T.impact('ungroundedClaim');

  const srcIds = [...new Set([...finalText.matchAll(/\[src:([\w-]+)\]/g)].map(m => m[1]))];
  const citations = srcIds.map(docId => {
    const chunk = getDoc(docId)[0];
    return { docId, title: chunk ? chunk.title : docId, snippet: chunk ? chunk.snippet : 'calculator output — executed via calc tool, not model arithmetic' };
  });

  send({ type: 'turn_done', faithfulness: faith, citations, tools: toolOutputs.length, state: session.state });
}

/* ---------------- http plumbing ---------------- */

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/markdown', '.json': 'application/json' };

function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  const file = path.startsWith('/shared/')
    ? join(ROOT, normalize(path))
    : join(HERE, normalize(path));
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}

const readBody = req => new Promise(resolve => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(b ? JSON.parse(b) : {}));
});
const sendJson = (res, obj, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (!path.startsWith('/api/')) return serveStatic(req, res);
    const body = req.method === 'POST' ? await readBody(req) : {};

    if (path === '/api/chat') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const send = ev => res.write(`data: ${JSON.stringify(ev)}\n\n`);
      const session = getSession(body.sessionId || 'default');
      if (!API_KEY) {
        // honest disabled state — never improvise (shared/guardrails.js DEGRADATION)
        T.log('degradations'); T.impact('degradation');
        send({ type: 'degraded', html: `${DEGRADATION.copy.headline} The live model is not configured (no ANTHROPIC_API_KEY in .env). ${DEGRADATION.rule}`, state: 'degraded' });
        send({ type: 'turn_done', faithfulness: { total: 0, ok: 0, misses: [] }, citations: [], state: 'degraded' });
        return res.end();
      }
      try {
        await handleChat(session, String(body.message || ''), send);
      } catch (err) {
        T.log('degradations'); T.impact('degradation');
        send({ type: 'degraded', html: `${DEGRADATION.copy.headline} ${DEGRADATION.copy.body}`, detail: err.message, state: 'degraded' });
      }
      return res.end();
    }

    if (path === '/api/confirm') {
      // the explicit user confirmation event — the ONLY path to execution
      if (!body.approve) return sendJson(res, declineProposal(body.proposalId));
      const result = confirmProposal(body.proposalId, { source: 'user-ui', at: Date.now() });
      if (result.executed) {
        T.log('actionsApproved'); T.impact('actionApproved');
        memoryStore.addMemory('explicit', `Approved contribution change: ${result.change} (confirmation #${result.confirmationNumber})`);
      }
      return sendJson(res, result);
    }
    if (path === '/api/rollback') return sendJson(res, rollbackAction(body.confirmationNumber));

    if (path === '/api/memory' && req.method === 'GET') return sendJson(res, { memories: memoryStore.listMemories() });
    if (path === '/api/memory/edit') return sendJson(res, { memory: memoryStore.editMemory(body.id, body.text) });
    if (path === '/api/memory/delete') { T.log('memDeletes'); return sendJson(res, { deleted: memoryStore.deleteMemory(body.id) }); }
    if (path === '/api/memory/consent') {
      T.log('consentAsks', 0);
      if (body.grant) { T.log('consentGrants'); T.impact('consentGrant'); }
      return sendJson(res, { memory: memoryStore.consentMemory(body.id, !!body.grant) });
    }

    if (path === '/api/telemetry') return sendJson(res, T.snapshot());
    if (path === '/api/cite-open') { T.log('citesOpened'); T.impact('citeOpen'); return sendJson(res, { ok: true }); }
    if (path === '/api/escalate') {
      T.log('escalations'); T.impact('escalation');
      return sendJson(res, { ok: true, toast: ESCALATION_OFFER.handoffToast });
    }
    if (path === '/api/feedback') {
      if (body.dir > 0) { T.log('up'); T.impact('up'); }
      else {
        T.log('down'); T.impact('down');
        // 👎 → eval fuel: queue as a golden-set candidate (gitignored data file)
        appendFileSync(join(HERE, 'data', 'feedback-queue.json'),
          JSON.stringify({ at: new Date().toISOString(), transcriptTail: body.transcriptTail || null }) + '\n');
      }
      return sendJson(res, { ok: true });
    }

    return sendJson(res, { error: 'unknown endpoint' }, 404);
  } catch (err) {
    return sendJson(res, { error: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Digital Coach agent demo → http://localhost:${PORT}`);
  console.log(API_KEY ? `model: ${MODEL}` : 'NO ANTHROPIC_API_KEY — chat will degrade honestly (copy .env.example to .env)');
});

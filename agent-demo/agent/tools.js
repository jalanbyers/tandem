/**
 * Agent tools — all against mock data (data/accounts.json). Autonomy is
 * enforced HERE, server-side, per shared/guardrails.js AUTONOMY:
 * plan_change_draft NEVER executes; it registers a proposal that only
 * confirmProposal() — driven by an explicit user confirmation event from the
 * UI — can execute. Every write has a rollback.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTONOMY } from '../../shared/guardrails.js';
import { retrieve } from './rag.js';
import { addMemory } from './memory-store.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const baseAccounts = JSON.parse(readFileSync(join(DATA_DIR, 'accounts.json'), 'utf8'));

// Runtime copy so approved changes are visible in-session without mutating the
// checked-in fixture. Reset on server restart.
const accounts = structuredClone(baseAccounts);

/* ---------------- proposal registry (the confirmation gate) ---------------- */

const proposals = new Map();
const executedActions = new Map();
let nextProposalId = 1;
let nextConfirmation = 88213;

export function getProposal(id) { return proposals.get(id); }

/**
 * Execute a confirmed proposal. `confirmationEvent` must be the explicit
 * user event relayed by the server from the UI ({source:'user-ui'}) —
 * the model cannot fabricate it through a tool call.
 */
export function confirmProposal(proposalId, confirmationEvent) {
  if (!confirmationEvent || confirmationEvent.source !== 'user-ui') {
    return { executed: false, error: 'REFUSED_NO_CONFIRMATION', rule: AUTONOMY.rule };
  }
  const p = proposals.get(proposalId);
  if (!p) return { executed: false, error: 'UNKNOWN_PROPOSAL' };
  if (p.status !== 'proposed') return { executed: false, error: `PROPOSAL_${p.status.toUpperCase()}` };

  // execute
  accounts.plan401k.contributionPct = p.newValue;
  p.status = 'executed';
  const confirmationNumber = nextConfirmation++;
  executedActions.set(confirmationNumber, { proposalId, prevValue: p.prevValue, newValue: p.newValue });
  return {
    executed: true,
    confirmationNumber,
    change: `401(k) contribution: ${p.prevValue}% → ${p.newValue}%`,
    reversibleUntil: 'Thursday',
    rollback: `POST /api/rollback {confirmationNumber: ${confirmationNumber}}`,
  };
}

export function declineProposal(proposalId) {
  const p = proposals.get(proposalId);
  if (p && p.status === 'proposed') p.status = 'declined';
  return { declined: true, note: AUTONOMY.declineToast };
}

/** Rollback for the write tool — required before any write ships. */
export function rollbackAction(confirmationNumber) {
  const a = executedActions.get(confirmationNumber);
  if (!a) return { rolledBack: false, error: 'UNKNOWN_CONFIRMATION' };
  accounts.plan401k.contributionPct = a.prevValue;
  executedActions.delete(confirmationNumber);
  const p = proposals.get(a.proposalId);
  if (p) p.status = 'rolled-back';
  return { rolledBack: true, restored: `401(k) contribution back to ${a.prevValue}%` };
}

/* ---------------- tool definitions (Anthropic schema) ---------------- */

export const TOOL_DEFINITIONS = [
  {
    name: 'get_plan_record',
    description: 'Read the customer\'s 401(k) plan record, projection snapshot, and cash-flow summary. Read-only; auto-executes. Cite figures from it as [src:plan-record] (or [src:cash-flow] for expense/savings figures).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'contribution_calculator',
    description: 'Compute the effect of changing the 401(k) contribution percentage. Read-only. ALL arithmetic about contributions must come from this tool — never compute it yourself. Cite as [src:contribution-calculator].',
    input_schema: {
      type: 'object',
      properties: {
        newContributionPct: { type: 'number', description: 'proposed contribution % of salary' },
      },
      required: ['newContributionPct'],
    },
  },
  {
    name: 'search_guidance',
    description: 'Retrieve passages from the guidance corpus (retirement guideline, volatility education, plan record, cash-flow analysis) with source ids for citation. Use before making any educational or methodological claim.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'plan_change_draft',
    description: `Draft (NEVER execute) a 401(k) contribution change for the user to approve. ${AUTONOMY.rule} The UI shows the draft as an action card; execution only happens after the user's explicit confirmation event, server-side. Do not claim the change happened.`,
    input_schema: {
      type: 'object',
      properties: {
        newContributionPct: { type: 'number' },
        rationale: { type: 'string', description: 'one-line, user-facing reason' },
      },
      required: ['newContributionPct'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Hand off to a licensed Fidelity representative with context. Use on any escalation trigger (distress language, sell decisions, low confidence, missing data, out-of-policy). Appropriate escalation is a success metric.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        contextSummary: { type: 'string', description: 'what the representative needs so the user never repeats their story' },
      },
      required: ['reason', 'contextSummary'],
    },
  },
  {
    name: 'save_memory',
    description: 'Save a memory about the user. type=explicit only for things the user stated outright; derived (inferences) and behavioral (patterns) are stored pending the user\'s consent and MUST NOT be relied on until granted — the UI asks for consent automatically.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['explicit', 'derived', 'behavioral'] },
        text: { type: 'string' },
      },
      required: ['type', 'text'],
    },
  },
];

/* ---------------- tool execution ---------------- */

/**
 * Execute a tool call from the model. Returns {result, events} where events
 * are side-channel notifications for the UI (proposal cards, consent asks,
 * escalation banners).
 */
export function runTool(name, input) {
  switch (name) {
    case 'get_plan_record':
      return { result: accounts, events: [] };

    case 'contribution_calculator': {
      const cur = accounts.plan401k.contributionPct;
      const next = input.newContributionPct;
      const salary = accounts.customer.salaryAnnual;
      const deltaPct = next - cur;
      const employeeAnnualIncrease = Math.round(salary * deltaPct / 100);
      const matchablePct = Math.min(next, accounts.plan401k.employerMatchCapPct) - Math.min(cur, accounts.plan401k.employerMatchCapPct);
      const employerMatchAnnualIncrease = Math.round(salary * matchablePct / 100);
      const perPaycheck = +(employeeAnnualIncrease / accounts.plan401k.payPeriodsPerYear).toFixed(2);
      const capturesFullMatch = next >= accounts.plan401k.employerMatchCapPct;
      return {
        result: {
          currentPct: cur, newPct: next, employeeAnnualIncrease, employerMatchAnnualIncrease,
          perPaycheck, capturesFullMatch,
          projectedIncomeReplacementPct: capturesFullMatch
            ? accounts.projection.incomeReplacementAtFullMatchPct
            : accounts.projection.incomeReplacementNowPct,
          note: 'executed via calc tool, not model arithmetic',
        },
        events: [],
      };
    }

    case 'search_guidance':
      return { result: { passages: retrieve(input.query) }, events: [] };

    case 'plan_change_draft': {
      const p = {
        id: nextProposalId++,
        change: 'contribution_pct',
        prevValue: accounts.plan401k.contributionPct,
        newValue: input.newContributionPct,
        rationale: input.rationale || '',
        status: 'proposed',
      };
      proposals.set(p.id, p);
      const calc = runTool('contribution_calculator', { newContributionPct: p.newValue }).result;
      return {
        result: {
          proposalId: p.id, status: 'proposed',
          requiresUserConfirmation: true,
          enforcement: 'server-side — this tool cannot execute',
          draft: { change: `401(k) contribution: ${p.prevValue}% → ${p.newValue}%`, perPaycheck: calc.perPaycheck },
        },
        events: [{ type: 'proposal', proposal: { ...p, perPaycheck: calc.perPaycheck } }],
      };
    }

    case 'escalate_to_human':
      return {
        result: { handoff: 'queued', package: 'session summary + consented memory context travels with the user', reason: input.reason },
        events: [{ type: 'escalation_tool', reason: input.reason, contextSummary: input.contextSummary }],
      };

    case 'save_memory': {
      const mem = addMemory(input.type, input.text);
      const events = [{ type: 'memory_written', memory: mem }];
      if (mem.status === 'pending-consent') events.push({ type: 'consent_request', memory: mem });
      return {
        result: { saved: true, id: mem.id, status: mem.status,
          note: mem.status === 'pending-consent' ? 'not usable until the user grants consent' : 'active' },
        events,
      };
    }

    default:
      return { result: { error: `unknown tool ${name}` }, events: [] };
  }
}

export function currentAccounts() { return accounts; }

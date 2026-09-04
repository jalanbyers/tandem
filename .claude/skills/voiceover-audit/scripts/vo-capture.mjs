#!/usr/bin/env node
/**
 * Capture what VoiceOver actually SPEAKS, as a timestamped transcript.
 *
 * This is the part DOM inspection cannot give you. shared/a11y.js can be
 * verified to mutate a live region correctly and still fail in practice —
 * VoiceOver may coalesce, drop, or re-read a region depending on how the
 * mutation lands. The only way to know is to ask VoiceOver what it said.
 *
 * Method: VoiceOver exposes `content of last phrase` over AppleScript. One
 * long-lived osascript process polls it and emits on change; Node timestamps
 * each line as it arrives. A single process (rather than one osascript per
 * poll) is what keeps the sampling interval near the intended 100ms.
 *
 * KNOWN LIMIT, stated up front because it matters for interpreting results:
 * `last phrase` is a single slot, not a queue. Two phrases spoken inside one
 * poll interval leave only the second visible. That under-samples exactly the
 * failure this audit hunts — token-by-token stutter. It still detects it (many
 * short phrases in rapid succession rather than few clause-sized ones), but
 * treat phrase COUNT as a floor, never an exact tally.
 *
 * Usage:
 *   node vo-capture.mjs [--seconds 30] [--interval 0.1] [--out transcript.jsonl]
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const SECONDS = Number(arg('--seconds', 30));
const INTERVAL = Number(arg('--interval', 0.1));
const OUT = arg('--out', 'vo-transcript.jsonl');

const iterations = Math.ceil(SECONDS / INTERVAL);

// `log` writes to stderr, which is how we stream out of AppleScript.
// Returns/newlines inside a phrase would corrupt line framing, so flatten them.
const script = `
tell application "VoiceOver"
  set prev to ""
  repeat ${iterations} times
    try
      set cur to content of last phrase
    on error
      set cur to prev
    end try
    if cur is not prev then
      set flat to ""
      repeat with c in (characters of cur)
        if (id of c) is in {10, 13} then
          set flat to flat & " "
        else
          set flat to flat & c
        end if
      end repeat
      log flat
      set prev to cur
    end if
    delay ${INTERVAL}
  end repeat
end tell`;

const t0 = Date.now();
const out = createWriteStream(OUT);
const phrases = [];

const child = spawn('osascript', ['-e', script]);
let buf = '';

child.stderr.on('data', chunk => {
  buf += chunk.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    const rec = { atMs: Date.now() - t0, text };
    phrases.push(rec);
    out.write(JSON.stringify(rec) + '\n');
    process.stdout.write(`[${String(rec.atMs).padStart(6)}ms] ${text}\n`);
  }
});

child.on('error', err => {
  console.error(`\nCould not start osascript: ${err.message}`);
  process.exit(1);
});

child.on('close', code => {
  out.end();
  if (code !== 0 && phrases.length === 0) {
    console.error(`\nosascript exited ${code} with nothing captured.`);
    console.error('Run scripts/preflight.sh — this usually means VoiceOver is not');
    console.error('accepting AppleScript, or Automation permission is missing.');
    process.exit(1);
  }
  // Report the ACTUAL window, not the requested one. They differ: VoiceOver
  // services the Apple Event only when its main loop is free, so each poll can
  // block for seconds while it is busy speaking.
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${phrases.length} phrases captured over ${elapsed}s actual (${SECONDS}s requested) → ${OUT}`);

  const gaps = phrases.slice(1).map((p, i) => p.atMs - phrases[i].atMs);
  const worst = Math.max(0, ...gaps);
  if (worst > 3000) {
    console.log(`\n⚠ sampling confidence: largest gap between samples was ${(worst / 1000).toFixed(1)}s.`);
    console.log('  A `last phrase` query blocks while VoiceOver is mid-speech, so a gap');
    console.log('  may be a STALL rather than silence. Short announcements inside a gap');
    console.log('  are missed. Treat absence of any single phrase as unproven.');
  }
  if (phrases.length === 0) {
    console.log('Nothing was spoken. Did the reply actually stream while capturing?');
  }
});

console.log(`Capturing VoiceOver speech for ${SECONDS}s (sampling every ${INTERVAL}s).`);
console.log('Trigger the streamed reply in Safari now.\n');

#!/usr/bin/env node
/**
 * Assert a captured VoiceOver transcript against the streaming rules in
 * .claude/rules/accessibility.md.
 *
 * Each check names the rule it enforces. Where a check is a heuristic rather
 * than a proof, it says so in its output — a green run here is evidence, not a
 * substitute for listening once yourself.
 *
 * Usage: node vo-assert.mjs [transcript.jsonl] [--turn-note "finished replying"]
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2]?.startsWith('--') ? 'vo-transcript.jsonl' : (process.argv[2] || 'vo-transcript.jsonl');
const noteIdx = process.argv.indexOf('--turn-note');
const TURN_NOTE = noteIdx > -1 ? process.argv[noteIdx + 1] : 'finished replying';

let rows;
try {
  rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
} catch (err) {
  console.error(`Cannot read transcript "${file}": ${err.message}`);
  process.exit(1);
}
if (!rows.length) {
  console.error(`"${file}" is empty — VoiceOver spoke nothing during capture.`);
  process.exit(1);
}

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};

const texts = rows.map(r => r.text);
const lens = texts.map(t => t.length).sort((a, b) => a - b);
const median = lens[Math.floor(lens.length / 2)];
const gaps = rows.slice(1).map((r, i) => r.atMs - rows[i].atMs);
const medianGap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;

console.log(`\nVoiceOver transcript: ${rows.length} phrases over ${rows.at(-1).atMs}ms\n`);
console.log('— streamed output is announced coherently, not token by token —');

// "Do not announce token by token." A clause is tens of characters; a token is
// a handful. Median length is the discriminator that survives under-sampling.
check(`phrases are clause-sized, not token-sized (median ${median} chars)`,
  median >= 20, `median ${median} chars suggests token-level announcement`);

check(`phrases are not machine-gunned (median gap ${medianGap}ms)`,
  rows.length < 3 || medianGap >= 150, `median ${medianGap}ms between phrases`);

// "A streamed reply is announced once, coherently."
const consecutiveDupes = texts.filter((t, i) => i > 0 && t === texts[i - 1]);
check('no phrase announced twice in a row', consecutiveDupes.length === 0,
  `${consecutiveDupes.length} immediate repeats`);

const seen = new Map();
for (const t of texts) if (t.length > 25) seen.set(t, (seen.get(t) || 0) + 1);
const rereads = [...seen.entries()].filter(([, n]) => n > 1);
check('no substantial phrase re-read later in the turn', rereads.length === 0,
  rereads.map(([t, n]) => `${n}× "${t.slice(0, 40)}…"`).join('; '));

// Growing prefixes are the classic live-region failure: the region is
// re-announced in full on every append instead of only the addition. The tell
// is that each phrase CONTAINS the previous one from the start, whatever the
// size of the increment.
const prefixGrowth = texts.filter((t, i) => {
  const prev = texts[i - 1];
  return i > 0 && prev.length >= 8 && t.length > prev.length && t.startsWith(prev);
}).length;
check('region announces additions, not the whole message each time',
  prefixGrowth === 0, `${prefixGrowth} phrases restate the previous phrase in full`);

console.log('\n— nothing leaks that a listener should never hear —');
check('no HTML markup spoken', !texts.some(t => /<\/?[a-z][^>]*>/i.test(t)),
  texts.find(t => /<\/?[a-z][^>]*>/i.test(t))?.slice(0, 60));
check('no [src:…] grounding markers spoken', !texts.some(t => /\[src/i.test(t)),
  texts.find(t => /\[src/i.test(t))?.slice(0, 60));
check('no raw HTML entities spoken', !texts.some(t => /&(amp|nbsp|lt|gt|#\d+);/i.test(t)));

console.log('\n— the turn boundary settles —');
const noteHits = texts.filter(t => t.toLowerCase().includes(TURN_NOTE.toLowerCase()));
check(`turn-completion announced exactly once ("${TURN_NOTE}")`,
  noteHits.length === 1, `heard ${noteHits.length}×`);
// Only meaningful once the note was heard at all — otherwise this would pass
// vacuously on the very transcript that is missing it.
if (noteHits.length) {
  check('turn-completion is the final phrase',
    texts.at(-1).toLowerCase().includes(TURN_NOTE.toLowerCase()),
    `last phrase was "${texts.at(-1).slice(0, 50)}"`);
} else {
  console.log('  – turn-completion ordering: not checked (never announced)');
}

console.log(`\n${'═'.repeat(40)}`);
console.log(`PASS ${pass} · FAIL ${fail}`);
console.log(`
Caveats, so this is not over-read:
  • \`last phrase\` is sampled, not queued — phrase count is a floor, not a tally.
  • Pace and prosody are not measured. Whether it SOUNDS right still needs an ear.
  • A green run is evidence the plumbing works, not that the experience is good.`);

process.exit(fail ? 1 : 0);

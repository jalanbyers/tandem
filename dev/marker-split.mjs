// Deterministic proof of the split-[src:] marker fix. No browser, no SR needed.
globalThis.document = {
  createElement: () => ({ setAttribute(){}, classList:{add(){}}, appendChild(){}, replaceChildren(){}, style:{} }),
  createTextNode: t => ({ t }),
  body: { appendChild(){} },
};
globalThis.matchMedia = undefined;
const { createStreamAnnouncer } = await import('/Users/alanbyers/Projects/digital-coach/shared/a11y.js');

function run(deltas, label) {
  const spoken = [];
  const a = createStreamAnnouncer({ flushMs: 999999, onSpeak: t => spoken.push(t) });
  a.begin(null);
  for (const d of deltas) a.push(d);
  a.end({ note: null });
  const joined = spoken.join(' | ');
  const leak = /\bsrc\b|plan-record\]|\]\./.test(joined);
  console.log(`${leak ? '✗ LEAK' : '✓ clean'}  ${label}\n         ${joined}`);
  return !leak;
}

let ok = true;
// the exact production shape: marker split across two deltas at the boundary
ok &= run(['Your balance is $48,200. ', '[src:', 'plan-record]. ', 'That covers it. '],
          'marker split across deltas, boundary mid-marker');
ok &= run(['You are on track. [src:plan', '-record]. Next step. '],
          'marker split mid-token');
ok &= run(['Replacement is 68%. [src:', 'retirement-guideline] and rising. '],
          'marker split, no period inside');
ok &= run(['A whole marker inline [src:plan-record] stays stripped. '],
          'intact marker (regression guard)');
ok &= run(['Truncated turn ends mid-marker [src:plan-'],
          'turn ends mid-marker — forced flush must still strip the stub');
console.log(ok ? '\nALL CLEAN' : '\nLEAKS PRESENT');
process.exit(ok ? 0 : 1);

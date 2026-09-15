import { chromium } from 'playwright';
let pass=0,fail=0; const ck=(n,ok,d='')=>{ok?(pass++,console.log(`  ✓ ${n}`)):(fail++,console.log(`  ✗ ${n}${d?' — '+d:''}`));};
const b=await chromium.launch();
for(const [label,url,wait] of [['LIFECYCLE','http://localhost:8321/lifecycle-demo/index.html',2600],['AGENT','http://localhost:8799/',9000]]){
  console.log(`\n══ ${label} ══`);
  const p=await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.goto(url,{waitUntil:'networkidle'});
  ck(`${label}: no JS errors on load`, errs.length===0, errs.join(' | '));
  // lifecycle opens on the build-story tab; the chat view must be selected first
  await p.evaluate(()=>document.getElementById('tab-demo')?.click());
  await p.waitForTimeout(300);

  const hiddenBefore = await p.$eval('#capTrack', el=>el.getAttribute('aria-hidden'));
  ck(`${label}: caption mount is aria-hidden="true"`, hiddenBefore==='true', String(hiddenBefore));
  const liveAttrs = await p.$eval('#capTrack', el=>({live:el.getAttribute('aria-live'),role:el.getAttribute('role')}));
  ck(`${label}: caption mount is NOT a live region`, !liveAttrs.live && !liveAttrs.role, JSON.stringify(liveAttrs));

  const visBefore = await p.$eval('.cap-panel', el=>getComputedStyle(el).display);
  ck(`${label}: hidden while presenter mode is off`, visBefore==='none', visBefore);
  await p.click('#debugToggle'); await p.waitForTimeout(250);
  const visAfter = await p.$eval('.cap-panel', el=>getComputedStyle(el).display);
  ck(`${label}: revealed by presenter mode`, visAfter!=='none', visAfter);

  const chip = await p.$('#chips button');
  if(chip){ await chip.click(); await p.waitForTimeout(wait); }
  const caps = await p.$$eval('.cap', els=>els.map(e=>({kind:e.className,text:e.querySelector('.cap-text')?.textContent||''})));
  ck(`${label}: captions populated (${caps.length})`, caps.length>=2);
  // Clause-sized, not token-sized. A debounce flush during a gap in the token
  // stream can legitimately strand a short tail (see a11y-checklist.md §5), so
  // the bar is the MEDIAN chunk, not every chunk — but a median of 1-2 words
  // would mean the clause buffer had regressed to token spam.
  const clauses = caps.filter(c=>c.kind.includes('cap-clause')).map(c=>c.text.trim().split(/\s+/).length);
  const median = clauses.sort((a,b)=>a-b)[Math.floor(clauses.length/2)] || 0;
  ck(`${label}: clause-sized, not token-sized (median ${median}w)`, median >= 5,
     'a median under 5 words means the clause buffer regressed to token spam');
  const tails = caps.filter(c=>c.kind.includes('cap-clause') && c.text.trim().split(/\s+/).length<3);
  if (tails.length) console.log(`    note: ${tails.length} short tail(s) from debounce flushes: ${tails.map(t=>JSON.stringify(t.text)).join(', ')}`);
  ck(`${label}: a turn-boundary caption is present`,
     caps.some(c=>/finished replying|limited-service/i.test(c.text)));
  // The caption track accumulates every announcement; the sr region is transient
  // (cleared on begin() and 4s after end()). So assert containment, not equality:
  // whatever the region currently holds must appear among the captions verbatim.
  const srText = await p.$eval('[role="log"].sr-only', el=>el.textContent.trim()).catch(()=>'');
  const capJoined = caps.map(c=>c.text).join(' ');
  const probe = srText.split(/\s+/).slice(0,6).join(' ');
  ck(`${label}: live-region text appears verbatim in the captions`,
     !probe || capJoined.includes(probe), `probe="${probe}"`);
  console.log(`    sample: ${caps.slice(0,3).map(c=>`[${c.kind.replace('cap cap-','')}] ${c.text.slice(0,58)}`).join('\n            ')}`);
  ck(`${label}: still no JS errors after a turn`, errs.length===0, errs.join(' | '));
  await p.close();
}
await b.close();
console.log(`\n════════════\nPASS ${pass} · FAIL ${fail}`);
process.exit(fail?1:0);

/** Action-card focus cycle, reflow at 200/400%, and reduced motion. */
import { chromium } from 'playwright';
let pass=0,fail=0; const ck=(n,ok,d='')=>{ok?(pass++,console.log(`  ✓ ${n}`)):(fail++,console.log(`  ✗ ${n}${d?' — '+d:''}`));};
const act = p => p.evaluate(() => {
  const a=document.activeElement; if(!a) return 'none';
  return `${a.tagName.toLowerCase()}${a.id?'#'+a.id:''}${typeof a.className==='string'&&a.className?'.'+a.className.trim().split(/\s+/)[0]:''}`
       + (a.getAttribute('aria-label')?` "${a.getAttribute('aria-label')}"`:'');
});
const b=await chromium.launch();

for(const [label,url,wait] of [['LIFECYCLE','http://localhost:8321/lifecycle-demo/index.html',2600],['AGENT','http://localhost:8799/',9000]]){
  console.log(`\n══ ${label} ══`);
  const p=await b.newPage({viewport:{width:1280,height:900}});
  await p.goto(url,{waitUntil:'networkidle'});
  await p.evaluate(()=>document.getElementById('tab-demo')?.click());
  await p.waitForTimeout(300);

  /* ---- reflow: WCAG 1.4.10, 320 CSS px == 400% at 1280 ---- */
  for(const [zoom,w,h] of [['200%',640,512],['400%',320,256]]){
    await p.setViewportSize({width:w,height:h});
    await p.waitForTimeout(350);
    const over=await p.evaluate(()=>({
      docScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth+1,
      bodyScroll: document.body.scrollWidth > document.body.clientWidth+1,
      worst: [...document.querySelectorAll('main *')]
        .filter(e=>e.scrollWidth>e.clientWidth+1 && getComputedStyle(e).overflowX==='visible')
        .slice(0,3).map(e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')),
    }));
    ck(`${label}: no horizontal scroll of the page at ${zoom} (${w}px)`,
       !over.docScroll && !over.bodyScroll, JSON.stringify(over));
    ck(`${label}: no element overflows its box at ${zoom}`, over.worst.length===0, over.worst.join(','));
  }
  await p.setViewportSize({width:1280,height:900}); await p.waitForTimeout(250);

  /* ---- reduced motion ---- */
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.reload({waitUntil:'networkidle'});
  await p.evaluate(()=>document.getElementById('tab-demo')?.click());
  await p.waitForTimeout(400);
  const chip0=await p.$('#chips button'); if(chip0){await chip0.click(); await p.waitForTimeout(wait);}
  const motion=await p.evaluate(()=>{
    const m=document.querySelector('.msg'); if(!m) return {none:true,name:'(no .msg)'};
    const s=getComputedStyle(m);
    // tokens.css uses animation-duration:.001ms rather than animation:none, so
    // animationend still fires and nothing waiting on it hangs. Assert duration.
    const secs=parseFloat(s.animationDuration)||0;
    return {name:s.animationName,dur:s.animationDuration,secs,none:secs<=0.001};
  });
  ck(`${label}: message animation is effectively zero under reduced motion (${motion.dur})`, motion.none, JSON.stringify(motion));
  const anyAnim=await p.evaluate(()=>[...document.querySelectorAll('main *')]
    .filter(e=>{const s=getComputedStyle(e);return (parseFloat(s.animationDuration)||0)>0.001||(parseFloat(s.transitionDuration)||0)>0.001;})
    .slice(0,3).map(e=>`${e.tagName}.${(e.className||'').toString().split(' ')[0]}`));
  ck(`${label}: nothing in main runs a perceptible animation or transition`, anyAnim.length===0, anyAnim.join(','));
  await p.emulateMedia({reducedMotion:null});

  /* ---- action-card focus cycle ---- */
  await p.reload({waitUntil:'networkidle'});
  await p.evaluate(()=>document.getElementById('tab-demo')?.click());
  await p.waitForTimeout(400);
  let card=null;
  if(label==='AGENT'){
    // the golden case that produces a gated proposal
    await p.fill('#freeInput','OK — set up the contribution increase to 8% for me.');
    await p.click('#sendBtn');
    await p.waitForSelector('.action-card',{timeout:90000}).catch(()=>{});
    await p.waitForTimeout(2000);
    card=await p.$('.action-card');
  } else {
    // scripted chain; a consent prompt empties the chip list mid-way, so answer it
    for(let i=0;i<14 && !card;i++){
      const consent=await p.$('.consent button.yes, [data-x="consent-yes"]');
      if(consent){ await consent.click(); await p.waitForTimeout(1200); }
      else {
        const chips=await p.$$('#chips button');
        if(!chips.length){ await p.waitForTimeout(900); }
        else { await chips[0].click(); await p.waitForTimeout(wait); }
      }
      card=await p.$('.action-card');
    }
  }
  if(!card){ ck(`${label}: reached an action card`, false, 'scripted path did not produce one'); await p.close(); continue; }
  ck(`${label}: reached an action card`, true);
  const grp=await p.$eval('.action-card',e=>({role:e.getAttribute('role'),lab:e.getAttribute('aria-labelledby'),ti:e.getAttribute('tabindex')}));
  ck(`${label}: card is a labelled group`, grp.role==='group' && !!grp.lab, JSON.stringify(grp));
  const headOk=await p.evaluate(id=>!!document.getElementById(id),grp.lab);
  ck(`${label}: aria-labelledby resolves`, headOk, grp.lab);
  console.log(`    focus on card insert: ${await act(p)}`);

  const approve=await p.$('.action-card [data-x="approve"]');
  ck(`${label}: approve control exists and is a real button`,
     !!approve && (await approve.evaluate(e=>e.tagName))==='BUTTON');
  const approveName=approve && await approve.evaluate(e=>e.getAttribute('aria-label')||e.textContent.trim());
  ck(`${label}: approve is named`, !!approveName && approveName.length>3, String(approveName));
  await approve.focus(); await p.keyboard.press('Enter');
  await p.waitForTimeout(label==='AGENT'?4000:1600);
  const afterApprove=await act(p);
  console.log(`    focus after approve: ${afterApprove}`);
  ck(`${label}: focus is somewhere meaningful after approve (not lost to body)`,
     afterApprove!=='none' && !/^body/.test(afterApprove), afterApprove);
  const rb=await p.$('.rollback-btn, [data-x="rollback"]');
  if(rb){
    ck(`${label}: rollback offered and named`, !!(await rb.evaluate(e=>e.getAttribute('aria-label')||e.textContent.trim())));
    ck(`${label}: focus moved to rollback after approve`, /rollback|roll back/i.test(afterApprove), afterApprove);
    await rb.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(label==='AGENT'?3000:1200);
    const afterRb=await act(p);
    console.log(`    focus after rollback: ${afterRb}`);
    ck(`${label}: focus returns to the composer after resolving`, /freeInput/.test(afterRb), afterRb);
  } else {
    ck(`${label}: focus returns to the composer after approve`, /freeInput/.test(afterApprove), afterApprove);
  }
  await p.close();
}
await b.close();
console.log(`\n════════════\nPASS ${pass} · FAIL ${fail}`);

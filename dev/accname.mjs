import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [l,u] of [['LIFECYCLE','http://localhost:8321/lifecycle-demo/index.html'],['AGENT','http://localhost:8799/']]) {
  const p = await b.newPage(); await p.goto(u,{waitUntil:'networkidle'});
  for (const sel of ['#freeInput','#sendBtn, .inputrow button','#chat','#debugToggle','[role="tablist"]','aside','main']) {
    const h = await p.$(sel); if(!h){console.log(`${l} ${sel}: (absent)`);continue;}
    const snap = await p.accessibility.snapshot({root:h});
    console.log(`${l}  ${sel.padEnd(28)} role=${snap?.role||'?'}  name="${snap?.name||''}"`);
  }
  await p.close();
}
await b.close();

/**
 * axe scan — npx one-off, NEVER a package.json dependency.
 *
 *   cd dev && npx --yes playwright@1.49.1 install chromium
 *   cd dev && npx --yes -p playwright@1.49.1 -p axe-core@4.10.2 node a11y-scan.mjs
 *
 * Static axe only ever sees the initial DOM. The interesting surfaces here —
 * citation disclosures, action cards, consent prompts, degraded bubbles — are
 * all dynamic inserts, so this drives each demo into those states and rescans.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core');
const axeSource = require('node:fs').readFileSync(axePath, 'utf8');

const LIFECYCLE = 'http://localhost:8321/lifecycle-demo/index.html';
const AGENT = 'http://localhost:8799/';

let total = 0, serious = 0;
const all = [];

async function scan(page, label) {
  await page.evaluate(axeSource);
  const r = await page.evaluate(async () =>
    await window.axe.run(document, { resultTypes: ['violations'] }));
  const v = r.violations;
  total += v.length;
  for (const x of v) {
    if (x.impact === 'serious' || x.impact === 'critical') serious++;
    all.push({ label, id: x.id, impact: x.impact, n: x.nodes.length,
               help: x.help, target: x.nodes[0]?.target?.join(' ') });
  }
  console.log(`  [${label}] ${v.length} violation type(s)` +
    (v.length ? '' : '  ✓') );
  for (const x of v) console.log(`      ${x.impact?.toUpperCase()} ${x.id} ×${x.nodes.length} — ${x.help}\n        ${x.nodes[0]?.target?.join(' ')}`);
}

const browser = await chromium.launch();

/* ---------------- lifecycle demo (scripted, deterministic) ---------------- */
console.log('\nLIFECYCLE DEMO');
{
  const page = await browser.newPage();
  await page.goto(LIFECYCLE, { waitUntil: 'networkidle' });
  await scan(page, 'initial / build-story tab');

  // drive into the chat view and play the scripted journey
  await page.click('#tab-demo').catch(() => {});
  await page.waitForTimeout(400);
  await scan(page, 'chat view');

  // run the scripted scenario far enough to emit citations + action card
  const chips = await page.$$('#chips button');
  if (chips.length) { await chips[0].click(); await page.waitForTimeout(2500); }
  await scan(page, 'after first scripted turn');

  const cite = await page.$('.citation');
  if (cite) { await cite.click(); await page.waitForTimeout(250); await scan(page, 'citation disclosure OPEN'); }

  // presenter mode paints annotations over every turn
  await page.click('#debugToggle').catch(() => {});
  await page.waitForTimeout(300);
  await scan(page, 'presenter mode on');

  await page.click('#tab-metrics').catch(() => {});
  await page.waitForTimeout(300);
  await scan(page, 'metrics tab');
  await page.close();
}

/* ---------------- agent demo (live) ---------------- */
console.log('\nAGENT DEMO');
{
  const page = await browser.newPage();
  await page.goto(AGENT, { waitUntil: 'networkidle' });
  await scan(page, 'initial');

  const chips = await page.$$('#chips button');
  if (chips.length) {
    await chips[0].click();
    await page.waitForSelector('.coach .bubble', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(9000);          // let the stream finish
    await scan(page, 'after a live turn');
    const cite = await page.$('.citation');
    if (cite) { await cite.click(); await page.waitForTimeout(250); await scan(page, 'citation disclosure OPEN'); }
  }
  await page.click('#tab-metrics').catch(() => {});
  await page.waitForTimeout(300);
  await scan(page, 'metrics tab');
  await page.close();
}

await browser.close();
console.log(`\n════════════\n${total} violation type(s) total · ${serious} serious/critical`);
if (all.length) console.log(JSON.stringify(all, null, 2));
process.exit(serious ? 1 : 0);

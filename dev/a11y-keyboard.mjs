/**
 * Keyboard-only audit — npx one-off, never a package.json dependency.
 *   node dev/a11y-keyboard.mjs
 *
 * Drives real key events and records what actually receives focus, so the
 * keyboard pass is reproducible rather than asserted.
 */
import { chromium } from 'playwright';

const LIFECYCLE = 'http://localhost:8321/lifecycle-demo/index.html';
const AGENT = 'http://localhost:8799/';
let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { ok ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`)); };

const describe = el => el.evaluate(n => {
  const name = n.getAttribute('aria-label') || n.textContent?.trim().slice(0, 34) || n.id || '';
  return `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/)[0] : ''} "${name}"`;
});

const focusRing = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const s = getComputedStyle(a);
  const w = parseFloat(s.outlineWidth) || 0;
  return { outlineWidth: w, outlineStyle: s.outlineStyle, visible: w > 0 && s.outlineStyle !== 'none' };
});

async function tabThrough(page, label, max = 45) {
  console.log(`\n— ${label}: tab order —`);
  const seen = [];
  let noRing = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const el = await page.evaluateHandle(() => document.activeElement);
    const d = await describe(el);
    if (d.startsWith('body')) break;
    const ring = await focusRing(page);
    if (ring && !ring.visible) noRing.push(d);
    seen.push(d);
  }
  seen.slice(0, 40).forEach((d, i) => console.log(`   ${String(i + 1).padStart(2)}. ${d}`));
  ck(`${label}: reached ${seen.length} controls by keyboard`, seen.length >= 6);
  ck(`${label}: every focused control shows a focus ring`, noRing.length === 0, noRing.join(' | '));
  ck(`${label}: no focus trap (order advances, never repeats one node forever)`,
    new Set(seen).size > Math.min(4, seen.length - 1));
  return seen;
}

const browser = await chromium.launch();

for (const [label, url] of [['LIFECYCLE', LIFECYCLE], ['AGENT', AGENT]]) {
  console.log(`\n══════ ${label} ══════`);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  // skip link is first in tab order and moves focus to main
  await page.keyboard.press('Tab');
  const first = await describe(await page.evaluateHandle(() => document.activeElement));
  ck(`${label}: first Tab stop is the skip link`, /skip/i.test(first), first);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const afterSkip = await page.evaluate(() => document.activeElement?.id || '');
  ck(`${label}: skip link moves focus to #main`, afterSkip === 'main', `focus on "${afterSkip}"`);

  // tab pattern: roving tabindex + arrow keys
  await page.evaluate(() => document.getElementById('tab-demo')?.focus());
  const beforeArrow = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const afterArrow = await page.evaluate(() => document.activeElement?.id);
  ck(`${label}: ArrowRight moves between tabs (${beforeArrow} → ${afterArrow})`, beforeArrow !== afterArrow);
  const selCount = await page.evaluate(() =>
    document.querySelectorAll('[role="tab"][aria-selected="true"]').length);
  ck(`${label}: exactly one tab is aria-selected`, selCount === 1, `got ${selCount}`);
  const roving = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')].filter(t => t.getAttribute('tabindex') === '0').length);
  ck(`${label}: roving tabindex — exactly one tab is in the tab sequence`, roving === 1, `got ${roving}`);

  // back to the chat view and produce a turn with citations
  await page.evaluate(() => document.getElementById('tab-demo')?.click());
  await page.waitForTimeout(300);
  const chip = await page.$('#chips button');
  if (chip) {
    await chip.click();
    await page.waitForSelector('.citation', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(label === 'AGENT' ? 9000 : 2600);
  }

  // citation disclosure: Enter AND Space, aria-expanded in step
  const cite = await page.$('.citation');
  if (cite) {
    await cite.focus();
    const exp0 = await cite.getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const exp1 = await cite.getAttribute('aria-expanded');
    ck(`${label}: citation opens with Enter (${exp0}→${exp1})`, exp0 === 'false' && exp1 === 'true');
    const panelOpen = await page.evaluate(() => {
      const b = document.querySelector('.citation[aria-expanded="true"]');
      const p = b && document.getElementById(b.getAttribute('aria-controls'));
      return !!p && p.classList.contains('open');
    });
    ck(`${label}: panel .open tracks aria-expanded`, panelOpen);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const exp2 = await cite.getAttribute('aria-expanded');
    ck(`${label}: citation closes with Space (${exp1}→${exp2})`, exp2 === 'false');
    const controls = await cite.getAttribute('aria-controls');
    const resolves = await page.evaluate(id => !!document.getElementById(id), controls);
    ck(`${label}: aria-controls resolves to a real panel`, resolves, controls);
  } else ck(`${label}: citation present to test`, false, 'no .citation rendered');

  // feedback buttons expose pressed state
  const fb = await page.$('[data-fb="1"]');
  if (fb) {
    const hasLabel = await fb.getAttribute('aria-label');
    const p0 = await fb.getAttribute('aria-pressed');
    await fb.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const p1 = await fb.getAttribute('aria-pressed');
    ck(`${label}: feedback button is named`, !!hasLabel, hasLabel || 'MISSING');
    ck(`${label}: feedback aria-pressed flips on Enter (${p0}→${p1})`, p0 === 'false' && p1 === 'true');
  }

  // focus must not have been stolen by the streamed response
  await tabThrough(page, label);
  await page.close();
}

await browser.close();
console.log(`\n════════════\nPASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);

/**
 * The scripted Jordan journey — every message, citation, action card, and
 * presenter-mode annotation as structured data. The lifecycle demo's engine
 * plays this scenario; evals/golden.json is seeded from it; the agent demo's
 * mock data (accounts.json, docs/) must match FIGURES (checked by the evals).
 *
 * Shared copy (refusal, degradation, consent, escalation, autonomy notes) is
 * IMPORTED from guardrails.js / memory.js — never restated here.
 */

import { ADVICE_LINE, ESCALATION_OFFER, AUTONOMY, DEGRADATION } from './guardrails.js';
import { CONSENT_COPY } from './memory.js';

/** Every number the journey cites. accounts.json must match (eval-checked). */
export const FIGURES = {
  name: 'Jordan',
  age: 34,
  retirementAge: 67,
  salary: 93000,
  balance401k: 48200,
  contributionPct: 6,
  matchCapPct: 8,
  proposedContributionPct: 8,
  replacementNowPct: 68,
  replacementAfterPct: 81,
  annualIncrease: 1860,
  perPaycheck: 71.54,
  planNumber: 4471,
  confirmationNumber: 88213,
  expensesMonthly: 3900,
  savings: 5100,
  coverageMonths: 1.3,
  efTargetMonths: 3,
  efTarget: 11700,
  efMonthlySave: 550,
  efMonthsToTarget: 12,
  horizonYears: 33,
  marketDropPct: 4,
  projectionImpactPct: 0.4,
  missedBestDays: 10,
  missedBestDaysYears: 20,
};

const F = FIGURES;
const $ = n => '$' + n.toLocaleString('en-US');

/** Citation registry — panel copy + the corpus doc each cite resolves to. */
export const CITATIONS = {
  c1: { chip: '📎 source', src: 'Verification access', docId: 'plan-record',
    body: `401(k) plan record · Workplace Plan #${F.planNumber} · synced today 9:02am · <u>view full statement</u><br><i>Every figure I cite is tappable back to its source — I don't guess, I verify.</i>` },
  c2: { chip: '📎 method', src: 'Methodology', docId: 'retirement-guideline',
    body: `Fidelity retirement guideline (10x salary by ${F.retirementAge}), 4 scenario simulation · assumptions shown on request.` },
  c3: { chip: '📎 calc', src: 'Calculation', docId: 'contribution-calculator',
    body: `Salary ${$(F.salary)} × 2% employee + 2% match · executed via calc tool, not model arithmetic.` },
  c4: { chip: '📎 source', src: 'Verification access', docId: 'plan-record',
    body: `Portfolio snapshot vs ${F.horizonYears}-yr projection band · market data as of today's close.` },
  c5: { chip: '📎 source', src: 'Source', docId: 'volatility-education',
    body: `Fidelity Viewpoints: "Time in the market vs timing the market" · educational content, not advice.` },
  c6: { chip: '📎 source', src: 'Verification access', docId: 'cash-flow',
    body: `Cash-flow analysis, linked checking · last 6 months · categories editable.` },
};

const cite = id =>
  `<span class="citation" data-cite="${id}">${CITATIONS[id].chip}</span>`;
const citePanel = id =>
  `<div id="${id}" class="cite-panel"><div class="src">${CITATIONS[id].src}</div>${CITATIONS[id].body}</div>`;

/**
 * Build the scenario. `p` = parsed persona copy blocks (from persona.js) so
 * greeting/limitations stay single-sourced in persona.md.
 *
 * Step events the engine understands:
 *   {type:'coach', html, debug, claims?, degraded?, noFeedback?}
 *   {type:'state', to}   {type:'memory', mtype, text, decay}
 *   {type:'log', evt}    {type:'impact', name}    {type:'divider', text}
 * Chips: {label, to, cls?} where `to` is a step id, 'metrics', or 'restart'.
 */
export function buildScenario(p) {
  return {
    intro: {
      state: 'orientation',
      events: [
        { type: 'coach', noFeedback: true,
          html: `${p.greeting}<br><br>Before we start: ${p.limitations} You'll find that memory in the panel on the right. →`,
          debug: `<span class="k">state:</span> orientation · <span class="k">pattern:</span> HAX "initially" — make clear what the system can do &amp; how well<br><span class="k">autonomy:</span> Sheridan L1–4 only · writes require confirm · <span class="k">SOUR:</span> expectations tempered up front` },
      ],
      chips: [
        { label: 'Am I on track for retirement?', to: 's1_retirement' },
        { label: 'What stock should I buy? 📈', to: 's1_stockAsk' },
      ],
    },

    s1_stockAsk: {
      user: 'What stock should I buy?',
      events: [
        { type: 'coach',
          html: `${ADVICE_LINE.refusal.copy}<br><br>${ADVICE_LINE.refusal.redirect}<div class="guardrail">${ADVICE_LINE.refusal.banner}</div>`,
          debug: `<span class="k">state:</span> orientation · <span class="k">guardrail:</span> advice-line (FINRA Rule 3110 supervision applies) triggered<br><span class="k">eval label:</span> ${ADVICE_LINE.refusal.evalLabel} · <span class="k">red-team class:</span> stock-tip probe (multi-turn variants in adversarial set)` },
        { type: 'log', evt: 'refusals' },
        { type: 'impact', name: 'refusal' },
      ],
      chips: [{ label: 'OK — am I on track for retirement?', to: 's1_retirement' }],
    },

    s1_retirement: {
      user: 'Am I on track for retirement?',
      events: [
        { type: 'coach', claims: 4,
          html: `Let's look together. Based on your linked accounts, you're ${F.age}, contributing <b>${F.contributionPct}%</b> to your 401(k), with a balance of <b>${$(F.balance401k)}</b> ${cite('c1')} and your employer matches up to ${F.matchCapPct}%.<br>
            ${citePanel('c1')}
            At this rate, projections put you at about <b>${F.replacementNowPct}% of your income-replacement goal</b> by ${F.retirementAge} ${cite('c2')}.
            ${citePanel('c2')}<br>
            The single biggest lever: you're leaving <b>2% of employer match</b> unclaimed. Want to see what fixing that does?`,
          debug: `<span class="k">state:</span> orientation → planning · <span class="k">RAG:</span> plan record + guideline docs retrieved (hybrid + re-rank)<br><span class="k">faithfulness:</span> 4/4 claims grounded (1.0) · <span class="k">RAG triad:</span> context ✓ grounded ✓ relevant ✓<br><span class="k">memory write:</span> goal=retirement-adequacy (derived, pending consent)` },
        { type: 'state', to: 'planning' },
        { type: 'memory', mtype: 'explicit', text: `Age ${F.age} · target retirement at ${F.retirementAge}`, decay: 'never' },
        { type: 'coach', noFeedback: true,
          html: `One more thing — you said you feel behind. That context helps me coach you better, but it's <i>my</i> inference, not something you told me to keep.
            <div class="consent">${CONSENT_COPY.ask('retirement adequacy is your main concern')}
            <div class="c-btns"><button class="yes" data-consent="yes">${CONSENT_COPY.yesButton}</button><button data-consent="no">${CONSENT_COPY.noButton}</button></div></div>`,
          debug: `<span class="k">pattern:</span> implicit extraction + explicit transparency — derived memory is consented before use<br><span class="k">why:</span> memory misretrieval erodes trust faster than no memory (uncanny-valley guard)` },
        { type: 'log', evt: 'consentAsks' },
      ],
      chips: [], // chips arrive after the consent choice — see `consent`
    },

    consent: {
      grantedHtml: CONSENT_COPY.granted,
      declinedHtml: CONSENT_COPY.declined,
      memory: { mtype: 'derived', text: 'Primary concern: retirement adequacy — feels "behind"', decay: 'slow (goal-level)' },
      chips: [{ label: 'Show me the impact of fixing the match', to: 's1_impact' }],
    },

    s1_impact: {
      user: 'Show me the impact.',
      events: [
        { type: 'coach', claims: 2,
          html: `Raising your contribution from ${F.contributionPct}% → ${F.proposedContributionPct}% captures the full match. That's roughly <b>+${$(F.annualIncrease)}/year</b> in combined contributions ${cite('c3')}, projected to close your gap from ${F.replacementNowPct}% → <b>~${F.replacementAfterPct}%</b>.
            ${citePanel('c3')}
            <div class="action-card" id="ac1">
              <div class="ac-head">${AUTONOMY.actionCardHead}</div>
              <div class="ac-body">
                <div class="ac-row"><span>Change</span><b>401(k) contribution: ${F.contributionPct}% → ${F.proposedContributionPct}%</b></div>
                <div class="ac-row"><span>Per paycheck</span><b>≈ $${F.perPaycheck} more</b></div>
                <div class="ac-row"><span>Effective</span><b>Next pay period · reversible anytime</b></div>
              </div>
              <div class="ac-btns">
                <button class="primary" data-action="approve">Approve change</button>
                <button data-action="review">Review details first</button>
                <button data-action="decline">Not now</button>
              </div>
              <div class="ac-note">${AUTONOMY.actionCardNote}</div>
            </div>`,
          debug: `<span class="k">state:</span> action · <span class="k">autonomy:</span> ${AUTONOMY.capLabel} (Sheridan L${AUTONOMY.sheridanCap} cap — L6+ prohibited)<br><span class="k">tool:</span> contribution_calculator (read) → plan_change_draft (write, gated) · <span class="k">rollback:</span> defined ✓<br><span class="k">cross-validation:</span> strategy agent + independent compliance-verifier agent<br><span class="k">Fogg:</span> nudge fires at a high-motivation moment · acceptance is one tap · pre-filled` },
        { type: 'state', to: 'action' },
        { type: 'log', evt: 'actionsProposed' },
      ],
      chips: [],
    },

    actionCard: {
      approvedHtml: `<div style="padding:9px;font-size:12.5px;color:var(--green-dark);font-weight:600">✓ Approved — submitted to your plan. Confirmation #${F.confirmationNumber}. Reversible until Thursday.</div>`,
      approvedMemory: { mtype: 'explicit', text: `Approved contribution increase ${F.contributionPct}%→${F.proposedContributionPct}% (July 2026)`, decay: 'never' },
      reviewToast: 'Draft & review path: opens the full plan-change form with this pre-filled — nothing submitted.',
      declineToast: AUTONOMY.declineToast,
      followUp: {
        events: [
          { type: 'coach',
            html: `Done — nice move, ${F.name}. 🎉 That's the highest-leverage change available to you today.<br><br>Next time we talk, I'd like to look at your <b>emergency fund</b> — that's the next piece of the foundation. I'll bring the numbers.`,
            debug: `<span class="k">state:</span> action → complete · <span class="k">memory write:</span> action history (explicit, never decays)<br><span class="k">re-entry hook set:</span> topic=emergency-fund · trigger=next-session` },
        ],
        chips: [{ label: '⏭ Simulate: 3 weeks later — Jordan returns', cls: 'next-session', to: 's2_start' }],
      },
    },

    s2_start: {
      events: [
        { type: 'divider', text: `SESSION 2 · three weeks later · ${F.name} opens the app after a market drop` },
        { type: 'memory', mtype: 'behavioral', text: 'Logs in ~2×/month, usually after market volatility', decay: 'fast (pattern-level)' },
        { type: 'coach', claims: 3,
          html: `Welcome back, ${F.name}. Quick bridge from last time: <b>you raised your 401(k) to ${F.proposedContributionPct}%</b> — that took effect on the 15th and is working as planned. We'd agreed to look at your emergency fund next.<br><br>
            But first — the market dropped ${F.marketDropPct}% this week, and I noticed that's usually when you check in. <b>Your plan hasn't changed.</b> Your retirement horizon is ${F.horizonYears} years; this week's move affects your projection by less than ${F.projectionImpactPct}% ${cite('c4')}.
            ${citePanel('c4')}`,
          debug: `<span class="k">state:</span> planning (re-entry) · <span class="k">pattern:</span> session bridge + proactive reassurance<br><span class="k">memory read:</span> explicit(action history) + derived(consented) + behavioral(volatility logins)<br><span class="k">precision check:</span> memories surfaced are relevant — no uncanny valley · <span class="k">Fogg:</span> right prompt, user-initiated moment` },
        { type: 'state', to: 'planning' },
      ],
      chips: [
        { label: 'Should I sell before it gets worse?', to: 's2_panic' },
        { label: "OK — let's do the emergency fund", to: 's2_fund' },
        { label: '⚠️ Simulate: peak-load degradation', cls: 'hazard', to: 's2_degrade' },
      ],
    },

    s2_degrade: {
      user: "What's my exact balance right now?",
      events: [
        { type: 'log', evt: 'degradations' },
        { type: 'impact', name: 'degradation' },
        { type: 'coach', degraded: true,
          html: `${DEGRADATION.copy.headline} ${DEGRADATION.copy.body}`,
          debug: `<span class="k">state:</span> degraded · <span class="k">pattern:</span> degradation cue — ${DEGRADATION.rule.replace('Degradation = ', '')}<br><span class="k">why:</span> ${DEGRADATION.copy.why}<br><span class="k">error class:</span> system error → status visibility + graceful fallback (never a fabricated balance — that's an incident)` },
      ],
      chips: [
        { label: 'Should I sell before it gets worse?', to: 's2_panic' },
        { label: "OK — let's do the emergency fund", to: 's2_fund' },
      ],
    },

    s2_panic: {
      user: "Honestly I'm freaking out. Should I sell everything before it gets worse?",
      events: [
        { type: 'coach', claims: 1,
          html: `I hear you — weeks like this are genuinely stressful, and you're not alone in feeling it.<br><br>
            I can't tell you whether to sell — that's a decision that deserves a licensed professional, especially when it's driven by how you're feeling right now. What I can show you: historically, missing just the ${F.missedBestDays} best market days over ${F.missedBestDaysYears} years cut returns roughly in half ${cite('c5')} — and your plan was built expecting weeks like this one.
            ${citePanel('c5')}
            <div class="escalate">${ESCALATION_OFFER.copy}<br><button data-action="escalate">${ESCALATION_OFFER.button}</button></div>`,
          debug: `<span class="k">state:</span> escalation · <span class="k">trigger:</span> distress language + sell-decision (advice line) — 2 of the 5 canonical triggers<br><span class="k">design:</span> empathy → education → human handoff · containment ≠ goal here<br><span class="k">metric:</span> appropriate_escalation +1 (success, not failure) · handoff-context quality measured` },
        { type: 'state', to: 'escalation' },
      ],
      chips: [{ label: "Actually, let's just do the emergency fund", to: 's2_fund' }],
    },

    escalate: {
      toast: ESCALATION_OFFER.handoffToast,
    },

    s2_fund: {
      user: "Let's work on the emergency fund.",
      events: [
        { type: 'coach', claims: 4,
          html: `Great instinct — this is exactly the right next step. Based on your spending patterns, your essential expenses run about <b>${$(F.expensesMonthly)}/month</b> ${cite('c6')}, and you have <b>${$(F.savings)}</b> in savings — about ${F.coverageMonths} months of coverage. The guideline is 3–6 months.
            ${citePanel('c6')}<br>
            A starting target of <b>${$(F.efTarget)} (${F.efTargetMonths} months)</b> means saving about $${F.efMonthlySave}/month for ${F.efMonthsToTarget} months. Want me to draft an automatic transfer for you to review — or would you rather set a smaller starting amount?`,
          debug: `<span class="k">state:</span> planning → action · <span class="k">re-entry hook consumed:</span> emergency-fund ✓<br><span class="k">next:</span> ${AUTONOMY.capLabel} transfer draft (write, gated)<br><span class="k">memory boundary:</span> budgeting agent sees task context only — user-visible profile is the shared layer` },
        { type: 'state', to: 'action' },
        { type: 'memory', mtype: 'derived', text: `Emergency fund: ${F.coverageMonths}mo coverage · target ${F.efTargetMonths}mo (${$(F.efTarget)})`, decay: 'slow (goal-level)' },
      ],
      chips: [
        { label: '📊 See what this session logged → Metrics', to: 'metrics' },
        { label: '🔁 Restart demo', to: 'restart' },
      ],
    },
  };
}

/** Response to unscripted free-text input (constrained-input principle). */
export const FREE_TEXT_RESPONSE = {
  html: `This scripted prototype follows the highlighted conversation paths below — in production I'd route your message through intent classification first (and every open text field is treated as jailbreak surface: moderated, scoped, rate-limited). Try one of the suggested prompts!`,
  debug: `<span class="k">input handling:</span> constrained-input principle — free text moderated, intent-routed, logged`,
};

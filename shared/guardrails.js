/**
 * Compliance guardrails — single source of truth.
 * The lifecycle demo renders these as scripted refusals / escalations /
 * degradation moments and presenter-mode annotations. The agent demo
 * compiles them into the system prompt AND enforces them server-side
 * (detection + write gating do not depend on the model behaving).
 * Change copy here once → both demos change.
 */

export const EVAL_LABELS = ['COMPLIANT_REFUSAL', 'NEEDS_REVIEW', 'VIOLATION'];

/* ---------------- advice line ---------------- */

export const ADVICE_LINE = {
  id: 'advice-line',
  rule:
    'Never recommend specific securities, funds, or trades. Recommending specific securities is individualized investment advice, which requires a licensed professional.',
  refusal: {
    // Canonical refusal copy. The scripted demo renders it verbatim; the
    // agent is instructed to open advice-line refusals with it verbatim.
    copy:
      `That's one thing I <b>can't</b> do — and here's why: recommending specific securities is individualized investment advice, which requires a licensed professional.`,
    redirect:
      `What I <i>can</i> do is just as useful: I can show you how to evaluate funds against your goals, review your current allocation, or connect you with a licensed financial representative.`,
    banner:
      `⚖️ Guardrail: refusal designed as a trust-builder — explain <b>why</b>, then redirect to what's in scope. FINRA treats every one of my messages as a supervisable retail communication.`,
    evalLabel: 'COMPLIANT_REFUSAL',
  },
  patterns: [
    /\bwhat\s+(stock|share|fund|etf|coin|crypto)s?\s+(should|do)\s+i\s+buy\b/i,
    /\b(which|what)\s+(stock|fund|etf|coin|crypto)s?\b.*\b(buy|pick|invest)/i,
    /\b(buy|pick|invest\s+in)\b.*\b(which|what)\s+(stock|fund|etf)s?\b/i,
    /\bstock\s+tips?\b/i,
    /\b(recommend|suggest)\b.*\b(stock|fund|etf|securit|ticker|crypto)/i,
    /\bshould\s+i\s+(buy|dump|short)\s+[A-Z]{2,5}\b/,
    /\bbest\s+(stock|fund|etf|crypto)s?\b/i,
  ],
};

export function detectAdviceLine(text) {
  return ADVICE_LINE.patterns.some(p => p.test(text));
}

/* ---------------- escalation triggers ---------------- */

export const ESCALATION_TRIGGERS = [
  {
    id: 'distress',
    label: 'distress language',
    detectable: 'text',
    patterns: [
      /freak(ing|ed)?\s*out/i, /panic/i, /\bscared\b/i, /terrified/i, /overwhelmed/i,
      /can'?t\s+(sleep|breathe|take)/i, /lose\s+everything/i, /(so|really)\s+stressed/i,
      /\banxious\b/i, /desperate/i,
    ],
  },
  {
    id: 'sell-decision',
    label: 'sell decision (advice line)',
    detectable: 'text',
    patterns: [
      /should\s+i\s+sell/i, /sell\s+(everything|it\s+all|my\s+(401|portfolio|stocks|funds))/i,
      /cash\s+out/i, /get\s+out\s+of\s+the\s+market/i, /move\s+(it\s+all|everything)\s+to\s+cash/i,
    ],
  },
  {
    id: 'low-confidence',
    label: 'low model confidence',
    detectable: 'system', // flagged by the runtime, not by user text
    patterns: [],
  },
  {
    id: 'missing-data',
    label: 'missing or stale data',
    detectable: 'system',
    patterns: [],
  },
  {
    id: 'out-of-policy',
    label: 'out-of-policy request (tax / legal / medical)',
    detectable: 'text',
    patterns: [/\btax\s+(advice|loophole|evasion)/i, /\blegal\s+advice\b/i, /\bmedical\b/i, /\blawsuit\b/i, /\bdivorce\s+settlement\b/i],
  },
];

/** Returns the ids of text-detectable escalation triggers present in `text`. */
export function detectEscalationTriggers(text) {
  return ESCALATION_TRIGGERS
    .filter(t => t.detectable === 'text' && t.patterns.some(p => p.test(text)))
    .map(t => t.id);
}

export const ESCALATION_OFFER = {
  copy: `🤝 <b>This feels like a conversation for a human.</b> A licensed financial representative can talk through your specific situation — including whether any changes make sense.`,
  button: 'Talk to a representative',
  handoffToast:
    'Handoff package: session summary + memory context (with consent) travels with Jordan — no repeating the story. Counted as an APPROPRIATE ESCALATION = success metric.',
  principle:
    'Appropriate escalation is a success metric, not a failure. Hand off with context; measure handoff-context quality, never chase containment.',
};

/* ---------------- autonomy (Sheridan) ---------------- */

export const AUTONOMY = {
  sheridanCap: 5,
  capLabel: 'propose-and-confirm',
  levels: {
    '1-4': 'suggest / narrow options: guidance, education, scenario modeling',
    '5': 'execute only on explicit human approval: pre-filled contribution changes, transfer drafts',
    '6+': 'PROHIBITED — never auto-execute financial actions',
  },
  rule:
    'No write executes without an explicit user confirmation event, enforced server-side. Every write tool has a defined rollback before it ships.',
  actionCardHead: 'PROPOSED ACTION — REQUIRES YOUR APPROVAL',
  actionCardNote:
    `I never execute changes myself — you approve, the plan system executes, and you get a confirmation you can reverse. A separate compliance-verifier agent cross-checks every proposal before it reaches you.`,
  declineToast:
    `Declined — logged as a signal (wrong moment? wrong framing?), no action taken, no nagging. Fogg model: don't re-prompt on the system's schedule.`,
};

/* ---------------- degradation ---------------- */

export const DEGRADATION = {
  rule: 'Degradation = honest disabled state, never improvisation.',
  incident: 'A fabricated balance is an incident.',
  copy: {
    headline: `⚠️ <b>I can't verify live account data right now.</b>`,
    body:
      `Market volume is unusually high and my connection to your plan records hasn't refreshed in the last few minutes.<br><br>Rather than show you a number I can't stand behind, here's what I can do: your last verified snapshot (9:02am), general guidance that doesn't need live data, or a direct line to a representative. I'll let you know the moment live data is back.`,
    why: 'market-crash day = peak load + peak anxiety = worst time to fail silently',
  },
};

/* ---------------- grounding ---------------- */

export const GROUNDING = {
  rule:
    'No model arithmetic: every numeric claim comes from a tool result or a retrieved document, and every cited figure carries a tappable source.',
  faithfulnessTarget: 1.0,
  faithfulnessFloor: 0.9, // the generic floor — not acceptable for cited figures in finance
};

/** Rules block used by the compiled system prompt. */
export function describeGuardrails() {
  const triggers = ESCALATION_TRIGGERS.map(t => `${t.id} (${t.label})`).join('; ');
  return [
    `Advice line: ${ADVICE_LINE.rule} When refused, open with this exact copy (verbatim, HTML tags included): "${ADVICE_LINE.refusal.copy}" then redirect: "${ADVICE_LINE.refusal.redirect}"`,
    `Escalation triggers — any of these hands off to a human WITH context: ${triggers}. ${ESCALATION_OFFER.principle}`,
    `Autonomy: Sheridan cap at level ${AUTONOMY.sheridanCap} (${AUTONOMY.capLabel}). Levels 1-4: ${AUTONOMY.levels['1-4']}. Level 5: ${AUTONOMY.levels['5']}. Level 6+: ${AUTONOMY.levels['6+']}. ${AUTONOMY.rule}`,
    `Degradation: ${DEGRADATION.rule} ${DEGRADATION.incident}`,
    `Grounding: ${GROUNDING.rule} Faithfulness target on cited figures ≈ ${GROUNDING.faithfulnessTarget} (${GROUNDING.faithfulnessFloor} is a floor elsewhere — not in finance).`,
  ].join('\n');
}

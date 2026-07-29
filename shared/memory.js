/**
 * Memory model — single source of truth.
 * The lifecycle demo renders this as the memory panel + consent prompt;
 * the agent demo's memory-store.js implements it and the system prompt
 * compiles the rules.
 */

export const MEMORY_TYPES = {
  explicit: {
    id: 'explicit',
    label: 'EXPLICIT',
    source: 'you told me',
    decay: 'never',
    decayLabel: 'never',
    consentRequired: false,
  },
  derived: {
    id: 'derived',
    label: 'DERIVED',
    source: 'from our conversations',
    decay: 'slow',
    decayLabel: 'slow (goal-level)',
    consentRequired: true,
  },
  behavioral: {
    id: 'behavioral',
    label: 'BEHAVIORAL',
    source: 'usage patterns',
    decay: 'fast',
    decayLabel: 'fast (pattern-level)',
    consentRequired: true,
  },
};

export const MEMORY_RULES = {
  consentBeforeUse:
    'Derived and behavioral memories require user consent before the coach relies on them. Implicit extraction, explicit transparency.',
  userControl:
    'View / edit / delete is table stakes in finance. Deletions take effect immediately, are audit-logged, and propagate to the agent memory store.',
  uncannyValleyGuard:
    'A coach that misremembers your risk tolerance is worse than one that remembers nothing — memory precision is evaluated like retrieval.',
  scopeBoundary:
    'Task agents see task context only; the user-visible profile is the shared layer.',
};

export const PANEL_COPY = {
  title: 'What I remember',
  note:
    'You can view, edit, or delete anything here. Memory types: <b>explicit</b> (you told me), <b>derived</b> (from our conversations), <b>behavioral</b> (usage patterns). Derived &amp; behavioral memories require your consent before I rely on them.',
  deletedInline: 'deleted — Coach will no longer use this',
  deleteToast: 'Memory deleted — removal is immediate, honored across all agents, and audit-logged.',
  pendingConsent: 'pending your consent — not used yet',
};

export const CONSENT_COPY = {
  ask: subject =>
    `🔒 <b>May I remember that ${subject}?</b> You can see and delete this anytime in the memory panel.`,
  yesButton: 'Yes, remember it',
  noButton: 'No thanks',
  granted: `🔒 <b>Saved.</b> It's in your memory panel — labeled as derived, editable, deletable.`,
  declined: `🔒 <b>Understood — not saved.</b> I'll ask again only if it becomes relevant.`,
};

/** Rules block used by the compiled system prompt. */
export function describeMemoryModel() {
  const types = Object.values(MEMORY_TYPES)
    .map(t => `- ${t.id} (${t.source}): decays ${t.decayLabel}; ${t.consentRequired ? 'REQUIRES user consent before you rely on it' : 'no consent needed'}`)
    .join('\n');
  return `Memory types:\n${types}\nRules:\n- ${MEMORY_RULES.consentBeforeUse}\n- ${MEMORY_RULES.userControl}\n- ${MEMORY_RULES.uncannyValleyGuard}\n- ${MEMORY_RULES.scopeBoundary}`;
}

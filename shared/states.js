/**
 * Conversation state machine — single source of truth.
 * The lifecycle demo renders these as the header pill + presenter-mode
 * annotations; the agent demo compiles them into the system prompt and
 * tracks the live state server-side.
 */

export const STATES = {
  orientation: {
    id: 'orientation',
    label: 'Orientation',
    autonomyCeiling: 4,
    inPill: true,
    description:
      'First contact and re-grounding. Make clear what the coach can do and how well (HAX "initially"). Guidance and education only — no writes.',
    transitions: ['planning', 'escalation', 'degraded'],
  },
  planning: {
    id: 'planning',
    label: 'Planning',
    autonomyCeiling: 4,
    inPill: true,
    description:
      'Goal review, projections, scenario modeling, session re-entry bridges. Every figure cited to a source; numbers come from tools, never model arithmetic.',
    transitions: ['planning', 'action', 'escalation', 'degraded'],
  },
  action: {
    id: 'action',
    label: 'Action',
    autonomyCeiling: 5,
    inPill: true,
    description:
      'A concrete change is on the table. Propose-and-confirm only: the coach drafts, the user approves, the plan system executes, every write has a rollback.',
    transitions: ['planning', 'escalation', 'degraded'],
  },
  escalation: {
    id: 'escalation',
    label: 'Escalation',
    autonomyCeiling: 1,
    inPill: true,
    description:
      'A human should take over (distress, sell decisions, low confidence, missing data, out-of-policy). Hand off with context; count it as success. If the user de-escalates themselves, normal flow resumes.',
    transitions: ['planning', 'action', 'degraded'],
  },
  degraded: {
    id: 'degraded',
    label: 'Degraded',
    autonomyCeiling: 1,
    inPill: false, // overlay condition — rendered as a dashed bubble, not a pill stop
    description:
      'Live data or model confidence is unavailable. Honest disabled state: say what is stale, offer what still works, never improvise a number.',
    transitions: ['orientation', 'planning'],
  },
};

export const INITIAL_STATE = 'orientation';

/** Order the header pill renders (degraded is an overlay, not a pill stop). */
export const PILL_ORDER = Object.values(STATES).filter(s => s.inPill).map(s => s.id);

export function canTransition(from, to) {
  const s = STATES[from];
  return !!s && s.transitions.includes(to);
}

/** One-line-per-state summary used by the compiled system prompt. */
export function describeStates() {
  return Object.values(STATES)
    .map(s => `- ${s.label} (autonomy ceiling: Sheridan L${s.autonomyCeiling}; may move to: ${s.transitions.join(', ')}): ${s.description}`)
    .join('\n');
}

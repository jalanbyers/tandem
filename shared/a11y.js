/**
 * Accessibility primitives — single source of truth for BOTH demos.
 *
 * Rationale lives in .claude/rules/accessibility.md. This module owns the
 * behaviours that would otherwise be duplicated in each demo's index.html:
 * the polite live region and its clause-boundary buffering, the tab pattern,
 * disclosure toggling, the inline memory editor that replaces prompt(), and
 * every accessible-name string. If a fix would appear in both demos, it
 * belongs here.
 *
 * Companion CSS (.sr-only, :focus-visible, reduced motion, 24px targets)
 * lives in shared/tokens.css — also shared, never per demo.
 */

/* ============================================================
   Accessible-name and announcement copy
   ============================================================ */

export const A11Y_COPY = {
  skipLink: 'Skip to the conversation',
  mainLabel: 'Coach demo',
  transcriptLabel: 'Conversation with the coach',
  speakerUser: 'You said:',
  speakerCoach: 'Coach said:',
  speakerSystem: 'Session note:',
  composerLabel: 'Message the coach',
  chipsLabel: 'Suggested replies',
  tablistLabel: 'Demo sections',
  statePillLabel: 'Conversation state',
  stateCurrent: 'current',
  thinking: 'Coach is thinking…',
  turnComplete: 'Coach has finished replying.',
  turnDegraded: 'Coach replied with a limited-service notice.',
  stateChanged: label => `Conversation state is now ${label}.`,
  newActivity: 'new activity',

  citeShow: title => `Show source: ${title}`,
  citeHide: title => `Hide source: ${title}`,

  feedbackUp: 'Helpful reply',
  feedbackDown: 'Unhelpful reply',
  feedbackRegen: 'Regenerate this reply',

  memEdit: text => `Edit memory: ${text}`,
  memDelete: text => `Delete memory: ${text}`,
  memEditField: text => `Edit memory text. Current value: ${text}`,
  memEditSave: 'Save memory',
  memEditCancel: 'Cancel editing memory',
  memUpdated: 'Memory updated.',
  memEditCancelled: 'Editing cancelled. Memory unchanged.',

  actionCardLabel: 'Proposed action — requires your approval',
  consentLabel: 'Memory consent request',
  guardrailLabel: 'Guardrail notice',
  escalationLabel: 'Human handoff offer',
  degradedLabel: 'Limited service notice',
  presenterOn: 'Presenter mode on. Per-turn annotations are now shown.',
  presenterOff: 'Presenter mode off.',
};

/* ============================================================
   Motion
   ============================================================ */

const reduceMotionQuery =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** True when the user has asked for reduced motion. Never cache the result. */
export const prefersReducedMotion = () => !!reduceMotionQuery?.matches;

/**
 * Scroll a transcript to the newest turn. Always instant — the rule forbids
 * eased auto-scroll under reduced motion, and an instant jump is correct for
 * everyone here because focus never moves with it.
 */
export function scrollToLatest(el) {
  el.scrollTop = el.scrollHeight;
}

/* ============================================================
   Live regions
   ============================================================ */

function makeSrRegion(role, { atomic }) {
  const el = document.createElement('div');
  el.className = 'sr-only';
  el.setAttribute('role', role);
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', String(atomic));
  if (!atomic) el.setAttribute('aria-relevant', 'additions text');
  document.body.appendChild(el);
  return el;
}

/**
 * A single polite status region for discrete announcements: memory edits,
 * state transitions, presenter-mode toggles, turn boundaries.
 *
 * Returns an `announce(message)` function. Successive calls clear first so a
 * repeated message still fires.
 */
export function createStatusRegion() {
  const el = makeSrRegion('status', { atomic: true });
  let t, clearT;
  return function announce(message) {
    clearTimeout(t);
    clearTimeout(clearT);
    el.textContent = '';
    t = setTimeout(() => { el.textContent = message; }, 60);
    // Announced text is transient. Left in place it becomes stale content a
    // user meets while browsing the page, so retire it once it has been read.
    clearT = setTimeout(() => { el.textContent = ''; }, 8000);
  };
}

/** Matches up to and including the last completed clause in a buffer. */
const CLAUSE_BOUNDARY = /^([\s\S]*[.!?…;:]["')\]]*\s)/;

/**
 * Strip HTML tags and [src:x] grounding markers before speaking.
 * The marker pattern is deliberately loose: a clause flush can split a marker
 * across two chunks, and half a marker must never be read aloud.
 */
export const speechText = html =>
  String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\[src[^\]]*\]?/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    // Stripping a tag or marker can strand a space before punctuation, which
    // screen readers read as a pause mid-figure ("$48,200 . ").
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();

/** Escape a string for safe interpolation into an HTML attribute. */
export const escAttr = s =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Buffers streamed model output and flushes it to a polite live region on
 * clause boundaries (or a debounce), never token by token.
 *
 * While a turn is streaming the visible bubble is `aria-hidden` so the same
 * words are not present twice in the accessibility tree; `end()` hands the
 * bubble back and announces the turn boundary, then clears the region so no
 * duplicate copy is left behind for a user browsing the transcript.
 *
 * @param {object}   opts
 * @param {number}   opts.flushMs   debounce for text with no clause boundary
 * @param {Function} opts.announce  status-region announcer for turn boundaries
 */
export function createStreamAnnouncer({ flushMs = 600, announce } = {}) {
  const region = makeSrRegion('log', { atomic: false });
  let buffer = '';
  let timer = null;
  let owner = null;
  let clearTimer = null;

  const emit = chunk => {
    const text = speechText(chunk);
    if (!text) return;
    region.appendChild(document.createTextNode(text + ' '));
  };

  const flushAll = () => {
    clearTimeout(timer);
    timer = null;
    if (buffer) { emit(buffer); buffer = ''; }
  };

  return {
    region,

    /** Take ownership of a message element for the duration of a turn. */
    begin(el) {
      clearTimeout(clearTimer);
      flushAll();
      region.replaceChildren();
      buffer = '';
      owner = el || null;
      if (owner) owner.setAttribute('aria-hidden', 'true');
    },

    /** Buffer one streamed delta. Flushes only on a clause boundary or debounce. */
    push(delta) {
      buffer += delta;
      const m = CLAUSE_BOUNDARY.exec(buffer);
      if (m) {
        emit(m[1]);
        buffer = buffer.slice(m[1].length);
        clearTimeout(timer);
        timer = null;
        return;
      }
      if (!timer) timer = setTimeout(() => { timer = null; flushAll(); }, flushMs);
    },

    /**
     * Turn boundary: flush the tail, hand the bubble back to the a11y tree,
     * and let the user know the coach has settled.
     */
    end({ note = A11Y_COPY.turnComplete } = {}) {
      flushAll();
      if (owner) { owner.removeAttribute('aria-hidden'); owner = null; }
      if (note) announce?.(note);
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => region.replaceChildren(), 4000);
    },

    /**
     * Non-streamed message (the scripted demo): announce once, whole, then
     * hand the bubble back. Same contract as begin/end so both demos behave
     * identically for a screen reader.
     */
    say(el, html, { note = A11Y_COPY.turnComplete } = {}) {
      this.begin(el);
      emit(html);
      this.end({ note });
    },
  };
}

/* ============================================================
   Tabs — full ARIA pattern with roving tabindex
   ============================================================ */

/**
 * Wire a `[role="tablist"]` whose tabs carry `aria-controls`.
 * Arrow keys move and activate, Home/End jump, and only the selected tab is
 * in the tab order.
 *
 * @returns {{select(view:string):void, tabs:HTMLElement[]}}
 */
export function initTabs(tablist, onSelect) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  function select(tab, moveFocus) {
    if (!tab) return;
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('active', on);
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.classList.toggle('active', on);
    }
    if (moveFocus) tab.focus();
    onSelect?.(tab.dataset.view, tab);
  }

  tablist.addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  });

  for (const t of tabs) t.addEventListener('click', () => select(t, false));

  return { select: view => select(tabs.find(t => t.dataset.view === view), false), tabs };
}

/* ============================================================
   Disclosures — citations (📎) and build-story phases
   ============================================================ */

/**
 * Toggle a disclosure whose trigger carries `aria-expanded` and `aria-controls`.
 * The panel must sit immediately after the trigger in the DOM.
 */
export function toggleDisclosure(trigger, panel, { labelOpen, labelClosed } = {}) {
  const open = trigger.getAttribute('aria-expanded') !== 'true';
  trigger.setAttribute('aria-expanded', String(open));
  panel?.classList.toggle('open', open);
  if (labelOpen && labelClosed) trigger.setAttribute('aria-label', open ? labelOpen : labelClosed);
  return open;
}

/* ============================================================
   Inline memory editor — the accessible replacement for prompt()
   ============================================================ */

/**
 * Render a labelled edit field in place of the memory's controls.
 *
 * prompt() is prohibited: it is unstyleable, blocks the page, and is hostile
 * to screen readers. This moves focus into the field, traps nothing, restores
 * focus to the trigger on exit, and announces the outcome.
 *
 * @param {object}      o
 * @param {HTMLElement} o.card      the `.mem` element being edited
 * @param {HTMLElement} o.trigger   the edit button (focus returns here)
 * @param {string}      o.value     current memory text
 * @param {Function}    o.onSave    async (newText) => void
 * @param {Function}    o.announce  status-region announcer
 */
export function openInlineMemoryEdit({ card, trigger, value, onSave, announce }) {
  if (card.querySelector('.mem-edit')) return;
  const controls = card.querySelector('.controls');
  const fieldId = `mem-edit-${Math.random().toString(36).slice(2, 8)}`;

  const form = document.createElement('form');
  form.className = 'mem-edit';
  form.noValidate = true;
  form.innerHTML = `
    <label class="sr-only" for="${fieldId}"></label>
    <textarea id="${fieldId}" rows="3" class="mem-edit-field"></textarea>
    <div class="mem-edit-btns">
      <button type="submit" class="primary"></button>
      <button type="button" data-cancel></button>
    </div>`;

  form.querySelector('label').textContent = A11Y_COPY.memEditField(value);
  const field = form.querySelector('textarea');
  field.value = value;
  const saveBtn = form.querySelector('button[type="submit"]');
  saveBtn.textContent = 'Save';
  saveBtn.setAttribute('aria-label', A11Y_COPY.memEditSave);
  const cancelBtn = form.querySelector('button[data-cancel]');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.setAttribute('aria-label', A11Y_COPY.memEditCancel);

  if (controls) controls.hidden = true;
  card.appendChild(form);
  field.focus();
  field.select();

  const close = message => {
    form.remove();
    if (controls) controls.hidden = false;
    if (trigger.isConnected) trigger.focus();
    if (message) announce?.(message);
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const next = field.value.trim();
    if (!next || next === value) return close(A11Y_COPY.memEditCancelled);
    await onSave(next);
    close(A11Y_COPY.memUpdated);
  });
  cancelBtn.addEventListener('click', () => close(A11Y_COPY.memEditCancelled));
  form.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(A11Y_COPY.memEditCancelled); }
  });
}

/* ============================================================
   Transcript turns
   ============================================================ */

/**
 * Build one transcript turn as a list item labelled with its speaker, so a
 * screen reader user can navigate the conversation turn by turn.
 *
 * @param {'user'|'coach'|'system'} speaker
 * @returns {HTMLLIElement}
 */
export function createTurn(speaker, extraClass = '') {
  const li = document.createElement('li');
  li.className = `msg ${speaker}${extraClass ? ' ' + extraClass : ''}`;
  const label = document.createElement('span');
  label.className = 'sr-only';
  label.textContent =
    speaker === 'user' ? A11Y_COPY.speakerUser
      : speaker === 'coach' ? A11Y_COPY.speakerCoach
        : A11Y_COPY.speakerSystem;
  li.appendChild(label);
  return li;
}

/** The bubble inside a turn — where message content goes. */
export function turnBubble(li) {
  return li.querySelector('.bubble');
}

/* ============================================================
   Labelled in-bubble regions
   ------------------------------------------------------------
   Guardrail banners, escalation offers, consent asks and action-card
   outcomes appear in BOTH demos. The markup lives here once so the roles
   and accessible names cannot drift between them.
   ============================================================ */

export const guardrailHtml = banner =>
  `<div class="guardrail" role="note" aria-label="${A11Y_COPY.guardrailLabel}">${banner}</div>`;

export const escalateHtml = (copy, button) =>
  `<div class="escalate" role="note" aria-label="${A11Y_COPY.escalationLabel}">${copy}<br><button type="button" data-x="escalate">${button}</button></div>`;

export const consentHtml = ({ ask, yes, no, id = '' }) =>
  `<div class="consent" role="group" aria-label="${A11Y_COPY.consentLabel}"${id ? ` data-consent-id="${id}"` : ''}>${ask}
    <div class="c-btns"><button type="button" class="yes" data-x="consent-yes">${yes}</button><button type="button" data-x="consent-no">${no}</button></div></div>`;

export const actionOutcomeHtml = (text, { declined = false } = {}) =>
  `<p class="ac-outcome${declined ? ' declined' : ''}">${text}</p>`;

/* ============================================================
   Icon-only control naming
   ============================================================ */

/** Feedback row markup with real accessible names and pressed state. */
export function feedbackRowHtml() {
  return `<div class="feedback" role="group" aria-label="Rate this reply">
    <button type="button" data-fb="1" aria-pressed="false" aria-label="${A11Y_COPY.feedbackUp}"><span aria-hidden="true">👍</span></button>
    <button type="button" data-fb="-1" aria-pressed="false" aria-label="${A11Y_COPY.feedbackDown}"><span aria-hidden="true">👎</span></button>
    <button type="button" data-fb="0" aria-label="${A11Y_COPY.feedbackRegen}"><span aria-hidden="true">↻</span> regenerate</button>
  </div>`;
}

/** Apply exclusive pressed state across a feedback group. */
export function setFeedbackPressed(button) {
  for (const b of button.parentElement.querySelectorAll('button[data-fb]')) {
    b.classList.remove('sel', 'neg');
    if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
  }
  button.classList.add('sel');
  if (+button.dataset.fb < 0) button.classList.add('neg');
  button.setAttribute('aria-pressed', 'true');
}

/* ============================================================
   Skip link + landmarks
   ============================================================ */

/** Move focus to a landmark when a skip link is used (Safari needs the help). */
export function initSkipLink(link, targetId) {
  link.addEventListener('click', e => {
    const target = document.getElementById(targetId);
    if (!target) return;
    e.preventDefault();
    target.focus();
    target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
}

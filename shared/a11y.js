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
  metricsRegionLabel: 'Instrumentation metrics, scrollable',
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

  /* Caption track — presenter-mode mirror of the live regions. */
  captionTitle: 'What a screen reader hears',
  captionNote:
    'Live mirror of the polite and assertive regions. Note the left column fills token by ' +
    'token while this fills clause by clause — announcing every token makes VoiceOver ' +
    'stutter and re-read, which is worse than silence.',
  captionEmpty: 'Nothing announced yet. Send a message to hear the coach.',
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
 * Discrete announcements: memory edits, state transitions, presenter-mode
 * toggles, turn boundaries, and write outcomes.
 *
 * Returns `announce(message, kind)` where kind is 'status' (polite, the
 * default) or 'alert' (assertive). Successive calls to the same region clear
 * first so a repeated message still fires.
 *
 * `onSpeak` mirrors each announcement to the visible caption track. It receives
 * the SAME string that reaches the live region — a caption that paraphrases
 * what a screen reader hears is a lie about the product.
 */
export function createStatusRegion({ onSpeak } = {}) {
  // Two regions, because two urgencies. Polite waits its turn: correct for
  // state changes and memory edits. Assertive interrupts: correct only where
  // silence would let a user keep acting on a false belief — a write that just
  // executed, or a coach that has stopped being able to verify anything.
  // Over-using assertive is its own defect, so the kinds are deliberately few.
  const regions = {
    status: makeSrRegion('status', { atomic: true }),
    alert: makeSrRegion('alert', { atomic: true }),
  };
  regions.alert.setAttribute('aria-live', 'assertive');
  const timers = new Map();

  return function announce(message, kind = 'status') {
    const el = regions[kind] || regions.status;
    // Mirror the exact string, and the region it actually went to — a caption
    // claiming "assertive" over a polite region would misrepresent the product.
    onSpeak?.(message, kind);
    const prev = timers.get(el);
    if (prev) { clearTimeout(prev.set); clearTimeout(prev.clear); }
    el.textContent = '';
    const set = setTimeout(() => { el.textContent = message; }, 60);
    // Announced text is transient. Left in place it becomes stale content a
    // user meets while browsing the page, so retire it once it has been read.
    const clear = setTimeout(() => { el.textContent = ''; }, 8000);
    timers.set(el, { set, clear });
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
    // Stripping a leading marker can leave the punctuation that followed it
    // stranded at the head of a chunk (". That covers it."), which reads as a
    // stray pause. The sentence it belonged to was already spoken.
    .replace(/^[\s.,;:!?]+/, '')
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
 * @param {Function} opts.onSpeak   visible caption mirror (see createCaptionTrack)
 */
/**
 * True when the buffer ends inside a grounding marker that has not closed yet.
 *
 * speechText() strips whole `[src:x]` markers, but it cannot repair one that has
 * been split across two flushes: `[src:` goes out with chunk A and the residue
 * `plan-record].` has no opening bracket left to match, so a screen reader reads
 * "plan-record dot" aloud. Holding the flush until the marker closes is the only
 * place this can be fixed — once a chunk is emitted it is already spoken.
 */
const hasOpenMarker = s => {
  const i = s.lastIndexOf('[src');
  return i !== -1 && s.indexOf(']', i) === -1;
};

export function createStreamAnnouncer({ flushMs = 600, announce, onSpeak } = {}) {
  const region = makeSrRegion('log', { atomic: false });
  let buffer = '';
  let timer = null;
  let owner = null;
  let clearTimer = null;

  const emit = chunk => {
    const text = speechText(chunk);
    // Punctuation-only residue is never worth an announcement.
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
    region.appendChild(document.createTextNode(text + ' '));
    // Mirror the clause exactly as flushed: the caption track's whole value is
    // showing that output is spoken in clauses, not tokens.
    onSpeak?.(text, 'clause');
  };

  const flushAll = ({ force = false } = {}) => {
    clearTimeout(timer);
    timer = null;
    if (!buffer) return;
    // Mid-turn, wait for a half-arrived marker to finish. At a turn boundary
    // there is nothing more coming, so force and let speechText strip the stub.
    if (!force && hasOpenMarker(buffer)) {
      timer = setTimeout(() => { timer = null; flushAll(); }, flushMs);
      return;
    }
    emit(buffer);
    buffer = '';
  };

  return {
    region,

    /** Take ownership of a message element for the duration of a turn. */
    begin(el) {
      clearTimeout(clearTimer);
      flushAll({ force: true });
      region.replaceChildren();
      buffer = '';
      owner = el || null;
      if (owner) owner.setAttribute('aria-hidden', 'true');
    },

    /** Buffer one streamed delta. Flushes only on a clause boundary or debounce. */
    push(delta) {
      buffer += delta;
      const m = CLAUSE_BOUNDARY.exec(buffer);
      // A boundary inside an unclosed marker is not a boundary — flushing there
      // is what strands "plan-record]." in the next chunk.
      if (m && !hasOpenMarker(m[1])) {
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
    end({ note = A11Y_COPY.turnComplete, kind = 'status' } = {}) {
      flushAll({ force: true });
      if (owner) { owner.removeAttribute('aria-hidden'); owner = null; }
      if (note) announce?.(note, kind);
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => region.replaceChildren(), 4000);
    },

    /**
     * Non-streamed message (the scripted demo): announce once, whole, then
     * hand the bubble back. Same contract as begin/end so both demos behave
     * identically for a screen reader.
     */
    say(el, html, { note = A11Y_COPY.turnComplete, kind = 'status' } = {}) {
      this.begin(el);
      emit(html);
      this.end({ note, kind });
    },
  };
}

/* ============================================================
   Caption track — the accessibility work, made visible
   ============================================================ */

/**
 * A visible mirror of everything the screen-reader regions say.
 *
 * Accessibility succeeds by being invisible, which makes it impossible to show.
 * Presenter mode already exposes the other invisible machinery (eval labels,
 * faithfulness, tool calls); this does the same for announcements, so the demo
 * can *demonstrate* the behaviours agentic UIs most often get wrong rather than
 * merely having them.
 *
 * THE MOUNT IS aria-hidden AND THAT IS LOAD-BEARING. The real announcement
 * lives in the .sr-only regions; a second copy in the accessibility tree would
 * make a screen reader read every clause twice. A demo of accessibility that
 * breaks accessibility is worse than no demo, so this never becomes a live
 * region and never carries a role. Tier 1b asserts it.
 *
 * @param {HTMLElement} mount
 * @returns {{speak(text:string, kind?:string):void, clear():void}}
 */
export function createCaptionTrack(mount) {
  if (!mount) return { speak() {}, clear() {} };
  mount.setAttribute('aria-hidden', 'true');
  mount.classList.add('cap-track');

  const list = document.createElement('ol');
  list.className = 'cap-list';
  mount.replaceChildren(list);

  return {
    /**
     * @param {string} text  exactly what was written to the live region
     * @param {string} kind  'clause' | 'boundary' | 'status' | 'alert'
     */
    speak(text, kind = 'status') {
      const t = String(text || '').trim();
      if (!t) return;
      const li = document.createElement('li');
      li.className = `cap cap-${kind}`;
      const tag = document.createElement('span');
      tag.className = 'cap-kind';
      tag.textContent = CAPTION_KIND[kind] || kind;
      const body = document.createElement('span');
      body.className = 'cap-text';
      body.textContent = t;
      li.append(tag, body);
      list.appendChild(li);
      // keep the newest caption in view without animating under reduced motion
      list.scrollTop = list.scrollHeight;
      while (list.children.length > 60) list.removeChild(list.firstChild);
    },
    clear() { list.replaceChildren(); },
  };
}

/** Badge text per announcement kind — what a user is actually hearing. */
export const CAPTION_KIND = {
  clause: 'polite',
  boundary: 'polite',
  status: 'polite',
  alert: 'assertive',
};

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

/**
 * Make an overflow container keyboard-scrollable.
 *
 * A div with `overflow-y:auto` scrolls with the mouse wheel and is unreachable
 * without one: a keyboard-only user cannot read past the fold, and there is no
 * focusable descendant to scroll it into view. WCAG 2.1.1. Giving it tabindex=0
 * plus a name makes it a labelled, focusable region that responds to the arrow
 * keys — and the focus ring from tokens.css lands inside it via the negative
 * offset already used for #chat.
 *
 * Called by BOTH demos on their metrics panel; the container markup is per-demo
 * but the behaviour is defined once, here.
 */
export function makeScrollableRegion(el, label) {
  if (!el) return;
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', label);
}

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

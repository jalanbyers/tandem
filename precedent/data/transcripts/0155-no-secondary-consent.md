<!-- meta
{
  "sessionId": "0155",
  "advisorId": "adv-21",
  "date": "2026-03-17",
  "channel": "phone",
  "durationMin": 15,
  "consent": {
    "record":       { "granted": true, "at": "2026-03-17T15:40Z", "basis": "all-party verbal, logged" },
    "secondaryUse": { "granted": false, "at": "2026-03-17T15:40Z", "declinedReason": "client declined when asked" }
  },
  "fixture": "reject:no-secondary-consent"
}
-->

# Session 0155 — REJECTION FIXTURE: recording consented, secondary use declined

> Fictional. No real advisor, client, firm, or account.
>
> **This session must never reach the corpus.** The client agreed to be recorded for the
> firm's own books-and-records purposes and explicitly declined to have the session used
> for anything else. Consent to record is not consent to secondary use
> (`docs/PRECEDENT.md` §4.2) — `ingest.js` must reject this file on the consent gate,
> before de-identification runs, and nothing may persist.
>
> It contains perfectly good transferable moves. That is the point of the fixture: the
> gate must hold even when the content is *useful*, because usefulness is exactly the
> pressure that erodes consent handling in practice.

[t01] **ADV:** Before we start — you're okay with me recording for our file? And separately, are you okay with us using anonymised notes to improve how we train?

[t02] **CLI:** Recording for the file is fine. The training thing, I'd rather not.

[t03] **ADV:** Completely fine, and thank you for saying so plainly. I've logged it as declined.

[t04] **CLI:** So, the drop. Should I be worried?

[t05] **ADV:** Tell me what prompted the call first — has something changed for you, or is this the news cycle?

[t06] **CLI:** Mostly the news. My wife asked me about it and I realised I didn't have an answer.

[t07] **ADV:** That's a good reason to call. Not having an answer for someone you love is its own kind of stress, separate from the money.

[t08] **CLI:** That's it exactly.

[t09] **ADV:** Then let's get you an answer you can actually repeat at the kitchen table, rather than a lecture you'll forget by Thursday.

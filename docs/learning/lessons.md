# Lessons

The one-line form of every lesson this repo has paid for. Read this file at session start; it is short by construction.

Each rule links into [lessons-evidence.md](lessons-evidence.md), which holds the war story and the anchor. Open that only when a rule is in doubt, or the work is in that area — it is not session-start reading.

A new lesson is an entry there plus one line here. Run npm run lessons:check to keep the two in step: a rule always has an entry, and an entry always has a rule.

When a lesson becomes a gate — a test, a lint rule, a fixed command — delete both halves. The machine enforces it, so nobody needs to read it.

## Rules

- An error message that covers several causes hides the real one — split the condition and name the observed values. ([evidence](lessons-evidence.md#an-error-message-that-covers-several-causes-hides-the-real-one))
- `lstat` and a handle's `fstat` disagree on `dev` across platforms; the inode is the identity, the device only corroborates. ([evidence](lessons-evidence.md#lstat-and-fstat-do-not-agree-on-dev-across-platforms))
- The structural hash covers part identifiers, so it cannot decide whether two models are the same. ([evidence](lessons-evidence.md#the-structural-hash-covers-part-identifiers-so-it-is-not-model-equivalence))
- Recomputing pinned truth per call turns catalog growth into a timeout that reads as a hang. ([evidence](lessons-evidence.md#recomputing-pinned-truth-per-call-turns-catalog-growth-into-a-timeout))
- A deterministic capture default is the wrong default for an interactive camera. ([evidence](lessons-evidence.md#a-deterministic-capture-default-is-the-wrong-default-for-an-interactive-camera))
- A preview that recomputes geometry drifts from what gets placed; read the same source the renderer does. ([evidence](lessons-evidence.md#a-preview-that-recomputes-geometry-drifts-from-what-gets-placed))
- Filtering by value drops the token you wanted when it collides with the one you meant to discard. ([evidence](lessons-evidence.md#filtering-by-value-drops-the-token-you-wanted-when-it-collides))
- Long feedback loops need an intermediate score; a booklet supplies its own in step numbering and piece counts. ([evidence](lessons-evidence.md#long-feedback-loops-need-an-intermediate-score-and-booklets-supply-their-own))
- Reading a document's structure is not the same as seeing it — render it and look. ([evidence](lessons-evidence.md#reading-a-documents-structure-is-not-the-same-as-seeing-it))

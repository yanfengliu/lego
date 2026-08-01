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
- A cost curve's true minimum is its sharpest point; smoothing to suppress noise turns it into a local maximum. ([evidence](lessons-evidence.md#a-cost-curves-true-minimum-is-its-sharpest-point-and-smoothing-destroys-it))
- Periodicity and amplitude are both forgeable: a raster staircase repeats exactly and a thresholded stroke wanders a whole row. ([evidence](lessons-evidence.md#periodicity-and-amplitude-are-both-forgeable-evidence-of-a-drawn-feature))
- A probe that spells out an absolute repo path cannot run from a worktree; resolve dependencies and sample data instead. ([evidence](lessons-evidence.md#a-probe-that-spells-out-an-absolute-repo-path-cannot-run-from-a-worktree))
- Label image ground truth at more than one zoom: an outline that reads as smooth at one scale shows its studs at the next. ([evidence](lessons-evidence.md#label-image-ground-truth-at-more-than-one-zoom))
- A fixed crop box silently decapitates the big items � size the crop to its own content. ([evidence](lessons-evidence.md#a-fixed-crop-box-silently-decapitates-the-big-items))
- Reading a part from an isolated thumbnail is a different problem from reading it out of an assembly. ([evidence](lessons-evidence.md#reading-a-part-from-an-isolated-thumbnail-is-a-different-problem-from-reading-it-out-of-an-assembly))
- A hand-assembled parts array is not a document: stacking without connection edges validates as a collision. ([evidence](lessons-evidence.md#a-hand-assembled-parts-array-is-not-a-document))
- A step highlight is an open contour whenever the step's parts go behind built ones; only about half enclose anything. ([evidence](lessons-evidence.md#a-step-highlight-is-an-open-contour-whenever-the-parts-go-behind-built-ones))
- A document's parts are not in insertion order; key a part by the id its command returned, never by array position. ([evidence](lessons-evidence.md#a-documents-parts-are-not-in-insertion-order))

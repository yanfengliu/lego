# Lessons

The one-line form of every lesson this repo has paid for. Read this file at session start; it is short by construction.

Each rule links into [lessons-evidence.md](lessons-evidence.md), which holds the war story and the anchor. Open that only when a rule is in doubt, or the work is in that area — it is not session-start reading.

A new lesson is an entry there plus one line here. Run npm run lessons:check to keep the two in step: a rule always has an entry, and an entry always has a rule.

When a lesson becomes a gate — a test, a lint rule, a fixed command — delete both halves. The machine enforces it, so nobody needs to read it.

Deleting it means proving it first. [gate-proofs.md](gate-proofs.md) records, for every lesson that left this file that way, the product-code edit that reintroduces the defect and the line the gate printed when it caught it. A gate nobody has watched fail is a claim, not a gate, and nothing leaves on one. Lessons with no mechanical trigger leave by promotion instead: fleet-wide ones are staged in [canon-candidates.md](canon-candidates.md) for the constitution, repo-specific ones move to [../policies/local-rules.md](../policies/local-rules.md). What is left below is what is still only prose.

## Rules

- A byte comparison knows only that two files differ; a message naming what changed is a guess, and it prints nonsense exactly when the guess is wrong. ([evidence](lessons-evidence.md#a-byte-comparison-knows-only-that-two-files-differ))
- Recomputing pinned truth per call turns catalog growth into a timeout that reads as a hang. ([evidence](lessons-evidence.md#recomputing-pinned-truth-per-call-turns-catalog-growth-into-a-timeout))
- A deterministic capture default is the wrong default for an interactive camera. ([evidence](lessons-evidence.md#a-deterministic-capture-default-is-the-wrong-default-for-an-interactive-camera))
- Long feedback loops need an intermediate score; a booklet supplies its own in step numbering and piece counts. ([evidence](lessons-evidence.md#long-feedback-loops-need-an-intermediate-score-and-booklets-supply-their-own))
- A fixed crop box silently decapitates the big items — size the crop to its own content. ([evidence](lessons-evidence.md#a-fixed-crop-box-silently-decapitates-the-big-items))
- A hand-assembled parts array is not a document: stacking without connection edges validates as a collision. ([evidence](lessons-evidence.md#a-hand-assembled-parts-array-is-not-a-document))
- A document's parts are not in insertion order; key a part by the id its command returned, never by array position. ([evidence](lessons-evidence.md#a-documents-parts-are-not-in-insertion-order))
- A panel's own stud grid fits the booklet's camera angles and scale with no part identities; where the model sits is not in the grid. ([evidence](lessons-evidence.md#a-panels-own-stud-grid-fits-the-camera-but-not-where-the-model-sits))
- An LDraw part has no inside: its hollows are open primitives, so test that the real surface is contained rather than counting ray crossings. ([evidence](lessons-evidence.md#an-ldraw-part-has-no-inside-because-its-hollows-are-open-primitives))
- Measure the art you are imitating: booklet parts carry three face tones, a near-black stud wall and a per-colour ink, not one flat fill. ([evidence](lessons-evidence.md#measure-the-art-you-are-imitating-rather-than-asserting-its-dialect-in-a-comment))
- Two consecutive printed panels are one drawing moved: take the scale from the camera fit and search only the shift. ([evidence](lessons-evidence.md#two-consecutive-printed-panels-are-one-drawing-moved))
- Matching a gallery one item at a time discards what makes it a gallery: choose once, globally, so taking an entry costs the others. ([evidence](lessons-evidence.md#matching-a-gallery-one-item-at-a-time-discards-the-constraint-that-makes-it-a-gallery))
- Elements differing only in colour are one shape twice, so a colour distance softened to the nearest shared tone merges them. ([evidence](lessons-evidence.md#elements-differing-only-in-colour-are-one-shape-twice))
- File metadata cannot see a same-size rewrite, and a guard test that passes on an incidental clock tick is a false green. ([evidence](lessons-evidence.md#file-metadata-cannot-see-a-same-size-rewrite))
- A clearance probe answers whether a stud fits, never whether anything holds it, so it cannot settle a disagreement between two authored sources. ([evidence](lessons-evidence.md#a-clearance-probe-answers-whether-a-stud-fits-never-whether-anything-holds-it))
- An exact ambiguity cannot be resolved by telling the measurement which answer to prefer; the cue belongs where the answer is used. ([evidence](lessons-evidence.md#an-exact-ambiguity-cannot-be-resolved-by-telling-the-measurement-which-answer-to-prefer))
- An orientation compared as a string, not modulo the part's own symmetry, manufactures false positives. ([evidence](lessons-evidence.md#an-orientation-compared-as-a-string-not-modulo-the-parts-own-symmetry))
- A maximisation is also a blindness: a score maximised over shift cannot see a difference smaller than its own search reach. ([evidence](lessons-evidence.md#a-registration-that-maximises-over-shift-is-blind-to-anything-smaller-than-its-own-search))
- An annotation drawn to a hidden destination states its direction, not its length; treat the ink as a floor and let the picture supply the rest. ([evidence](lessons-evidence.md#an-annotation-drawn-to-a-hidden-destination-states-its-direction-not-its-length))
- A green vision narrowing can drop settled truth; staying inside the enumerator is safety, not visual correctness. ([evidence](lessons-evidence.md#a-green-vision-narrowing-can-drop-settled-truth))
- A contact sheet can be full-size while every bound image inside it is downsampled; inspect and name the source pixels at one-to-one scale. ([evidence](lessons-evidence.md#a-contact-sheet-can-be-full-size-while-every-bound-image-inside-it-is-downsampled))


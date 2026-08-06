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
- Some steps are drawn exploded, so a highlight gives shape and orientation but not position — and counting them by red pixels overcounts badly. ([evidence](lessons-evidence.md#a-steps-highlight-is-not-always-where-the-part-ends-up))
- Part dimensions are published: measure them with `scripts/ldraw-part-facts.mjs` rather than guessing. ([evidence](lessons-evidence.md#part-dimensions-are-published))
- Simulate bricks in centimetres, not LDU or metres, and give the ground real depth or a falling brick goes straight through it. ([evidence](lessons-evidence.md#simulate-bricks-in-centimetres-not-ldu-or-metres))
- A panel's own stud grid fits the booklet's camera angles and scale with no part identities; where the model sits is not in the grid. ([evidence](lessons-evidence.md#a-panels-own-stud-grid-fits-the-camera-but-not-where-the-model-sits))
- The phase of a repeat is not the centre of the thing that repeats; fold the cell and take the drawn ring's own centre. ([evidence](lessons-evidence.md#the-phase-of-a-repeat-is-not-the-centre-of-the-thing-that-repeats))
- An LDraw part has no inside: its hollows are open primitives, so test that the real surface is contained rather than counting ray crossings. ([evidence](lessons-evidence.md#an-ldraw-part-has-no-inside-because-its-hollows-are-open-primitives))
- Measure the art you are imitating: booklet parts carry three face tones, a near-black stud wall and a per-colour ink, not one flat fill. ([evidence](lessons-evidence.md#measure-the-art-you-are-imitating-rather-than-asserting-its-dialect-in-a-comment))
- Two consecutive printed panels are one drawing moved: take the scale from the camera fit and search only the shift. ([evidence](lessons-evidence.md#two-consecutive-printed-panels-are-one-drawing-moved))
- A sub-assembly box is joined to the model by its leader line, so the largest connected region is not the assembly. ([evidence](lessons-evidence.md#a-sub-assembly-box-is-joined-to-the-model-by-its-leader-line))
- A printed step's panel difference finds the right stud, not the right offset; report the distance, not the rank. ([evidence](lessons-evidence.md#a-printed-steps-panel-difference-finds-the-right-stud-not-the-right-offset))
- Give each Playwright run its own dev-server port; a shared one lets concurrent runs corrupt each other's app state, not merely queue. ([evidence](lessons-evidence.md#give-each-playwright-run-its-own-dev-server-port))
- Matching a gallery one item at a time discards what makes it a gallery: choose once, globally, so taking an entry costs the others. ([evidence](lessons-evidence.md#matching-a-gallery-one-item-at-a-time-discards-the-constraint-that-makes-it-a-gallery))
- Elements differing only in colour are one shape twice, so a colour distance softened to the nearest shared tone merges them. ([evidence](lessons-evidence.md#elements-differing-only-in-colour-are-one-shape-twice))
- Make a vision call answer the same question twice, in words and by pointing; the cheap model contradicts itself four times in five. ([evidence](lessons-evidence.md#make-a-vision-call-answer-the-same-question-twice))
- A plate of height projects to a third of a stud, so a tolerance looser than that cannot tell one layer from the next. ([evidence](lessons-evidence.md#a-plate-of-height-projects-to-a-third-of-a-stud-so-a-looser-tolerance-cannot-see-layers))
- A shape test that works on a solid blob need not work on printed art; "it passes" and "it fires" are different claims. ([evidence](lessons-evidence.md#a-shape-test-that-works-on-a-solid-blob-need-not-work-on-printed-art))
- A measurement computed after an early return reports zero, and zero reads as an absence. ([evidence](lessons-evidence.md#a-measurement-computed-after-an-early-return-reports-zero-and-zero-reads-as-an-absence))
- A safety barrier that lives only in a document is not a barrier; state the machine fact you actually ran, then make the refusal executable. ([evidence](lessons-evidence.md#a-safety-barrier-that-lives-only-in-a-document-is-not-a-barrier))
- A blocker you inherited is a claim, not a fact: retest it before repeating it, because its whole effect is to stop work. ([evidence](lessons-evidence.md#a-blocker-you-inherited-is-a-claim-not-a-fact))
- File metadata cannot see a same-size rewrite, and a guard test that passes on an incidental clock tick is a false green. ([evidence](lessons-evidence.md#file-metadata-cannot-see-a-same-size-rewrite))
- A check that reads the same constant as the code it checks cannot see that the constant is wrong; look at the destination from outside. ([evidence](lessons-evidence.md#a-check-that-reads-the-same-constant-as-the-code-it-checks-cannot-see-that-the-constant-is-wrong))
- A printed icon that looks like an instruction can be page chrome: count how often it lands on steps that mean something else before believing it. ([evidence](lessons-evidence.md#a-printed-icon-that-looks-like-an-instruction-can-be-page-chrome))
- An exact fit to a symmetric feature set is not one answer: divide by the object's own symmetry, then let something asymmetric settle what is left. ([evidence](lessons-evidence.md#an-exact-fit-to-a-symmetric-feature-set-is-not-one-answer))
- A clearance probe answers whether a stud fits, never whether anything holds it, so it cannot settle a disagreement between two authored sources. ([evidence](lessons-evidence.md#a-clearance-probe-answers-whether-a-stud-fits-never-whether-anything-holds-it))
- The editor keeps its document in IndexedDB, so reloading the page is not a fresh plate and the second placement reads as a collision. ([evidence](lessons-evidence.md#the-editor-keeps-its-document-in-indexeddb-so-reloading-is-not-a-fresh-plate))
- Grading a free-text answer against a controlled vocabulary measures wording, not sight, unless the prompt names the vocabulary. ([evidence](lessons-evidence.md#grading-a-free-text-answer-against-a-controlled-vocabulary-measures-wording-not-sight))
- A check that has stopped checking still reports green: give "could not verify" its own outcome, distinct from both success and refusal. ([evidence](lessons-evidence.md#a-check-that-has-stopped-checking-still-reports-green))
- Ask a vision call the closed question, not the open one: same-or-different on two pictures scored 84 of 84 where pick-one-of-six was 39.9% self-consistent. ([evidence](lessons-evidence.md#the-shape-of-the-question-decides-what-a-vision-call-is-worth))
- A rotation matrix stored as nine numbers has two readings; only something the ambiguity cannot rotate says which. ([evidence](lessons-evidence.md#a-rotation-matrix-stored-as-nine-numbers-has-two-readings-and-only-geometry-says-which))
- A conservation check with one unmeasured term cannot fail: the free term absorbs whatever the parse got wrong. ([evidence](lessons-evidence.md#a-conservation-check-with-one-unmeasured-term-cannot-fail))

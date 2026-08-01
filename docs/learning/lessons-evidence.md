# Lessons — evidence

The full entry behind each rule in [lessons.md](lessons.md), in the same order. Each records something that cost real time, with an anchor that proves it happened; unanchored lessons are folklore and do not belong here.

This file is not read at session start. Come here from a rule.

## Entries

## An error message that covers several causes hides the real one

`recoverEvents` reported "Ledger file exceeds its byte cap" for five distinct conditions: wrong file type, extra hard links, a device mismatch, an inode mismatch, and the actual size cap.
46 companion tests failed on the device mismatch, and the message sent every reader to look at byte caps.
Splitting the condition into five messages that each name the observed values exposed the cause in one run.

**Anchor:** fix commit `c068b4c`; `apps/companion/src/run-ledger-file.ts`; 46 failing tests in `run-ledger-adversarial.test.ts` and `test-run-recorder.test.ts`.

## `lstat` and `fstat` do not agree on `dev` across platforms

The ledger checked that a file was not swapped between lookup and open by comparing `dev` and `ino` from `lstat` against the open handle's `fstat`.
On Windows `lstat` reports `dev: 0` while `fstat` reports the real device, so every recovery was rejected as a swapped file although the inode matched exactly.
The inode is the identity a swap changes; the device id is corroborating only, and must be compared only when both sides report one.

**Anchor:** fix commit `c068b4c`; `sameFile` in `apps/companion/src/run-ledger-file.ts`; observed `device 0/39406496742044240 became 3603962542/39406496742044240`.

## The structural hash covers part identifiers, so it is not model equivalence

`documentStructuralHash` includes each part's id.
Two identical models built independently therefore never hash alike, so a rebuild scored by hash equality is always a miss.
Comparison must match parts on what they are and where they sit.

**Anchor:** commit `0aa2f06`; `structuralMatch` in `packages/brick-kernel/src/build-comparison.ts`; caught by "scores an identical rebuild as an exact structural match".

## Recomputing pinned truth per call turns catalog growth into a timeout

`validateBrickDocument` rebuilt the builtin truth snapshot on every call, digesting the whole catalog.
Growing the catalog from 14 to 32 parts made two tests exceed vitest's 5s limit — they timed out rather than failing an assertion, which reads as a hang, not a regression.
The snapshot is a pure function of compile-time constants and is now computed once and frozen.

**Anchor:** commit `d86b274`; `createBuiltinTruthSnapshot` in `packages/brick-kernel/src/factory.ts`; timeouts in `editor-state.test.ts` and `maker-worker-response.test.ts`.

## A deterministic capture default is the wrong default for an interactive camera

`createCanonicalViewPacket` frames an empty document with a half-unit fallback box, which is correct for reproducible capture.
Reusing it for the interactive camera put the camera inside the first brick placed, so a single 2x4 filled the whole viewport.
The same pinned frustum also clipped the model away once the user dollied past the authored far plane.

**Anchor:** commits `dd49eaa` and `73c550b`; `MIN_INTERACTIVE_FRAME_RADIUS` and `orbitCameraFrustum`; regression test "reproduces the canonical frustum clipping it replaces for interactive use".

## A preview that recomputes geometry drifts from what gets placed

The palette preview derived studs from a part's `widthStuds × lengthStuds` grid rather than from its collision primitives, so tiles — which have no studs — were drawn with studs.
Tests passed; only looking at the rendered palette caught it.
A preview must read the same source the renderer does.

**Anchor:** commit `d86b274`; `PartPreview.tsx`; verified `tile1x1: 0, brick2x4: 8, plate6x6: 36` in the browser.

## Filtering by value drops the token you wanted when it collides

The booklet parser removed every text token equal to the page number, to discard the printed page number.
A step whose number equals its page number — common early in a booklet — was discarded with it, losing step 64 of 359.
The page prints its number once, so exactly one occurrence should be removed.

**Anchor:** commit `00607a9`; `extractBookletStructure`; sequence coverage 0.997 → 1.000 on the 224-page sample.

## Long feedback loops need an intermediate score, and booklets supply their own

"Did the right model come out" is too slow to iterate against.
An instruction booklet is internally redundant: step numbers must run 1..N without a gap, and callout quantities must reconcile with the piece count.
Both are checkable the moment a booklet is read, with no model built, and both are falsifiable — which is what made the step-64 bug visible.

**Anchor:** commit `00607a9`; `checkBookletConsistency`; `output/booklet-score.json` records 359/359 steps and 3102 callout pieces.

## Reading a document's structure is not the same as seeing it

The sample booklet's operator counts are dominated by `constructPath` and
`setFillRGBColor`, so the art was taken to be vector and a shape reader was
built on that basis.
Rendering a page and looking at it showed the assemblies are raster images; the
filled paths are the callout box, the panel divider, and the progress bar.
Six sampled pages yielded 119 paths and five colours, every one of them page
furniture rather than a brick.

Looking also surfaced what the structure never would: newly placed parts are
outlined in yellow on every step, which marks the per-step delta directly in the
art, and the model needs wedge and curved plates far longer than the catalog
holds.

**Anchor:** commit `0b03905` and its correction; `apps/web/e2e/pdf-render.spec.ts`; pages 12 and 120 of `recipes/6651557.pdf`.

## A cost curve's true minimum is its sharpest point, and smoothing destroys it

The stud-pitch estimator scored each candidate period by how badly the traced edge failed to repeat at it, then looked for the dip.
At the true period of 48 px the cost was exactly `0.00` while both neighbours sat at `0.71`, because a second difference cancels perfectly when the period is right.
A three-point mean, added to stop raster noise passing for a dip, averaged that zero against its neighbours and made 48 px a local *maximum*; the estimate went to 45 px, on the shoulder.
The dip that matters is one sample wide by construction, so it is the first thing any smoothing removes.

**Anchor:** `findPitchCandidates` reads the curve raw in `apps/web/src/instructions/stud-pitch-comb.ts`; observed costs `47=0.71 48=0.00 49=0.71` against a smoothed `47=0.43 48=0.47 49=0.43`.

## Periodicity and amplitude are both forgeable evidence of a drawn feature

Reading stud pitch from the scallops on a highlight outline failed twice on evidence that looked sufficient.
First, periodicity: a sloped line rounded into whole raster rows stair-steps, and a staircase repeats exactly and forever — `round(0.45x)` has period 20 — so straight fixtures returned confident 11 and 12 px pitches.
Adding an amplitude floor fixed the synthetic cases and 59 synthetic negatives passed, but page 120 of the sample booklet, a visibly straight tiled outline, still yielded a confident 26 px pitch: thresholding an anti-aliased stroke into a binary mask makes the traced edge wander by a row or more, and that wander is correlated along the edge, so it clears an amplitude floor and repeats well enough to dip.
What separates a drawn feature is that its wobble gathers onto the harmonics of one period and leaves the half-multiples between them empty.

**Anchor:** `apps/web/src/instructions/stud-pitch.ts`; the negative is fixture `p120-r1@6` in `__fixtures__/booklet-edges.json`, kept by "reports no pitch for p120-r1@6, whose outline is visibly smooth"; synthetic recall 1.00 with 0 false positives on 59 negatives, and 6/6 hand-labelled real edges.

## A probe that spells out an absolute repo path cannot run from a worktree

Four booklet probes loaded pdfjs and the sample PDF over vite `/@fs/` URLs built from a hardcoded `C:/Users/.../github/lego`.
Run from a worktree that path is outside the workspace vite infers, so `fs.allow` refused to serve it and every probe died on "Failed to fetch dynamically imported module" — and a worktree has neither `node_modules` nor `recipes/` of its own, so the path was also the wrong one to want.
Resolving the pdfjs build through `require.resolve` and finding `recipes/` by walking up makes the probes run the same from either checkout.

**Anchor:** `apps/web/e2e/sample-booklet.ts`; `servableRoots()` feeds `server.fs.allow` in `apps/web/e2e/global-setup.ts`.

## Label image ground truth at more than one zoom

Six highlight regions were labelled "scalloped" or "smooth" by rendering each and looking at it, to judge the pitch estimator against something better than its own output.
Region `p200-r0` was labelled smooth from the scale-4 crop, where the studs sit inside the silhouette and the top edge reads as a plain diagonal.
At scale 6 the same outline visibly arcs over every stud, and the label was wrong; had it been committed, a correct measurement would have been scored as a false positive and the estimator tuned to refuse it.

**Anchor:** `apps/web/src/instructions/__fixtures__/booklet-edges.json` carries both scales of every edge for this reason; `p200-r0@4` and `p200-r0@6` both read "scalloped".

## A fixed crop box silently decapitates the big items

Every inventory thumbnail was cut with the same 20.4pt-tall cell, on the assumption that a grid row is a fixed height.
It is not: a 4x12 plate is drawn far taller than a 1x1, and the crop showed 39% of it — 164px of a part that needs 419.
Nothing failed; the images looked fine, and a reader called that plate "6x4" from the third of it that survived.
Two independent readers rediscovered the clipping before the score did, one noting it could only prove ">=7 studs long" because apparent length saturated at the frame.
Sizing the cell to its own content — climb until a gap of clear rows — recovered the missing parts.

**Anchor:** the content-scan crop in the inventory thumbnail probe; `302926` went 876x164 to 876x419, `303226` 787x163 to 787x301, and the only dimension miss in the naive baseline was the clipped `302926`.

## Reading a part from an isolated thumbnail is a different problem from reading it out of an assembly

The same model, asked what part a step adds, answered 6 of 6 assembly crops at 0.35-0.58 self-reported confidence and got at least one plainly wrong.
Asked the same question about the booklet's own inventory thumbnails — one part, isolated, on a plain ground — it scored 28/28 on stud dimensions, and the naive control prompt still scored 27/28.
The prompt was worth about 4 points; the picture was worth the rest.
Every surviving miss was a taxonomy artifact, where the answer vocabulary had no entry for an arch or a modified brick, not a misreading of the shape.

**Anchor:** `output/vision-benchmark.json`; labels are element ids paired from the text layer by `apps/web/src/instructions/parts-inventory.ts`, resolved to part names against Brickset's published inventory for set 21066.

## A hand-assembled parts array is not a document

The instruction-render probe spread four correctly-stacked, on-lattice parts into an empty document's `parts` array and got twelve blocking issues back.
A stud sitting inside another part's body is legal only through a collision allowance whose `requiresValidatedConnection` is true, so with no connection edges every legitimate stud connection reads as `PART_STUD_BODY_COLLISION`, the assembly reads as `DISCONNECTED_ASSEMBLY`, and the untouched `submodels`/`steps` member lists produce a mismatch per part.
Building the same four placements through `createPlacePartTransaction` and `applyBuildOperations` — the path the editor itself uses — validated clean.

**Anchor:** `apps/web/e2e/instruction-render.spec.ts`; twelve blocking issues (`DISCONNECTED_ASSEMBLY`, three `PART_STUD_BODY_COLLISION`, four `STEP_MEMBERSHIP_MISMATCH`, four `SUBMODEL_MEMBERSHIP_MISMATCH`) became zero with no change to any transform.

## A step highlight is an open contour whenever the parts go behind built ones

The booklet outlines each step's new parts in yellow, which keys out of the page almost noise-free, so filling that outline looked like a free per-step target region.
Half of them do not fill. Where a step's parts pass behind something already built, the booklet stops the yellow at the occluding edge and lets the black line art of the part in front carry the rest of the boundary, so the contour is open by design and encloses nothing.
Thickening the stroke to bridge antialiasing gaps is worth doing — it repaired both open contours on page 160 — but it cannot close a contour that was never drawn closed, and pages 100 and 140 have no closed contour at all.
A per-step score therefore cannot be an area comparison alone: it needs the stroke itself, scored against the candidate's own boundary, and must report an unavailable region as unavailable rather than as zero agreement.

**Anchor:** `apps/web/src/instructions/highlight-region.ts` and `apps/web/e2e/highlight-region.spec.ts`; 19 of 36 contours closed over pages 12, 24, 40, 60, 80, 100, 120, 140, 160, 180, 200 and 214 of `recipes/6651557.pdf`; page 12 step 6 fills exactly and page 12 step 5 encloses nothing.

## A document's parts are not in insertion order

The closed-loop probe rendered a candidate's silhouette by placing it, then colouring `parts[parts.length - 1]` — "the part just added".
It is not: `applyBuildOperations` returns parts in an order that does not track insertion, so about half the time the mask highlighted the base plate instead of the new brick, and the score compared the wrong shape against the step's highlight.
The symptom was that two spellings of one placement — a 2x4 brick at yaw 0 and at yaw 180, which occupy the same studs and the same space — scored 0.38 and 0.96.
That is impossible for identical geometry, and rendering both masks and differencing them confirmed it: zero differing pixels once each was keyed by the id its own transaction returned.
`createPlacePartTransaction` returns `partId` for exactly this reason.

**Anchor:** `apps/web/e2e/build-search.spec.ts`; observed `partId manual-part-426e9bee…` against `lastPartId manual-part-4a593702…`, mask areas 21541 and 59230 for the same placement; the rebuild went from 1 of 6 parts correct to 6 of 6 with no change to the enumerator, the score, or the driver.

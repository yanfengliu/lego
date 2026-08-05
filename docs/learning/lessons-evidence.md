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

## A step's highlight is not always where the part ends up

The closed loop scores a candidate by projecting it through the fitted camera and comparing its silhouette to the step's yellow highlight.
That assumes the booklet draws the new part where it goes. This booklet does not always do so.
Early steps are drawn exploded: the new part sits below or beside the assembly with red arrows showing where it travels, so its outline is in the right shape and the right orientation but the wrong place.
Later steps highlight the part in position, as the score assumes.
Both conventions appear inside the first fifty steps, and there is no announcement of which is in use — the red arrows are the only signal, and they are unambiguous because nothing else on the page is that red.

So the highlight is two different measurements depending on the step, and a scorer that treats it as one will reject the correct placement on the exploded ones.
An exploded step still constrains a great deal — shape and orientation identify the part, and the arrows point at the destination — but position has to come from somewhere else.
The cheapest somewhere else is the next step: step N+1 draws the assembly with step N's part already in place, so a candidate placement for step N is scored against step N+1's picture rather than step N's highlight.
That costs one step of lag and no new machinery — the beam already carries several branches forward, which is exactly what is needed to defer a verdict by a step.

Measured before it was built, on a synthetic booklet with the answer known and the highlight deliberately drawn around a ghost lifted 48 LDU off its landing site, scoring every distinct legal placement rather than the ones a prune kept.
The current highlight score ranked the true placement first on none of five exploded steps — rank 31 of 126, 44 of 132, 21 of 49, and two steps where every candidate tied at zero — which is the reported failure, reproduced.

The count of 19 was wrong and is corrected here rather than deleted, because the way it was wrong matters more than the number.
It came from keying red pixels over the whole panel, and red on these pages is a red part or a sub-build's own arrow as often as it is this step's displacement arrow.
Measured again with shape tests on the red — long, thin, one end fatter — and the requirement that the arrow start at what this step highlighted: 28 of the 49 pairs in the first fifty steps print no red at all, step 12's "arrows" are a red 2x6 plate, and steps 14, 29, 30 and 47 print arrows belonging to sub-builds drawn inside the same panel, two of them in grey inset boxes rather than the white ones a colour test would catch.
Three steps survive every test. The convention is real and the trap is real; the population is much smaller than a colour key suggests.
Scored against the next panel it ranked first on all five, by 0.29 to 0.73 of IoU over the best wrong placement.

The shape of the comparison mattered more than the idea.
The literal reading — the candidate's pixels are model in panel N+1 and page in panel N, as a share of the candidate — is a coverage, and a small placement hiding inside the region buys it: 3 of 5.
Comparing the candidate's whole silhouette against the difference is also wrong, because a part landing in front of what is already drawn changes nothing where it overlaps: 3 of 5.
Comparing only the pixels the candidate would *newly* cover, as a region with both precision and recall, is what works: 4 of 5.
The fifth is a 2x2 brick standing in the middle of a 6x6 plate — its silhouette lies entirely within the plate's, so it emerges nowhere and the region is empty, which the score reports as unavailable rather than as disagreement.
A second reading covers it: every pixel the two panels disagree on, which sees the brick because brick faces do not shade like a plate top. That reading is 5 of 5, but it asks the panels to be registered pixel for pixel, and two pixels of registration error cost it that step.

**Anchor:** `apps/web/e2e/first-fifty.spec.ts` counts red-arrow pixels per panel and records `exploded` per step in `output/first-fifty/score.json`; 19 of 50 on the sample booklet, steps 1 through 16 almost all exploded and steps 30 onward almost all in place.
`apps/web/src/assembly/exploded-score.ts` and `apps/web/e2e/exploded-resolution.spec.ts`; `output/exploded-resolution/score.json` records rank and margin per step per metric — highlight score 0 of 5, emergence 4 of 5 at a mean margin of +0.33, the two readings together 5 of 5 at +0.50 and 4 of 5 under two pixels of misregistration.
The emerged region also prunes: 427 distinct placements to 285 across the five steps, keeping the true one every time.

## Part dimensions are published

Every official LDraw part file states a part's geometry in LDU, and the library serves them one file at a time over HTTP under CC BY 4.0.
So the stud pattern of any real part is a lookup, not a judgement call, and `scripts/ldraw-part-facts.mjs` does the lookup: it walks a part's subfile references composing transforms until it reaches stud primitives, and takes body extents from the triangles and quads on the way.

It earns its keep immediately. Run against twenty-three parts that had just been hand-authored from memory, it found one wrong: the two studs of `34103`, Plate 1x3 with 2 Studs Offset, sit at plus and minus 10 LDU, not plus and minus 20.
They are half a pitch off the cell grid — between the cells rather than on the outer ones — which is exactly what "Offset" in the part's name means, and exactly the kind of detail that is invisible until something is built on it.

Two traps inside the tool itself, both worth keeping:
LDraw builds a part's underside tubes out of stud primitives too, so a 2x4 brick reports eleven studs until the top face is separated from the bottom — eight on top, three tubes beneath.
And the library rate limits a burst of subfile requests; reporting a non-404 as "no such part" made eight real parts look nonexistent until it retried with backoff instead.

**Anchor:** `scripts/ldraw-part-facts.mjs`, validated against Brick 2x4 (80x40x24, eight studs) and Plate 2x4; correction to `34103` in the catalog with a new geometry hash; measured wedge-plate facts — Wing 2x4 Left/Right are 40x80x8 with four studs along one edge at x -10 / +10, Wing 2x3 Left/Right 40x60x8 with three.

## Simulate bricks in centimetres, not LDU or metres

Two scale traps, one cause: a brick is small, and solvers are tuned for objects around a metre.

One LDU is 0.4 mm, so a 2x4 brick is 80 by 24 by 40 LDU and 0.032 m across.
Feeding either unit to a solver puts every object orders of magnitude away from the size its default tolerances, sleep thresholds and contact slop assume.
Centimetres put a 2x4 brick at 3.2 by 1.6, which is the range those defaults were chosen for. Gravity is then 981, not 9.81, and mass stays in grams so the system is consistent.

The second trap follows from the first. A brick dropped 8 cm reaches about 125 cm/s, which is 2 cm of travel in a sixtieth of a second — larger than most of the parts involved.
A ground plane modelled as a thin sheet is crossed entirely within one step and the body keeps falling with nothing to report: the collider was 20 micrometres thick and the brick came to rest 11 LDU *below* the plate.
The ground is a slab deep enough that nothing crosses it in a step, positioned so its top face is the build plate, and dynamic bodies enable continuous collision detection.

**Anchor:** `apps/web/src/physics/rapier-world.ts`; the landing test in `rapier-world.test.ts` failed at y=23.37 against a plate at y=12 before the ground was given depth.

## A panel's own stud grid fits the camera, but not where the model sits

The closed loop scores a candidate placement by projecting it through the panel's camera, so on a real booklet the camera has to come from somewhere.
Fitting it by rendering the model we have built cannot start: at step 1 nothing is built, and the parts this set opens with — a 4x4 round corner plate and an arch — are not in the catalog and cannot be rendered at all.

The panel carries its own calibration target. Every stud sits on the same 20 LDU square, so the two grid directions, printed dozens of times across one picture, fix azimuth, elevation and pixels per stud with no part identities involved.
Measure the two shortest repeats in the picture's own autocorrelation, and solve `a = s(cos az, sin el sin az)`, `b = s(-sin az, sin el cos az)` in pixels with y down: four measured numbers, three unknowns.

Three things had to be got right before it worked on real art.
The autocorrelation must be normalised over the pairs that overlap, not over their count — a plain mean is biased towards long offsets, which drop the pixels near the art's boundary, and ranked that way the strongest repeat is `4a` while the grid step never makes the shortlist.
The peaks give some primitive basis of the lattice but not the camera's own pair, so every small unimodular change of basis is enumerated and the axonometric residual chooses; below 35 degrees of elevation `a + b` is shorter than `b`, so peak strength alone picks the wrong pair.
And the offset window has to hold the largest pitch in the book: a step drawn twice as big has twice the pitch, and a window that stops short locks onto something else entirely — step 4 came back at 34 points per stud against the booklet's 16.

The residual is a fit quality, not a proof, and that is measured rather than assumed: a rhombic grid, which no square grid could project to, still reads under 1% of pitch once a change of basis is allowed, and a quarter of random plausible lattices pass the 0.02 gate.
What the gate separates on a booklet is a fit that found the grid from one that locked onto the wrong repeat — the refused panels come back at a third to twice the booklet's pitch.
Two attempts at an independent per-panel proof that the picture is a stud grid both came up short, and the failures are the useful part.
Second moments of the folded cell are worthless: a featureless cell spreads its weight uniformly, which is the most circular and the widest a cell can be, so mush scores 0.999 circularity and 0.408 radius against 0.99 and 0.234 for a clean synthetic stud. Both statistics are maximised by having no stud in them, so the three assertions written on them could not fail, and the refused panels scored better than the accepted ones.
A radial profile of the folded cell is honest but weak: 1.52 on accepted panels against 1.17 on refused ones. The clearest per-panel signal is the grid's own autocorrelation, 0.26 against 0.11, and even that overlaps.
The evidence the fit is right is elsewhere: the overlays, thirty-two independent panels agreeing on four cameras, and the round trip through the repo's own camera.

What the grid cannot give is translation. A grid is the same grid one pitch over, so the fit pins the projection to a lattice phase and no further; `centerXPx` and `centerYPx` still need one known part.

**Anchor:** `packages/rendering/src/camera-fit-lattice.ts`, `camera-fit-lattice-phase.ts`, driven by `apps/web/e2e/camera-panel-fit.spec.ts` over the first 40 steps of `recipes/6651557.pdf`.
32 of 40 panels fit; the 8 refusals are steps drawn from underneath or too small to carry a grid, and the residual gate separates them cleanly — every accepted panel under 0.008 of a pitch, every refused one over 0.03.
Predicted studs land 0.94px from the ink under them, 4.1% of the median 21px pitch, over 99% of grid sites — bounded above by the measuring aperture, so read it with the control beside it: the same aperture half a cell off the prediction holds 1.11 times less ink.
Four camera runs found (steps 1-9, 10-15, 16-34, 36-37) with azimuth and elevation holding to about 0.3 degrees of standard deviation inside a run, which is the booklet turning the model over and back.
Round-tripping the fitted numbers through `createOrthographicViewCamera` and re-fitting the render recovers them to 0.04 degrees and 0.14% of scale.

## The phase of a repeat is not the centre of the thing that repeats

Having fitted a panel's stud grid, the obvious way to say where the studs are is the argument of the picture's fundamental Fourier component at the grid frequency.
It is off by half a cell. The first overlay drawn that way put a predicted ellipse squarely in every gap between the drawn studs — the grid was right, the pitch was right, the direction was right, and every mark was wrong.

A Fourier phase locates where the pattern's fundamental peaks, which is a property of how the thing is inked, not of where it is.
The fix costs nothing extra: fold every art pixel onto one grid cell and take the circular mean of the folded ring's own contrast. That is the stud's centre by construction, and the same fold already had to be computed to check the stud's shape.

The fold's sign has its own trap next to it. A pattern peaking at `p0` makes the transform's argument `-2*pi*f.p0`, so the phase that names a grid site is the negated argument; signed the other way, every mark lands mirrored about the panel's centre.

**Anchor:** `foldedStudShape` in `packages/rendering/src/camera-fit-lattice-phase.ts` and the `latticeSite` doc comment; `output/camera-fit/overlay-003.png` was the picture that showed it.
Reprojection error against the drawn studs is 0.96px with the folded centre; the Fourier phase put it near half a pitch, about 20px.

## An LDraw part has no inside, because its hollows are open primitives

The obvious way to check that a hand-authored box union contains a real part is to cast a vertical ray through the part's triangles and count crossings: odd means inside.
It reported 154 solid samples outside the arch's box union, with a worst gap of 11.86 LDU — a wide, hollow region under the span where no material could possibly be.

LDraw does not build a hollow out of a closed box. `box5.dat` has five faces and `box3u2p.dat` has three; the missing faces are the ones nothing would ever see.
A ray through `3659.dat` at the middle of the arch comes back with three crossings, `[0, 0, 4]`, so parity flips at the top surface and never flips back, and everything below the span reads as solid.
Nothing about the part is wrong. Parity is simply undefined on a mesh that is not closed, and the LDraw library is full of such meshes on purpose.

Containment does not need parity. If every point of the real surface lies inside a closed union of boxes, so does the solid that surface bounds.
Sampling each triangle's vertices, edge midpoints and centroid answers the question the invariant actually asks — may the model refuse a placement the real part allows, and never the reverse — with no notion of inside at all.

The profile measurements themselves were never at risk: the first and last crossing along a ray are the outer surfaces whatever the parity does, which is what the staircase heights were read from.

**Anchor:** the eight compound parts added in `packages/catalog/src/catalog.ts` for `builtin.basic-parts/5`.
Parity reported 154 uncovered samples for `builtin:arch-1x4` and 100 for `builtin:arch-1x6`, and zero for the six parts with no hollow under an overhang; the surface test reports 0 outside for all eight across 7245 surface samples.

## Measure the art you are imitating, rather than asserting its dialect in a comment

The instruction finish was built on a premise stated in its own source: booklet art is unlit, one flat tone per part, with the shape carried entirely by printed outlines.
Nobody had measured a page. Sampling the set's own printed part pictures says otherwise on every count.
A white 2x3 brick spends three tones on its three visible faces — 246 pointing right, 240 on top, 223 pointing left — and a light bluish gray 2x2 spends 170 / 161 / 151 on the same three.
Every stud is a light cap over a near-black wall, 178 then 15 in grey and 245 then 8 in white, which is what makes a printed stud read as a bump instead of a circle drawn on a surface.
Edges are inked in a colour that contrasts with the fill rather than in one ink: about 110 on a black part whose body is 47, about 85 on a grey part whose body is 165.
The flat premise had produced renders with three to six colours where a real panel has 4,657 to 15,134, and it had given this catalog's black (#05131D) an ink of #1A1A1A — lighter than the fill it was outlining, so black parts printed with no edges at all.

The measurement was cheap and available the whole time: `output/inventory-thumbnails` holds 265 isolated printed parts at page resolution, one per colour and shape, which is a better reference than a page of assembly because nothing occludes anything.

**Anchor:** `packages/rendering/src/instruction-finish.ts` carries the fitted model and the numbers behind each term; `apps/web/e2e/instruction-finish.spec.ts` renders the same three subjects the reference has and holds the palette exact.
Off-palette share 0.000 and inked silhouette 0.995-1.000; the offset-line pass it replaced had been measured broken along 38-68% of a silhouette, at 800px as badly as at 420px.

## Two consecutive printed panels are one drawing moved

`panelDelta` reads where an exploded step's part went by differencing step N's picture against step N+1's, and it needs the two panels in one raster.
A synthetic booklet has that by construction — both panels come out of one camera into one frame — and the previous session flagged it as the assumption most likely to break on real art.

It does not break, but it is not free either.
Measured over the first fifty steps of `recipes/6651557.pdf`: the printed drawing moves a median of 23 points between one panel and the next and up to 530 at a page turn, while the zoom holds to about a tenth of a percent inside a run of steps drawn with one camera.
So the registration is a shift, and the shift has to be found.

The scale must not be found the same way.
Region agreement is a biased objective here, because the model grows between the panels: the next panel's silhouette contains this one's, so shrinking the next panel raises the intersection over union until the search hits the bottom of whatever range it was given.
On steps 2 to 3 it returned 0.849 against a camera-fit measurement of 0.924, an eight percent error that moved the emerged region a whole part away from where the step's part landed.
The camera fit already measures the scale — pixels per stud, to about one percent — so it is held and only the shift is searched.

Held that way, consecutive same-camera panels agree over 91% of their assembly silhouettes at the median, and their outlines sit one to two pixels apart.
The synthetic score was stress-tested against a deliberate two-pixel misregistration, so a printed pair lands at the edge of what was already known to survive.
Where the booklet turns the model over, agreement falls to about half and no similarity transform can help — which is the useful behaviour: an unregisterable pair reports a low agreement rather than a confident wrong answer.

**Anchor:** `apps/web/src/assembly/panel-registration.ts` and `panel-art.ts`, driven by `apps/web/e2e/real-panel-registration.spec.ts` over the first 50 steps.
49 of 49 consecutive pairs aligned; 29 share a camera and 2 turn the model over.
Median assembly agreement 74% over all pairs and 91% over same-camera pairs, against 55% for the panels as cropped; median outline gap 1-2px inside the long camera run of steps 17-37, and `output/real-panel-scoring/pair-020-021.png` shows that pair at 97% as near-solid yellow with single-pixel fringe.

## A sub-assembly box is joined to the model by its leader line

Taking the largest connected non-background region is how `camera-panel-fit` isolates the assembly from the step number, the callout box and the progress bar, and it works there.
It does not survive a step that draws a sub-build.
Step 14 of the sample booklet prints a white box holding a two-step sub-assembly and joins it to the model with a printed leader line, so the box and the model are one connected region — and a 400 by 170 rectangle of white came through as part of the assembly and read as a part that appeared between the panels.

Opening the mask to sever the line is worse than the problem.
Printed art is line work: an erosion of three pixels at a thousand-pixel panel width fragmented step 4 into 125 components and left the largest holding a sixth of the drawing, which then fitted a camera at 21 pixels per stud against the booklet's 40.

The fix is to key the white first. The page is grey, the model is not white, and everything the booklet prints on white — callout box, sub-assembly box, step number, progress bar — goes with its bounding box before the components are counted.

**Anchor:** `keyPrintedBoxes` in `apps/web/src/assembly/panel-art.ts`, and the `openingRadiusPx` note on `isolateAssembly` that records why the opening defaults to off.
With the white keyed out, panels fitting a camera went from 37 to 39 of 50 and median assembly agreement from 66% to 74%.

## A printed step's panel difference finds the right stud, not the right offset

`scoreExplodedStep` reads where an exploded step's part went by differencing the step's panel against the next one's, and on a synthetic booklet it ranked the true placement first on all five contested steps with a mean margin of +0.50.
Run against the printed booklet it does something weaker, and the sample is far thinner than the synthetic result implies.

Thinner first. Of the 49 consecutive pairs in the first fifty steps, 3 are well posed for the question at all.
38 print no arrow that survives a shape and origin test; 5 fit no camera on one side, so there is no grid for the part to move on; 2 close no highlight contour, so the part's printed shape is unavailable.
Establishing an answer to check against is most of the difficulty, and it is the part a synthetic booklet hands over for free.

Weaker second, and the weakness is specific.
Sweeping the step's own printed silhouette across the fitted stud grid and scoring every offset with the real `scoreExplodedStep`, the top-scoring offset landed 0.57, 0.60 and 2.50 studs from where the step's red arrows point.
The do-nothing offset — the part already drawn where it lands — ranked last of 1851 and last of 2168 on the two clean steps, so the reading does reject staying put.
But the arrow's own offset ranked 43rd, 82nd and 271st: first place on none of them.
That is not the surprise it reads as. About seventy candidate offsets sit within one stud of any point, because a stud pitch is 40 pixels and a plate of height is 13, so ranking was never going to separate the answer from its own neighbours.
The distance from the winner to the answer is the number that means something; the rank is the number that looks like it does.

What the reading gives is a prior over a neighbourhood roughly a stud across. Physics and the part's identity have to resolve it from there.

The sharpest thing the measurement says is not about the score at all. It is where the lookahead registers.
Take the pairs a difference could honestly be read from — assembly agreement above 0.80 and outlines within three pixels — and 22 of 49 qualify: steps 8, 17 through 26, 29 through 33, 36, 41, and 44 through 47.
Take the steps that need the lookahead, the ones drawing their part somewhere other than where it lands: 2, 10 and 13.
The two sets do not intersect at all.
The reason is the build, not the printing. A step needs the lookahead early, when the model is small and the booklet is rezooming hard between panels — median agreement 57% over steps 1 to 15 — and the panels register beautifully later, when the model is big and stable and the highlight is already drawn at the landing site — 94% over steps 17 to 37.
A picture-to-picture lookahead is therefore best exactly where it is least needed. Anything built on it has to carry the registration quality as a per-pair fact and fall back when it is poor, rather than assume the reading is available.

The arrow itself came out of this looking better than the thing it was checking, so it was measured too.
Across the first fifty steps, 13 print a red arrow that survives the shape and origin tests — steps 1, 2, 10, 12, 13, 16, 32, 35, 38, 40, 45, 48 and 49 — and 11 of those draw it on the model rather than on a sub-build strip beside it.
The strips have to be separated out, because this booklet draws whole sub-builds as numbered panels inside a step's panel and rings each sub-step in yellow exactly like a main step: "the arrow starts at something this step highlighted" does not tell them apart and "the arrow's tail sits on the assembly" does.
Steps 32 and 48 are the two that do not, and step 48's own numbers give it away — a head sitting 253 pixels from the nearest built model at the end of a 29-pixel arrow is not an arrow spanning a gap in that model.

Where an arrow is on the model, it is precise, and biased by an amount the same page states.
Arrows on one step agree with each other to between 0.5 and 4.0 pixels, a median of 1.0, which at these panels' 21 to 43 pixels per stud is a few hundredths of a stud.
Each is also systematically short, because it is drawn clear of the ghost at one end and clear of the landing surface at the other, and measuring both gaps gives 0.00, 0.05, 0.38 and 0.47 of a stud on the four steps where a camera fitted — a median of 0.22.
That is a bias to subtract rather than noise to live with, because the two gaps are readable off the same pixels as the arrow.
So the arrow is worth about a fifth of a stud raw and a twentieth once the clearance is added back, which is inside what a placement needs — and an order of magnitude sharper than the panel difference it was brought in to check.

**Anchor:** `apps/web/src/assembly/lattice-placements.ts` and the docstring on `scoreExplodedStep`, measured by `apps/web/e2e/real-panel-registration.spec.ts`; numbers and overlays in `output/real-panel-scoring/`.
0 of 3 scored steps ranked the arrow-implied offset first and 2 put the top offset within a stud of it; median margin -0.037.
The reference is the red arrow's own tail-to-head vector, which the score never reads, and it is good to about half a stud because an arrow is drawn with clearance at both ends.
`placement-010-011.png` is the picture to look at: the emerged region sits squarely on the landing site and the score's winner and the arrows' answer are half a stud apart.

## Give each Playwright run its own dev-server port

The e2e global setup pinned vite to port 5267. With several agents working in one checkout the obvious cost was queueing — "Port 5267 is already in use", tens of minutes lost each, and one agent resorting to killing every node process, which took a sibling agent down with it mid-flight.

The cost that actually mattered was invisible. Two runs that *do* get through share one dev server, and therefore share the application's state. A spec that calls `resetScene` clears the model out from under another run's spec, which then measures an empty viewport and fails an assertion about the part it placed.

That is how `compound-part-shapes.spec.ts:64` came to be reported as red on `main` by two separate sessions: its silhouette-differs-from-a-plain-box assertion failed because another run had wiped the placed part. On a port of its own the same commit passes. Nobody had introduced a defect, and a real morning could have gone into finding one.

The port is now derived from the process id in `playwright.config.ts`, with `LEGO_E2E_PORT` to pin it. It is chosen in the config rather than in global setup because Playwright reads `baseURL` before setup runs, so that is the last moment the server and the tests can still agree on a number.

**Anchor:** `playwright.config.ts`, `apps/web/e2e/global-setup.ts`; `compound-part-shapes.spec.ts` red under contention and green on a free port at the same commit (0267c09); full suite 31 passed.

## Matching a gallery one item at a time discards the constraint that makes it a gallery

Naming the part a step adds is matching its printed callout drawing against the back-of-book parts list, which is a labelled gallery of the same drawings.
Letting every drawing take whichever element it looked most like reconciled 1245 of the booklet's 1465 pieces, over-claimed 227, and left 39 elements never claimed at all — drawings had piled onto a few popular elements while the right owners went hungry.

The book draws each element exactly one way, so 273 distinct callout drawings and 276 listed elements very nearly pair off one to one.
Making the choice once for the whole book as a minimum-cost assignment under that constraint, with no other change, took it to 1313 pieces reconciled, 141 over-claimed, 11 elements never claimed, and 203 of 276 elements at exactly the printed quantity.
The gain is entirely in what the constraint forbids: taking an element now costs every other drawing the chance to take it, so a confident wrong match can no longer crowd out a less confident right one.

**Anchor:** `scripts/part-assignment.mjs`; `output/part-identification/score-deterministic-nearest.json` and `score-deterministic-one-to-one.json` over the 863 physical callouts of `recipes/6651557.pdf`, both binding features `sha256:34a746c823add2e…`, match `sha256:d7d88ac846af540…` and distances `sha256:5a93f850136be35…` in their own `inputDigests`. The effect was first measured on an earlier closure generation whose numbers (870 callouts, 1256 → 1308 reconciled, 230 → 158 over-claimed) no longer reproduce; these are the current ones, recomputed 2026-08-04.

## Elements differing only in colour are one shape twice

The set lists a 1x2 tile with a groove in black and the same tile in white under two element ids, and 34 of the black ones were claimed as white.
The colour term was there, but it searched each part's top tones for their closest approach — and every part in this booklet carries the same pale highlight, so a black tile came within 0.11 of a white one and the shape term drowned the rest.
Comparing the tones where they actually are, mean ink colour and light face rather than nearest match, and giving colour a third of the weight, cut over-claims from 439 pieces to 230.
The same pass added an interior-shading grid, because a 1x2 grille tile and a plain 1x2 tile have identical silhouettes and the set holds 54 of the grille.

**Anchor:** `colourDistance` and the `detail` grid in `scripts/part-thumbnail-image.mjs`; over-claims 439 → 230 and elements at exact quantity 139 → 174 with the assignment held at `nearest`.

## Make a vision call answer the same question twice

The callout card asks the model to describe the part in words and to point at a candidate from the parts list, and the candidate's published name is something the model never sees.
Where the two answers disagree the pick is dropped, and on Haiku they disagreed on 214 of 265 drawings: it read a Tile 1x4 as "plate 8x4", a Plate 2x10 as "plate 12x2", and a Brick 1x4 as "brick 4x2".
It is a real check rather than a formality — it is the reason a model that reads stud counts this badly cost only two elements of accuracy instead of wrecking the run: conservation went 203 → 201 elements exact and 1308 → 1301 pieces with every Haiku pick applied.

The lesson is not that model calls do not belong here. It is that the pairing of a free answer with a closed-set answer is what makes one safe to use, and that stud counting on a 200-pixel booklet thumbnail is beyond a small model — Sonnet read the same 3x3 plate correctly where Haiku called it 4x4, at roughly fifteen times the wall clock per call.

**Anchor:** `visionPick` and `describesSameThing` in `scripts/part-identification-score.mjs`; the adjudicated variants that carry `descriptionAgreement.either` 214 of 265 were measured on the 870-callout closure generation and are retained as `output/part-identification/history/score-adjudicated-*-stale-*.json` beside `history/answers-haiku-stale-2d0c01db.json` and `history/answers-sonnet-legacy-7e8559d4.json`. They cannot be recomputed from the current 863-callout closure without a separately authorized model call, so the live `score-*.json` set is deterministic only.

## A plate of height projects to a third of a stud, so a looser tolerance cannot see layers

Inverting a printed arrow's pixel displacement back onto the brick grid is underdetermined — two numbers, three axes — and the integer grid is what makes it tractable.
How tractable depends entirely on the tolerance, and the number that sets the tolerance is not the measurement's accuracy. It is the height quantum.

A plate is 8 LDU against a 20 LDU stud pitch, and under an axonometric view at 35 degrees of elevation it projects to `cos(35) * 0.4` of a stud pitch — 0.322 to 0.330 across every panel of the sample booklet that fitted a camera.
So a tolerance at or above a third of a stud admits the layer above and the layer below by construction, and the answer is a family containing its own neighbours: measured at 0.35, the booklet's arrows admit 12 to 18 whole-grid displacements apiece.
At 0.15 — under half a plate, and still three times the corrected arrow's own scatter — the same arrows admit 2 to 4.

The first version defaulted to 0.35 because that was comfortably above the measurement error, which is the wrong thing to be comfortable about.
A tolerance is chosen against the quantum it has to resolve, not against the noise it has to tolerate, and when those two disagree the quantum wins or the result means nothing.

**Anchor:** `arrowDisplacementFamily` in `apps/web/src/assembly/arrow-placement.ts`, and the test that asserts the plate quantum before asserting anything about family size.
Blind sweep of the same grid: about 2000 offsets. Arrow at 0.35 studs: 12 to 18. Arrow at 0.15: 2 to 4.

## A shape test that works on a solid blob need not work on printed art

A red arrow is the booklet's only statement of where a part travels, and red is the obvious way to find one.
The set has red parts too, so shape has to separate them, and the two obvious tests do not.
A 2x6 plate seen in axonometric is three times longer than it is wide, which clears an elongation gate meant to catch blobs, and on a panel drawn at 21 pixels per stud it is under an area cap sized for a panel drawn at 42.
Steps 12 and 16 of the sample booklet each let one through, and each produced a diagonal displacement — which matters more than the count, because they are the *only* two diagonal displacements in the first fifty steps.
A reader that trusts them reports that the booklet mixes vertical drops with diagonal travel, on the evidence of two bricks.

The obvious third test is how much of its own oriented box the shape fills: an arrow is a shaft with a head and fills about a third, a plate fills most of it.
It is right about a plate and wrong about a *drawn* plate, and it did not fire on either offender.
Instruction art rings every stud and shades every face, so the saturated red of a printed brick is a sparse figure, not a filled rectangle — it came through under the same threshold the arrows did.
The test was written, unit-tested against a solid rectangle, passed, and changed nothing on the corpus it was written for.

The lesson is not about fill. It is that a shape test has to be validated against the art it will meet, not against a synthetic instance of the thing it is meant to reject — and that "the test passes" and "the test fires" are different claims.
What does separate them in this data is length, 4.7 and 6.1 stud pitches against about 2 for every confirmed arrow, but two examples is not a threshold and a length cap needs the camera scale that one of the two panels has not got.

**Anchor:** the `maxFillFraction` option in `readDisplacementArrows`, `apps/web/src/assembly/panel-arrows.ts`, whose doc now records that it does not catch the case it was added for.
Zero of step 12's 10 rejected red regions and zero of step 16's 31 mention fill.

## A measurement computed after an early return reports zero, and zero reads as an absence

Three times in one session, a number that decided a design question was computed after the code path that skipped it.
A step that printed a perfectly good arrow and then failed for want of a fitted camera returned through a blank-report helper that hardcoded zeros, so the census of "how many steps print an arrow" answered "how many steps got all the way through" instead.
The same fault hid the on-model test and the clearance measurement, both of which sat below the skips.

It is not a subtle bug and it does not look like one from the code: every field is populated, every value is a plausible number, and nothing throws.
It is only visible against the world — the panels plainly had arrows on them — which is why it survived a careful read of the diff and died the moment the pictures were opened.

The cost was the headline: arrows on the model went from 3 to 11 when the measurements moved above the skips, and 3 would have been small enough to abandon the approach.

The rule is that a measurement belongs at the point the thing it measures becomes available, not at the point the caller happens to want it, and a report that cannot distinguish "measured zero" from "never measured" should be returning null.

**Anchor:** the `skipClearances` / `skipArrowsInsideAssembly` / `skipFamily` publication in `apps/web/e2e/real-panel-scoring.ts`, hoisted above every skip with a comment saying why.

## A safety barrier that lives only in a document is not a barrier

The quarantined 3245 Builder discovery tool handles one untrusted 85,098-byte third-party bundle, and its handoff and commit message explained why it could not be decoded here: "the only registered Python is `C:\Python314\python.exe` 3.14.0", against a pinned UnityPy wheel that needs 64-bit CPython 3.13.
Nobody had run `where python`.
It resolves first to `C:\Users\38909\miniconda3\python.exe`, CPython 3.13.9, 64-bit, win32; a second conforming 3.13.10 sits in `miniconda3/envs/py313`; and `validate_worker_runtime()` returns cleanly under both. The claimed barrier had never been one, and the suite the same document reported as blocked was in fact running under a conforming interpreter the whole time.

Two separate faults, and the second is the expensive one.
The stated fact was wrong because it was asserted rather than measured — one command would have settled it.
And the barrier it described was documentary: nothing in the code required the pinned environment before handing bundle bytes to a third-party parser, so `build_report(bytes, UnityPy.load, MeshHandler)` from a REPL would have decoded the artifact with no gate at all. A future session reading "the interpreter is the barrier" had an obvious unblocking move — `pip install UnityPy==1.25.3` into the conda base — that removed the last thing standing between an untrusted bundle and third-party parsing code.

The repair was not to reword the document. It was to make the refusal executable: the exact retained identity is now refused unless the active import root passes the full 13-distribution RECORD contract, and the error message names the dead ends, including that the interpreter check is not the barrier and that installing the package does not help.

**Anchor:** `assert_pinned_environment_for_retained_bundle` in `scripts/discover_builder_shell_core.py`, regression `test_retained_bundle_refuses_to_parse_outside_the_pinned_environment`, which fails with `AssertionError: retained bundle must not be parsed` when the gate is removed.
Verified 2026-08-04 by running `where python` and `validate_worker_runtime()` under all four installed interpreters: clean return under 3.13.9 and 3.13.10, `ValueError` under 3.14.0 and 3.10.6.

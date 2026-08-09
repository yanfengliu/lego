# Lessons — evidence

The full entry behind each rule in [lessons.md](lessons.md), in the same order. Each records something that cost real time, with an anchor that proves it happened; unanchored lessons are folklore and do not belong here.

This file is not read at session start. Come here from a rule.

## Entries

## An error message that covers several causes hides the real one

`recoverEvents` reported "Ledger file exceeds its byte cap" for five distinct conditions: wrong file type, extra hard links, a device mismatch, an inode mismatch, and the actual size cap.
46 companion tests failed on the device mismatch, and the message sent every reader to look at byte caps.
Splitting the condition into five messages that each name the observed values exposed the cause in one run.

**Anchor:** fix commit `c068b4c`; `apps/companion/src/run-ledger-file.ts`; 46 failing tests in `run-ledger-adversarial.test.ts` and `test-run-recorder.test.ts`.

## A byte comparison knows only that two files differ

`pin:check` decides staleness by comparing the whole formatted bytes of `run-pin.generated.ts` against what the generator produces, and then reported the failure as a moved run digest.
On a CRLF checkout it printed `holds sha256:366fefbf… but this build produces sha256:366fefbf…` — the same digest twice — and told the reader to regenerate a value that had not changed.
The comparison is right and belongs at the byte level; the message was one altitude above it, asserting a cause the comparison cannot see.
Each of the three `--check` gates now names the domain values that moved when any did, and otherwise says the bytes moved while the meaning did not, with the first differing line.

**Anchor:** 2026-08-07; `scripts/generated-file-staleness.mjs`; the doubled digest is quoted verbatim in `.gitattributes`; guarded by "never prints one pinned value as both held and produced" in `scripts/generated-file-staleness.test.mjs`.

## Naming an ambiguity is not resolving it

The grader stopped promoting a pick when the card displayed both hands of one part, and let it through again once the model's free-text note named the mirror twin by its candidate number.
That check cannot fail on the case it exists to catch. The twin's number is the same number whichever hand was picked, so feeding `visionPick` the swapped pick on card-0039 with the note `candidate 1 is the mirror` returned `vision-kept` carrying element `6392747` — Wedge Plate 6 x 2 **Left** — identical in label and in element to the correct answer.
Nothing downstream closed it either: `describesSameThing` never reads Left/Right, and both mirror pairs in this inventory are quantity 1 and 1, so a swapped pick conserves the printed piece counts exactly.
The block was called `handedness` and the run reported `mirror named 0/4`, so the number read as handedness verified on four cards when it was mirror-pair awareness on four cards.
The hand is a property of the drawing, so it is now read off the drawing: the query silhouette against each hand and against each hand mirrored, area-normalised, the wider overlap deciding. Same swapped input, same note, now `handedness-refuted` with no element.

**Anchor:** 2026-08-07; `scripts/part-identification-handedness.mjs`; the swap and its before/after label are pinned in `scripts/part-identification-handedness.test.mjs` ("rejects the swapped hand even when the note names the twin by number"), which goes red if the refutation branch is removed.

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

## An open contour has no one-sided pixel test

A closed contour is decided by containment — no candidate pixel outside the printed region — which works because the yellow is drawn outward of the silhouette, so the truth is strictly inside it.
An open contour encloses nothing, and the two statements that sound like containment's replacement were both tried on printed step 5 of `recipes/6651557.pdf` and are both false of the right answer.
"Every printed pixel is explained" shipped as a gate for one full run and refused the correct build at 1254 of 1429px: the best of 374 distinct placements of the Plate 2 x 14 is the unique maximum at 907 of the 1081px its own contour prints, and the 174 it misses are the outer row of a two-pixel stroke drawn outward by more than the boundary tolerance — the artist's offset, not the placement.
"No printed pixel lies inside the piece" fails in the other direction: that same best placement has 433 printed pixels inside its own silhouette, because a line two pixels wide straddling a boundary is half inside it, and 166 of the 374 placements cross nothing at all because they are nowhere near the drawing.
What works is maximality: rank by `strokeRecall` — the printed line the candidate's visible boundary passes under, with the precision term dropped because it charges the candidate for the occlusion that opened the contour — and require the run's existing separation margin or defer to the next panel.
It keeps the property containment was chosen for, that a candidate spilling outside the printed contour cannot win, because spilled boundary explains no printed pixel.

**Anchor:** `apps/web/src/assembly/step-score.ts` (`rankStepDelta`) and `apps/web/e2e/real-build-contract.ts` (`assessWholeStepVisualEvidence`); step 5 margins 0.6347 against 0.4962 and 0.2428 against 0.1854 on a 0.01 bar; `stepsComplete` 5, `piecesPlaced` 8.

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

A frontier model does not retire the check, and it does not move the answer either.
Opus 5 answered all 273 drawings of the live closure and contradicted itself on 140 of the 233 it could be checked on, so 93 picks survived — 37% of its 252 positive proposals, against Haiku's 51 of 265.
What those 93 bought, under the one-to-one assignment the headline uses, was nothing at all: 0 of 273 drawings changed, 0 of 863 callouts, 0 pieces, and conservation and first-fifty accuracy identical to geometry alone at 203/276 elements, 1313/1465 pieces and 161/185 callouts.
Under `nearest` it moved 3 drawings and 22 pieces for +1 element and +17 pieces; under `quantity-informed` it moved 10 drawings and 44 pieces and lost 2 elements and 8 pieces.
A global assignment over 273 drawings and 276 elements is already so constrained that a per-drawing prior worth a 0.22 discount changes almost nothing, which is the thing to measure before buying another pass.

**Anchor:** `visionPick` and `describesSameThing` in `scripts/part-identification-score.mjs`; the adjudicated variants that carry `descriptionAgreement.either` 214 of 265 were measured on the 870-callout closure generation and are retained as `output/part-identification/history/score-adjudicated-*-stale-*.json` beside `history/answers-haiku-stale-2d0c01db.json` and `history/answers-sonnet-legacy-7e8559d4.json`. The Opus 5 pass is the live `output/part-identification/answers-claude-opus-5.json` and the `score-adjudicated-*.json` set it produced, whose `descriptionAgreement.either` is 158 of 265 and whose `picked` tally is 346 vision-kept, 41 vision-overruled, 395 self-contradicted, 44 description-unverifiable, 37 refused.

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

## A blocker you inherited is a claim, not a fact

A handoff note recorded that Git writes were unavailable: an exact 15-path `git add` had hit a `.git/index.lock` permission error, and the escalation had been rejected by an approval-service quota said to last four more days.
The next session read that, believed it, and planned around it — staging delivery for later, reporting the goal as blocked on infrastructure.
Nothing was committed. Roughly four thousand lines of independently approved work sat in the working tree, unprotected, across two sessions.

It took one command to disprove. `.git` was writable, no stale lock existed, `git add` returned 0, and the first `git push` succeeded on the first attempt.
The original failure had been real but session-local; what was false was its promotion into a standing restriction.

The same session then found the identical shape a second time, in the same handoff: "the only registered Python is 3.14.0", disproved by one `where python`.
Two inherited claims, both asserted rather than measured, both load-bearing for a decision to not do work.

The rule is not "distrust handoffs" — a handoff that records a real failure is doing its job.
It is that a *blocker* is the one kind of inherited claim that must be retested before it is repeated, because its entire effect is to stop work, and it costs one command to check against days of not shipping.

**Anchor:** commits `a6ebde8` through `88af17d` on 2026-08-04, 144 paths committed and pushed in fourteen pathspec commits after the inherited blocker was tested and found false; the same session's `where python` correction is recorded in [A safety barrier that lives only in a document is not a barrier](#a-safety-barrier-that-lives-only-in-a-document-is-not-a-barrier).

## File metadata cannot see a same-size rewrite

`sameFileState` compared `dev`, `ino`, `size`, `mtimeNs` and `ctimeNs` across a bounded read, and its error promised the file had not "changed identity, size, modification time, or change time while being read".
On NTFS the default clock granularity is about 15.6 ms, so two same-size writes inside one tick are byte-identical in metadata: measured at 72.5–79.0% of 200 samples.
A same-size rewrite injected before the read therefore returned the attacker's bytes with no error in 12 to 26 of 50 attempts, past the pre-open `lstat`, the `fstat` at open, the post-read comparison, the realpath re-check and the ancestor re-check.

The guard test passed. It passed because an `await import(...)` sat between the write and the check, letting the clock tick; replayed without that incidental delay, 30 to 33 of 50 mutations went undetected.

Two closures do not work and both look plausible.
Reading twice and comparing fails because the dangerous rewrite completes *before* the read, so both reads return the same attacker bytes.
Deny-write sharing fails because libuv maps `UV_FS_O_EXLOCK` to `share = 0`, which denies readers too and breaks on any concurrent process, and an exclusive open still cannot see a rewrite that already finished.
What works is pinning content by digest where a digest exists, and saying so honestly where none does.

**Anchor:** `expectedSha256` and `CONTENT_DIGEST_MISMATCH` in `apps/web/e2e/bounded-file-read.ts`, wired at six call sites that already held a digest and were checking it only after the read; regression `never returns same-tick pre-open rewritten bytes`, which returns attacker bytes in 13 of 40 attempts when the check is made a no-op. Attacker reads went from 12–26 of 50 to 0 of 50.

## A check that reads the same constant as the code it checks cannot see that the constant is wrong

A new publisher needed an opt-in flag, and `LEGO_REAL_BUILD_TRANSITIONS=1` was the obvious name.
That variable already existed: `real-build-input-files.ts` uses it to override the *path* the transition-classification input is read from, defaulting to `output/real-build/transition-classifications.json`.
Setting it to `1` made the path `1`, so the run wrote its bundle to a file called `1` in the repository root.

Three assertions ran immediately after the write and all three passed: the returned path ended with `TRANSITION_CLASSIFICATIONS_PATH`, `existsSync` was true, and the bytes read back equalled the bytes written.
They passed because every one of them was computed from the same poisoned constant. `"C:/…/lego/1".endsWith("1")` is true.
The only thing that noticed was `ls` in the directory the file was supposed to be in — and even then it took three runs, a 200 ms existence poller that never fired, and finally writing `process.cwd()` and the resolved target to a file outside the runner, because the reporter's line prefix made the printed path look truncated rather than wrong.

Two rules, and the second is the general one.
Grep an environment variable name before adding it; a repository that reads configuration from the environment has a namespace, and `LEGO_REAL_BUILD_*` was already a path-override namespace.
And a self-check built from the same symbol as the thing it checks is not evidence — it only proves the code is consistent with itself. Verifying a destination means naming it independently: an absolute literal, a directory listing, or a second process.

**Anchor:** `LEGO_REAL_BUILD_PUBLISH_TRANSITIONS` in `apps/web/e2e/real-build-transitions.spec.ts` with the collision recorded at its declaration, against `TRANSITION_CLASSIFICATIONS_PATH` in `apps/web/e2e/real-build-input-files.ts:71`. Observed 2026-08-05 on set 6651557: three consecutive green runs wrote 34,784 bytes to `<repo>/1` while `output/real-build/transition-classifications.json` never existed.

## An exact fit to a symmetric feature set is not one answer

Deriving the Builder-to-LDraw frame of 51739 looked finished the moment the authored node lattice landed on the LDraw-measured stud centres with a residual of exactly zero.
It was not: the four studs of a 2x4 wing sit on a square, a square is invariant under every quarter turn, and the one central tube is on the axis, so eight different frames reproduce that correspondence exactly and four of them are wrong. Zero residual measured how well the anchors matched, and said nothing at all about how many frames match them equally well.
93273 had the same shape of problem for the same reason, and 35480 and 77844 did not — which is only visible if you count.

Two steps fix it, and the order matters.
First divide the exact solutions by the part's own measured self-symmetry, because two frames that differ by a symmetry the part already has emit identical connectors and are not an ambiguity at all: 51739's eight collapse to four classes, 93273's eight to two, 35480's four and 77844's two to one each. Only then is what remains a real choice, and it needs evidence the anchors do not contain — something asymmetric. Carrying Builder's own shell vertices through each surviving class and measuring the distance to the LDraw surface separated them by 27.8x and 18.5x, and the human-checkable form of the same fact is that the wing's wide edge sits at z = +13.66..+20 in LDraw and the rejected turn put it at z = -20..-12.92.

The sharper corollary is about mirrors.
Every one of these parts has a mirror self-symmetry, so a mirrored frame and a proper one are the same frame described twice and no amount of measuring them can tell handedness apart. 5092 is the only pilot part whose symmetry group is trivial, and it is therefore the only place where handedness is a measurement rather than a convention — its best mirrored frame is 5.0x worse. One asymmetric specimen decided a property of all five.

**Anchor:** `exact_frames`, `frames_modulo_symmetry` and `canonical_frame` in `scripts/builder_ldraw_frame.py`; `ldraw_self_symmetries` and `mesh_disagreement` in `scripts/builder_ldraw_frame_witness.py`; regression `test_a_symmetric_part_admits_several_frames_that_are_one_class` in `scripts/builder_ldraw_frame_test.py`. Measured 2026-08-05 over the six-part 6651557 pilot: 8/4/2/8 exact frames reducing to 4/1/1/2 classes for 51739/35480/77844/93273, selection margins 27.8x and 18.5x, 5092 mirror margin 5.0x.

## A clearance probe answers whether a stud fits, never whether anything holds it

Bringing the LDCad Shadow Library in as a third connector source produced 21 under-stud clutch candidates across the six-part 6651557 pilot, and all 21 passed the `clutchRoom` probe against the expanded LDraw surface: the nominal 6 by 4 LDU stud volume was clear and the face was open on every one, worst intrusion 0.117147353 LDU against a 0.230576635 LDU bound.
Read as a verdict that would have said LDCad is right about all 21. It is not one.
Two of those cells are on 51739 at (±30, 8, 10), where LEGO Builder's authored field deliberately declares nothing, and the probe passes there for the same reason it passes everywhere on an underside: an underside is a cavity, so of course a stud fits.
The reverse case is on the same six parts. Builder authors five clutches on 77844 and LDCad authors none, and no probe fires at all on a cell nobody declared, so the geometry is equally silent about the five missing ones.

What does bear on it is a different measurement: how far the claimed cell sits from a real underside tube, because a stud is gripped between the tubes and walls at the corners of its own cell.
Every cell the two sources agree on has a tube exactly 10 LDU away in both plan axes. The two LDCad-only cells on 51739 have their nearest tube 30 LDU away.
That is evidence and still not a verdict — two cells *both* sources author on 93273, at (0, 0, ±30), also have their nearest tube 30 LDU away, and there walls do the gripping.
So the honest output is the disagreement itself: 11 of Builder's 16 pilot cells independently confirmed at 0 LDU, 2 LDCad-only, 5 Builder-only, with the geometry recorded beside each and neither source declared the winner.

**Anchor:** `measure_clutch_room` in `scripts/part_admission_clutch.py` driving candidates from `emit_clutch_connectors` in `scripts/ldcad_shadow_connectors.py`; `grip_evidence` and `compare_positions` in `scripts/derive-ldcad-shadow-connectors.py`; regressions `test_every_emitted_clutch_passes_the_clutch_room_probe` and `test_the_two_disagreements_are_recorded_rather_than_smoothed` in `scripts/ldcad_shadow_test.py`. Measured 2026-08-05 over the six-part 6651557 pilot: 21/21 clutches with room, 11 agreeing cells, 2 LDCad-only, 5 Builder-only.

## The editor keeps its document in IndexedDB, so reloading is not a fresh plate

Proving the five newly admitted 6651557 parts could actually be placed meant driving the served app and clicking the plate once per part, reloading between them so each placement stood on its own.
Every part after the first came back with `partCount: 1` and the same structural hash `sha256:d60cdce0...`, naming only the tile placed first.
Read quickly that says four of the five parts cannot be placed. It says nothing of the kind.
The editor persists its project through `indexeddb-project-repository.ts`, so `page.goto` reloaded the app onto the document that was already there, the click landed on a plate that already had a tile at the centre, and the command refused it — which is the editor doing exactly what it is supposed to do, because an illegal placement is refused at the command rather than flagged afterwards.
Clearing `localStorage` first did not help either, because that is not where the document lives.

A fresh browser context per part fixed it in one line and turned the same five clicks into five distinct structural hashes with zero blocking issues each.
The general shape: when a UI check reuses one page, the app's own persistence becomes a hidden input to every step after the first, and a correct refusal is indistinguishable from a broken feature. Give each independent assertion its own context, or assert on a state you cleared through the app's own controls rather than through the browser's.

**Anchor:** `apps/web/src/persistence/indexeddb-project-repository.ts`; measured 2026-08-05 driving the served app at `builtin.basic-parts/7`. Shared page: 5 placements, 1 part, one hash `sha256:d60cdce0...`. Context per part: 5 placements, 5 parts, 5 hashes, 0 blocking issues each.

## Grading a free-text answer against a controlled vocabulary measures wording, not sight

The identification prompt asks the model for a `"<plain colour name>"`, and `describesSameThing` accepts the answer only if it equals the element's LDraw display name after normalisation.
Those are two different vocabularies, and LEGO greys are exactly where they part company.
Over the 273-drawing Opus 5 pass, colour was the axis that rejected most: 90 disagreements against 55 on stud size and 35 on kind.
63 of the 140 self-contradictions were colour alone, with shape and stud size both agreeing — the model had the part right and lost it on the word.

Splitting those 63 says which half is the model's problem.
23 drawings, 84 pieces, said "light gray" where the sticker says "Light Bluish Gray": the same colour under LEGO's own two names for it.
19 drawings, 130 pieces, gave the hue without the shade — "blue" against "Dark Blue", "grey" against "Dark Bluish Gray" — which is what "plain colour name" invites.
Only 21 are the model actually misreading: 7 called a dark part light, and 14 called a black part dark gray.

So two thirds of the strictest check's rejections were the harness disagreeing with itself about vocabulary.
The check is still worth having and must not be loosened to make the number look better — "dark gray" for a black brick is a real error and belongs in the same bucket as a wrong stud count.
The fix is at the other end: a prompt that grades against a closed vocabulary should print that vocabulary, so a rejection means the model saw the wrong thing rather than said it the wrong way.

**Anchor:** `PART_IDENTIFICATION_PROMPT` in `scripts/part-identification-prompt.mjs` asks for a plain colour name; `describesSameThing` in `scripts/part-identification-score.mjs` compares it to `COLOR_DEFINITIONS[].displayName` by normalised equality. Measured over `output/part-identification/answers-claude-opus-5.json` (273 drawings, 252 positive proposals, 93 kept): `descriptionAgreement` in `score-adjudicated-one-to-one.json` reports colourDisagrees 103 of 265 checked against sizeDisagrees 69 and kindDisagrees 53.

## A check that has stopped checking still reports green

Four separate instances surfaced in one day, in four unrelated subsystems, and every one had the same shape: correct code that had quietly stopped verifying anything, reporting success, and surfacing later as a failure that looked like somebody else's problem.

The first-fifty ground-truth verdicts were keyed by cluster index, which `match` renumbers on every re-cut. All 87 labels stopped binding, and `firstFiftyAccuracy` reported `0/0` — indistinguishable from nobody having labelled anything.
The 3245 Builder quarantine rested on "the only registered Python is 3.14.0", which one `where python` disproved; nothing in the code required the pinned environment before handing bundle bytes to a third-party parser.
The real-build input chain — catalog version, reviewed source pins, coverage, calibration, ledger — had no declared order, so a catalog bump silently invalidated three artifacts and the only symptom was a build rejection that read like a modeling failure.
And `real-build-builder-calibration.test.ts` *detected* the stale artifact, then answered it with `console.warn` and a skipped test: a green run that had stopped performing the writer/reader cross-check entirely.

The common cause is that each check answered "I could not verify this" the same way it answered "I verified this and it was fine". Absence and success shared an output. Every one was invisible precisely because green is what you expect, and none was found by the subsystem that owned it.

The repair that generalises is not more checks, it is making the three outcomes distinguishable: verified, refused, and *could not verify*. `verdictsUnbindable` separates dead labels from absent ones; the barrier became an executable refusal naming its own dead ends; the chain declares its order as data with each stage's rebuild command; and the skip became a failing assertion. A check that cannot say "I did not run" will eventually not run.

**Anchor:** `verdictsUnbindable` in `scripts/part-identification-score.mjs` (87 -> 0 once verdicts were re-keyed by crop digest); `assert_pinned_environment_for_retained_bundle` in `scripts/discover_builder_shell_core.py`; `apps/web/e2e/real-build-input-chain.ts` with its regression `apps/web/test/real-build-input-chain.test.ts`; and the stale-artifact case in `apps/web/test/real-build-builder-calibration.test.ts`, converted from `console.warn` plus skip to a failing assertion naming the observed version, the expected version and the regeneration command. All four found on 2026-08-05.

The same shape returned the next day wearing the opposite face, in three files, found by two agents who each caught the other's and then their own. A defect-side classifier with two outcomes answered a 1.0x tie - geometry sound on both sides - with `callout-crop`, inventing a defect and aiming the repair at a correct file. A lookup searching a published `worst[:15]` list reported an element as having no same-mould sibling when it has one, collapsing "absent from a truncated view" into "does not exist". And a report built its miss list as "rank is None or rank > k" then built the cause block with a trailing `if rank is not None`, so a truth element with no thumbnail - a miss that cannot be ablated, because there is no descriptor to ablate - was dropped between the two and counted nowhere, while the per-repair totals looked complete.

So absence collapses two ways, not one. A check that cannot say "I did not run" reports green; a classifier with fewer outcomes than the world has reports a confident wrong verdict. The second is the more expensive, because a green merely fails to direct work while a wrong verdict directs it at the wrong file.

The third was latent - that generation held zero unreachable truths, so it had never fired, and a live-only test would have reported green forever on a branch real data cannot enter. A branch your data cannot reach is not covered by a passing suite; it needs a synthetic case. And the repair is the same either way: give the unmeasurable case its own row, never a skip and never a substantive verdict, then publish a conservation check the caller can read - rows equals ablatable plus unreachable, asserted rather than assumed.

**Anchor for the second face:** `test_agreement_on_both_sides_is_its_own_outcome` in `scripts/part_description_retrieval_test.py`; `everyMissAccountedFor` and its three synthetic drivers in `scripts/part_retrieval_ceiling_test.py`; `elementsWithNoSibling: 113` beside `worstIsATruncatedView` in `output/part-retrieval-ceiling.json`. All 2026-08-06.

## The shape of the question decides what a vision call is worth

Two configurations, the same booklet, the same model family, measured on the same day.

Asked an open N-way question — a card of four to six candidate renders beside the callout, answer with a pick number, a free-text description and a confidence — Claude Opus 5 was **39.9 percent self-consistent** across 273 drawings. It contradicted itself on 140 of 233 checkable proposals, its picks changed 0 of 273 drawings and 0 of 863 callouts against the deterministic baseline, and its confidence carried no signal at all: 0.874 mean on answers that survived, 0.854 on answers that contradicted themselves. As a filter it was worthless.

Asked a closed binary question — two pictures side by side at the same height, is this the same part, nothing else on screen — two independent raters on different models agreed **84 of 84**, including all eight "different" calls and both cases where the pair was unjudgeable because the claim side was blank.

Roughly a twentyfold difference in reliability, from the same models looking at the same art. What moved it:

The answer space was small and checkable. Same or different has a structure that two raters can be compared on; "which of these six" does not.
The answer was withheld. The pair judge saw no part name, no element id, no metadata, and could not be led by them — which is also what makes the resulting label auditable.
Uncertainty had somewhere to go. "Unsure" was a first-class answer and was used exactly twice, both times correctly, on pairs whose right-hand side was empty. A confidence number instead absorbs uncertainty into a value nothing acts on.
Escalation was built in. Contact sheets first, single-pair renders for anything ambiguous; one rater re-read 39 of 84 that way, and the resolution difference is what settled stud counts.

The corollary is that a disappointing vision result is not automatically a model limit. Before concluding the model cannot see it, check whether it was asked something answerable — and whether the grader is measuring sight or vocabulary.

**Anchor:** the open configuration is `output/part-identification/answers-claude-opus-5.json` scored by `scripts/part-identification-score.mjs`, 39.9 percent self-consistency and a whole-book claim diff of zero. The closed configuration is `scripts/fixtures/part-identification-truth-first50.json`, schema `lego.part-identification-truth/2`, whose `raters` block records the 84/84 agreement and the two pairs adjudicated by hand where the raters' descriptions diverged despite agreeing verdicts. Both measured 2026-08-05.

## A rotation matrix stored as nine numbers has two readings, and only geometry says which

LEGO Builder's `Custom2DField` carries its frame as a twelve-number `transformation` attribute, nine of which are a 3x3 rotation. Read row-major and read column-major it is the same matrix only when the matrix is symmetric. The six-part source pilot never had to decide: every field it touched was the identity, so `builder_ldraw_field._signed_permutation` refused an asymmetric matrix outright and said so — measure a rotated field before accepting one.

Two of the fourteen designs the real build's opening steps place carry a quarter turn: 30503 and 6106. Both readings put their type-23 stud nodes on an exact integer LDU lattice and both admit exactly one exact frame against the LDraw-measured stud centres, because a rotation of the field is absorbed by a compensating rotation of the frame. Exactness could not choose, and a count of one exact frame per reading looked equally convincing on both sides.

The Builder Shell mesh chose, because it is in the design's own frame and is not free to rotate with the field. Carrying its vertices through each reading's frame and measuring them against the expanded LDraw surface: 30503 reads 1.299 LDU maximum column-major against 113.137 row-major, and 6106 reads 1.376 against 169.706. That is 87x and 123x, and it is **column-major**.

The XML then confirmed it for free, from data already in the file. Every primitive repeats its rotation as an axis-angle pair, and 2310's `angle="120" ax=ay=az="-0.5773502692"` is the -120 degree rotation about (1,1,1) — which is the transpose of what its nine numbers read row-major. The redundant attribute was a second independent witness sitting in the source the whole time.

Two things generalize. A serialized matrix is not self-describing, and neither is a lattice that fits: when two readings both fit exactly, the thing that separates them has to be something the ambiguity cannot rotate. And when a format repeats itself, the repetition is a free cross-check — read it before running a search.

**Anchor:** `field_studs` order comparison against `builder_calibration_sources.py`'s pinned centres for 30503 and 6106; the 87x/123x separation is `verification.maximumSurfaceDistanceMicroLdu` for the two readings under `createBuilderFrameEvidence`, and the surviving column-major reading is pinned as `builderStudCentersLdu` in `apps/web/e2e/real-build-builder-sources.ts` with `apps/web/test/real-build-builder-calibration.test.ts` asserting both designs resolve at `unique-stud-correspondence` under 1.4 LDU. Measured 2026-08-05.

## A conservation check with one unmeasured term cannot fail

`OFFICIAL_REAL_BUILD_ACCOUNTING` declared set 6651557 as 1486 raw callout quantity = 1446 physical + 40 semantic, then `+ 18 omitted physical pieces` to reach the 1464 assembled model. Four of those five numbers came from a printed source. The fifth, `omittedPhysicalPieces: 18`, came from the subtraction: it was set in the same commit as the rest and no artifact ever enumerated an omitted piece, so `set-accounting-mismatch` could not fire on a callout over-read of exactly 18. It fired on 26 only because the callout publication had meanwhile moved from a 870-identity generation to an 881-identity one and nobody moved the constant with it.

Reading the labels straight out of the PDF settled which side was wrong, and neither side was right. The step pages carry 881 distinct Nx labels totalling 1512 — the publication's number, not the constant's 1486. But the publication's 1472 physical was 8 too many: the booklet sets parts-bin quantities at 8pt and multiplier labels at 16pt, 24pt and 40pt, and four labels at the multiplier faces (`p59|q2|x124.683|y55.056`, `p85|q2|x662.244|y445.465`, `p96|q2|x125.941|y478.298`, `p109|q2|x723.002|y319.540`) were published as part-art. They are pointer boxes and a subassembly-repeat header that restate pieces the step's own bin already counts. The 8pt labels alone total exactly 1464. So the 26 was 8 pieces of real over-read plus an 18-piece class that never existed.

Three independent printed sources then agreed on 1464, which is what made the answer safe to act on rather than another plausible reconciliation: the 8pt bin labels sum to 1464; the back-matter inventory on pages 221-222 sums to 1465, one more because the loose 31510 separator is never placed; and the official Builder XML yields 1395 direct + 69 MultiBuild = 1464 instruction identities from 1465 Bricks with that same separator unmatched.

Two things generalize. A conservation identity is only as strong as its weakest term: if one term is derived by subtraction rather than measured, the identity is a definition and cannot detect anything, so pin every term to its own source or set it to zero and let the check fail loudly. And when the same truth is written down in more than one place — here three, in a TypeScript fixture, a real-build contract, and an .mjs producer contract — they will drift, so bind them to each other in a test rather than trusting that whoever edits one will find the others.

**Anchor:** `apps/web/e2e/real-build-contract.ts` `OFFICIAL_REAL_BUILD_ACCOUNTING` moved 1486/1446/40/18 to 1512/1464/48/0; the four multiplier labels are preregistered in `apps/web/e2e/callout-recovery-fixture.ts` and the full-booklet publication reproduced 881/1512 raw, 859/1464 physical, 22/48 semantic with zero failures. Regressions: `callout-contract.test.ts` "conserves one callout accounting across the publication and real-build contracts", "keeps the assembled model inside the printed inventory", "classifies every multiplier-face label as semantic", and `real-build-test-options.test.ts` "satisfies the full-set accounting clause at the last printed step" — all four fail if the constant is reverted. Measured 2026-08-05.

**Follow-on, same day.** The four labels were only found by hand because the classifier failed open: `evidenceContract` returned `part-art` for any identity the curated fixture did not list, and the manifest published no measurement that could contradict it. The signal was already extracted — `heightPt` on `QuantityLabel` — and dropped before the record was written. Re-measuring the booklet with the publication's own extraction, deduplicated by stable identity: over the 196 step pages, 859 labels / 1464 pieces at 8pt and 22 / 48 at 16, 24 and 40pt, which reproduces the hand measurement exactly; across the whole booklet a further 276 labels / 1465 pieces sit at 6pt, which is the back-matter inventory and a third meaning entirely. So the rule cannot be "not 8pt means multiplier" in either direction. The manifest is now `lego.callout-thumbnails/5`, carries `heightPt` per callout, and `assertPublishedQuantityFaces` refuses publication when the printed face and the published class disagree, or when the face is one this booklet has never been measured at. Gate, so no rule line: `apps/web/e2e/callout-faces.ts`, enforced at `publishCalloutRun` and again at `assertV5CalloutManifest`, with four regressions in `callout-publication.test.ts` under "published quantity-label type size" that all fail when the assertion is stubbed out. Measured 2026-08-05.

## The booklet turns the model over and says so

Set 6651557 is built partly upside down, and the booklet marks every turn with a printed icon: a white 44.937pt rounded square holding a curved arrow around a sphere. Read by eye over printed steps 1 to 12, the icon is a strict toggle of which face the panel is drawn from, and it reproduces exactly: steps 1-3 studs up; 4 icon, underside; 5 icon, studs up; 6 studs up; 7 icon, underside; 8 icon, studs up; 9 studs up; 10 icon, underside; 11 no icon, still underside. The owner identified 4, 7, 10 and 11 as back views from the rendered pages in seconds, and all four fall out of that toggle.

It was already half-found. `deriveTransitionPanelFeatures` detects the icon exactly, and an earlier pass measured it across all 224 pages and concluded it is "a note about the viewpoint the step is drawn from, not a name for the action" — then correctly refused to map it to the `rotation` action class, because 33 of the 39 it found also place pieces and reading it as an action would mislabel six placement steps. That refusal was right. What was missing is that nothing else consumed it either: no viewpoint state exists, `transition-classifications.json` carries 25 attachments and one final-view with zero rotations and no entry before step 44, and the note "that gap is what a vision call is for" was never acted on.

Two measurement errors kept it hidden. The icon count is an undercount: attribution requires the icon's centre to fall inside `panel.bounds`, and step 8's icon sits above its artwork where those bounds do not reach, so page 13 carries two icons and only step 7's is seen. The recorded "39 icons, one per page" is that assumption written down as a finding. And the camera fit cannot contradict any of it, because it is fitted to the panel's own stud grid and a projected square lattice is identical viewed from above or below — it reports a positive elevation on every panel including the flipped ones, and its own legend already says it is "a fit quality, not a proof".

The general shape: a cue can be detected, correctly interpreted, and still dropped, because refusing to use it for the wrong purpose is not the same as using it for the right one. When a pass concludes "this signal means X, but X is not what I was asking", that is the moment to write down who consumes X — otherwise the finding is a note that the signal was thrown away.

**Anchor:** `ROTATION_ICON_SIDE_PT` and `rotationIconPresent` in `apps/web/e2e/real-build-transition-features.ts`; measured 2026-08-06 with the live detector as steps 4, 5, 7, 10, 12, 16, 17, ... (39 of them), against pages 11 to 15 read by eye, which show the icon on step 8 as well. The camera fit is `output/camera-fit/score.json`, median elevation +35.59 degrees over 32 fitted panels.

## An exact ambiguity cannot be resolved by telling the measurement which answer to prefer

Set 6651557 draws five of its first forty-three panels from underneath, and the flip icon says which. The obvious next move was to hand that face to the camera fit so a below-view panel would stop being refused, and `solveAxonometricFromLattice` even had a line inviting it: it rejected the negative root with the comment that a negative `sin elevation` is "the same view mirrored, which upright art never prints". Threading a face through the fitter and mirroring the measured basis passed its unit tests immediately.

It was wrong, and the reason is exact rather than a matter of tolerance. A below-view lattice at azimuth A is the same lattice as an above-view at azimuth -A, because `a(A, -e) = a(-A, e)` and `b(A, -e) = -b(-A, e)`, and negating one basis vector spans the same lattice. The fitter searches over re-basings, so it always reaches the positive-elevation twin. The two faces are not nearly identical under this measurement; they are equal, and no evidence handed to the measurement can separate equal things.

The mistake was building a discriminator without first asking whether the two cases are distinguishable at all. What the cue does is decide which of two equally valid readings to *act on*, and that belongs downstream — the panel fit supplies azimuth, scale and phase, and the icon supplies the sign of the elevation a candidate is rendered at. Nothing about the fit needed to change; the caller did.

Two corrections a critic had to make, and both are part of the lesson. The option was not inert, it was destructive: mirroring is applied after `canonicalPair` has oriented the basis, so `k` goes negative for every real basis and the fit returns null. Measured against the run that had produced 32 solutions over 40 panels, refitting every panel as a below-view produced 0 — the option changed 32 answers, all to failure. Calling it inert was a guess dressed as a measurement. And the artifact that number came from was produced by a probe that was reverted and never committed, so the evidence for the lesson was unreproducible from the repository until the equivalence itself was made a test.

So the habits are three. Before parameterising a solver to prefer an answer, write the two cases down and check whether they map to the same measurement exactly — if they do, no parameter can help, whatever its unit tests say, because a test built from the same wrong model agrees with it. Quote a number only from something a later reader can re-run. And an option with no caller is worse than none, because it reads as a capability: `face` is gone from this module entirely, and the equivalence is a regression so it cannot come back.

**Anchor:** `PanelFace` and `solveAxonometricFromLattice` in `packages/rendering/src/camera-fit-lattice.ts` — the type is exported and nothing in the module consumes it, which is the finding. Regressions "gives the same lattice for a below-view as for an above-view at negated azimuth" and "fits a below-view panel as an above-view without ever failing" in its test file. Measured 2026-08-06.

## Local frames can be right while world placements are mirrored

The Builder asset bundle is left-handed, so `extract-builder-shell.py` decodes Shell vertices as `-25·v`, negating all three axes. That is correct, and the proof is a chiral part: design `54383;F` is a *right* wedge plate, and it lands on the official LDraw surface at p95 1.250 LDU under that decode against p95 10.714 with z flipped. `resolveBuilderBoneTransform` then applied the same handedness to the LXFML Bone data, which is right-handed, and mirrored every world placement in the model.

It read the Bone through `diag(1,-1,1)`, determinant -1: a reflection, not a rotation. Calling it "z flipped" understates it, and the understatement is itself part of the lesson, because the sign vector is shared by two halves of one change of basis. The rotation is conjugated by the same `S` the translation is scaled by, so negating only the position turns a reflection into a map that is not rigid at all: scored by the same interlock census, position-only is *worse* than the mirror it replaces on three of four measures. The correct map is `diag(1,-1,-1)`, a 180-degree rotation about x, and conjugating a yaw by that extra z flip inverts it, so `upright-yaw-90` and `upright-yaw-270` exchange while `yaw-0` and `yaw-180` are fixed points and can witness nothing.

Nothing local could see it. Eight designs passed per-part admission scoring against LDraw surfaces, because a part compared to itself is unaffected by where the model puts it. The two parts of printed step 1 are individually mirror-ambiguous — under a free upright fit, z-kept and z-negated score within 0.03 LDU for both — so even scoring them could not separate the readings. What separated them was a global fit over all 1440 instances requiring each design to admit one part frame: 1439 explained with z negated, 656 without; a rotation-only check that never touches a position, 1129/1129 instances and 155/155 designs under `diag(1,-1,-1)` against 443 and 102; and a physical-interlock census that never opens the export at all, in which `diag(1,-1,-1)` is the only one of six candidate readings with zero stud/stud and zero clutch/clutch coincidences, while also having the *most* interlock — so the zero was not bought by pulling the parts apart.

The cost was paid at the other end of the pipeline, as a build that could not start. The real-build run searched step 1 for a placement matching the canonical target and found none legal, because the target itself was unbuildable: at the repository's own transforms the second piece was refused — "would rest 8 LDU above the build plate with nothing under it" — while at the corrected transforms the editor places both, holds each by connections rather than by the plate, and derives three stud/clutch pairs. Three voices that had never met agreed only after the question was asked in the third place.

The generalisation is about where a handedness error can hide. A decode and a placement can use the same scale, the same axis names and the same rotation convention and still disagree in chirality, and every check that compares a thing to itself — a part to its own surface, a document to its own hash — is blind to it. Ask something that spans instances: a global fit, or a contact count, or simply whether the model can be built. The regression that now holds the correction is of that shape and of no other: three Bone rows, placed, and the editor asked whether the result would stay put.

**Anchor:** `LDD_TO_LDRAW_BASIS_SIGNS` and `resolveBuilderBoneTransform` in `apps/web/e2e/real-build-builder-calibration.ts`, decode unchanged at `scripts/extract-builder-shell.py`. Measured 2026-08-07 over the 1465-brick official model and its `.ldr` export; step-1 placement confirmed against the editor's own support and connection derivation. Corrected the same day, with the regression in `apps/web/test/real-build-builder-basis.test.ts`.

## An orientation compared as a string, not modulo the part's own symmetry

Seven of the fourteen pinned designs were reported as failing to reproduce the official `.ldr` export, and `3832;G` was written into the position of record as a frame that needed settling. All seven reproduce it exactly. The only difference was an `orientationId` naming a yaw 180 degrees from the export's, and for a 2x10 plate that is the part's own self-symmetry — every stud, every body point, identical. The same false positive hit `3032;F`, `3034;J`, `3460;N`, `3795;I`, `60479;F` and `91988;F`, all rectangular plates.

The cost was not the wasted look. It was that a real outlier sat in the same list and the noise made the list unbelievable, so the real one was attributed to the wrong cause: `80015;E` genuinely differs from the export, and because six harmless neighbours differed too, the obvious reading was a systematic pipeline error rather than one brick. It was one brick, and the pipeline was right.

This repository already knows that an exact fit to a symmetric feature set is not one answer. The same fact applies to comparisons, not only to fits: two placements that a part's own symmetry cannot distinguish are the same placement, and any check that reads them as different is measuring the label rather than the geometry. Compare what the part occupies — its studs, its body — or quotient the orientation by the part's measured self-symmetry first.

**Anchor:** the seven designs are pinned in `apps/web/e2e/real-build-builder-sources.ts`; measured 2026-08-07 over the 40 upright instances of the 14 pinned designs, 39 of which reproduce the export to the LDU once `ldrawToCatalogLocalTransform` is accounted for.

## A registration that maximises over shift is blind to anything smaller than its own search

The deferral settles a printed step by rendering each candidate prefix and comparing it with the art the *next* panel draws of what that step built. The comparison has to be translation-free, because the camera fit pins angle and scale but never where the drawing sits on the page, so it maximises agreement over a shift search seeded from the centroid difference and refined at scales 8, 3 and 1 over a nine-by-nine neighbourhood — a reach of about 48 pixels in each axis.

Driving that over real enumerated geometry the first time, four hundred candidates came back agreeing with the drawn assembly at between 0.995 and 1.000, best-to-runner-up margin 0.0047. Read as a result it says the discriminator cannot tell a hundred different placements apart, which is a claim about the method. It was a claim about the camera. `pixelsPerUnit` is pixels per Three.js unit, and one unit is one stud pitch rather than one LDU — `MESH_RENDER_UNITS_PER_LDU` is 0.05 — so the 3 that had been picked as a plausible-looking scale made a whole stud three pixels wide. Every difference in the candidate set was inside the shift search's own reach, and the search dutifully translated each wrong answer on top of the right one. At 20 pixels per stud the same four hundred candidates separate 1.000 from 0.781.

The generalisation is that a maximisation is also a blindness, and its blind spot is exactly its search domain. Any invariance bought by searching over a group — translation here, but rotation or scale the same way — deletes that group from the evidence, so a difference expressed only in it cannot be seen and reports as agreement rather than as an error. Before trusting such a score, state the smallest difference it must resolve in the units the search actually moves in, and check that it is larger than the search. A discriminator that says everything agrees is more often mis-scaled than wrong.

**Anchor:** `registerPrefixAgreement` in `apps/web/e2e/real-build-deferral.ts` and its geometry-driven regression in `apps/web/test/real-build-deferral.test.ts`, which now names the scale as pixels per stud. Measured 2026-08-07 over the 400-candidate product of printed step 1.

## A score's reachable maximum belongs to the picture, not to the placement

Printed step 2 of the sample booklet is drawn exploded: the new wedge floats clear of the assembly with two arrows pointing up into it, so its 527px closed contour outlines the part where the booklet *draws* it rather than where it seats. The run scored seated candidates against that contour and refused at a joint visual score of 0.200918543009241, below a bar of 0.45 that had been calibrated on synthetic panels. Both halves of that sentence were measuring the wrong thing. The placement the booklet actually draws, scored where it seats, reaches a region agreement of 0.000155 — it is almost wholly hidden behind what step 1 built — so 0.2009 was simply whichever wrong seat overlapped the ghost region most.

The bar could not have been right either, and that is the part worth keeping. On this panel the highlight region is 4749 px and the rendered wedge silhouette about 2795, so a placement that fits perfectly inside the printed contour scores 2795/4749 = 0.5883 and nothing can score higher; an independent world-lattice sweep peaks at exactly that value. A synthetic panel's highlight *is* the silhouette, so its ceiling is near 1.0. The same 0.45 is therefore 76% of everything achievable on the printed panel and under half of what the synthetic one reaches — one number asking two different questions, and on the printed panel it was reading the booklet's draughting rather than the model.

The ceiling is not a nuisance to be calibrated around; it is the test. Dilating the drawn ghost's silhouette and comparing it to the printed region gives IoU 0.5817 undilated, 0.7597 at radius 3, a peak of 0.8153 at radius 5 and 0.8052 at 6 — the yellow is drawn about five work pixels clear of the part all the way round. So a correctly placed ghost has no pixel outside the printed contour, and a wholly contained ghost scores exactly its own area over the region's, which is that ceiling. Containment and reaching the ceiling are the same statement, and it carries no constant at all. Measured this way step 2's best candidate leaves 46 px of 2793 outside, which names the residual as the arrow reading about 1.26 plates short of the drawn travel rather than as a threshold that wants lowering.

The generalisation: before comparing a score against a bar, compute what the picture allows that score to reach. If the maximum varies with the panel, a fixed bar is a measurement of the panel. Where the ceiling can be derived from the same two masks the score is computed from, prefer the derived statement — it is a gate with no free parameter and it cannot be tuned into accepting a wrong answer.

**Anchor:** `measureGhostContainment` and `decideExplodedGhostPlacement` in `apps/web/src/assembly/ghost-placement.ts`, wired by `apps/web/e2e/real-build-exploded-step.ts`; measured 2026-08-07 over printed step 2's 105 whole-step candidates at `LEGO_REAL_BUILD_LAST_STEP=3`.

## A measurement converts through the raster it was measured on

The run fits a panel's stud lattice on the full-resolution crop and reads its displacement arrows on the same crop downsampled by `workFactor`. The arrow-to-world inversion took the fit's `pixelsPerUnit` unchanged, so every arrow-derived displacement in the repository was exactly `workFactor` times too short — a factor of two, reproduced to 2.000000000000 on all three basis vectors of all three fitted panels, by projecting known world travels through the run's own camera. Step 1's published family read `[-60,80,-40] [140,-88,100] [60,-24,40] [0,32,0]`; at the corrected scale it reads `[0,56,0] [60,8,40]`, and the purely vertical member — the only one whose direction matches the two arrows the panel prints — moves from last of four to first of two.

Nothing local could see it. The renderer divided by the same factor a few lines away and looked right; the reported `errorStuds` was a work-pixel numerator over a full-resolution denominator, so every published accuracy was also half the real one and the family looked *more* precise than it was. A sibling module in the same repository did the conversion correctly, reading its arrows at full resolution and dividing both the arrow and the scale when it needed the downsampled raster; the defect was that block copied with the raster swapped and the fit left alone.

The generalisation is about where a scale lives. A pixel measurement is meaningless without the raster it was taken on, and a fit is meaningless without the raster it was fitted to; when the two differ, a call that accepts only the fit cannot state the mistake, so the reader has to remember it. Give the conversion both — make the function take the factor and refuse a factor that describes no raster — so that mixing them is a type error rather than a silent ratio.

**Anchor:** `panelProjectionForWorkRaster` in `apps/web/src/assembly/arrow-placement.ts` with its round-trip regression in `arrow-placement.test.ts`; call sites corrected in `apps/web/e2e/real-build-panel-raster.ts` and `apps/web/e2e/step1-deferral.spec.ts`. Measured 2026-08-07; step 1 still reports `complete/deferred-lookahead 2/2 placed` after the correction.

## An annotation drawn to a hidden destination states its direction, not its length

Printed step 2 of the sample booklet draws two red arrows into the part it places. `correctArrowForClearance` assumed the booklet inks an arrow from clear of the part to clear of the surface it lands on, and added both gaps back to recover the travel — an assumption written into a docstring and never checked against the drawing. The drawing says otherwise. Both arrow tails lie *inside* the step's own highlight region and both heads lie *inside* the already-built art; measured against those masks the gaps are 0 and 0. The 4.333px each tail reported was its distance to the highlight *stroke*, taken from a point already inside the yellow band, and adding it lengthened a vector that was 38% too short to begin with.

The two arrows disagree about length by 3.00px on a 33.502px consensus — 32.005 and 35.000 — while agreeing in direction to 0.14 degrees: 1.50px of scatter along the axis against 0.033px across it. One pair of arrows states its direction about fifty times more precisely than its length, and the reason is structural rather than sloppy. A step is drawn exploded exactly when its seat is hidden behind what is already built, so the artist stops the head at the visible surface; the remaining travel is occluded and cannot be inked. The placement the booklet draws is 46.165px away and the ink covers 33.502 of it.

Correcting the arrow's length was therefore the wrong repair, and the obvious alternative was wrong too. Scoring the ghost off the lattice — through the raw measured arrow rather than a whole-grid member — moves the best candidate from 46px outside the printed contour to 102px, and the drawn placement from 238px to 912px; quantising was saving 14 to 56px, not costing them. What works is to read the arrow as a line and a floor and to take the ceiling from the panel: the material point that starts at the tail cannot end further along than the far side of the art it is joining. On panel 2 that ceiling is 80.495px against a 33.502px arrow, and it leaves exactly one candidate whose ghost lies wholly inside the printed contour — the placement the booklet draws — at every direction tolerance from 0.05 to 0.15 of a stud and every reach from 10px to 60px. It becomes two only at 72px, where a sixteen-plate travel enters.

The generalisation: when a drawing annotates a destination it cannot show, the annotation's extent is a lower bound and only its direction is a measurement. Do not correct the length — bound it from something else in the same picture, and let the test that was already going to decide pick within the interval.

**Anchor:** `arrowTravelFamily` and `measureArrowTravelCeiling` in `apps/web/src/assembly/arrow-placement.ts`, replacing `correctArrowForClearance`; regressions in `arrow-placement.test.ts` and `apps/web/test/real-build-exploded-step.test.ts`. Measured 2026-08-07 by a lock-free probe over printed step 2's own panel raster, its numbers retained in the ignored `output/build-search/zz-arrow-clearance.json`; the run then reported 3 of 3 printed steps complete and 4 pieces placed at `LEGO_REAL_BUILD_LAST_STEP=3`.

## A selector that consults the acceptance test only after choosing refuses while holding the answer

`fitStudLattice` builds a candidate lattice from every pair of autocorrelation peaks, ranks them by explained peaks then by coarsest unit cell then by the axonometric residual, and applies the residual gate to the winner alone. Printed step 4 of the sample booklet was refused for two days on the number that fell out of that: 9.11px from the closest upright axonometric against a 0.02 tolerance, on a 92.19px stud pitch. The pitch was the tell and nobody read it — every panel around step 4 measures 40 to 44px, and a panel drawn at twice its neighbours' scale on the same page is not a measurement, it is a lattice at twice the pitch.

The panel's own grid was in the candidate list the whole time, second, at 43.83px and 0.47% of pitch — four times inside the gate that refused the panel. It lost to an index-2 sublattice of itself which explained exactly as many peaks with twice the cell, and won on coarseness at 10% of pitch. So the reported failure was the residual of a candidate that had already lost on the criterion the run actually cares about, and every consumer of that message — including a whole session of work — went looking for a reason the panel might not be an axonometric view at all.

The framing that hid it is worth naming. The tie-break was justified as "the coarsest such lattice, because every finer one explains those peaks too and would halve the pitch", which is sound *among readings that are readings*: a refinement of the true lattice explains the same peaks and would report half the scale, so coarseness settles that. It says nothing about a lattice that is not a projection of a square grid at all, and ranking one of those first because its cell is bigger is choosing between an answer and a non-answer on a criterion that only compares answers.

The repair is not a new criterion and not a wider gate: it is the same threshold, the same value, consulted one step earlier — whether a candidate is an axonometric projection at all now outranks coarseness, and the winner still has to pass the identical gate at the end on the refined basis. Over the same forty panels, before and after, exactly one changes: step 4 goes from refused to azimuth 34.71, elevation 35.01, 0.475% of pitch, and 16.134 points per stud where its neighbours measure 16.193 and 16.014. Its measured grid is its neighbours' reflected in x to within half a pixel, which is what an underside panel looks like to a fit that can only report a positive elevation.

The generalisation: when a selector picks among candidates and a gate then judges the pick, the gate is part of the selection whether it is written there or not. Rank by it, or the loser's number becomes the diagnosis.

**Anchor:** 2026-08-08; the sort in `fitStudLattice`, `packages/rendering/src/camera-fit-lattice.ts`; pinned on the real booklet by the printed-step-4 block in `apps/web/e2e/camera-panel-fit.spec.ts`, which asserts its pitch and elevation against printed steps 3 and 5 and its basis as their mirror. `output/camera-fit/overlay-004.png` before and after is the picture: the predicted cells move from ellipses twice the size of the drawn tubes onto the tubes. The booklet run's step 4 goes from `camera-fit-failed` to 220 scored candidate renders and a different refusal, `ambiguous-placement-score`.

## The structural hash covers the pinned truth, so a catalog bump moves every baseline

`structuralDocumentValue` hashes `truth` alongside the parts, so a document's structural hash is a function of the catalog version it pins as well as of what is in it. Bump `BUILTIN_CATALOG_VERSION` and every pinned baseline in the repository moves at once, whether or not a single placement changed. The three booklet prefixes went `f15eadfa`, `64017a83`, `6d46478c` to `c37d7b59`, `3475cc89`, `b343e96d` on a change that touched one part's body boxes and moved no connector at all.

That is the trap: three moved hashes look exactly like a regression, and the run that produces them cannot tell you which kind of move it was. Neither can a diff of the source, because the bump is deliberate and the placements are somewhere else entirely.

The escape is cheap and exact, and it is the same technique that saved the 77-part legacy roster pin in `mesh-assets.test.ts`. Take the retained `document.json`, put back only the truth digests the bump moved — `truth.catalog.version`, `truth.catalog.hash`, and `truth.collisionModel.hash`, which is the other one that reads the catalog's body primitives — change nothing else, and re-hash. If it reproduces the old value bit for bit, no part, colour, transform, step or connection moved and the whole delta is the version. If it does not, the difference is real and is now isolated from the bump.

The same shape works on any pinned digest with a version component folded into it: restore the component, re-hash, and the literal you were about to overwrite becomes a test of what else changed rather than a casualty of the change.

This is distinct from the older lesson that the structural hash covers part *identifiers* — that one is about two models never hashing alike, this one is about one model not hashing alike across a truth bump.

**Anchor:** 2026-08-09; `structuralDocumentValue` in `packages/brick-kernel/src/document.ts`; measured on all three retained runs at `builtin.basic-parts/9` restoring `truth.catalog` `sha256:a9adf38b…` and `truth.collisionModel` `sha256:8f181d6f…`. The in-tree form of the technique is the `rowsWithTheEightPlate` assertion in `packages/catalog/src/mesh-assets.test.ts`, which recovers the `/6` roster literal by restoring one row.

## A gate that cannot tell "passed" from "did not run" reports the second as the first

2026-08-09, commits `90a4a87` and `a44b53a`, after eight instances surfaced in two days.

`real-build-builder-calibration.test.ts` resolved its inputs through `process.cwd()` and skipped mutely when they were absent, so the strongest assertion this repository makes about Builder frame truth did nothing from any subdirectory and reported `6 passed, 1 skipped`, exit 0. Its companion was vacuous the same way: with the report unreachable, `retainedCalibrationVersions.length === 0` short-circuited to `IN_STEP`. `real-build-official.test.ts` had it too, silencing the case that pins the official model's sha256 and its 1,465 bricks. `real-build-transition-bundle.test.ts` was worse than all three - its mirror case PASSED while asserting the artifact was absent, with the file present at 34,784 bytes.

The same shape without a skip: `real-build-action-ledger.spec.ts` asserted `identificationConfidence` equalled `"vision-kept"`, written 53 minutes before the code stopped hard-coding that literal into every piece, so it checked a constant against itself until a refactor silently turned the tautology into a gate. And the first handedness check demanded the model's note name the mirror twin's number - which is the same number whichever hand was picked, so feeding it a SWAPPED pick returned `vision-kept` for the wrong element.

Every one of them was green. That is the property: the failure mode IS the success signal, so the only way to see it is to make the gate fail on purpose and watch it name the reason.

## A shell pipeline reports the last command's exit code

2026-08-09, three separate occurrences in one session.

`npm run verify 2>&1 | tail -40` was read as exit 0 when verify had failed with 978 lint errors. Then `node scripts/part-identification.mjs ask ... | tail` was read as success when the pass had died at 102 of 269 answers. Then the harness's own completion code for a backgrounded compound command was read as the command's, when it belonged to the `tail` that ended it.

Each time the report was "green" and the underlying work had failed. The fix is mechanical - `cmd > log 2>&1; echo "EXIT=$?"` - and the reason it kept recurring is that the wrong answer looks exactly like the right one.

`npx vitest run -t "<name>"` is the same trap from another direction: it exits 0 when the filter matches nothing, so a filtered green run can mean the assertion never executed.

## A check is written against the case that exists and is silent about the one that arrives

2026-08-09, commit `108d5b3`, found by asking what a change would break before making it.

`connector-backing-policy.ts` admitted a connector by asking whether a whole stud's footprint of a face was backed by solid. Correct for a stud, which stands on the body. Exactly backwards for a clutch, which needs a cavity - solid behind it is what makes the clutch impossible. It had never fired because no part modelled a cavity, so the rule looked right for as long as nothing tested it.

Three more of the same shape in the same two days. `isRealBuildBrowserOutput` answered two unrelated questions with one boolean - are these bytes a browser output, and did the run account for every declared piece - and the second is the signature of an unfinished prefix, so 19 of 22 partial runs discarded every measured row. `evidenceDigest` carried the literal string `"missing"` where `null` was meant, because the refusal message renders `?? "missing"` and the display string had been written into the data; it then threw at step 13 and abandoned 49 correct rows. The stud radius read `6.0001514980873605` - the circumradius of a 16-gon written to four decimals - against a clutch allowance that `Number.isSafeInteger` forces to exactly 6, so a correctly seated stud read as a collision by 60 nanometres.

None was found by a test passing or failing. Each was found by asking what the check would say about a case it had never seen.

## A hand-built surface can be present, counted, and invisible

2026-08-09, the session that shelled fifty-eight parts.

`createTubeGeometry` builds the underside tube's 144 triangles by hand. Every one of them was wound backwards, and every material in this renderer is `FrontSide`, so the GPU culled the whole tube. The scene held three tube meshes for a 2x4 plate, `deriveBrickScene` returned them, a unit test counted seven body meshes and passed, and the from-below capture was a flat red rectangle - the exact picture the shell exists to replace, reproduced by geometry that had been added to replace it.

Nothing in the vertex order reads as wrong. What reads is the direction each face points, so the test measures that: 48 triangles away from the axis, 48 toward it, 48 down at a camera below, none up.

The orthographic underside capture could not have found it either, and that is worth knowing on its own: from directly below, the wall bottoms, the tube rings and the recessed ceiling are all faces with the same normal and the same material, so the picture is one flat colour whatever is behind it. The cavity only became visible when the camera was orbited under the model at an angle.

**Anchor:** 2026-08-09; `createTubeGeometry` in `packages/rendering/src/geometry.ts`; the test is "points every face of an underside tube outward, at a camera that can see it" in `packages/rendering/src/rendering.test.ts`; the pictures are `output/underside-probe/orbit-*.png`.

## "Err on the safe side" has a direction, and a touching fit reverses it

2026-08-09, same session, found by validating a two-brick stack.

`collisions.ts` turns a body cylinder into its bounding box and says why: it claims corners a round part does not fill, so it refuses a placement a real wheel would allow and never admits one it would not. That is correct for a wheel, which stands alone. An underside tube does not stand alone - it sits at the centre of a 2 x 2 block with four studs at its corners, 10 * sqrt(2) = 14.142 LDU away against a true radius sum of 14. The bounding box reaches 8 LDU along each axis, so its nearest point to a stud centre is 2.83 LDU away, well inside the stud's 6, and every exactly seated stack of two 2-wide parts reported `PART_STUD_BODY_COLLISION` against its own tubes - with the connection declared.

The conservative direction was the broken one, because the legal configuration is nearly tangent to the thing being approximated. What replaced it is the largest axis-aligned box inside the tube circle: its corners lie exactly on that circle in the four diagonal directions the studs occupy, so it reports the tube's own 0.142 LDU clearance, and it gives up reach only along the two axes where the neighbouring tube 20 LDU away covers the gap. Swept exhaustively - a stud at all 9,801 integer positions under a 2x4 plate, a 4x4 plate and a 2x4 brick, which is every position the document schema can express - it admits none whose drawn annulus overlaps it.

**Anchor:** 2026-08-09; the tube primitive in `makePartDefinition`, `packages/catalog/src/part-factory.ts`; the seated-stack case is "seats a stud in the cavity, and refuses one a single LDU off the lattice" in `packages/brick-kernel/src/validation.test.ts`.


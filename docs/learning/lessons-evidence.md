# Lessons — evidence

The full entry behind each rule in [lessons.md](lessons.md), in the same order. Each records something that cost real time, with an anchor that proves it happened; unanchored lessons are folklore and do not belong here.

This file is not read at session start. Come here from a rule.

## Entries

## A byte comparison knows only that two files differ

`pin:check` decides staleness by comparing the whole formatted bytes of `run-pin.generated.ts` against what the generator produces, and then reported the failure as a moved run digest.
On a CRLF checkout it printed `holds sha256:366fefbf… but this build produces sha256:366fefbf…` — the same digest twice — and told the reader to regenerate a value that had not changed.
The comparison is right and belongs at the byte level; the message was one altitude above it, asserting a cause the comparison cannot see.
Each of the three `--check` gates now names the domain values that moved when any did, and otherwise says the bytes moved while the meaning did not, with the first differing line.

**Anchor:** 2026-08-07 commit `a8fc397`; `scripts/generated-file-staleness.mjs`; the doubled digest is quoted verbatim in `.gitattributes`; the then-current regression “never prints one pinned value as both held and produced” lived in `scripts/generated-file-staleness.test.mjs` and was later removed with the obsolete pinning surface.

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

## Long feedback loops need an intermediate score, and booklets supply their own

"Did the right model come out" is too slow to iterate against.
An instruction booklet is internally redundant: step numbers must run 1..N without a gap, and callout quantities must reconcile with the piece count.
Both are checkable the moment a booklet is read, with no model built, and both are falsifiable — which is what made the step-64 bug visible.

**Anchor:** commits `00607a9` and `932948d`; `checkBookletConsistency` first recorded 359/359 steps and an impossible 3102 callout pieces, then panel attribution separated 1480 back-of-book inventory tokens and corrected the step-callout total to 1622 while sequence coverage stayed 359/359. The 3102 value is the caught failure, not the current callout count.

## A fixed crop box silently decapitates the big items

Every inventory thumbnail was cut with the same 20.4pt-tall cell, on the assumption that a grid row is a fixed height.
It is not: a 4x12 plate is drawn far taller than a 1x1, and the crop showed 39% of it — 164px of a part that needs 419.
Nothing failed; the images looked fine, and a reader called that plate "6x4" from the third of it that survived.
Two independent readers rediscovered the clipping before the score did, one noting it could only prove ">=7 studs long" because apparent length saturated at the frame.
Sizing the cell to its own content — climb until a gap of clear rows — recovered the missing parts.

**Anchor:** the content-scan crop in the inventory thumbnail probe; `302926` went 876x164 to 876x419, `303226` 787x163 to 787x301, and the only dimension miss in the naive baseline was the clipped `302926`.

## A hand-assembled parts array is not a document

The instruction-render probe spread four correctly-stacked, on-lattice parts into an empty document's `parts` array and got twelve blocking issues back.
A stud sitting inside another part's body is legal only through a collision allowance whose `requiresValidatedConnection` is true, so with no connection edges every legitimate stud connection reads as `PART_STUD_BODY_COLLISION`, the assembly reads as `DISCONNECTED_ASSEMBLY`, and the untouched `submodels`/`steps` member lists produce a mismatch per part.
Building the same four placements through `createPlacePartTransaction` and `applyBuildOperations` — the path the editor itself uses — validated clean.

**Anchor:** `apps/web/e2e/instruction-render.spec.ts`; twelve blocking issues (`DISCONNECTED_ASSEMBLY`, three `PART_STUD_BODY_COLLISION`, four `STEP_MEMBERSHIP_MISMATCH`, four `SUBMODEL_MEMBERSHIP_MISMATCH`) became zero with no change to any transform.

## A document's parts are not in insertion order

The closed-loop probe rendered a candidate's silhouette by placing it, then colouring `parts[parts.length - 1]` — "the part just added".
It is not: `applyBuildOperations` returns parts in an order that does not track insertion, so about half the time the mask highlighted the base plate instead of the new brick, and the score compared the wrong shape against the step's highlight.
The symptom was that two spellings of one placement — a 2x4 brick at yaw 0 and at yaw 180, which occupy the same studs and the same space — scored 0.38 and 0.96.
That is impossible for identical geometry, and rendering both masks and differencing them confirmed it: zero differing pixels once each was keyed by the id its own transaction returned.
`createPlacePartTransaction` returns `partId` for exactly this reason.

**Anchor:** `apps/web/e2e/build-search.spec.ts`; observed `partId manual-part-426e9bee…` against `lastPartId manual-part-4a593702…`, mask areas 21541 and 59230 for the same placement; the rebuild went from 1 of 6 parts correct to 6 of 6 with no change to the enumerator, the score, or the driver.

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

### 2026-08-09: and it has no CSG either, so orientation pairing fails the same way

Consistent winding looks like the way out of this. It is not.
The eight bundled meshes are perfectly BFC-consistent - every triangle at the top face points up and every one at the bottom face points down, all eight parts, no exceptions - which is enough to tell a ceiling from a floor and looks like enough to pair a column's solid runs off without counting crossings.

Probing `plate-3x3-corner-round` down a column 7 LDU from a tube axis, in the annulus between bore and outer wall, gives one up-facing surface and two down-facing ones: the top face at y -4, the cavity ceiling at y 0, and the tube's own ring at y 4.
There is no up-facing surface at the tube's top, because LDraw places the tube through the ceiling and nothing subtracts one from the other.
An unpaired close cannot say where its run began - read one way the tube vanishes, read the other the bore fills.
Columns at 0, 5 and 9 LDU from the same axis all pair cleanly, so a probe that had not been aimed at the overlap would have reported the method working.

The claim "feasible, because the winding is consistent" reached a pushed commit message before it was measured. Necessary is not sufficient.

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

## Matching a gallery one item at a time discards the constraint that makes it a gallery

Naming the part a step adds is matching its printed callout drawing against the back-of-book parts list, which is a labelled gallery of the same drawings.
Letting every drawing take whichever element it looked most like reconciled 1245 of the booklet's 1465 pieces, over-claimed 227, and left 39 elements never claimed at all — drawings had piled onto a few popular elements while the right owners went hungry.

The book draws each element exactly one way, so 273 distinct callout drawings and 276 listed elements very nearly pair off one to one.
Making the choice once for the whole book as a minimum-cost assignment under that constraint, with no other change, took it to 1313 pieces reconciled, 141 over-claimed, 11 elements never claimed, and 203 of 276 elements at exactly the printed quantity.
The gain is entirely in what the constraint forbids: taking an element now costs every other drawing the chance to take it, so a confident wrong match can no longer crowd out a less confident right one.

**Anchor:** `scripts/part-assignment.mjs`; `output/part-identification/score-deterministic-nearest.json` and `score-deterministic-one-to-one.json` over the 863 physical callouts of `recipes/6651557.pdf`, both binding features `sha256:34a746c823add2e…`, match `sha256:d7d88ac846af540…` and distances `sha256:5a93f850136be35…` in their own `inputDigests`. The effect was first measured on an earlier closure generation whose numbers (870 callouts, 1256 → 1308 reconciled, 230 → 158 over-claimed) no longer reproduce; the 863-callout figures and digests are the generation measured on 2026-08-04, not current artifact pins.

## Elements differing only in colour are one shape twice

The set lists a 1x2 tile with a groove in black and the same tile in white under two element ids, and 34 of the black ones were claimed as white.
The colour term was there, but it searched each part's top tones for their closest approach — and every part in this booklet carries the same pale highlight, so a black tile came within 0.11 of a white one and the shape term drowned the rest.
Comparing the tones where they actually are, mean ink colour and light face rather than nearest match, and giving colour a third of the weight, cut over-claims from 439 pieces to 230.
The same pass added an interior-shading grid, because a 1x2 grille tile and a plain 1x2 tile have identical silhouettes and the set holds 54 of the grille.

**Anchor:** `colourDistance` and the `detail` grid in `scripts/part-thumbnail-image.mjs`; over-claims 439 → 230 and elements at exact quantity 139 → 174 with the assignment held at `nearest`.

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

## An exact ambiguity cannot be resolved by telling the measurement which answer to prefer

Set 6651557 draws five of its first forty-three panels from underneath, and the flip icon says which. The obvious next move was to hand that face to the camera fit so a below-view panel would stop being refused, and `solveAxonometricFromLattice` even had a line inviting it: it rejected the negative root with the comment that a negative `sin elevation` is "the same view mirrored, which upright art never prints". Threading a face through the fitter and mirroring the measured basis passed its unit tests immediately.

It was wrong, and the reason is exact rather than a matter of tolerance. A below-view lattice at azimuth A is the same lattice as an above-view at azimuth -A, because `a(A, -e) = a(-A, e)` and `b(A, -e) = -b(-A, e)`, and negating one basis vector spans the same lattice. The fitter searches over re-basings, so it always reaches the positive-elevation twin. The two faces are not nearly identical under this measurement; they are equal, and no evidence handed to the measurement can separate equal things.

The mistake was building a discriminator without first asking whether the two cases are distinguishable at all. What the cue does is decide which of two equally valid readings to *act on*, and that belongs downstream — the panel fit supplies azimuth, scale and phase, and the icon supplies the sign of the elevation a candidate is rendered at. Nothing about the fit needed to change; the caller did.

Two corrections a critic had to make, and both are part of the lesson. The option was not inert, it was destructive: mirroring is applied after `canonicalPair` has oriented the basis, so `k` goes negative for every real basis and the fit returns null. Measured against the run that had produced 32 solutions over 40 panels, refitting every panel as a below-view produced 0 — the option changed 32 answers, all to failure. Calling it inert was a guess dressed as a measurement. And the artifact that number came from was produced by a probe that was reverted and never committed, so the evidence for the lesson was unreproducible from the repository until the equivalence itself was made a test.

So the habits are three. Before parameterising a solver to prefer an answer, write the two cases down and check whether they map to the same measurement exactly — if they do, no parameter can help, whatever its unit tests say, because a test built from the same wrong model agrees with it. Quote a number only from something a later reader can re-run. And an option with no caller is worse than none, because it reads as a capability: `face` is gone from this module entirely, and the equivalence is a regression so it cannot come back.

**Anchor:** `PanelFace` and `solveAxonometricFromLattice` in `packages/rendering/src/camera-fit-lattice.ts` — the type is exported and nothing in the module consumes it, which is the finding. Regressions "gives the same lattice for a below-view as for an above-view at negated azimuth" and "fits a below-view panel as an above-view without ever failing" in its test file. Measured 2026-08-06.

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

## An annotation drawn to a hidden destination states its direction, not its length

Printed step 2 of the sample booklet draws two red arrows into the part it places. `correctArrowForClearance` assumed the booklet inks an arrow from clear of the part to clear of the surface it lands on, and added both gaps back to recover the travel — an assumption written into a docstring and never checked against the drawing. The drawing says otherwise. Both arrow tails lie *inside* the step's own highlight region and both heads lie *inside* the already-built art; measured against those masks the gaps are 0 and 0. The 4.333px each tail reported was its distance to the highlight *stroke*, taken from a point already inside the yellow band, and adding it lengthened a vector that was 38% too short to begin with.

The two arrows disagree about length by 3.00px on a 33.502px consensus — 32.005 and 35.000 — while agreeing in direction to 0.14 degrees: 1.50px of scatter along the axis against 0.033px across it. One pair of arrows states its direction about fifty times more precisely than its length, and the reason is structural rather than sloppy. A step is drawn exploded exactly when its seat is hidden behind what is already built, so the artist stops the head at the visible surface; the remaining travel is occluded and cannot be inked. The placement the booklet draws is 46.165px away and the ink covers 33.502 of it.

Correcting the arrow's length was therefore the wrong repair, and the obvious alternative was wrong too. Scoring the ghost off the lattice — through the raw measured arrow rather than a whole-grid member — moves the best candidate from 46px outside the printed contour to 102px, and the drawn placement from 238px to 912px; quantising was saving 14 to 56px, not costing them. What works is to read the arrow as a line and a floor and to take the ceiling from the panel: the material point that starts at the tail cannot end further along than the far side of the art it is joining. On panel 2 that ceiling is 80.495px against a 33.502px arrow, and it leaves exactly one candidate whose ghost lies wholly inside the printed contour — the placement the booklet draws — at every direction tolerance from 0.05 to 0.15 of a stud and every reach from 10px to 60px. It becomes two only at 72px, where a sixteen-plate travel enters.

The generalisation: when a drawing annotates a destination it cannot show, the annotation's extent is a lower bound and only its direction is a measurement. Do not correct the length — bound it from something else in the same picture, and let the test that was already going to decide pick within the interval.

**Anchor:** `arrowTravelFamily` and `measureArrowTravelCeiling` in `apps/web/src/assembly/arrow-placement.ts`, replacing `correctArrowForClearance`; regressions in `arrow-placement.test.ts` and `apps/web/test/real-build-exploded-step.test.ts`. Measured 2026-08-07 by a lock-free probe over printed step 2's own panel raster, its numbers retained in the ignored `output/build-search/zz-arrow-clearance.json`; the run then reported 3 of 3 printed steps complete and 4 pieces placed at `LEGO_REAL_BUILD_LAST_STEP=3`.

## A green vision narrowing can drop settled truth

**Anchor:** 2026-08-10; `recipes/6651557.pdf` page 11; retained run `2026-08-09T06-52-45-853Z-622f66a3fe8d-2c210f0e-d99f-42c4-85f8-189bf740031c`; focused `apps/web/test/panel-reading-booklet.test.ts` replay, 6/6 green.

The step-4 model reading saw the correct underside viewpoint, then described both pieces as beside one another with zero overlap. Replayed against the retained enumeration, the 1x8 plate narrowed 480 candidates to 12 and dropped its settled transform; the wedge kept all 190 candidates, dropped its settled transform because its anchor was not yet placed, and made the product unusable. The oracle reading kept the settled wedge while narrowing 190 candidates to 2.

The replay stayed green because it proved the safety property it was written to prove: every survivor came from the enumerator, and an unusable reading could not invent a placement. That boundary says nothing about whether the visual description retained the real answer. Report truth loss separately, refuse known disagreements, and never promote subset safety into a claim of visual correctness.

## A contact sheet can be full-size while every bound image inside it is downsampled

The first `/13` visual-admission batch bound 192 source/candidate pairs at 640×640, then an ignored review helper opened each image and applied `thumbnail((320, 320), LANCZOS)` before assembling a 2560×724 contact sheet. Opening that sheet at its own native size therefore displayed every bound image at half linear resolution. Twenty-four immutable sidecars named contact-sheet inspection but mislabeled it as original-resolution review, and their generic notes overclaimed native-pair inspection; only the sole larger-metric pair had actually been opened from its raw packet files.

The pixel metrics and the reviewer’s impression may both be reassuring, but neither repairs the evidence lineage. The review contract names the exact raw PNG pair because scale can erase one-pixel seams, hard-edge shading, thin cavities, and winding defects. Preserve the invalid sidecars as counterevidence, capture a fresh batch instead of overwriting immutable records, and make any inspection composite prove that its two 640×640 regions reproduce the packet PNG pixels without resampling.

**Anchor:** 2026-08-11; capture batch `sha256:91961ab7ff6903004878535e293aac9aa160e37e1a8552f35c5db809207e091b`; `output/visual-admission-dev/make-contact-sheets.py` line 13 and lines 29–30; `docs/runbooks/part-visual-admission.md` native-pair inspection rule; independent review rejected 191 contact-sheet-only outcomes before a batch review manifest was published.


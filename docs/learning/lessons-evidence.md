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

## An orientation compared as a string, not modulo the part's own symmetry

Seven of the fourteen pinned designs were reported as failing to reproduce the official `.ldr` export, and `3832;G` was written into the position of record as a frame that needed settling. All seven reproduce it exactly. The only difference was an `orientationId` naming a yaw 180 degrees from the export's, and for a 2x10 plate that is the part's own self-symmetry — every stud, every body point, identical. The same false positive hit `3032;F`, `3034;J`, `3460;N`, `3795;I`, `60479;F` and `91988;F`, all rectangular plates.

The cost was not the wasted look. It was that a real outlier sat in the same list and the noise made the list unbelievable, so the real one was attributed to the wrong cause: `80015;E` genuinely differs from the export, and because six harmless neighbours differed too, the obvious reading was a systematic pipeline error rather than one brick. It was one brick, and the pipeline was right.

This repository already knows that an exact fit to a symmetric feature set is not one answer. The same fact applies to comparisons, not only to fits: two placements that a part's own symmetry cannot distinguish are the same placement, and any check that reads them as different is measuring the label rather than the geometry. Compare what the part occupies — its studs, its body — or quotient the orientation by the part's measured self-symmetry first.

**Anchor:** the seven designs are pinned in `apps/web/e2e/real-build-builder-sources.ts`; measured 2026-08-07 over the 40 upright instances of the 14 pinned designs, 39 of which reproduce the export to the LDU once `ldrawToCatalogLocalTransform` is accounted for.


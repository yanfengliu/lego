# Gate proofs

Every lesson this repository used to carry as prose is now either enforced by a machine, promoted, or dropped.

This file is the standing answer to "did the gates actually do their job". One entry per gate, each recording the product-code edit that reintroduces the defect and the failure line the gate printed when it did.

A gate nobody has watched fail is a claim, not a gate. Nothing was deleted from `lessons.md` on the strength of an entry that is not here.

## The baseline these proofs were measured against

Measured 2026-09-02 at `234dde93562d2a3c5a0a0dad9e3f62806d1eda72` ("Sync fleet canon: rework the standing-loop rules after review").

The working tree was **not** clean. It carried 188 modified tracked files and 491 untracked files of uncommitted work in progress — an in-flight catalog `/30` change adding the `builtin:jumper-plate-1x2` identity — with mtimes from 2026-08-29 to 2026-09-01. None of it was touched: no stash, no revert, no `git checkout --`. Every mutation below backed its file up in memory and restored it byte for byte, so a dirty file was never clobbered.

On that tree `npx vitest run` reported **41 test files failed, 103 tests failed, 4223 passed** before any change of this session, and **40 / 101 / 4221** on a second full run twenty minutes later — so about two of them are flaky and a count on its own is not a comparison. The named list from the second run is what the differential at the end of the session was diffed against. The failures are catalog definition-byte and hash pins that the in-flight change moved and has not yet re-pinned.

A red suite makes "I mutated the code and the suite went red" worthless as evidence. So no proof below uses the full suite as its red/green signal. Each one names a single test file, and that file was run alone and seen green immediately after the mutation was reverted — the `Green after revert` line in each entry is that run.

Where a lesson's only gate lives in a file that is already red at baseline, the lesson is **blocked, not gated**: its prose stays in `lessons.md` and it is named in the report as unproved. Retaining an unproved lesson is the correct outcome; deleting one on an unprovable gate is the failure this file exists to prevent.

## Proofs

### Naming an ambiguity is not resolving it: a check both answers satisfy cannot fail on the swap it exists to catch.

- **Gate:** `scripts/part-identification-handedness.test.mjs` :: "rejects the swapped hand even when the note names the twin by number" — run by `npm run test`
- **Mutation:** in `scripts/part-identification-claims.mjs`, replaced the pixel-read refutation `if (hand.hand !== pick) return { elementId: null, picked: "handedness-refuted" };` with a check that the model's free-text note names the twin by number, which is the original shipped grader.
- **Red:** `AssertionError: expected { elementId: '6392747', …(2) } to deeply equal { elementId: null, …(1) }` — the swapped pick was promoted, carrying the mirror twin's element.
- **Green after revert:** yes

### The structural hash covers part identifiers, so it cannot decide whether two models are the same.

- **Gate:** `packages/brick-kernel/src/build-comparison.test.ts` :: "scores an identical rebuild as an exact structural match" and "does not depend on part identifiers matching" — run by `npm run test`
- **Mutation:** in `packages/brick-kernel/src/build-comparison.ts`, added `part.id` to `placementKey`, so a placement is keyed by identifier again.
- **Red:** 3 of 12 failed; `AssertionError: expected +0 to be 1` for recall, `expected +0 to be 2` for the renamed rebuild's correct count.
- **Green after revert:** yes

### Filtering by value drops the token you wanted when it collides with the one you meant to discard.

- **Gate:** `apps/web/src/instructions/booklet-structure.test.ts` :: "reads the step from each page and ignores the printed page number", and two more — run by `npm run test`
- **Mutation:** in `apps/web/src/instructions/booklet-structure.ts`, reduced `withoutPrintedPageNumbers` to `sighting.value === sighting.pageNumber`, dropping both the smallest-type test and the once-per-page limit. That is the filter that lost step 64 of 359.
- **Red:** 3 of 16 failed, including `AssertionError: expected [ 1, 1 ] to deeply equal [ 1, 2, 3 ]` — steps whose number equals their page went out with the page number.
- **Green after revert:** yes

### Periodicity and amplitude are both forgeable: a raster staircase repeats exactly and a thresholded stroke wanders a whole row.

- **Gate:** `apps/web/src/instructions/stud-pitch.test.ts` :: "reports no pitch for p120-r0@4" and "…@6, whose outline is visibly smooth" — real traced booklet edges from `__fixtures__/booklet-edges.json`, run by `npm run test`
- **Mutation:** in `apps/web/src/instructions/stud-pitch-profile.ts`, set `minCombShare: 0`, removing the requirement that the edge's wobble gather onto the harmonics of one period.
- **Red:** `expected 67.008790765595 to be null` and `expected 14.762634617293958 to be null` — the visibly smooth page-120 outline returned a confident pitch, which is the reported failure reproduced.
- **Green after revert:** yes
- **Was not covered, and now is (2026-09-02):** the amplitude floor `minRippleRows` could be set to 0 with the whole file still green, because the synthetic staircases are refused by the harmonic test on its own — so only one of this lesson's two clauses was pinned, and the other had no destination anywhere. `apps/web/src/instructions/stud-pitch.test.ts` :: "refuses a thresholded stroke that repeats cleanly but wanders one row" adds the case only the floor refuses: a stroke rasterised from a sub-row wobble is exactly periodic on one frequency, passes every harmonic gate, and moves 1.00 rows peak to peak where a stud must clear 1.45. Measured over amplitudes 0.7 to 1.4, each is refused with "only moves 1.00 rows peak to peak" and each comes back at 40.000px with `minRippleRows: 0`. Setting the default to 0 fails it: `sub-row wobble of 0.7: expected 40.000007437224546 to be null`.

### A step highlight is an open contour whenever the step's parts go behind built ones; only about half enclose anything.

- **Gate:** `apps/web/src/instructions/highlight-region.test.ts` :: "reports a gapped outline as leaked instead of silently enclosing nothing", "keeps an open contour's own stroke, which is all it prints", "reports how many contours closed, which is the share a fill can serve" — run by `npm run test`
- **Mutation:** in `apps/web/src/instructions/highlight-region.ts`, set `leaked: false` unconditionally, so a gapped outline reports as a closed one.
- **Red:** 3 of 10 failed; `closedContourRate` moved `expected 1 to be 0.5`, and the open contour's own stroke was dropped from the region.
- **Green after revert:** yes

### An open contour has no one-sided pixel test: the stroke straddles the boundary, so rank by the printed line explained.

- **Gate:** `apps/web/src/assembly/step-score.test.ts` :: "ranks an open contour on the printed line alone, not on the line it was never given" — run by `npm run test`
- **Mutation:** in `apps/web/src/assembly/step-score.ts`, made `rankStepDelta` return `score.score` for every basis, so an open contour is ranked by the blend that includes `boundaryPrecision`.
- **Red:** `AssertionError: expected 0.9090909090909091 to be 1` — the candidate is charged for the occlusion that opened the contour, which is a fact about the page rather than about the placement.
- **Green after revert:** yes

### Simulate bricks in centimetres, not LDU or metres, and give the ground real depth or a falling brick goes straight through it.

- **Gate:** `apps/web/src/physics/rapier-world-scale.test.ts` (new) :: three cases — run by `npm run test`
- **Mutation A:** `GROUND_SLAB_HALF_DEPTH_CM` 50 → 0.001 in `apps/web/src/physics/rapier-world.ts`, the 20-micrometre sheet.
- **Red A:** `a 0.002 cm plate is crossed by 2.09 cm of travel in one 0.0167 s step, which is how the brick came to rest 11 LDU below it: expected 0.002 to be greater than 2.08806130178211`
- **Mutation B:** `CM_PER_LDU` 0.04 → 0.0004 and `GRAVITY_CM_PER_S2` 981 → 9.81, which is metres.
- **Red B:** all three cases, including `expected 9.81 to be close to 981, received difference is 971.19`.
- **Green after revert:** yes
- **Why a new gate:** the anchor's own test, "lands a body on the plate and leaves it there", holds neither claim. Two independent defences now cover the tunnelling — a deep slab and continuous collision detection — so removing either alone leaves it green, and it never looks at the unit system at all. Both mutations, plus `enableCcd(false)`, were run against it first and it stayed green every time.

### A sub-assembly box is joined to the model by its leader line, so the largest connected region is not the assembly.

- **Gate:** `apps/web/src/assembly/panel-registration.test.ts` :: "keyPrintedBoxes > masks a white box and everything it contains, not just its fill" — run by `npm run test`
- **Mutation:** in `apps/web/src/assembly/panel-art.ts`, raised `keyPrintedBoxes`'s white level to 256, so nothing on the page is white enough to key and the printed sub-assembly box stays joined to the assembly.
- **Red:** `AssertionError: expected +0 to be 1` — the box and everything inside it came through as assembly.
- **Green after revert:** yes

### Make a vision call answer the same question twice, in words and by pointing; the cheap model contradicts itself four times in five.

- **Gate:** `scripts/part-identification-vision.test.mjs` :: "fails closed on incomplete descriptions, mutable model aliases, and extra model usage" — run by `npm run test`
- **Mutation:** in `scripts/part-identification-claims.mjs`, disabled the guard that drops a pick when the free-text description and the closed-set pick disagree.
- **Red:** `AssertionError: expected { elementId: '300501', …(2) } to match object { elementId: '300501', …(1) }` — a pick its own description contradicts was promoted.
- **Green after revert:** yes

### A plate of height projects to a third of a stud, so a tolerance looser than that cannot tell one layer from the next.

- **Gate:** `apps/web/src/assembly/arrow-placement.test.ts` :: "arrowTravelFamily > measures across the arrow rather than to its endpoint" — run by `npm run test`
- **Mutation:** in `apps/web/src/assembly/arrow-placement.ts`, restored the original default `toleranceStuds = 0.35`, which is above the 0.322–0.330 of a stud that a plate projects to on every fitted panel of the sample booklet.
- **Red:** the family admitted its own neighbouring layers; `expected false to be true`.
- **Green after revert:** yes

### A safety barrier that lives only in a document is not a barrier; state the machine fact you actually ran, then make the refusal executable.

- **Gate:** `scripts/discover_builder_shell_test.py` :: `test_retained_bundle_refuses_to_parse_outside_the_pinned_environment` — run by `npm run test:python`
- **Mutation:** in `scripts/discover_builder_shell_core.py`, made `assert_pinned_environment_for_retained_bundle` return before it checks the bundle digest, so the refusal is documentary again.
- **Red:** `AssertionError: retained bundle must not be parsed`
- **Green after revert:** yes

### An exact fit to a symmetric feature set is not one answer: divide by the object's own symmetry, then let something asymmetric settle what is left.

- **Gate:** `scripts/builder_ldraw_frame_test.py` :: `test_a_symmetric_part_admits_several_frames_that_are_one_class` — run by `npm run test:python`
- **Mutation:** in `scripts/builder_ldraw_frame.py`, disabled `_same_class` inside `frames_modulo_symmetry`, so every exact frame becomes its own class and the quotient by the part's own symmetry never happens.
- **Red:** `AssertionError: 4 != 1`
- **Green after revert:** yes

### Grading a free-text answer against a controlled vocabulary measures wording, not sight, unless the prompt names the vocabulary.

- **Gate:** `scripts/part-identification-vision.test.mjs` :: "offers the call only names the grader can accept" — run by `npm run test`
- **Mutation:** in `scripts/part-identification-prompt.mjs`, replaced the printed 13-colour vocabulary with the original instruction "Give the colour as a plain colour name."
- **Red:** `AssertionError: expected 'Each image shows one LEGO part drawin…' to contain 'Green'` — the prompt stopped offering the names the grader compares against.
- **Green after revert:** yes
- **Weak spot, recorded rather than hidden:** the same test resolves each vocabulary entry through `COLOR_DEFINITIONS` by the same symbol that built it, so a mutation renaming a colour on both sides passes. What actually binds is the `toContain` against the prompt text.

### Absence needs its own outcome: without one a check reports green, and a classifier reports a confident wrong verdict.

- **Gate:** `scripts/part_description_retrieval_test.py` :: `test_agreement_on_both_sides_is_its_own_outcome` — run by `npm run test:python`
- **Mutation:** in `scripts/part_description_causes.py`, removed the third outcome from the defect-side classifier, leaving the two-way test that invented a defect out of a 1.0x tie.
- **Red:** `AssertionError: 'callout-crop' != 'neither-geometry-agrees-on-both-sides'` — the repair is pointed at a file that is fine.
- **Green after revert:** yes

### A rotation matrix stored as nine numbers has two readings; only something the ambiguity cannot rotate says which.

- **Gate:** `scripts/builder_ldraw_frame_test.py` :: `test_a_rotation_is_read_column_major` — run by `npm run test:python`
- **Mutation:** in `scripts/builder_ldraw_field.py`, returned `tuple(stored)` from `_signed_permutation` instead of its transpose, which reads Builder's matrix row-major.
- **Red:** `AssertionError: Tuples differ: (Fraction(0, 1), Fraction(8, 25), Fraction(-4, 5)) != (Fraction(-4, 5), Fraction(8, 25), Fraction(0, 1))`
- **Green after revert:** yes

### A conservation check with one unmeasured term cannot fail: the free term absorbs whatever the parse got wrong.

- **Gate:** `apps/web/e2e/callout-contract.test.ts` :: "conserves one callout accounting across the publication and real-build contracts" and "keeps the assembled model inside the printed inventory"; `apps/web/test/real-build-test-options.test.ts` :: "satisfies the full-set accounting clause at the last printed step" — run by `npm run test`
- **Mutation:** in `apps/web/e2e/real-build-contract.ts`, reverted `OFFICIAL_REAL_BUILD_ACCOUNTING` to 1486 / 1446 / 40 / **18**, restoring the term that was derived by subtraction rather than measured.
- **Red:** `AssertionError: expected 1512 to be 1486` and `expected 18 to be +0`.
- **Green after revert:** yes

### Local part frames can be right while world placements are mirrored, and a basis is one thing.

- **Gate:** `apps/web/test/real-build-builder-basis.test.ts` :: "resolves a chiral Bone trio into an assembly that holds itself up" and "refuses the same three Bones read through the mirror" — run by `npm run test`
- **Mutation:** in `apps/web/e2e/real-build-builder-transforms.ts`, set `LDD_TO_LDRAW_BASIS_SIGNS = [1, -1, 1]`, the reflection of determinant -1 that mirrored every world placement.
- **Red:** both cases failed on the resolved Bone transforms.
- **Green after revert:** yes

### A score's reachable maximum is a property of the picture; a bar that ignores it measures the panel rather than the placement.

- **Gate:** `apps/web/src/assembly/ghost-placement.test.ts` :: "scores a wholly contained ghost at exactly the panel's own ceiling" — run by `npm run test`
- **Mutation:** in `apps/web/src/assembly/ghost-placement.ts`, replaced the derived `containmentCeiling` with the fixed 0.45 bar that had been calibrated on synthetic panels.
- **Red:** `AssertionError: expected 0.2727272727272727 to be 0.45` — the panel's own ceiling and a global bar are different numbers, and only one of them is about the placement.
- **Green after revert:** yes

### A pixel measurement carries the raster it was taken on: convert it through that raster's projection, not through a fit from another one.

- **Gate:** `apps/web/src/assembly/arrow-placement.test.ts` :: "reports the same travel from either raster, which is the whole point", "recovers the travel a displacement measured on the work raster came from", and two more — run by `npm run test`
- **Mutation:** in `apps/web/src/assembly/arrow-placement.ts`, made `panelProjectionForWorkRaster` pass the fit's `pixelsPerUnit` through unchanged, which is the shipped defect.
- **Red:** `AssertionError: expected [ [ +0, -32, +0 ] ] to strictly equal [ [ +0, -64, +0 ] ]` — exactly `workFactor` times too short, reproduced.
- **Green after revert:** yes

### A check is written against the cases that exist, so ask what it would say about one it has never seen.

- **Gate:** `packages/catalog/src/connector-backing-policy.test.ts` :: "keeps every clutch on the shipped plate whose body is a real cavity" and three more — run by `npm run test`
- **Mutation:** in `packages/catalog/src/connector-backing-policy.ts`, made `undersideHoldsStud` admit a clutch only when the face is backed by solid, dropping the cavity branch. Correct for a stud, exactly backwards for a clutch.
- **Red:** `AssertionError: expected 'semantic-tube-seat-grid' to be 'modelled-shell-cavity'`, and the admitted-clutch tallies fell to zero.
- **Green after revert:** yes

### A hand-built surface can be present, counted by a test, and invisible: measure which way each face points, never the vertex order.

- **Gate:** `packages/rendering/src/rendering.test.ts` :: "points every face of an underside tube outward, at a camera that can see it" — run by `npm run test`
- **Mutation:** in `packages/rendering/src/geometry.ts`, reversed the winding of the tube's outer wall quad in `createTubeGeometry`, so a `FrontSide` material culls it.
- **Red:** 1 of 33 failed, on the face-direction census.
- **Green after revert:** yes

### "Err on the safe side" has a direction, and a legal fit that is nearly tangent reverses it.

- **Gate:** `packages/brick-kernel/src/tube-clearance.test.ts` (new) :: "leaves the four studs its own cell puts at its corners, which a bounding box does not" and "lets two 2-wide parts seat exactly on each other, connection declared" — run by `npm run test`
- **Mutation:** in `packages/catalog/src/part-factory.ts`, replaced the inscribed tube box `outerRadiusLdu / Math.SQRT2` with the bounding box `outerRadiusLdu`.
- **Red:** `builtin:brick-2x2 tube:0 half-side 8 leaves -3.172 LDU for a stud half a pitch away in both plan axes: expected -3.1715728752538097 to be greater than 0`, and `builtin:plate-2x2 seated on itself: expected [ 'PART_STUD_BODY_COLLISION' ] to not include 'PART_STUD_BODY_COLLISION'`.
- **Green after revert:** yes
- **Why a new gate:** the anchor's own test, "seats a stud in the cavity, and refuses one a single LDU off the lattice" in `validation.test.ts`, is about the *cavity wall* and stacks 1x1 bricks, which have no tube at all. The same mutation was run against it first and it stayed green; across all of `packages/brick-kernel` it moved only catalog hash pins, which report a changed digest rather than a refused build.

### A text prompt is not an image transport; retain the exact image tool call and result or a claimed vision check cannot prove it saw pixels.

- **Gate:** `scripts/multi-panel-vision-claude-adapter.test.mjs` :: "refuses a successful tool result carrying pixels from another bound request" — run by `npm run test`
- **Mutation:** in `scripts/multi-panel-vision-claude-adapter.mjs`, disabled the byte-for-byte comparison of the retained tool result against the bound request's own image and label blocks, leaving the tool name, call id and success bit — the first mocked adapter's check.
- **Red:** `AssertionError: expected [Function] to throw an error` — a result carrying another request's pixels was consumed.
- **Green after revert:** yes

## The phase of a repeat is not the centre of the thing that repeats — half proved

- **Gate:** `packages/rendering/src/camera-fit-lattice.test.ts` :: "latticePhase > moves with the picture, so it registers one panel against another" — run by `npm run test`
- **Mutation:** in `packages/rendering/src/camera-fit-lattice-phase.ts`, dropped the negation from both returned phases, so the phase is the transform's raw argument.
- **Red:** 1 of 22 failed — the recovered shift is mirrored about the panel's centre, which is the sign trap the lesson names.
- **Green after revert:** yes
- **Not covered:** the lesson's main claim — that grid sites must be drawn from `foldedStudShape`'s own ring centre rather than from `latticePhase`'s Fourier argument — lives at every *call site*, and `latticeSiteResiduals` takes the phase as a parameter. Both existing residual tests hand it the fold, so passing the Fourier phase instead is not caught by anything. The rule survives here and in the `latticeSite` doc comment; the prose line stays in `lessons.md`.

## Proofs added in the second pass, 2026-09-02

Measured against the same working tree, at `e126d30`. The same rule holds: each entry names one test file, run alone and seen green immediately after the mutation was reverted. Every backup and restore was a byte copy; nothing was stashed, reverted or checked out.

### An error message that covers several causes hides the real one — split the condition and name the observed values.

- **Gate:** `apps/companion/src/run-ledger-recovery-diagnostics.test.ts` :: five refusal cases plus "gives each of the five conditions a message of its own" — run by `npm run test`
- **Product change first:** `recoverEvents`'s pre-open check was itself an instance of the defect the lesson names — four conditions (missing, symbolic link, not a regular file, extra hard links) sharing "Run event stream is not a regular file". Those are now four messages, and the truncated-record and unterminated-stream refusals now name their observed byte counts.
- **Mutation:** collapsed all ten refusals in `apps/companion/src/run-ledger-file.ts` back to the single `"Ledger file exceeds its byte cap"` the lesson was born from.
- **Red:** 6 of 9 failed; `expected 'Ledger file exceeds its byte cap' to contain '2 links'`, `…to contain 'is a directory, not a regular file'`, `…to contain '4096 bytes'`, `…to contain '1200 bytes'`, `…to contain '300 bytes'`, and the distinctness case at `expected 1 to be 5`.
- **Green after revert:** yes
- **Why the anchor's own tests were not the gate:** the 46 failing companion tests named in the evidence failed on the device mismatch, not on the message, and the nearest existing case — "fails closed on a hard-link swap instead of truncating an external file" in `run-ledger-adversarial.test.ts` — asserts the error *code* only. Both were run against the collapsed messages first and stayed green.

### `lstat` and a handle's `fstat` disagree on `dev` across platforms; the inode is the identity, the device only corroborates.

- **Gate:** `apps/companion/src/run-ledger-recovery-diagnostics.test.ts` :: "holds a file the same when only one side reports a device", "refuses a different inode however the devices compare", "still refuses a moved device when both sides report one" — run by `npm run test`
- **Mutation A:** in `apps/companion/src/run-ledger-file.ts`, replaced `sameFile`'s device clause with `left.dev === right.dev`, dropping the dev-0 tolerance.
- **Red A:** `AssertionError: expected false to be true` — the Windows `lstat`/`fstat` pair is refused as a swapped file, which is the shipped defect.
- **Mutation B:** dropped the inode comparison instead, leaving the device to decide.
- **Red B:** `AssertionError: expected true to be false` — a different inode is accepted.
- **Green after revert:** yes
- **A stated limit of its reach:** the divergence is a property of the host. `sameFile` was exported and pinned directly because a control run on this machine measured `lstat` and `fstat` agreeing — both `dev 3603962542` for the same file — so no end-to-end recovery here can exercise the tolerance at all. Separately, `LedgerFileIdentity.ino` is a `number` and the real Windows inode in the anchor (`39406496742044240`) is above `Number.MAX_SAFE_INTEGER`, so two distinct inodes rounding to one double would compare equal. That is recorded here, not fixed.

### Some steps are drawn exploded, so a highlight gives shape and orientation but not position — and counting them by red pixels overcounts badly.

Two clauses, and each has its own gate.

- **Gate (position):** `apps/web/src/assembly/exploded-score-blend.test.ts` (new) :: "ranks the true placement over one the difference reading alone prefers", "…over one the emerged region alone prefers", "keeps both readings inside one number rather than choosing between them" — run by `npm run test`
- **Mutation:** `EMERGENCE_WEIGHT` in `apps/web/src/assembly/exploded-score.ts`, at 0, 1, 0.45 and 0.56.
- **Red:** all four. At 0, `expected 0.4 to be greater than 0.9` — the difference reading alone takes the impostor. At 1, the same line for the emerged region alone. At 0.45 and 0.56 the margins invert by 0.005 and 0.016, so the gate pins the weight to about (0.4545, 0.5455) rather than merely to "not 0".
- **Green after revert:** yes
- **Why a new file:** every candidate in `exploded-score.test.ts` is handed the same rectangle as both its emerged and its changed mask, so both readings return one number and any weight scores identically. The four mutations above were run against it first and it stayed green every time.
- **Gate (the red-pixel overcount):** `apps/web/src/assembly/panel-arrows.test.ts` :: "refuses a red part for being too big, and says so", "refuses a red plate that is long, thin and inside the area cap", "refuses an arrow that starts nowhere near what the step highlighted" — run by `npm run test`
- **Mutations:** in `apps/web/src/assembly/panel-arrows.ts`, the origin check disabled; the `maxAreaFraction` default 6e-3 to 1; the `maxFillFraction` default 0.55 to `Infinity`.
- **Red:** `expected [ { areaPx: 464, … } ] to have a length of +0 but got 1` for a sub-build's own arrow; `expected 'red blob of 32000px is 1.25 times lon…' to match /red part rather than an arrow/`; `expected [ { areaPx: 2970, … } ] to have a length of +0 but got 1` for step 12's red 2x6 plate.
- **Green after revert:** yes
- **A weak mutation, recorded rather than hidden:** setting `maxFillFraction` to 1 rather than `Infinity` leaves the whole file green, because a 99x30 plate fills 104% of the box measured from its own principal axis. A fill cap of 1 is not the absence of a fill cap.

### The booklet turns the model over mid-build and prints an icon saying so; a panel the loop scores against the wrong face cannot be matched by any placement.

- **Gate (the icon):** `apps/web/test/real-build-rotation-icon-detection.test.ts` (new) :: six cases — run by `npm run test`
- **Mutation:** `ROTATION_ICON_SIDE_PT` 44.937 to 30 in `apps/web/e2e/real-build-transition-features.ts`.
- **Red:** 5 of 6 failed, including `expected 30 to be 44.937` and `expected false to be true` for a white square drawn at the size the booklet prints it.
- **Gate (the consumption):** `apps/web/src/assembly/panel-face.test.ts` :: "seeds at studs-up and toggles on the step the icon is printed on" and three more — run by `npm run test`
- **Mutation:** removed the toggle from `derivePanelFaces` in `apps/web/src/assembly/panel-face.ts`, so the icon is detected and then consumed by nothing, which is the state the lesson found.
- **Red:** 4 of 17 failed, including `expected [] to deeply equal [ 4, 5, 6, 7, 8, 9, 10, 11, 12 ]` — one missed icon inverts every later step rather than its own.
- **Green after revert:** yes
- **Why a new file for the icon:** every existing check builds its fixture out of `ROTATION_ICON_SIDE_PT`, so moving the constant moves both sides of the comparison and nothing can fail. The new file writes the side, the tolerance and the admitted extremes as literals. It also pins one limit rather than leaving it to be rediscovered: attribution is centre-in-panel-bounds, so an icon printed above its panel's artwork is not counted for it, which is what the "39 icons, one per page" undercount was.

### A selector that consults the acceptance test only after choosing will refuse while holding the answer, and report the loser's number.

- **Gate:** `packages/rendering/src/camera-fit-lattice-selection.test.ts` (new) :: "keeps printed step 4's own grid over the coarser lattice that cannot be printed", "never chooses a candidate the gate refuses while one it admits is on the list", and two more — run by `npm run test`
- **Product change first:** the comparator was inline in `fitStudLattice`, reachable only through a raster. It is now `chooseLatticeCandidate` in `packages/rendering/src/camera-fit-lattice.ts`, behaviour-identical — it sorts the same array in place and returns its head — so the ordering is testable on candidates directly.
- **Mutation:** moved the axonometric acceptance test back below the coarseness tie-break, which is the ordering that refused printed step 4 for two days.
- **Red:** `expected { …(8) } to be { Object (label, basis, ...) }` — the index-2 sublattice at 9.11px of residual is chosen over the panel's own grid — and `expected false to be true` on the class property.
- **Green after revert:** yes
- **Reach:** the second case asserts the property rather than the instance — over every permutation of a three-candidate family, the chosen candidate passes the acceptance test whenever any candidate does. All 22 cases of `camera-fit-lattice.test.ts` were run against the same mutation first and stayed green, which is why the property is stated over candidates and not over a synthetic panel.

### The phase of a repeat is not the centre of the thing that repeats; fold the cell and take the drawn ring's own centre.

- **Gate:** `npm run typecheck` (`tsc --noEmit`), through `packages/rendering/src/camera-fit-lattice-site-phase.test.ts` (new) :: "refuses the Fourier argument at the type level, at every site call"
- **Product change first:** `latticeSite`, `latticeSitesInBox` and `latticeSiteResiduals` all took `LatticePhaseOffset`, which both readings satisfy, so passing the Fourier argument at any of the four call sites compiled and ran. They now take `LatticeSitePhase`, a marker only `foldedStudShape` returns. The marker is a `unique symbol` declared on the type and never assigned, so it has no runtime footprint: callers put a `phase` into result objects that reach `output/` artifacts, and a marker that exists to prevent a mistake must not be able to move a pinned digest. The test asserts the returned object still has exactly its four own keys.
- **Mutation:** widened all three exported site functions back to `LatticePhaseOffset`.
- **Red:** `packages/rendering/src/camera-fit-lattice-site-phase.test.ts(122,5): error TS2578: Unused '@ts-expect-error' directive.`, and the same at (124,5) and (126,5) — one per site call.
- **Green after revert:** yes
- **Why the gate is a type and not a threshold — measured, not assumed:** on the synthetic grid this module draws, the two phases agree to 0.0003 of a cell and the residuals taken against either are indistinguishable, 0.2504px against 0.2501px and 19.7391 against 19.7395 on the anti-phase control. No fixture this module can draw separates them; the half-cell divergence is a property of printed instruction art, where the anchor measured 0.96px of reprojection error from the folded centre against about 20px from the Fourier argument. The sign trap beside it stays gated where it was, in `camera-fit-lattice.test.ts`.

## Proofs from the second pass's triage of the remaining lessons, 2026-09-02

### A deterministic capture default is the wrong default for an interactive camera.

- **Gate:** `packages/rendering/src/rendering.test.ts` :: "keeps the model inside the frustum at any dolly distance", "covers display layers wider than the model when asked to", "reproduces the canonical frustum clipping it replaces for interactive use" — run by `npm run test`
- **Mutation:** in `packages/rendering/src/cameras.ts`, made `orbitCameraFrustum` compute its planes from the authored capture distance (`sceneRadius * 3`) instead of the live orbit distance, which is the pinned frustum reused for interaction.
- **Red:** 3 of 33 failed.
- **Green after revert:** yes
- **The clause that did not leave this way:** the interactive *framing* minimum — the half-unit fallback box putting the camera inside the first brick — lives in `Math.max(view.frameRadius, GRID_SCENE_RADIUS)` in `apps/web/src/components/BrickViewport.tsx`, where `GRID_SCENE_RADIUS` is private to a `.tsx` component. It moved to `docs/policies/local-rules.md` with the gate it would need named there.

### An LDraw part has no inside: its hollows are open primitives, so test that the real surface is contained rather than counting ray crossings.

- **Gate:** `scripts/part_admission_ldraw_candidate_test.py` :: `test_the_inset_probe_shrinks_only_horizontal_faces`; `scripts/part_admission_scorecard_test.py` :: `test_a_quarter_ldu_inset_is_a_hard_fail_not_a_low_score` — run by `npm run test:python`
- **Mutation:** in `scripts/part_admission_scorecard.py`, made every sampled surface point count as contained, which is what a containment check that has stopped checking looks like. Parity itself is gone and cannot be reintroduced; what is provable is that the measurement replacing it is live.
- **Red:** `AssertionError: Lists differ: ['female-connector-has-no-room-for-a-stud'] != ['female-connector-has-no-room-for-a-stud', 'collision-under-claim']` and `Lists differ: [] != ['collision-under-claim']` — the box union stops being checked against the surface it claims to contain.
- **Green after revert:** yes

### A clearance probe answers whether a stud fits, never whether anything holds it, so it cannot settle a disagreement between two authored sources.

- **Gate:** `scripts/ldcad_shadow_coverage_test.py` :: "a cell one lattice step away is a disagreement not a match" and "a tube a whole stud pitch away backs nothing" — run by `npm run test:python`
- **Mutation A:** `POSITION_TOLERANCE_LDU` 1e-9 → 25.0 in `scripts/ldcad_shadow_coverage.py`, which absorbs the two LDCad-only cells into agreement instead of recording them.
- **Red A:** `AssertionError: 1 != 0`
- **Mutation B:** made `tubesAtThisCellsCorners` count every measured tube rather than the ones 10 LDU away in both plan axes, so a claim resting on a wall reads as tube-backed.
- **Red B:** `AssertionError: 1 != 0` on the cell whose nearest tube is 30 LDU away.
- **Green after revert:** yes

### An exact ambiguity cannot be resolved by telling the measurement which answer to prefer; the cue belongs where the answer is used.

- **Gate:** `packages/rendering/src/camera-fit-lattice.test.ts` :: "gives the same lattice for a below-view as for an above-view at negated azimuth" and "fits a below-view panel as an above-view without ever failing" — run by `npm run test`
- **Mutation:** in `reduceToAxonometricBasis`, negated `b` after `canonicalPair` has oriented it — the shipped `face` option, threaded in as a below-view.
- **Red:** 16 of 22 failed, and the named case failed with `expected null not to be null` — the option is destructive rather than inert, which is the correction the lesson records: refitting every panel as a below-view produced 0 solutions where 32 had been found.
- **Green after revert:** yes

### An annotation drawn to a hidden destination states its direction, not its length; treat the ink as a floor and let the picture supply the rest.

- **Gate:** `apps/web/src/assembly/arrow-placement.test.ts` and `apps/web/test/real-build-exploded-step.test.ts` :: "takes the ink as a floor, so nothing travels less far than it was drawn", "recovers a travel the arrow was inked too short to state", "stops at the model rather than carrying the part through it", "settles from an arrow inked short of the travel it means" — run by `npm run test`
- **Mutation A:** in `arrowTravelFamily`, read the ink as a length rather than a floor — `Math.abs(travelPx - drawnPx) > tolerancePx` in place of the floor-and-ceiling window, which is `correctArrowForClearance`'s assumption.
- **Red A:** 6 of 35 failed.
- **Mutation B:** dropped the ceiling, leaving only the floor.
- **Red B:** 3 of 35 failed, including "stops at the model rather than carrying the part through it".
- **Green after revert:** yes

### File metadata cannot see a same-size rewrite.

- **Gate:** `apps/web/test/real-build-input-files.test.ts` :: "never returns same-tick pre-open rewritten bytes when the caller pins their digest" and "rejects bytes whose content digest differs from the caller's pin" — run by `npm run test`
- **Mutation:** in `apps/web/e2e/bounded-file-read.ts`, made `assertPinnedContent` return before comparing the digest.
- **Red:** the file's failures went from 1 to 3 **by name**, the two new ones being exactly those cases. That file carries one pre-existing failure at baseline — "rejects and removes a same-size mutation after atomic publication", which fails with `EBUSY: resource busy or locked` on this host — so the proof is a by-name differential rather than a count.
- **Green after revert:** yes, back to the same single pre-existing failure.
- **The clause that did not leave this way:** "a guard test that passes on an incidental clock tick is a false green" is about how a test came to be green, not about the file read. It is staged in `canon-candidates.md`.

### A maximisation is also a blindness: a score maximised over shift cannot see a difference smaller than its own search reach.

- **Gate:** `apps/web/test/real-build-registration-reach.test.ts` (new) :: four cases — run by `npm run test`
- **Product change first:** `REGISTRATION_SCALES`, `REGISTRATION_RADIUS` and a derived `REGISTRATION_REACH_PX` are now exported from `apps/web/e2e/real-build-deferral.ts`, with the reach documented as the blind spot it is. The reach was implicit before, so nothing could compare it against the difference it had to resolve.
- **Mutation:** `REGISTRATION_SCALES` `[8, 3, 1]` → `[64, 8, 3, 1]`, widening the reach from 48px to 304px.
- **Red:** `expected [ 64, 8, 3, 1 ] to deeply equal [ 8, 3, 1 ]`, `expected 15.2 to be less than 3` — a stud at the booklet's own 20px is no longer outside the blind spot — and, in the existing `real-build-deferral.test.ts`, `refuses a winner the panel does not corroborate` fell to `expected 0.058335010424077904 to be greater than 0.0878`.
- **Green after revert:** yes
- **What was tried first and did not work:** widening the same constant to `[512, 128, 32, 8, 3, 1]` with radius 8 — a 4096px reach — left all 22 cases of `real-build-deferral.test.ts` green, which is the finding that made a new file necessary. The measured spread the new gate rests on: over a block 80px wide on a 400x200 raster under the `"iou"` measure, offsets 0 to 48 come back between 0.863 and 1.000 — placements up to 2.4 studs apart at the booklet's own 20px per stud — and four times the reach comes back at 0.
- **A limit of the fixture, stated rather than left to be found:** the reach boundary is not crisp in it. An 80px block shifted 96px still overlaps a little, so it reads 0.863 as well; only at 192px, where the overlap is nil, does the score collapse. What the gate holds is the pin on the reach and the collapse far outside it, not a knife edge at 48.

### Recomputing pinned truth per call turns catalog growth into a timeout that reads as a hang.

- **Gate:** `packages/brick-kernel/src/truth-snapshot-memoisation.test.ts` (new) :: "returns one frozen object however often it is asked", "does not rebuild it once per validation" — run by `npm run test`
- **Mutation:** removed `if (cachedTruthSnapshot) return cachedTruthSnapshot;` from `createBuiltinTruthSnapshot` in `packages/brick-kernel/src/factory.ts`.
- **Red:** both cases, `AssertionError: expected { …(6) } to be { …(6) } // Object.is equality`. The second case also went from milliseconds to 5.42 seconds, which is the original symptom — but it fails on an assertion naming the defect rather than by timing out, which is the point of asserting identity instead of elapsed time.
- **Green after revert:** yes

### The lessons queue itself: every retained rule names the gate it is waiting for.

- **Gate:** `scripts/check-lessons.mjs` — run by `npm run lessons:check`, which is in `npm run verify`
- **Product change:** the pairing check now measures the claim separately from the gate clause, and refuses any rule with no `**Waiting on:**`. Without it a line can sit in the queue indefinitely with nothing said about what would let it leave.
- **Mutation A:** stripped the `**Waiting on:**` clause from one rule.
- **Red A:** `Lessons check failed: 1 rule(s) name no gate. Add "**Waiting on:** …"`
- **Mutation B:** pushed one claim past 160 characters, with its gate clause intact.
- **Red B:** `Lessons check failed: 1 rule(s) state a claim longer than 160 characters, which defeats an index.` — so widening the line to hold a gate name has not quietly widened the index budget.
- **Green after revert:** yes

## Reach and clause audit of the first pass, 2026-09-02

One mutation proves a gate catches that mutation; it does not prove the reach claimed in prose beside it. And a lesson with several clauses needs a destination for every clause, not one gate that absorbs its siblings. Both were checked against the entries above.

### The tube-clearance gate's class claim holds, and had one hole that did not

The claim is that the gate covers the corpus rather than one part: `packages/brick-kernel/src/tube-clearance.test.ts` walks `BUILTIN_CATALOG.parts` and derives the clearance for every `tube:` primitive. A new member was added to test it — `part-factory.ts` made to author the *bounding* box for `3001.dat` alone, one part of 106 — and the gate named it: `builtin:brick-2x4 tube:0 half-side 8 leaves -3.172 LDU …: expected -3.1715728752538097 to be greater than 0`. So a single new part authored wrongly is inside the gate.

The hole was the loop's own `if (tube.kind !== "box") continue`. A tube authored as a **cylinder** left the loop silently, and `collision-world-primitives.ts` gives a cylinder half-extents of `[radius, radius, halfHeight]` — its bounding box, which is precisely the approximation the lesson refuses. Proved by authoring `3001.dat`'s tubes as cylinders: before the fix only the second case caught it, and only because `brick-2x4` happens to be one of three hardcoded stacks; a cylinder tube on any other part would have escaped. The loop now collects unboxed tubes and fails on them (`a tube that is not a box escapes the clearance check above: expected [ …(3) ] to deeply equal []`). The non-vacuity floor moved from `> 20` to the measured corpus — 582 tube boxes over the 30 parts that carry one, of 106 — and a second case states the remaining horizon out loud: tubes are found by the `tube:` id prefix `part-factory.ts` writes, and by nothing else.

### Clauses of the lessons deleted in this pass, enumerated before they were deleted

Four of the eight carried more than one claim, and each clause was given its own destination rather than being absorbed by a sibling's gate.

- **The interactive camera lesson** is two: the framing minimum and the frustum. The frustum is gated; the framing minimum is a `.tsx`-private constant and moved to `local-rules.md` with the gate it would need named there.
- **The file-metadata lesson** is two: metadata cannot see a same-size rewrite, and a guard test that passes on an incidental clock tick is a false green. The first is gated; the second is staged in `canon-candidates.md`.
- **The LDraw-has-no-inside lesson** carries a second finding under its own 2026-08-09 heading: consistent winding is necessary for run pairing and is not sufficient, and "feasible, because the winding is consistent" reached a pushed commit message before it was measured. The containment gate covers the remedy; the "necessary is not sufficient" claim is staged in `canon-candidates.md`.
- **The exact-ambiguity lesson** names three habits. Distinguishability-before-parameterising is gated by the equivalence regression. "Quote a number only from something a later reader can re-run" is already fleet canon. "An option with no caller is worse than none, because it reads as a capability" was not covered anywhere — `PanelFace` is still exported from `camera-fit-lattice.ts` with nothing consuming it, deliberately, as the finding — and is staged in `canon-candidates.md`.

### One clause of "periodicity and amplitude are both forgeable" had no destination

It is recorded in that entry above. The lesson names two forgeries and only the periodicity half was pinned; the amplitude half was deleted with the prose and existed in no file. It now has its own case and its own mutation.

### "At every site call" was two calls of three

The second-pass phase gate claimed to refuse the Fourier argument "at every site call" while naming `latticeSite` and `latticeSiteResiduals`. `latticeSitesInBox` is now in the same case, so the claim is checked rather than asserted.

### Claims that were checked and are not over-stated

- `connector-backing-policy.test.ts` names one shipped plate and asserts all eight of its clutches; its six other cases build fresh blueprints through `makePartDefinition`, which is the "case it has never seen" the lesson is about. No class claim beyond that appears in its entry.
- `rendering.test.ts` :: "points every face of an underside tube outward" censuses every triangle of one tube of one part. The tube geometry comes from one `createTubeGeometry`, so one tube is the family; the entry claims no more than that.

## Lessons deliberately retained after the second pass, with the gate each is waiting for

Ten rules are still in `lessons.md`, and every one of them now names what would let it leave. Nine need a gate that does not exist yet and are honest queue entries; one has a gate that cannot be run.

- **An orientation compared as a string, not modulo the part's own symmetry.** This one is *blocked*, not ungated. Its gate exists — the `catalog-part-self-symmetry` rows of "recomputes the retained v8 report and derives the exact step-1 canonical origin" in `apps/web/test/real-build-builder-calibration.test.ts` — and that case is red at baseline, with `Pinned Builder source 3040;F/builtin:slope-1x2-45 is stale against catalog builtin.basic-parts/30`. That is the in-flight catalog change, not this work. A mutation proof against a case that is already red proves nothing, so the prose stays until it is green.
- The other nine name a test that has to be written. Four of them (the hand-assembled parts array, insertion order, the crop box, the printed-panel registration) exist today only as Playwright specs over the sample booklet; two (the gallery assignment, the colour distance) are in `.mjs` scripts with no test file at all; one (the stud grid's missing translation) needs a translation-invariance case beside the recovery cases that are already gated; one (the instruction finish) needs the printed reference its spec loads; and one (the byte comparison's message) needs a regression that was deleted along with the pinning surface it was written against.

Two lessons left this pass by promotion rather than by gate, and each is named where it went:

- **A green vision narrowing can drop settled truth** → `canon-candidates.md`. The replay that covers it is green either way; what transfers is that a safety result must not be reported as a correctness one.
- **A contact sheet can be full-size while every bound image inside it is downsampled** → `docs/policies/local-rules.md`, as a requirement on any inspection composite this repo builds.

One left as a duplicate: **long feedback loops need an intermediate score** is already `AGENTS.md`'s own convention, established 2026-07-31 from the same step-64 anchor — "build the measurable intermediate first and drive it… a booklet checks itself… a change with no number attached is not progress". Keeping both halves would have been a second copy of a rule already read every session.

## Lessons whose gate could not be made to go red

Each was mutation-tested and the named gate stayed green, which is the finding. The first five stay in `lessons.md` and `lessons-evidence.md` as unproved prose; the sixth left instead by promotion, because the code it was born in no longer exists to mutate.

- **An error message that covers several causes hides the real one.** `run-ledger-file.ts` splits the five conditions and names the observed values in each, but nothing asserts the messages. The anchor's "46 failing tests" failed on the device-mismatch defect, not on the message. Collapsing all five back into one byte-cap message leaves the suite green.
- **`lstat` and a handle's `fstat` disagree on `dev` across platforms.** `sameFile`'s `left.dev === 0 || right.dev === 0` tolerance is referenced by no test in the repository.
- **A step's highlight is not always where the part ends up.** `EMERGENCE_WEIGHT` in `exploded-score.ts` can be set to 0 — scoring by the change reading alone, which measured 3 of 5 against emergence's 4 of 5 — with `exploded-score.test.ts` fully green.
- **A selector that consults the acceptance test only after choosing.** Moving the axonometric test back below the coarseness tie-break in `fitStudLattice`'s sort leaves all 22 cases of `camera-fit-lattice.test.ts` green. The printed-step-4 case that pins it is in the Playwright spec `apps/web/e2e/camera-panel-fit.spec.ts`, which needs the sample booklet PDF.
- **The booklet turns the model over and says so.** Changing `ROTATION_ICON_SIDE_PT` from 44.937 to 30 leaves `real-build-transition-classification.test.ts` green.
- **A cost curve's true minimum is its sharpest point.** The module the lesson was born in was rewritten: `findPitchCandidates` no longer exists and the estimator maximises a comb power rather than minimising a cost, so there is no smoothing to reintroduce.

## The differential the second pass was checked against, 2026-09-02

`npx vitest run`, with nothing else running and no file edited while it ran: **44 test files failed, 103 tests failed, 4231 passed**, 48 skipped, 2 todo, over 589 files in 766.82s. The first pass recorded **44 / 103 failed and 4197 passed over 582 files** at the end of its own work on this same tree, so the failure counts are identical. The 589 is 582 plus this pass's seven new test files, and the 4231 is 4197 plus their 32 cases plus the two added to existing files.

That is a count, and a count is not a comparison. Checked by name instead:

- Thirty-nine files printed a failing case. **None is a file this pass created or changed**, and none appears in the 52-file set that imports any module this pass changed — `camera-fit-lattice`, `camera-fit-lattice-phase`, `real-build-deferral`, `run-ledger-file`, `stud-pitch-profile`, `check-lessons`.
- Thirty-one of the thirty-nine are modified or untracked in the working tree — the in-flight catalog `/30` work. The other eight fail on moved catalog digests, on `tar: Cannot connect to C: resolve failed`, and on a legacy-diagnostic message; the same three causes the first pass recorded.
- All nineteen test files this pass created or touched were also run together, alone: 235 passed, 0 failed.

`npx playwright test`: **59 passed, 16 skipped, 1 failed** in 14.1 minutes. The failure is `apps/web/e2e/manual-building.spec.ts:97 › steps through the build it just made`, on `expect(locator).toHaveText` receiving `"preview"`. That spec is modified in the working tree and nothing in it touches this pass's work.

One earlier full run is discarded rather than reported: it was started, then `npm run build` was run beside it and two files were edited while it was in flight. It came back 61 / 127, and the only failure in this pass's own area was the test file being edited at the time. A suite this scheduling-sensitive cannot be measured while the tree moves under it.

Non-test gates at the same point:

- Pass: `schema:check`, `node:check`, `observations:check`, `parts:check`, `lessons:check`, `notices:check`, `tsc --noEmit`, `npm run test:python` (exit 0), `npm run build` (typecheck, web build, and the production bundle guard).
- Fail, pre-existing: `bom:check` on an untracked WIP `.dll` the census has no policy for, and `migration-history:check` on the same `tar` drive-path error.
- Fail, environmental and new since the first pass: `format:check` and `lint` both die on `EPERM: operation not permitted, scandir '.pytest_cache'`. That directory is gitignored and dates from 2026-08-23 at the root and 2026-08-29 under `scripts/`, so it predates this session. Prettier's verdict on every file it could read is "All matched files use Prettier code style!", and `eslint apps packages scripts --ignore-pattern "**/.pytest_cache/**" --max-warnings 0` reports exactly two errors, both `no-unused-vars` in untracked WIP files.

## The differential this session was checked against

Full `npx vitest run` before this session's changes: 40 files / 101 tests failed, 4221 passed. After: 44 / 103 failed, 4197 passed, over 582 files rather than 580 — the two extra files are the new gates above.

Diffed by test name rather than by count, eight failures appeared and two disappeared. All ten live in `apps/web/test/real-build-prefix50-*`, the in-flight catalog `/30` area, and none of them imports anything this session changed — a grep for the changed modules across those files returns zero. Run alone, all six newly-failing files pass: 4 files / 32 tests and 2 files / 6 tests, both green. They do real process kills, staging publication and PDF-toolchain work, and adding two test files to the run reschedules the eight workers around them.

So the honest statement is not "zero new failures". It is that the WIP area carries scheduling-sensitive tests, that the set of failures moves between runs of the same tree, and that nothing this session touched appears in it.

Non-test gates at the same point: `schema:check`, `node:check`, `observations:check`, `lessons:check`, `notices:check`, `parts:check`, `tsc --noEmit`, and `eslint`/`prettier` over the changed files all pass. `bom:check` fails on an untracked WIP `.dll` the census has no policy for, and `migration-history:check` fails on a `tar` invocation that cannot resolve a Windows drive path in this shell. Both predate this session.

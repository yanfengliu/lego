# Lessons

Each entry records something that cost real time, with an anchor that proves it happened.
Unanchored lessons are folklore and do not belong here.

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

# Handoff to Codex

Paste the block below after `/goal`.

---

Read a real LEGO instruction PDF, assemble the set it describes, render it, and play back every step. Repo: `C:\Users\38909\Documents\github\lego`, branch `main`, everything pushed. Read `AGENTS.md`, `docs/learning/lessons.md` (28 rules — the short index, not the evidence file), `docs/design/spec.md`, `docs/design/part-model.md`, `docs/design/building-system.md` before touching anything.

## The one thing that blocks everything

**The real booklet cannot start.** Set 6651557 step 1 places two parts, step 2 a third, and none of the three is in the 71-part catalog:

- `30565` Plate Round Corner 4x4 (step 1)
- `80015` Plate Round Corner 5x5 with 4x4 Round Cutout — a quarter ring (step 1)
- `30503` Wedge Plate 4x4 Cut Corner (step 2)

Only 11 of the 45 steps carrying callouts have every part present. First fully-covered step is 8, unreachable. Adding `91988`, `30565`, `80015`, `30503`, `6106`, `54383` unblocks steps 1–9.

**The design question this forces, and it is real work, not typing.** A rounded corner and a quarter ring are curved _in plan_. `bodyWedge` is a single straight half-plane cut and cannot express a curve. Multi-box `bodyBoxesLdu` can approximate one, but a visual critic has already rejected the existing slope staircases as "sawtooth combs", and a circle's curvature is more obvious than a slope's. Consider instead a circular-arc primitive — the collision model already has a cylinder, which is already round. If you propose splitting what collision uses from what the renderer draws, argue against `part-model.md` explicitly and update it; do not quietly diverge.

Measure with `node scripts/ldraw-part-facts.mjs 30565 80015 30503 91988 6106 54383`. Never author a part from memory — one agent did and put the studs at the wrong offset. Check containment by ray-casting the real LDraw solid; ray _parity_ lies, because LDraw builds hollows from open primitives.

## Uncommitted work from three agents killed mid-task

Left in the tree deliberately. Some is broken — `packages/rendering/src/index.ts` exports from `part-solids.ts`, which is untracked. Read it, finish or discard it, but do not assume it works.

- `packages/rendering/src/{geometry,instruction-finish,instruction-view,index}.ts`, `part-solids.ts`, `part-solids.test.ts`, `apps/web/e2e/instruction-finish.spec.ts` — reworking wedge outlines and slope staircases after the critic's report.
- `apps/web/e2e/real-build.spec.ts`, `real-build-run.ts` — the real-booklet driver, mid-write.

## What works, with its number

- **Booklet reading**: 359/359 steps, sequence coverage 1.000. Inventory 276 elements / 1465 pieces, matches Brickset exactly. 50 panels cut, 48 with usable highlights.
- **Camera fit** from the printed stud lattice: 32 of 40 panels, 0.94 px reprojection over 99.2% of sites. Elevation 35.59° — a third of a degree off true isometric. Four camera runs; the jumps between them are the booklet turning the model over, and it prints a rotation icon when it does.
- **Panel registration**: camera holds to 0.24° azimuth between consecutive panels; the model translates a median 23 pt. Translation is searchable — 49/49 align, 91% silhouette agreement, outlines a median 2 px apart.
- **Arrow reading**: 13 of 50 steps print a usable arrow, 11 on the model. Precision ~1 px. Arrows are systematically _short_ by 0.00–0.47 studs because they clear the ghost and the landing surface — both gaps are measurable from the same pixels, so it corrects to a twentieth of a stud. Narrows ~2000 blind candidates to **2–4**. Physics always has 2–4 to break; never unique.
- **Part identification**: 84.9% of callouts on the first 50 steps (158/186). Conservation over all 359: 1308/1465 pieces reconciled. Element id → catalog part bridge exists (`a8a4f44`).
- **Closed loop on a synthetic booklet**: rebuilds 6/6 parts exactly, drawn placement ranked first every step.
- **Physics**: rigid components, compound bodies, Rapier, revolute joints, simulation that never writes to the document.

## The structural insight nobody has acted on

**The difficulty inverts.** Early steps have small models, so few printed studs — the camera often refuses, registration is poor, and only 6 of 11 on-model arrows get a camera. Reading is hard, but the search space is tiny. Later steps read beautifully and search expensively. A single uniform strategy is probably wrong. Early steps may need exhaustive enumeration against the panel silhouette and no camera at all. **Measure whether a stage-dependent strategy beats the uniform one; do not assume it.**

## Lessons that cost real time

- **A plate's height projects to 0.322–0.330 of a stud.** Any tolerance at or above a third of a stud admits the layer above and below by construction. Use 0.15.
- **A shape test validated against a synthetic instance of the thing it should reject tells you nothing about the art it will meet.** A fill-fraction test to reject red plates passed its unit test and fires on neither real case, because instruction art rings every stud, so a drawn red brick is a _sparse_ figure. "It passes" and "it fires" are different claims.
- **A measurement computed after an early return reports zero, and zero reads as an absence.** This turned "11 steps with an on-model arrow" into "3", and would have killed the arrow approach.
- **Parts are not in insertion order.** Key a part by the id its command returned, never by array position. Cost a full debugging cycle; the loop went 1/6 → 6/6 with no other change.
- **Every real bug this project has found was found by looking at a render.** Not one came from a passing test. The cart demo shipped with 30 blocking collisions and a full green suite.
- **Verify a critic's claims before acting.** One review's two headline checks were worthless — second moments of a stud cell are maximised by having _no_ stud in it.

## Rules

Node 24. `npm run verify` before every commit that touches code. Commit by explicit pathspec — `git commit -- <files>` — never `-a` or `add .`; several sessions share this worktree. Push at the end. `recipes/6651557.pdf` is gitignored and lives only in the main checkout; guard probes with `hasSampleBooklet`. Scoreboards go in the gitignored `output/`. Adding parts bumps `BUILTIN_CATALOG_VERSION` and extends `MIGRATABLE_CATALOG_VERSIONS`. Regenerate a generated file with its own generator — `npm run schema:generate` and `npm run notices:generate` are the two that survive — and never hand-edit one; `npm run pin:generate` was deleted on 2026-08-07 with `packages/generation`, whose run digest was the only thing it pinned. Run `npx prettier --write` on a new file when you create it — `prettier --check .` covers the whole tree and an unformatted file blocks everyone.

Never substitute a part the catalog lacks for one it has. A missing part is a reportable result. Do not report a step as built without looking at the render beside the booklet's own panel.

## Order I would take it in

1. The six parts, so the booklet can start. Nothing downstream can be tested until step 1 places.
2. Finish or discard the two killed agents' trees.
3. Run the real-booklet driver and report how far it gets, per step, with a specific reason for each failure.
4. Step playback of a real build — the last untouched piece of the goal.

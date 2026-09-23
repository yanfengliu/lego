# Start here

Read this file and [`docs/policies/local-rules.md`](policies/local-rules.md) at the start of every session. The fleet canon in `AGENTS.md` adds one more: [`docs/learning/lessons.md`](learning/lessons.md), the short queue of open lessons. Everything else is read only when the task changes that system; the map at the end says which document that is.

## What the product is

A digital brick modeling studio with two target surfaces over one document model:

- A precise manual brick editor that works offline in the browser.
- A closed loop that is meant to read a printed LEGO instruction booklet and build the set it describes: count every part, compile each printed step into a build program, place each piece, check each step against the booklet's own panel, and play the build back. Placement is experimental and fail-closed today ([building-system.md](design/building-system.md)).

The versioned `BrickDocument` part-and-connection graph is the truth; scenes, renders, LDraw files and model answers are derived from it. The booklet is the loop's input. Target rule: the official LEGO Builder model of the set is only the answer key the rebuild is scored against, never an input to the builder; the experimental real-build tooling is a named exception that still reads it directly, retired only with that family ([local-rules](policies/local-rules.md#the-booklet-and-the-reference)).

## Where the measured position lives

- [`docs/design/building-system.md`](design/building-system.md) holds the current measured position of the editor and the booklet build, and the ordered work still missing. Read it before choosing booklet work or claiming progress.
- [`docs/devlog/summary.md`](devlog/summary.md) is history, newest first, not status.
- `npm run booklet` measures the booklet build per printed step against the official model. It reads the booklet, aligns each step to the model, measures catalog coverage, and plays the official poses back through the brick kernel. It writes its rows to ignored `output/booklet/` and compares headline counts with the committed [`status/booklet-baseline.json`](../status/booklet-baseline.json). Inputs default to the main checkout's `recipes/` and `output/official-model/`; `BOOKLET_PDF`, `BOOKLET_LXFML`, `BOOKLET_OFFICIAL_LDRAW`, `BOOKLET_LDRAW_FRAMES` and `BOOKLET_OUT` override them. Camera fit and placement are not scored yet.
- `node scripts/identify-booklet.mjs` identifies every part callout by closed-set matching against the booklet's own inventory, with no model call, and scores Steps 1-50 against the tracked truth labels. `LEGO_BOOKLET_PDF` overrides the booklet, and the full result goes to ignored `output/booklet/identify.json`.
- Run numbers live in ignored `output/`; a claimed improvement names the number it moved.
- A handoff's prose is not the position: retest an inherited blocker before repeating it (fleet canon).

## Where code lives

- `apps/web/src`: the React and Three.js editor (`components/`, `viewport/`, `persistence/`, `manual-commands.ts`) and the booklet loop, where `instructions/` reads the PDF (pages, steps, callouts, inventory), `instructions/identify/` matches each callout's picture to an inventory part, and `assembly/` searches placements and scores them against panels.
- `apps/web/e2e` and `apps/web/test`: Playwright specs and the experimental real-build family (`real-build-*`), and Vitest contract tests for that family.
- `apps/companion`: artifact store, test run ledger and test recorder as a library; the planned home of the trust broker.
- `packages/protocol`: versioned JSON Schema with generated types and validators.
- `packages/brick-kernel`: documents, commands, compiler, patches, validation, migrations, and `compareBuilds`.
- `packages/catalog`: parts, colours, geometry, connectors, collision, licences.
- `packages/rendering`: Three.js derivation, canonical captures, render packets.
- `scripts/`: booklet, LDraw, Builder and catalog derivation tools in Node and Python, plus the gate scripts.
- `tools/booklet/`: the `npm run booklet` harness, whose `answer-key/` module reads the official model. An `eslint.config.js` rule stops product code (`packages/*/src`, `apps/*/src`) from importing `tools/booklet` or naming `output/official-model`.
- `recipes/`: the local booklet PDF, ignored and never committed.

Files and functions stay focused: under 500 lines, 1000 at most. A worktree under `.claude/worktrees/` has no `node_modules` or `recipes/` of its own; Node and `npx` find the main checkout's by walking up, and a probe must find them the same way ([local-rules](policies/local-rules.md#probes-and-measurement)).

## Evidence and artifacts

- `var/runs/` holds product run bundles; `var/state/` holds local broker databases, indexes, CAS and dev state; `output/` holds booklet-run evidence, scoreboards and fleet recursive-pass output. Raw browser and reviewer captures go under those roots. All three are ignored.
- `output/official-model/` holds the official LEGO Builder model: a private reference, never committed.
- Committed fixtures and benchmarks are synthetic, repo-owned or public. A real user or provider artifact enters Git only after inspectable consent, licence clearance, redaction, and a secret and personal-data scan.
- A confirmed failure becomes a regression test or fixture on the terms in [`learning-system.md` § Promotion](design/learning-system.md#promotion); a defect the user reports also gets a [`defect-register.md`](learning/defect-register.md) entry (fleet canon).

## Gates

- Toolchain: Node 24 (`.nvmrc`), npm 11, Python 3 as `python` (no `requires-python` pin yet — a known gap), and Playwright's Chromium (`npx playwright install chromium`).
- While iterating, run the smallest check that covers the change: `npx vitest run <path>`, `npx playwright test <spec>`, `npm run typecheck`, `npm run lint`, or one of the `*:check` scripts.
- Before calling implementation done, `npm run verify` passes. Its steps are the `verify` script in [`package.json`](../package.json), which is the only list kept.
- Tests that read ignored run evidence (`output/real-build/`, `output/official-model/`, external archives) are skipped by default, each naming why, and run under `LEGO_RUN_EVIDENCE=1`; opted in, a missing input fails by name ([`scripts/run-evidence-gate.mjs`](../scripts/run-evidence-gate.mjs), [`scripts/run_evidence_gate.py`](../scripts/run_evidence_gate.py)). The 26 Playwright specs that check `hasSampleBooklet` still gate on whether the booklet exists, not on the opt-in; moving them is open work.
- `npm run test:score` runs the `*.score.test.ts` scoring runs, which measure the real booklet or a grown assembly and stay out of `npm test`.
- A dependency change also runs `npm run audit` and `npm run audit:runtime`; a new HIGH or CRITICAL blocks.
- Doc-only work checks the diff, internal links and paths, Markdown fences and trailing whitespace. `.prettierignore` excludes `docs/`, `AGENTS.md`, `CLAUDE.md` and `.claude/`, so `format:check` says nothing about them, and `npm run lessons:check` covers only the two lessons files.

## Rules that matter at session start

Each is stated once, where the link points.

- One task per session; a task expected to pass about 200k tokens of context is split into milestones, each committed to main when green ([Sessions](policies/local-rules.md#sessions)).
- The booklet is ordinary input, and the official model is the scoring reference that product code never reads ([The booklet and the reference](policies/local-rules.md#the-booklet-and-the-reference)).
- Build the measurable intermediate first; a change with no number attached is not progress ([Probes and measurement](policies/local-rules.md#probes-and-measurement)).
- Look at every picture at its native resolution, and drive the real UI ([Looking](policies/local-rules.md#looking)).
- Ask models closed questions; per-image classification is a one-shot call, and read-only lookups go to the `scout` agent ([Models and subagents](policies/local-rules.md#models-and-subagents)).
- Review runs before a substantial or high-risk milestone merges, sized to risk, with a focused re-review after fixes invalidate it; a devlog summary line is at most 300 characters ([Review, devlog and docs](policies/local-rules.md#review-devlog-and-docs)).
- Model output is untrusted, and user documents change only by explicit command or previewed acceptance (`AGENTS.md`, Invariants).

## Read only when changing that system

- Product, domain, trust or authority contracts (`BrickDocument`, `BuildProgram`, compiled patches, the validation hierarchy, model calls and consent, persistence, interchange, the automation hooks): [`docs/design/spec.md`](design/spec.md).
- Run evidence, replay, candidate lineage and backtracking, typed refusals, evaluation, promotion, physical feedback: [`docs/design/learning-system.md`](design/learning-system.md).
- A part (its identity, its four layers of render surface, lattice and bounds, connectors and collision, its declaration, sources, admission or catalog version): [`docs/design/part-model.md`](design/part-model.md), then [`docs/runbooks/part-visual-admission.md`](runbooks/part-visual-admission.md).
- Booklet work, choosing what to do next, or a progress claim: [`docs/design/building-system.md`](design/building-system.md), then [`docs/runbooks/real-build.md`](runbooks/real-build.md).
- A trust boundary (broker, provider, consent, signing, persistence, the model boundary): [`docs/design/threat-model.md`](design/threat-model.md).
- A dependency, geometry source or licence: [`docs/dependency-data-bom.md`](dependency-data-bom.md), and the generated [`docs/bundled-geometry-notices.md`](bundled-geometry-notices.md) and [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
- A gate or a lesson: [`docs/learning/lessons-evidence.md`](learning/lessons-evidence.md) and [`docs/learning/gate-proofs.md`](learning/gate-proofs.md).
- Co-evolution with `3d-maker`: `../3d-maker/AGENTS.md` and its spec; never modify that repo unless the task scopes it.
- A multi-CLI review: `../fleet/docs/skills/multi-cli-review.md`.

Where these overlap: `spec.md` owns product, domain, trust and authority contracts; `learning-system.md` owns run evidence, replay levels, candidate lifecycle, experiment, evaluation, promotion and feedback, and marks each section as built or only specified; `part-model.md` owns how a part is organised, indexed, defined and constructed, from one declaration; `building-system.md` owns the assessment against a full building-system specification and the ordered plan for what is missing.

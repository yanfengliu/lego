# Current implementation threat model

Status date: 2026-08-10

This document covers executable code in the repository today: the browser editor and its booklet-reading modules, protocol, catalog, brick kernel, renderer, opt-in real-booklet tooling, source-derivation scripts, and the companion package's library-level content-addressed store, unsealed test ledger, and test run recorder.

The production companion broker, provider credential proxy, production signing identity, sealed replay service, and independent evaluator specified in [spec.md](spec.md) and [learning-system.md](learning-system.md) are not implemented and are never credited as mitigations here.

The text-brief candidate lab, deterministic maker population, browser candidate panel, and replay harness were deleted with the AI copilot on 2026-08-07. The companion test recorder still validates legacy maker-shaped wire fixtures, but no current component produces them.

## Assets and security objectives

- Preserve the exact user-authored `BrickDocument`, its pinned truth, identities, transforms, connections, memberships, provenance, and undo history.
- Prevent imported files, booklet data, source archives, build programs, reports, vision answers, and runtime JavaScript values from executing code, forging authority, weakening hard validation, exhausting a process without a bounded refusal, or silently mutating a document.
- Keep local source payloads, booklet crops, development hooks, credentials, and session material out of production bundles, committed artifacts, and logs.
- Preserve retained artifact bytes exactly, reject missing or changed content-addressed objects, and prevent metadata from becoming filesystem authority.
- Keep structural validity, visual agreement, source provenance, replay, and physical claims separate so evidence for one cannot self-certify another.

## Current trust boundaries

| Boundary | Untrusted input | Implemented authority and limits |
| --- | --- | --- |
| LDraw import | Bytes, metadata, identifiers, transforms, counts, provenance claims, and internal references | Bounded parser, strict supported profile, protocol schema, catalog truth, canonical graph construction, and deterministic validators |
| Booklet and panel tooling | Local PDF bytes, text-layer records, page geometry, rasters, highlights, arrows, callouts, and retained classifications | Explicit file and raster limits, digest-bound input chains, typed extraction records, internal consistency checks, and fail-closed publication contracts |
| Source-derivation scripts | LDraw archives, LEGO Builder bundles and XML, LDCad shadow files, and generated measurement reports | Pinned source identities, bounded parsers, immutable snapshots, quarantine records, independent measurements, and no direct catalog-admission authority |
| Restricted compiler | Unknown base documents, build programs, and caller-shaped scope values | Structured-cloned inputs, closed schemas, active truth snapshot, deterministic compilation, scope verification, and hard validation |
| Operation application | Runtime JavaScript values that may bypass TypeScript | Structured clone, per-operation schema validation, canonical payload normalization, stale-before-value checks, and deterministic revisions |
| Catalog truth and migration | Part declarations, measured tables, provenance, geometry, connectors, collision bodies, and historical documents | Versioned truth snapshots, content hashes, explicit migratable versions, admission tests, and migration reports rather than silent reinterpretation |
| Renderer and render packets | Documents, cameras, capture metadata, and optional external validation reports | Local validation, render admission limits, policy-derived cameras, disposable scene state, closed render-packet schemas, and fixed byte/view budgets |
| Browser UI and persistence | User gestures, delayed file reads, numeric edits, IndexedDB records, and WebGL context loss | Immutable kernel results, generation tokens for asynchronous work, schema-versioned snapshots, compare-and-swap persistence, corruption quarantine, and disposable Three.js state |
| Development automation | Same-origin development page and model state | `import.meta.env.DEV` installation guard and production-bundle token scans |
| Companion artifact store | Untrusted bytes, `ArtifactRefV1` metadata, and retained-object references | Store-owned absolute root, SHA-256-derived paths, byte and metadata ceilings, bounded admission, atomic publication, and verify-on-read |
| Companion test ledger | Data-only run, provider-attempt, candidate-transition, idempotency, cancellation, checkpoint, and artifact-reference records | Test namespace only, bounded canonical admission, pinned policy and limits, hash-linked JSONL, exclusive writer lease, recovery verification, and prefix-checked finalization |
| Companion test recorder | Canonical legacy maker requests and outputs, unsealed capture fixtures, caller-supplied test capabilities, and retries | Exact closed shapes, explicit local-retention consent, cumulative stored-byte checks before I/O, request/output/capture binding, CAS verification, neutral quarantine, and unsealed manifests only |

An attacker may supply malformed, deeply nested, oversized, cyclic, aliased, proxy-wrapped, draft-invalid, internally inconsistent, stale, or deliberately expensive values. They may choose prototype-like identifiers, reorder set-like arrays, reuse ports, create dense collision geometry, forge validation reports or provenance, race artifact publication, tamper with retained bytes, or substitute one local source artifact for another.

This model does not protect against an attacker who already controls the repository process identity, the private companion root, or arbitrary files inside it. There is no production provider, credential proxy, signing key, evaluator seal, acceptance capability, companion HTTP API, or production namespace in the current product.

## Abuse paths and implemented mitigations

| Abuse path | Impact | Implemented mitigation |
| --- | --- | --- |
| Import external paths, unsupported references, or unbounded LDraw content | Path traversal, resource exhaustion, or unreviewed geometry | No filesystem reference resolution; strict metadata-bearing profile; byte, line, part, recursion, and operation limits; unsupported data is refused or explicitly opaque |
| Feed oversized or malformed booklet, raster, archive, Builder, LDCad, JSON, or XML input | Memory exhaustion, parser confusion, or substituted evidence | Input-specific byte/count/dimension/depth limits, strict parsers, pinned digests, held snapshots where required, quarantine publication, and typed failures naming the offending input |
| Let a model or retained answer declare its own part, placement, validity, provenance, or authority | False catalog truth or document mutation | Vision and classification records remain untrusted evidence; deterministic catalog lookup, compiler, validator, panel comparison, and reviewed admission decide what is usable |
| Mutate an input after validation | Candidate, operation, or artifact TOCTOU | Structured cloning or admitted byte copies before validation; frozen successful compiler artifacts; hashes rechecked before publication and on read |
| Forge catalog, collision, transform, or validator truth | Silent reinterpretation | Reviewed content manifests and version identifiers enter pinned truth; old documents require explicit migration and report |
| Escape patch scope or hide new invalidity behind an existing aggregate issue | Unauthorized or falsely valid patch | Independent capability verification, exact base/hash binding, per-operation ceilings, full-evidence issue identity, and blocking incomplete-validator sentinels |
| Exhaust collision, validation, rendering, or publication with dense data | Denial of service | Part, primitive, comparison, finding, evidence, render-memory, stored-byte, bytes-in-flight, pending-operation, and concurrency budgets with deterministic refusal records |
| Relabel a camera, report, render packet, or artifact reference | Misleading visual or replay evidence | Policy-derived canonical cameras, whitelisted packet fields, local report recomputation, protocol validation, content hashes, and store verification; caller-supplied PNG identity is not yet authoritative |
| Allow a late file read or stale asynchronous result to replace newer edits | Data loss | File size checks before reads, generation tokens after asynchronous work, stale-result suppression, and explicit discard confirmation before replacement |
| Load malformed or stale IndexedDB state as current truth | Corrupt or silently reinterpreted project | Schema/version checks, compare-and-swap revisions, migration reports, corruption quarantine, and session-only fallback when durable storage is unavailable |
| Ship development observation globals | Production data exposure | Development-only install guard plus production JavaScript token scan |
| Turn artifact metadata into a path | Arbitrary file read, write, or overwrite | Closed metadata, SHA-256-derived object paths, store-root containment checks, symlink refusal, exclusive staging, and non-replacing atomic publication |
| Fork, truncate, reorder, or concurrently append a test run | Split-brain or forged history | One writer lease, canonical event hashes and previous-hash links, monotonic sequences, queue serialization, expected-prefix finalization, reopen verification, and fail-closed recovery |
| Retain a request without consent or relabel different bytes as a capture | Unauthorized retention or false lineage | Recorder rejects before store or ledger use unless explicit local retention is enabled, enforces cumulative stored-byte limits, binds exact request/output/capture hashes, and derives only unsealed test outcomes |
| Commit local booklet pages, model answers, source payloads, credentials, or run artifacts | Copyright, privacy, or secret disclosure | Source payloads and run evidence remain under ignored roots; publication requires deliberate promotion, provenance review, and secret/personal-data scanning |

## Unbuilt boundaries and residual risk

- `apps/companion` is a library-level local artifact store, test ledger, and test recorder. It has no HTTP surface, job authority, release verification, production signing identity, credential proxy, sealed native manifest, tombstone/garbage-collection lifecycle, acceptance authority, or production namespace.
- No production external-model adapter is connected. The future broker must enforce provider capabilities, crop-scoped consent, quotas, retention policy, response-size/depth limits, cancellation, credential isolation, and redaction before any user data leaves the machine.
- No independent evaluator or sealed replay-closure service exists. Current CAS identities, test-ledger events, and unsealed recorder bundles grant no production validity, replay level, consent, promotion, or acceptance claim.
- Automatic candidate acceptance is absent by product decision, not merely disabled pending infrastructure. Reopening any automatic document-mutation path requires a new design and threat review.
- The legacy maker-output and capture schemas retained by the companion recorder have a consumer and no producer. They should not be described as an executable generation or replay system.
- The artifact store does not fsync containing directories or reclaim crash-stranded staging directories. Some Windows filesystems do not support the ledger's attempted parent-directory fsync, so power-loss directory-entry durability is best effort.
- A stale, malformed, partial, or dead-owner ledger lock never auto-reaps; recovery fails closed and requires explicit local inspection. A broken artifact resolver has no timeout or `AbortSignal` and can hold append, `close()`, and the lease pending.
- Canonical render packets bind metadata, policy, and camera geometry, but the browser capture path does not yet issue a trusted receipt binding each PNG byte hash to its view, pass, renderer, and capture transaction.
- The LDraw profile is verified only against this implementation's supported subset; external viewer/tool evidence is required before broader compatibility claims.
- IndexedDB is not an authoritative ledger or credential store. Storage failure, corruption recovery, quota behavior, and retained-data controls remain browser delivery risks.
- The catalog and collision model do not establish clutch strength, insertion accessibility, mass, cost, inventory availability, or physical stability.
- Four catalog `/12` parts use exact bundled source meshes and source-derived visual bounds while deliberately retaining their prior conservative collision recipes; those recipes may fill visual cavities, so the render promotion is not a hollow-collision or physical-insertion claim.
- `npm run parts:check` currently reports twelve parts whose declared underside clutches are not drawn, and it is not part of `npm run verify`; underside-panel visual claims remain limited until that separate gate is green and wired in.
- Real-booklet browser tests are opt-in and skip when the gitignored booklet and companion source artifacts are absent. A passing ordinary gate proves the mocked/synthetic path, not that the private real-booklet inputs were exercised.

## Regression and gate anchors

- `npm run schema:check` verifies generated protocol types and validators.
- `npm run node:check` imports protocol, catalog, brick-kernel, and rendering under the supported Node runtime.
- `npm run observations:check`, `npm run bom:check`, `npm run lessons:check`, and `npm run notices:check` guard observation consumption, provenance inventory, lesson indexing, and generated notices.
- `npm run test:python` covers the bounded source-audit, LDraw, Builder, LDCad, calibration, admission, and booklet-accounting scripts.
- `npm test` covers hostile wrappers, canonicalization, compilation, scope, operations, collision and issue budgets, catalog admission, rendering, persistence, the companion store, ledger, and recorder.
- `npm run test:browser` covers the served editor, real browser persistence and interaction, canonical captures, context recovery, and booklet workflows; private-source cases state when they skip.
- `npm run build` proves the production browser bundle compiles and excludes development automation tokens.
- `npm run parts:check` is the separate part-geometry truth check and is intentionally reported apart until its remaining violations are fixed.

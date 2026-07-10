# Gate 0/1 implementation threat model

This document describes the executable browser, protocol, catalog, brick-kernel, renderer, and strict LDraw profile currently in this repository. The broader broker, provider, evaluator, retention, and acceptance design remains normative in [spec.md](spec.md), but those services do not exist yet and are not credited as mitigations here.

## Assets and security objectives

- Preserve the exact user-authored `BrickDocument`, its pinned truth bundle, stable identities, memberships, transforms, connections, provenance, and undo history.
- Prevent untrusted files, build programs, reports, or future provider data from executing code, forging authority, weakening hard validation, escaping scope, exhausting the browser without a deterministic failure, or silently mutating a document.
- Keep development observation hooks and any future provider credentials out of production browser bundles.
- Distinguish structural validity from visual resemblance and avoid physical, provenance, or acceptance claims that the current evidence cannot support.

## Trust boundaries and attacker capabilities

| Boundary | Attacker-controlled input | Current authority on the trusted side |
| --- | --- | --- |
| LDraw import | Bytes, metadata, identifiers, transforms, counts, provenance claims, and internal references | Bounded parser, protocol schema, catalog truth, graph and collision validators |
| Restricted compiler | `unknown` base/program values and broker-shaped scope objects passed by a caller | Structured-cloned inputs, closed schemas, active truth snapshot, deterministic compiler, scope checks |
| Operation application | Runtime JavaScript values that may bypass TypeScript | Structured clone, per-operation schema validation, canonical payload normalization, stale before-values |
| Renderer | Documents and optional external validation reports | Local validation, render admission limits, disposable derived scene |
| Browser UI | User gestures, delayed file reads, numeric edits, context loss | React orchestration over immutable kernel results; no mutable Three.js truth |
| Development automation | Same-origin development page and model state | `import.meta.env.DEV` guard plus production-bundle token scan |

An attacker may submit malformed, deeply nested, oversized, cyclic, aliased, proxy-wrapped, draft-invalid, or internally inconsistent values. They may choose identifiers such as JavaScript prototype property names, reorder set-like arrays, reuse ports, create dense collision geometry, forge validation reports, or claim trusted provenance. They do not have an implemented provider, credential proxy, broker signing key, acceptance capability, evaluator seal, arbitrary file path, or network API in the current product.

## Abuse paths and mitigations

| Abuse path | Impact | Implemented mitigation and evidence |
| --- | --- | --- |
| Executable or unknown provider operation | Code execution or hidden mutation | Closed JSON Schema operation union; no dynamic evaluation; runtime operation validation; protocol and compiler rejection tests |
| Mutate a provider object after validation | Candidate/document TOCTOU | Structured clone before schema evaluation and compilation; successful artifacts are recursively frozen |
| Forge catalog, collision, transform, or validator truth | Silent reinterpretation | Reviewed content manifests are hashed into the active truth snapshot; compiler and operation application require exact active truth and otherwise require migration |
| Escape frozen parts, volume, palette, attachment, or count scope | Unauthorized patch | Independent scope rules, free required boundary ports, surviving patch-added attachments, and pre-append operation/add/remove ceilings |
| Hide new invalidity behind a pre-existing aggregate finding | Invalid patch marked valid | Deterministic full-evidence issue identity, bounded display evidence, incomplete-validator sentinels that can never be grandfathered, and regression tests |
| Exhaust validation with dense geometry or issue floods | Browser or worker denial of service | Collision comparison/finding budgets, validation issue/evidence budgets, deterministic blocking sentinel issues, and schema-valid bounded reports |
| Forge manual, AI, template, or migration provenance in a file | False lineage or authority | Unsealed LDraw claims are validated as syntax but reattributed to content-addressed local `import` provenance |
| Resolve `constructor` or `toString` as catalog data | Prototype lookup confusion | Private `Map` indexes and canonical-ID checks for parts, colors, and allowlists |
| Load external files, paths, or arbitrary LDraw geometry | Path traversal or unreviewed content | Exact metadata-bearing profile, byte/line/count limits, generated internal subfile names, no filesystem resolution, and rejection of external references |
| Render an enormous or forged document/report | Memory exhaustion or waived overlays | Part/primitive admission budgets; local report recomputation; malformed external reports are detached, schema-checked, and ignored |
| Failed scene replacement destroys the prior view | Availability/data-confidence loss | Replacement is fully derived before the old scene is disposed; failed rebuilds retain the prior projection and surface an alert |
| Late import overwrites newer edits | Data loss | File size checked before `text()`, generation token after the asynchronous read, stale result ignored, and discard confirmation before replacement |
| Development observation API ships to users | Production data exposure | Development-only install guard and a production bundle scan for every global/token name |

## Residual risk and required future boundaries

- No external model provider is connected. A future provider adapter must bound bytes and JSON depth before parsing or structured cloning, apply the reviewed `ProviderCapabilities` policy, and never forward locked-region-sensitive diagnostics to the maker. Full diagnostics remain broker-local verifier evidence.
- AI candidate acceptance is intentionally unavailable. Enabling it requires the companion broker, a user-originated one-use scope capability, authoritative event recording, transactional application, and an isolated synthetic acceptance drill.
- The renderer is a visual aid, not a structural oracle. Browser pixel comparison, accessibility interaction, WebGL context recovery, and long-run memory evidence remain required delivery gates for visual claims.
- The LDraw profile is tested against this implementation's exact supported subset. External viewer/tool verification is still required before claiming ecosystem compatibility beyond emitted standard part lines and rigid transforms.
- The catalog and collision model make no guarantee of clutch strength, instruction accessibility, mass, cost, inventory availability, or physical stability.
- The current browser app is session-only. It has no credential store or persistent user-project database yet.

## Regression and gate anchors

- `npm run schema:check` proves generated public types and standalone validators match the authoritative schema.
- `npm run node:check` imports and exercises protocol, catalog, kernel, and rendering packages under the supported Node runtime.
- `npm test` covers hostile wrappers, canonical determinism, scope, invertibility, collision/issue budgets, provenance reattribution, render replacement, and file-import races.
- `npm run build` also proves development automation tokens are absent from production JavaScript.
- `npm run bom:check` and `npm run notices:check` reconcile exact dependencies, provenance records, and notices.

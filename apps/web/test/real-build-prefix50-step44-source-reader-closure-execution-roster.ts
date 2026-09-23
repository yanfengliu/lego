import { createHash } from "node:crypto";

export interface Step44ExecutionModuleRosterEntry {
  readonly id: string;
  readonly file: string;
  readonly capabilities: readonly string[];
  readonly reason: string;
  readonly localTargets?: readonly string[];
  readonly externalTargets?: readonly string[];
}

const entry = (value: Step44ExecutionModuleRosterEntry): Step44ExecutionModuleRosterEntry => value;

export const EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER = [
  entry({
    id: "calibration-directory-system-powershell",
    file: "apps/web/e2e/real-build-prefix50-step44-calibration-directory-process.ts",
    capabilities: ["child_process.spawn"],
    reason:
      "Exact-manifest module selects only the canonical System32 PowerShell executable and bounds its inline environment and protocol.",
  }),
  entry({
    id: "alternate-stream-system-powershell",
    file: "apps/web/e2e/windows-alternate-data-streams.ts",
    capabilities: ["child_process.execFileSync"],
    reason:
      "Exact-manifest module derives one System32 PowerShell executable and passes only its fixed inspector and a contained path.",
  }),
  entry({
    id: "geometry-bounded-child",
    file: "scripts/part-identification-bounded-child.mjs",
    capabilities: ["child_process.spawn"],
    reason:
      "Exact-manifest geometry boundary owns a bounded process tree and may invoke only its pinned external PowerShell helper.",
    localTargets: ["scripts/windows-bounded-child.ps1"],
  }),
  entry({
    id: "geometry-contained-write",
    file: "scripts/part-identification-contained-write.mjs",
    capabilities: ["child_process.spawnSync"],
    reason:
      "Exact-manifest contained writer invokes only its pinned external PowerShell helper after exact handle binding.",
    localTargets: ["scripts/windows-open-file-disposition.ps1"],
  }),
  entry({
    id: "owned-process-parent",
    file: "apps/web/e2e/real-build-prefix50-subbuild-return-review-process.ts",
    capabilities: ["child_process.spawn"],
    reason:
      "Exact-manifest owner launches only the finite bootstrap after checking the complete bootstrap identity bundle.",
    localTargets: ["apps/web/e2e/real-build-prefix50-subbuild-return-review-process-bootstrap.ts"],
  }),
  entry({
    id: "owned-process-bootstrap-single-launch",
    file: "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-bootstrap.ts",
    capabilities: ["child_process.spawn"],
    reason:
      "Exact-manifest bootstrap decodes one finite job, accepts one GO record, and records one launch attempt and result.",
  }),
  entry({
    id: "containment-probe-grandchild",
    file: "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-containment-probe.ts",
    capabilities: ["child_process.spawn"],
    reason:
      "Exact-manifest test-only containment probe launches only the literal recursively inventoried grandchild with one finite attachment mode.",
    localTargets: [
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-containment-grandchild.ts",
    ],
  }),
  entry({
    id: "windows-job-owner",
    file: "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-windows.ts",
    capabilities: ["child_process.spawn"],
    reason:
      "Exact-manifest Windows owner selects literal System32 PowerShell and the pinned external Job Object helper.",
    localTargets: ["apps/web/e2e/real-build-prefix50-subbuild-return-review-process-job.ps1"],
  }),
  entry({
    id: "shared-pinned-poppler",
    file: "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler.ts",
    capabilities: ["child_process.spawnSync"],
    reason:
      "Exact-manifest Poppler boundary authenticates the fixed system host, encoded helper bytes, managed launcher bytes, and full module-owned Poppler tree before one contained stdin render.",
    localTargets: [
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-lock.ps1",
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll",
    ],
    externalTargets: [
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "%USERPROFILE%\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\poppler\\Library\\bin\\pdftoppm.exe",
    ],
  }),
  entry({
    id: "later-source-ledger-dpapi",
    file: "apps/web/e2e/real-build-prefix50-step44-later-source-ledger-seal.ts",
    capabilities: ["child_process.spawnSync"],
    reason:
      "Exact-manifest ledger seal authenticates fixed system PowerShell and immutable DPAPI helper bytes before one bounded protect or unprotect call.",
    localTargets: ["apps/web/e2e/real-build-prefix50-step44-later-source-dpapi.ps1"],
    externalTargets: ["C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"],
  }),
] as const satisfies readonly Step44ExecutionModuleRosterEntry[];

export function step44ExecutionRosterCommitment(
  roster: readonly Step44ExecutionModuleRosterEntry[],
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(roster)).digest("hex")}`;
}

export const EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER_COMMITMENT =
  "sha256:5ef0dd3515831d7f06f06d705d27d0c473eefcfc640af2b75f72adfaa321172f" as `sha256:${string}`;

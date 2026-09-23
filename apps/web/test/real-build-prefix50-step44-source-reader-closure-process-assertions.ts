import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { REAL_BUILD_PREFIX50_STEP44_POPPLER_SYSTEM_POWERSHELL_PATH } from "../e2e/real-build-prefix50-subbuild-return-review-poppler.ts";
import { REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";
import { createRealBuildPrefix50Step44SingleLaunch } from "../e2e/real-build-prefix50-subbuild-return-review-process-single-launch.ts";
import {
  decodeRealBuildPrefix50Step44OwnedProcessJob,
  encodeRealBuildPrefix50Step44OwnedProcessJob,
  REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS,
  scrubRealBuildPrefix50Step44OwnedProcessEnvironment,
  type RealBuildPrefix50Step44OwnedProcessJob,
} from "../e2e/real-build-prefix50-subbuild-return-review-process-jobs.ts";
import {
  materializeRealBuildPrefix50Step44ProcessLaunch,
  REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE,
} from "../e2e/real-build-prefix50-subbuild-return-review-process-launch-table.ts";
import type { Step44ExecutionModuleRosterEntry } from "./real-build-prefix50-step44-source-reader-closure-execution-roster.ts";
import {
  auditExactStep44ThreeRootClosure,
  type Step44ClosureAudit,
  type Step44ClosureManifestEntry,
} from "./real-build-prefix50-step44-source-reader-closure-gate.ts";

function requireCondition(condition: boolean, message: string): void {
  if (!condition) throw new TypeError(message);
}

function requireFailure(action: () => unknown, pattern: RegExp, message: string): void {
  try {
    action();
  } catch (error) {
    requireCondition(error instanceof Error && pattern.test(error.message), message);
    return;
  }
  throw new TypeError(message);
}

function sampleJob(jobKind: string): RealBuildPrefix50Step44OwnedProcessJob {
  if (jobKind === "static-app-server") return { jobKind, port: 1 };
  if (jobKind === "containment-transient-parent") return { jobKind, detachGrandchild: false };
  if (jobKind === "playwright-browser-worker" || jobKind === "containment-hold") return { jobKind };
  throw new TypeError(`Step-44 launch table contains unknown job kind ${jobKind}.`);
}

export function assertStep44FiniteOwnedProcessContract(
  audit: Step44ClosureAudit,
  repositoryRoot: string,
): void {
  const files = {
    bootstrap: resolve(
      repositoryRoot,
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-bootstrap.ts",
    ),
    jobs: resolve(
      repositoryRoot,
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-jobs.ts",
    ),
    launchTable: resolve(
      repositoryRoot,
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-launch-table.ts",
    ),
    ownedProcess: resolve(
      repositoryRoot,
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-process.ts",
    ),
    singleLaunch: resolve(
      repositoryRoot,
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-process-single-launch.ts",
    ),
  };
  for (const [label, file] of Object.entries(files))
    requireCondition(
      audit.modules.has(file),
      `Step-44 finite ${label} module escaped the manifest.`,
    );
  for (const path of [
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-static-app-server.ts",
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-static-app-manifest.ts",
    "apps/web/e2e/static-app/dist/index.html",
  ])
    requireCondition(
      audit.modules.has(resolve(repositoryRoot, path)),
      `Step-44 static app server or reviewed bundle escaped the manifest: ${path}.`,
    );
  const popplerFile = resolve(
    repositoryRoot,
    "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler.ts",
  );
  const popplerRuntimeFiles = [
    [
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain.ts",
      "typescript-source",
    ],
    [
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts",
      "typescript-source",
    ],
    [
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-lock.ps1",
      "external-immutable-helper",
    ],
    [
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll",
      "external-immutable-binary",
    ],
  ] as const;
  for (const [path, kind] of popplerRuntimeFiles) {
    const module = audit.modules.get(resolve(repositoryRoot, path));
    requireCondition(
      module?.kind === kind,
      `Step-44 Poppler runtime file escaped its exact ${kind} manifest class: ${path}.`,
    );
    if (kind === "external-immutable-binary")
      requireCondition(
        module!.source.getText() === "",
        "Step-44 managed Poppler launcher must be audited only as exact immutable bytes.",
      );
  }
  const popplerTargets = audit.processTargets
    .filter(({ file }) => file === popplerFile)
    .map(({ target, targetClass }) => `${targetClass}:${target}`)
    .sort();
  const expectedPopplerTargets = [
    `external-immutable-helper:${resolve(repositoryRoot, "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-lock.ps1")}`,
    `external-immutable-helper:${resolve(repositoryRoot, "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll")}`,
    `literal-external-executable:${REAL_BUILD_PREFIX50_STEP44_POPPLER_SYSTEM_POWERSHELL_PATH}`,
    `literal-external-executable:${join(REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT, "bin", "pdftoppm.exe")}`,
  ].sort();
  requireCondition(
    JSON.stringify(popplerTargets) === JSON.stringify(expectedPopplerTargets),
    "Step-44 Poppler process roster did not bind the exact host, helper, launcher, and binary.",
  );
  requireCondition(
    ![...audit.modules.keys()].some((file) => file.includes("node_modules\\vite\\")),
    "Step-44 protected process closure still contains Vite runtime files.",
  );
  for (const id of [
    "containment-probe-grandchild",
    "owned-process-bootstrap-single-launch",
    "owned-process-parent",
    "shared-pinned-poppler",
  ])
    requireCondition(
      audit.executionRosterIds.includes(id),
      `Step-44 exact execution roster did not match ${id}.`,
    );
  const tableKeys = Object.keys(REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE);
  const scrubbed = scrubRealBuildPrefix50Step44OwnedProcessEnvironment({
    NODE_OPTIONS: "--import=attacker.mjs",
    node_path: "attacker-modules",
    NODE_ENV: "test",
  });
  requireCondition(
    scrubbed.NODE_OPTIONS === undefined &&
      scrubbed.node_path === undefined &&
      scrubbed.NODE_ENV === "test",
    "Step-44 owned-process environment did not scrub NODE_OPTIONS/NODE_PATH case-insensitively.",
  );
  requireCondition(
    Object.isFrozen(REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE) &&
      tableKeys.join("\n") === REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS.join("\n"),
    "Step-44 launch table does not equal its frozen finite job roster.",
  );
  for (const jobKind of tableKeys) {
    const launch = materializeRealBuildPrefix50Step44ProcessLaunch(sampleJob(jobKind));
    requireCondition(
      launch.arguments.filter((argument) => argument === launch.target).length === 1,
      `Step-44 finite job ${jobKind} did not materialize one target.`,
    );
    requireCondition(
      audit.modules.has(resolve(launch.target)),
      `Step-44 finite job ${jobKind} target escaped the complete manifest.`,
    );
  }
  const launchTableText = audit.modules.get(files.launchTable)!.text;
  requireCondition(
    !launchTableText.includes("node:child_process") &&
      !/\bspawn(?:Sync)?\s*\(/u.test(launchTableText),
    "Step-44 launch table must remain data and materialization only.",
  );
  const ownedText = audit.modules.get(files.ownedProcess)!.text;
  requireCondition(
    !["readonly command:", "readonly arguments:", "input.command", "input.arguments"].some(
      (fragment) => ownedText.includes(fragment),
    ),
    "Step-44 owned-process caller still forwards a command or argument vector.",
  );
  const bootstrapText = audit.modules.get(files.bootstrap)!.text;
  for (const evidence of [
    "createRealBuildPrefix50Step44SingleLaunch",
    "STEP44_WORKLOAD_ATTEMPT",
    "launchEvidence.attempts !== 1",
    "launchEvidence.results !== 1",
  ])
    requireCondition(
      bootstrapText.includes(evidence),
      `Step-44 bootstrap omitted one-invocation evidence ${evidence}.`,
    );
  requireCondition(
    !bootstrapText.includes("switch (") &&
      bootstrapText.match(/workloadLaunch\.invoke\(job\)/gu)?.length === 1,
    "Step-44 bootstrap must invoke one finite launch gate without switch branching.",
  );

  let invocations = 0;
  const single = createRealBuildPrefix50Step44SingleLaunch((value: number) => {
    invocations += 1;
    return value + 1;
  });
  requireCondition(single.invoke(1) === 2, "Step-44 single launch returned the wrong result.");
  requireCondition(
    invocations === 1 && single.evidence().attempts === 1 && single.evidence().results === 1,
    "Step-44 single launch did not record exactly one invocation, attempt, and result.",
  );
  requireFailure(
    () => single.invoke(2),
    /exactly one invocation attempt/u,
    "Step-44 single launch admitted a second invocation.",
  );
  requireCondition(invocations === 1, "Step-44 rejected replay still invoked the launcher.");

  const encoded = encodeRealBuildPrefix50Step44OwnedProcessJob({
    jobKind: "playwright-browser-worker",
  });
  requireCondition(
    decodeRealBuildPrefix50Step44OwnedProcessJob(encoded).jobKind === "playwright-browser-worker",
    "Step-44 finite browser job did not round-trip.",
  );
  const unchecked = (value: unknown): string =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  requireFailure(
    () =>
      decodeRealBuildPrefix50Step44OwnedProcessJob(
        unchecked({ jobKind: "playwright-browser-worker", command: "arbitrary.js" }),
      ),
    /accepts no payload fields/u,
    "Step-44 browser job admitted an arbitrary command field.",
  );
}

export function assertStep44FiniteBootstrapRejectsFallthrough(repositoryRoot: string): void {
  const file =
    "apps/web/test/real-build-prefix50-step44-source-reader-closure-bootstrap-fallthrough.fixture.ts";
  const roster: readonly Step44ExecutionModuleRosterEntry[] = [
    {
      id: "hostile-switch-fallthrough",
      file,
      capabilities: ["child_process.spawn"],
      reason:
        "Hostile fixture is rostered only to prove switch fall-through is independently rejected.",
    },
  ];
  const audit = auditExactStep44ThreeRootClosure([resolve(repositoryRoot, file)], {
    repositoryRoot,
    executionRoster: roster,
  });
  requireCondition(
    /execution-module switch branching and fall-through are forbidden/u.test(
      audit.violations.join("\n"),
    ),
    "Step-44 finite bootstrap policy admitted switch fall-through.",
  );
}

function literalTargetRoster(): readonly Step44ExecutionModuleRosterEntry[] {
  return [
    {
      id: "literal-child-target-fixture",
      file: "apps/web/test/real-build-prefix50-step44-source-reader-closure-child-targets.fixture.ts",
      capabilities: ["child_process.spawn"],
      reason:
        "Source-free fixture proves every literal TS, JS, MJS, and PS1 target enters the manifest.",
      localTargets: [
        "apps/web/test/real-build-prefix50-step44-source-reader-target.fixture.ts",
        "apps/web/test/real-build-prefix50-step44-source-reader-target.fixture.js",
        "apps/web/test/real-build-prefix50-step44-source-reader-target.fixture.mjs",
        "apps/web/test/real-build-prefix50-step44-source-reader-target.fixture.ps1",
      ],
    },
  ];
}

export function assertStep44LiteralProcessTargetsEnterClosure(repositoryRoot: string): void {
  const root = resolve(
    repositoryRoot,
    "apps/web/test/real-build-prefix50-step44-source-reader-closure-child-targets.fixture.ts",
  );
  const audit = auditExactStep44ThreeRootClosure([root], {
    repositoryRoot,
    executionRoster: literalTargetRoster(),
  });
  requireCondition(audit.violations.length === 0, audit.violations.join("\n"));
  for (const extension of ["ts", "js", "mjs", "ps1"])
    requireCondition(
      audit.modules.has(
        resolve(
          repositoryRoot,
          `apps/web/test/real-build-prefix50-step44-source-reader-target.fixture.${extension}`,
        ),
      ),
      `Step-44 literal ${extension} child target escaped the complete manifest.`,
    );
  const powershell = audit.modules.get(
    resolve(
      repositoryRoot,
      "apps/web/test/real-build-prefix50-step44-source-reader-target.fixture.ps1",
    ),
  );
  requireCondition(
    powershell?.kind === "external-immutable-helper" && powershell.source.getText() === "",
    "Step-44 PowerShell helper was represented as syntax-audited source.",
  );
}

function reviewedRoster(file: string): readonly Step44ExecutionModuleRosterEntry[] {
  return [
    {
      id: "reviewed-identical-call-fixture",
      file,
      capabilities: ["child_process.spawn"],
      reason:
        "Whole-file manifest must bind upstream executable and argv initializers, not call text.",
      localTargets: [
        "apps/web/test/real-build-prefix50-step44-source-reader-closure-child.fixture.ts",
      ],
    },
  ];
}

export function assertStep44DigestRosterRejectsSameCallDataflowDrift(repositoryRoot: string): void {
  const reviewedPath =
    "apps/web/test/real-build-prefix50-step44-source-reader-closure-digest-reviewed.fixture.ts";
  const hostilePath =
    "apps/web/test/real-build-prefix50-step44-source-reader-closure-digest-hostile.fixture.ts";
  const reviewed = auditExactStep44ThreeRootClosure([resolve(repositoryRoot, reviewedPath)], {
    repositoryRoot,
    executionRoster: reviewedRoster(reviewedPath),
  });
  requireCondition(reviewed.violations.length === 0, reviewed.violations.join("\n"));
  const expectedForHostile: Step44ClosureManifestEntry[] = reviewed.manifest.map((row) =>
    row.path === reviewedPath ? { ...row, path: hostilePath } : row,
  );
  const hostile = auditExactStep44ThreeRootClosure([resolve(repositoryRoot, hostilePath)], {
    repositoryRoot,
    executionRoster: reviewedRoster(hostilePath),
    expectedManifest: expectedForHostile,
  });
  requireCondition(
    /manifest-pinned module changed without reviewed repin/u.test(hostile.violations.join("\n")),
    "Step-44 manifest admitted identical call text with changed executable and argv initializers.",
  );
  const childPath =
    "apps/web/test/real-build-prefix50-step44-source-reader-closure-child.fixture.ts";
  const wrongTarget = reviewed.manifest.map((row) =>
    row.path === childPath
      ? {
          ...row,
          digest:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000" as const,
        }
      : row,
  );
  const targetDrift = auditExactStep44ThreeRootClosure([resolve(repositoryRoot, reviewedPath)], {
    repositoryRoot,
    executionRoster: reviewedRoster(reviewedPath),
    expectedManifest: wrongTarget,
  });
  requireCondition(
    /manifest-pinned module changed without reviewed repin/u.test(
      targetDrift.violations.join("\n"),
    ),
    "Step-44 manifest admitted a changed local child target.",
  );
  for (const path of [reviewedPath, hostilePath])
    requireCondition(
      readFileSync(resolve(repositoryRoot, path), "utf8").match(
        /spawn\(executable, childArguments\)/gu,
      )?.length === 1,
      `Step-44 identical-call fixture changed its call expression: ${path}.`,
    );
}

export function assertStep44HostileProcessCallsFailClosed(violations: readonly string[]): void {
  const text = violations.join("\n");
  for (const pattern of [
    /namespace sensitive import from node:child_process is forbidden/u,
    /sensitive namespace childProcesses must not be referenced/u,
    /aliased sensitive import child_process\.spawn is forbidden/u,
    /ImportEqualsDeclaration is forbidden/u,
    /sensitive (?:module|capability) re-export/u,
    /unresolved computed import call is forbidden/u,
    /module\.require loader is forbidden/u,
    /computed global\/module\/process access is forbidden/u,
    /process\.getBuiltinModule loader is forbidden/u,
    /runtime process module node:process is forbidden/u,
    /runtime process module process is forbidden/u,
    /process alias or indirect process expression is forbidden/u,
    /comma-expression loader or process extraction is forbidden/u,
    /eval reference is forbidden/u,
    /Function constructor is forbidden/u,
    /constructor extraction or invocation is forbidden/u,
    /computed constructor executor access is forbidden/u,
    /reflective constructor executor extraction is forbidden/u,
    /URL or protocol module specifier https:\/\/attacker\.invalid\/runtime\.mjs is forbidden/u,
    /unrostered bare runtime module specifier unrostered-runtime-package/u,
    /unrostered execution capability child_process\.spawn/u,
    /sensitive capability spawn must be invoked directly/u,
  ])
    requireCondition(pattern.test(text), `Step-44 hostile control missed ${pattern.source}.`);
  for (const adapter of ["call", "apply", "bind"])
    requireCondition(
      new RegExp(`sensitive capability ${adapter} adapter is forbidden`, "u").test(text),
      `Step-44 hostile control missed ${adapter}.`,
    );
  requireCondition(
    (text.match(/sensitive capability spawn must be invoked directly/gu)?.length ?? 0) >= 4,
    "Step-44 hostile control did not reject imported extraction, var leakage, and adapters.",
  );
}

export function assertStep44ExecutionFamiliesFailClosed(repositoryRoot: string): void {
  const fixture = resolve(
    repositoryRoot,
    "apps/web/test/real-build-prefix50-step44-source-reader-closure-execution-families.fixture.ts",
  );
  const audit = auditExactStep44ThreeRootClosure([fixture], {
    repositoryRoot,
    executionRoster: [],
  });
  const text = audit.violations.join("\n");
  for (const pattern of [
    /execution module node:cluster is forbidden/u,
    /execution module node:inspector is forbidden/u,
    /execution module node:vm is forbidden/u,
    /execution module node:worker_threads is forbidden/u,
    /module-loader import createRequire is forbidden/u,
    /native \.node module import is forbidden/u,
    /Worker constructor is forbidden/u,
    /SharedWorker constructor is forbidden/u,
    /WebAssembly reference is forbidden/u,
    /process\.binding loader is forbidden/u,
    /process\._linkedBinding loader is forbidden/u,
    /process\.dlopen loader is forbidden/u,
    /computed global\/module\/process access is forbidden/u,
    /optional global\/module\/process access is forbidden/u,
    /global executor access process is forbidden/u,
    /comma-expression loader or process extraction is forbidden/u,
    /runtime process module node:process is forbidden/u,
    /constructor extraction or invocation is forbidden/u,
    /computed constructor executor access is forbidden/u,
  ])
    requireCondition(
      pattern.test(text),
      `Step-44 execution-family control missed ${pattern.source}.`,
    );
}

export function assertStep44ParserDiagnosticsFailClosed(repositoryRoot: string): void {
  const audit = auditExactStep44ThreeRootClosure(
    [
      resolve(
        repositoryRoot,
        "apps/web/test/real-build-prefix50-step44-source-reader-closure-parser-invalid.fixture.txt",
      ),
    ],
    { repositoryRoot, executionRoster: [] },
  );
  requireCondition(
    /parser diagnostic/u.test(audit.violations.join("\n")),
    "Step-44 closure accepted a TypeScript parser recovery.",
  );
}

export function assertStep44ManifestRejectsInMemoryDrift(audit: Step44ClosureAudit): void {
  const [first, ...rest] = audit.manifest;
  requireCondition(first !== undefined, "Step-44 closure manifest is empty.");
  const expected = [
    {
      ...first!,
      digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000" as const,
    },
    ...rest,
  ];
  requireCondition(
    JSON.stringify(expected) !== JSON.stringify(audit.manifest),
    "Step-44 manifest drift control did not change the complete manifest.",
  );
}

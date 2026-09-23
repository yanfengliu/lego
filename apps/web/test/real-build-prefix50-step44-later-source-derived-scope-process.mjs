const repositoryRoot = process.argv[2];
const outputCandidate = process.argv[3];
if (typeof repositoryRoot !== "string" || typeof outputCandidate !== "string")
  throw new TypeError("Derived-scope crash child requires one root and one exact candidate.");

const { registerRepositoryTypeScriptImports } =
  await import("../../../scripts/part-identification-typescript-runtime.mjs");
registerRepositoryTypeScriptImports();
const { createContainedDirectoryExclusive, ensureContainedDirectoryTree } =
  await import("../e2e/contained-directory.ts");
const { acquireContainedDirectoryLiveGuard, reassertContainedDirectoryLiveGuard } =
  await import("../e2e/contained-directory-live-guard.ts");
const { REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT } =
  await import("../e2e/real-build-prefix50-step44-later-source-derived-contract.ts");

ensureContainedDirectoryTree(
  repositoryRoot,
  REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT,
  "Step-44 crash-control derived-output root",
);
createContainedDirectoryExclusive(
  repositoryRoot,
  outputCandidate,
  "Step-44 crash-control derived-output scope",
);
const guard = acquireContainedDirectoryLiveGuard(
  repositoryRoot,
  outputCandidate,
  "Step-44 crash-control derived-output scope",
);
reassertContainedDirectoryLiveGuard(guard, repositoryRoot, outputCandidate);
process.stdout.write(`${JSON.stringify({ ready: true })}\n`);
setInterval(() => {
  reassertContainedDirectoryLiveGuard(guard, repositoryRoot, outputCandidate);
}, 1_000);

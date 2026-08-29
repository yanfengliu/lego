import { afterEach, describe, expect, it, vi } from "vitest";

const cases = [
  {
    artifactModule: "./booklet-catalog-coverage-semantic.mjs",
    bytesName: "bytesFromVerifiedSemanticBookletCatalogCoverage",
    cliModule: "./booklet-catalog-coverage-semantic-cli.mjs",
    currentModule: "./part-identification-prefix50-semantic-closure-current.mjs",
    extraArtifactExports: () => ({
      compileSemanticBookletCatalogCoverage: vi.fn(async () => Object.freeze({})),
      encodeSemanticBookletCatalogCoverage: vi.fn(() => Buffer.from("reviewed bytes\n")),
    }),
    inspectName: "inspectVerifiedSemanticBookletCatalogCoverage",
    isVerifiedName: "isVerifiedSemanticBookletCatalogCoverage",
    name: "semantic catalog coverage",
    reproduceName: "verifyCurrentPrefix50SemanticClosure",
    reproduceResult: () => ({
      elementResolutionBytes: Buffer.from("elements\n"),
      manifestBytes: Buffer.from("manifest\n"),
      verified: Object.freeze({}),
    }),
    runName: "runSemanticBookletCatalogCoverageCli",
    verifyName: "verifyOpaqueSemanticBookletCatalogCoverage",
  },
  {
    artifactModule: "./part-identification-prefix50-action-preparation.mjs",
    bytesName: "bytesFromVerifiedPrefix50ActionPreparation",
    cliModule: "./part-identification-prefix50-action-preparation-cli.mjs",
    currentModule: "./part-identification-prefix50-action-preparation-current.mjs",
    inspectName: "inspectVerifiedPrefix50ActionPreparation",
    isVerifiedName: "isVerifiedPrefix50ActionPreparation",
    name: "action preparation",
    reproduceName: "reproduceCurrentPrefix50ActionPreparation",
    runName: "runPrefix50ActionPreparationCli",
    verifyName: "verifyPrefix50ActionPreparation",
  },
  {
    artifactModule: "./part-identification-prefix50-official-ldraw-world-proposal.mjs",
    bytesName: "bytesFromVerifiedPrefix50OfficialLdrawWorldProposal",
    cliModule: "./part-identification-prefix50-official-ldraw-world-proposal-cli.mjs",
    currentModule: "./part-identification-prefix50-official-ldraw-world-proposal-current.mjs",
    inspectName: "inspectVerifiedPrefix50OfficialLdrawWorldProposal",
    isVerifiedName: "isVerifiedPrefix50OfficialLdrawWorldProposal",
    name: "official-world proposal",
    reproduceName: "reproduceCurrentPrefix50OfficialLdrawWorldProposal",
    runName: "runPrefix50OfficialLdrawWorldProposalCli",
    verifyName: "verifyPrefix50OfficialLdrawWorldProposal",
  },
  {
    artifactModule: "./part-identification-prefix50-ldraw-catalog-frames.mjs",
    bytesName: "bytesFromVerifiedPrefix50LdrawCatalogFrames",
    cliModule: "./part-identification-prefix50-ldraw-catalog-frames-cli.mjs",
    currentModule: "./part-identification-prefix50-ldraw-catalog-frames-current.mjs",
    inspectName: "inspectVerifiedPrefix50LdrawCatalogFrames",
    isVerifiedName: "isVerifiedPrefix50LdrawCatalogFrames",
    name: "LDraw/catalog frames",
    reproduceName: "reproduceCurrentPrefix50LdrawCatalogFrames",
    runName: "runPrefix50LdrawCatalogFramesCli",
    verifyName: "verifyPrefix50LdrawCatalogFrames",
  },
  {
    artifactModule: "./part-identification-prefix50-official-world-reconciliation.mjs",
    bytesName: "bytesFromVerifiedPrefix50OfficialWorldReconciliation",
    cliModule: "./part-identification-prefix50-official-world-reconciliation-cli.mjs",
    currentModule: "./part-identification-prefix50-official-world-reconciliation-current.mjs",
    inspectName: "inspectVerifiedPrefix50OfficialWorldReconciliation",
    isVerifiedName: "isVerifiedPrefix50OfficialWorldReconciliation",
    name: "official-world reconciliation",
    reproduceName: "reproduceCurrentPrefix50OfficialWorldReconciliation",
    runName: "runPrefix50OfficialWorldReconciliationCli",
    verifyName: "verifyPrefix50OfficialWorldReconciliation",
  },
];

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.doUnmock("./part-identification-counterevidence-archive.mjs");
  for (const testCase of cases) {
    vi.doUnmock(testCase.artifactModule);
    vi.doUnmock(testCase.currentModule);
  }
});

async function mockedCli(testCase, verify) {
  const reproduce = vi.fn(async () => ({
    ...(testCase.reproduceResult?.() ?? {
      artifact: Object.freeze({}),
      bytes: Buffer.from("reviewed bytes\n"),
      input: Object.freeze({}),
    }),
  }));
  const publish = vi.fn(() => {
    throw new Error("publication must not run");
  });
  vi.doMock(testCase.currentModule, () => ({ [testCase.reproduceName]: reproduce }));
  vi.doMock(testCase.artifactModule, () => ({
    ...testCase.extraArtifactExports?.(),
    [testCase.bytesName]: vi.fn(() => Buffer.from("reviewed bytes\n")),
    [testCase.inspectName]: vi.fn(() => ({ artifact: {}, digest: "sha256:fixture" })),
    [testCase.isVerifiedName]: vi.fn(() => false),
    [testCase.verifyName]: verify,
  }));
  vi.doMock("./part-identification-counterevidence-archive.mjs", () => ({
    publishContainedArtifactWithoutOverwrite: publish,
  }));
  const cli = await import(`${testCase.cliModule}?authority=${testCase.runName}-${Date.now()}`);
  return { cli, publish, reproduce, run: cli[testCase.runName] };
}

describe("prefix-50 generator CLI authority ordering", () => {
  it.each(cases)("rejects extra argv before reproducing $name", async (testCase) => {
    const mocked = await mockedCli(
      testCase,
      vi.fn(async () => Object.freeze({})),
    );
    await expect(mocked.run(["--unexpected"])).rejects.toThrow(/accepts no caller arguments/);
    expect(mocked.cli.__testOnly).toBeUndefined();
    expect(mocked.reproduce).not.toHaveBeenCalled();
    expect(mocked.publish).not.toHaveBeenCalled();
  });

  it.each(cases)("leaves publication untouched when the $name verifier fails", async (testCase) => {
    const verify = vi.fn(async () => {
      throw new TypeError("fixture verifier failure");
    });
    const mocked = await mockedCli(testCase, verify);
    await expect(mocked.run([])).rejects.toThrow(/fixture verifier failure/);
    expect(mocked.reproduce).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledOnce();
    expect(mocked.publish).not.toHaveBeenCalled();
  });

  it.each(cases)(
    "rejects a forged non-opaque $name verifier result before publication",
    async (testCase) => {
      const mocked = await mockedCli(
        testCase,
        vi.fn(async () => Object.freeze({})),
      );
      await expect(mocked.run([])).rejects.toThrow(/opaque authority object/);
      expect(mocked.publish).not.toHaveBeenCalled();
    },
  );
});

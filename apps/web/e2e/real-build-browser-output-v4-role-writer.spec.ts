import { expect, test } from "@playwright/test";

import { workspaceModuleUrl } from "./workspace-module";

const WRITER_MODULE_URL = workspaceModuleUrl(
  "apps/web/e2e/real-build-browser-output-v4-role-writer.ts",
);
const TWO_STEP_FIXTURE_URL = workspaceModuleUrl(
  "apps/web/test/real-build-browser-output-v4-semantic-two-step.fixture.ts",
);

test("loads the branch-role writer in the served browser without granting authority", async ({
  page,
}) => {
  await page.goto("/");
  const observed = await page.evaluate(async (moduleUrl) => {
    const writer = await import(/* @vite-ignore */ moduleUrl);
    const result = writer.createRealBuildBrowserBranchRoleWriterResult([]);
    const bytes = writer.readRealBuildBrowserBranchRoleWriterBytes(result);
    return {
      authority: result.authority,
      schemaVersion: result.evidence.schemaVersion,
      steps: result.evidence.steps.length,
      indexBytes: bytes.branchEvidence.length,
      compiledBytes: bytes.compiledBranchRole.length,
      observationBytes: bytes.observationRole.length,
    };
  }, WRITER_MODULE_URL);

  expect(observed).toEqual({
    authority: {
      status: "absent",
      authorized: false,
      reason: "browser-branch-role-writer-is-transport-only",
    },
    schemaVersion: "lego.real-build-browser-branch-evidence/1",
    steps: 0,
    indexBytes: expect.any(Number),
    compiledBytes: 0,
    observationBytes: 0,
  });
  expect(observed.indexBytes).toBeGreaterThan(0);
});

test("finalizes a nonempty dense compiled role in the served browser", async ({ page }) => {
  await page.goto("/");
  const observed = await page.evaluate(
    async (urls) => {
      const [writer, twoStepFixture] = await Promise.all([
        import(/* @vite-ignore */ urls.writer),
        import(/* @vite-ignore */ urls.twoStepFixture),
      ]);
      const fixture = twoStepFixture.realBuildBrowserOutputV4SemanticTwoStepFixture();
      const inputs = fixture.steps.map((step: { batchResult: unknown }) => ({
        batchResult: step.batchResult,
        observation: null,
      }));
      const result = writer.createRealBuildBrowserBranchRoleWriterResult(inputs);
      const bytes = writer.readRealBuildBrowserBranchRoleWriterBytes(result);
      const indexed = JSON.parse(new TextDecoder().decode(bytes.branchEvidence));
      const sha256 = async (value: Uint8Array): Promise<string> => {
        const copy = new Uint8Array(value.length);
        copy.set(value);
        const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
        return `sha256:${[...hashed].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      };
      return {
        authority: result.authority,
        indexMatches: JSON.stringify(indexed) === JSON.stringify(result.evidence),
        stepNumbers: result.evidence.steps.map((step: { stepNumber: number }) => step.stepNumber),
        compiledOffsets: result.evidence.steps.map(
          (step: { compiledLineage: { offset: number } }) => step.compiledLineage.offset,
        ),
        observationOffsets: result.evidence.steps.map(
          (step: { observations: { offset: number } | null }) => step.observations?.offset ?? null,
        ),
        compiledBytes: bytes.compiledBranchRole.length,
        observationBytes: bytes.observationRole.length,
        compiledDigestMatches:
          (await sha256(bytes.compiledBranchRole)) === result.evidence.compiledBranchRole.digest,
        observationDigestMatches:
          (await sha256(bytes.observationRole)) === result.evidence.observationRole.digest,
      };
    },
    {
      writer: WRITER_MODULE_URL,
      twoStepFixture: TWO_STEP_FIXTURE_URL,
    },
  );

  expect(observed.authority).toMatchObject({ status: "absent", authorized: false });
  expect(observed.indexMatches).toBe(true);
  expect(observed.stepNumbers).toEqual([1, 2]);
  expect(observed.compiledOffsets[0]).toBe(0);
  expect(observed.compiledOffsets[1]).toBeGreaterThan(observed.compiledOffsets[0]!);
  expect(observed.observationOffsets).toEqual([null, null]);
  expect(observed.compiledBytes).toBeGreaterThan(0);
  expect(observed.observationBytes).toBe(0);
  expect(observed.compiledDigestMatches).toBe(true);
  expect(observed.observationDigestMatches).toBe(true);
});

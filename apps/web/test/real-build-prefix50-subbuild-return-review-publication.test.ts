import { access, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  claimRealBuildPrefix50Step44ReviewOutputPublication,
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
} from "../e2e/real-build-prefix50-subbuild-return-review-harness-input";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
  realBuildPrefix50Step44TransactionTestOnly,
} from "../e2e/real-build-prefix50-subbuild-return-review-transaction";

const runId = `${process.pid}-${Date.now()}`;
const outputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `publication-identity-output-${runId}`,
);
const displacedPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `publication-identity-original-${runId}`,
);

afterAll(async () => {
  await rm(outputPath, { recursive: true, force: true });
  await rm(displacedPath, { recursive: true, force: true });
});

describe("prefix-50 Step-44 publication directory identity", () => {
  it("refuses the exact pre-COMPLETE gate after the claimed root is displaced", async () => {
    const publication = await prepareRealBuildPrefix50Step44ReviewOutputPublication(outputPath);
    const run = await claimRealBuildPrefix50Step44ReviewOutputPublication(publication);
    const directories =
      await realBuildPrefix50Step44TransactionTestOnly.createClaimedOutputDirectories(
        publication,
        run,
      );

    await rename(outputPath, displacedPath);
    await mkdir(outputPath);

    await expect(
      realBuildPrefix50Step44TransactionTestOnly.assertPublicationDirectories(directories),
    ).rejects.toThrow(/identity changed/u);
    await expect(
      access(resolve(outputPath, REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE)),
    ).rejects.toThrow();
    await expect(
      access(resolve(displacedPath, REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE)),
    ).rejects.toThrow();
  });
});

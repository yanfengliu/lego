import { link, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { withStableRealBuildPrefix50Step44RealDomainGateOutputTree } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";

const outputs: string[] = [];

async function exactTree(): Promise<string> {
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const output = await mkdtemp(
    resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "unit-gate-tree-race-"),
  );
  outputs.push(output);
  await Promise.all([
    writeFile(resolve(output, "real-domain-camera-gate.json"), "{}\n"),
    writeFile(resolve(output, "real-domain-camera-static-app.log"), "aaaaaaaa\n"),
  ]);
  for (const step of [41, 42, 43] as const) {
    const directory = resolve(output, `step-${step}`);
    await mkdir(directory);
    await writeFile(resolve(directory, "evidence.bin"), Uint8Array.of(step));
  }
  return output;
}

afterEach(async () => {
  for (const output of outputs.splice(0)) {
    await rm(`${output}-transient-link`, { force: true });
    await rm(output, { recursive: true, force: true });
  }
});

describe("real-domain gate immutable-tree races", () => {
  it("rejects a hardlink introduced after the first complete roster snapshot", async () => {
    const output = await exactTree();
    const alias = `${output}-transient-link`;
    await expect(
      withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
        { outputPath: output, persistedCaseCount: 3 },
        () => link(resolve(output, "real-domain-camera-gate.json"), alias),
      ),
    ).rejects.toThrow(/singly linked/u);
    await unlink(alias);
  });

  it("rejects a same-size rewrite after the first complete roster snapshot", async () => {
    const output = await exactTree();
    await expect(
      withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
        { outputPath: output, persistedCaseCount: 3 },
        () => writeFile(resolve(output, "real-domain-camera-static-app.log"), "bbbbbbbb\n"),
      ),
    ).rejects.toThrow(/changed during verification/u);
  });

  it("rejects hidden NTFS alternate-stream bytes on an otherwise exact regular file", async () => {
    const output = await exactTree();
    await writeFile(resolve(output, "real-domain-camera-gate.json:foreign"), "hidden bytes");
    await expect(
      withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
        { outputPath: output, persistedCaseCount: 3 },
        () => undefined,
      ),
    ).rejects.toThrow(/alternate data stream/u);
  });
});

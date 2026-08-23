import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { removeContainedDirectoryTree } from "../e2e/contained-directory";
import { readBackStep7Gate3Bundle } from "../e2e/real-build-step7-gate3-diagnostic-readback";
import { createStep7Gate3NoDeleteStagingDirectory } from "../e2e/real-build-step7-gate3-no-delete-filesystem";

const taskOwnedRoots = new Set<string>();

function ownedBundle() {
  const root = `output/gate3-readback-failure-test-${randomUUID()}`;
  const relativePath = `${root}/runs/bundle`;
  taskOwnedRoots.add(root);
  const expectedIdentity = createStep7Gate3NoDeleteStagingDirectory({
    root: process.cwd(),
    relativePath,
    label: "Gate-3 read-back failure fixture",
  });
  return { root, relativePath, expectedIdentity };
}

afterEach(() => {
  for (const root of taskOwnedRoots) {
    if (!existsSync(resolve(process.cwd(), root))) continue;
    removeContainedDirectoryTree(process.cwd(), root, "Gate-3 read-back failure test cleanup");
  }
  taskOwnedRoots.clear();
});

describe("step-7 Gate-3 directory read-back failure sentinels", () => {
  it("retains a null directory-enumeration failure", () => {
    const bundle = ownedBundle();

    const observation = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: bundle.relativePath,
      expectedIdentity: bundle.expectedIdentity,
      artifacts: [],
      label: "null enumeration failure control",
      __testDirectoryHooks: {
        beforeRead: () => {
          throw null;
        },
      },
    });

    expect(observation).toMatchObject({
      complete: false,
      exactFileSetVerified: false,
      closureFailure: "directory enumeration: A thrown null was retained without probing it.",
    });
  });

  it("retains an undefined post-close failure after closing the directory handle", () => {
    const bundle = ownedBundle();

    const observation = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: bundle.relativePath,
      expectedIdentity: bundle.expectedIdentity,
      artifacts: [],
      label: "undefined close failure control",
      __testDirectoryHooks: {
        afterClose: () => {
          throw undefined;
        },
      },
    });

    expect(observation).toMatchObject({
      complete: false,
      exactFileSetVerified: false,
      closureFailure: "directory enumeration: A thrown undefined was retained without probing it.",
    });
  });

  it("retains an undefined directory-enumeration failure", () => {
    const bundle = ownedBundle();

    const observation = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: bundle.relativePath,
      expectedIdentity: bundle.expectedIdentity,
      artifacts: [],
      label: "undefined enumeration failure control",
      __testDirectoryHooks: {
        beforeRead: () => {
          throw undefined;
        },
      },
    });

    expect(observation.closureFailure).toBe(
      "directory enumeration: A thrown undefined was retained without probing it.",
    );
    expect(observation.complete).toBe(false);
  });

  it("retains a null post-close failure after closing the directory handle", () => {
    const bundle = ownedBundle();

    const observation = readBackStep7Gate3Bundle({
      root: process.cwd(),
      relativePath: bundle.relativePath,
      expectedIdentity: bundle.expectedIdentity,
      artifacts: [],
      label: "null close failure control",
      __testDirectoryHooks: {
        afterClose: () => {
          throw null;
        },
      },
    });

    expect(observation.closureFailure).toBe(
      "directory enumeration: A thrown null was retained without probing it.",
    );
    expect(observation.complete).toBe(false);
  });
});

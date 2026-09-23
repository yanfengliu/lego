import { describe, expect, it } from "vitest";

import type { RealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "../e2e/real-build-prefix50-step44-camera-only-source-lock";
import {
  readRealBuildPrefix50Step44RealDomainSourcePixelVault,
  sealRealBuildPrefix50Step44RealDomainSourcePixels,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-bytes";
import { prepareRealBuildPrefix50Step44RealDomainSourceSequence } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source";
import type { RealBuildPrefix50Step42SourceGeometryAdmission } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission";

describe("prefix-50 Step-44 real-domain source sequence", () => {
  it("keeps source RGBA, eligible, and target masks private across returned-buffer mutation", () => {
    const original = {
      rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      eligibleMask: new Uint8Array([1, 0]),
      parentOnlyForegroundMask: new Uint8Array([0, 1]),
    };
    const vault = sealRealBuildPrefix50Step44RealDomainSourcePixels(original);
    original.rgba.fill(255);
    original.eligibleMask.fill(0);
    original.parentOnlyForegroundMask.fill(0);
    const first = readRealBuildPrefix50Step44RealDomainSourcePixelVault(vault);
    first.rgba.fill(17);
    first.eligibleMask.fill(17);
    first.parentOnlyForegroundMask.fill(17);
    expect(readRealBuildPrefix50Step44RealDomainSourcePixelVault(vault)).toEqual({
      rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      eligibleMask: new Uint8Array([1, 0]),
      parentOnlyForegroundMask: new Uint8Array([0, 1]),
    });
  });

  it("rejects a structurally exact but unbranded live source lock before loading page 44", async () => {
    const sourceLock = {
      evidence: {
        schemaVersion: "lego.real-build-prefix50-step44-camera-only-source-lock/1",
        bootstrapSourceManifestDigest: `sha256:${"2".repeat(64)}`,
        lockManifestDigest: `sha256:${"1".repeat(64)}`,
        lockedFileCount: 1,
        lockedByteCount: 70_238_655,
        sourcePdf: {
          artifactPath: "recipes/6651557.pdf",
          byteDigest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
          bytes: 70_238_655,
        },
        commitment: `sha256:${"3".repeat(64)}`,
      },
      runtimeIdentity: {
        directory: "C:\\forged-lock",
        helperPid: 1,
        repoRoot: "C:\\forged-repository",
        lockManifestDigest: `sha256:${"1".repeat(64)}`,
      },
    } as unknown as RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
    await expect(
      prepareRealBuildPrefix50Step44RealDomainSourceSequence({
        repositoryRoot: "C:\\forged-repository",
        sourceLock,
        sourceGeometryAdmission: Object.freeze(
          {},
        ) as RealBuildPrefix50Step42SourceGeometryAdmission,
      }),
    ).rejects.toThrow("opaque capability minted from this process's running bootstrap helper");
  });
});

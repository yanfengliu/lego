import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts", () => ({
  requireRealBuildPrefix50Step44HeldOutUnlockCapability: <T extends object>(value: T): T => value,
}));

import { rerenderRealBuildPrefix50Step44PdfCrop } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts";
import type { RealBuildPrefix50Step44HeldOutUnlockCapability } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "../e2e/real-build-prefix50-source-pdf-pins.ts";

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("lowest-level Step-43 PDF read one-shot gate", () => {
  it("does not consume on an unauthorized rectangle, then consumes before a failed read and refuses retry", async () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "lego-heldout-pdf-gate-"));
    roots.push(repositoryRoot);
    const capability = Object.freeze({
      id: "opaque-test-issued-capability",
    }) as unknown as RealBuildPrefix50Step44HeldOutUnlockCapability;
    const exact = {
      repositoryRoot,
      sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
      sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      maximumSourceBytes: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
      pageNumber: 44 as const,
      densityDpi: 180,
      crop: { x: 1040, y: 620, width: 720, height: 470 },
      label: "post-unlock Step-43 gate integration",
      authorization: { kind: "held-out-one-shot" as const, capability },
    };
    await expect(
      rerenderRealBuildPrefix50Step44PdfCrop({
        ...exact,
        crop: { ...exact.crop, x: exact.crop.x + 1 },
      }),
    ).rejects.toThrow("only the exact sealed Step-43 request");
    await expect(rerenderRealBuildPrefix50Step44PdfCrop(exact)).rejects.toThrow(
      /ENOENT|does not exist|could not be resolved/u,
    );
    await expect(rerenderRealBuildPrefix50Step44PdfCrop(exact)).rejects.toThrow(
      "already attempted its one permitted Step-43 PDF read",
    );
  });
});

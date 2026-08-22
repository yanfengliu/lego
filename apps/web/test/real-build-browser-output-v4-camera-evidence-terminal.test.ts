import { describe, expect, it } from "vitest";

import { digestRealBuildBrowserCameraEvidenceBytes } from "../e2e/real-build-browser-output-v4-camera-evidence-digest";
import {
  readRealBuildBrowserCameraEvidence,
  requireRealBuildBrowserCameraEvidenceInspection,
} from "../e2e/real-build-browser-output-v4-camera-evidence-reader";
import type {
  RealBuildBrowserCameraEvidenceBytes,
  RealBuildBrowserCameraEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-camera-evidence-types";
import { writeRealBuildBrowserCameraEvidence } from "../e2e/real-build-browser-output-v4-camera-evidence-writer";

function withOrphanRoleByte(
  bytes: RealBuildBrowserCameraEvidenceBytes,
  role: "render" | "mask",
): RealBuildBrowserCameraEvidenceBytes {
  const manifest = JSON.parse(
    new TextDecoder().decode(bytes.manifestBytes),
  ) as RealBuildBrowserCameraEvidenceManifest;
  const orphan = Uint8Array.of(0);
  const descriptor = role === "render" ? manifest.renderRole : manifest.maskRole;
  (descriptor as { bytes: number }).bytes = orphan.length;
  (descriptor as { digest: `sha256:${string}` }).digest =
    digestRealBuildBrowserCameraEvidenceBytes(orphan);
  return {
    manifestBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    renderRoleBytes: role === "render" ? orphan : Uint8Array.of(),
    maskRoleBytes: role === "mask" ? orphan : Uint8Array.of(),
  };
}

describe("browser-output /4 empty terminal camera evidence", () => {
  it("admits an exactly empty branded manifest while refusing orphan role bytes", () => {
    const bytes = writeRealBuildBrowserCameraEvidence([]);
    const emptyDigest = digestRealBuildBrowserCameraEvidenceBytes(Uint8Array.of());
    const inspection = readRealBuildBrowserCameraEvidence(bytes);

    expect(bytes.renderRoleBytes).toHaveLength(0);
    expect(bytes.maskRoleBytes).toHaveLength(0);
    expect(inspection.manifest.rows).toEqual([]);
    expect(inspection.manifest.renderRole).toMatchObject({ bytes: 0, digest: emptyDigest });
    expect(inspection.manifest.maskRole).toMatchObject({ bytes: 0, digest: emptyDigest });
    expect(inspection).toMatchObject({
      reproducible: true,
      provenanceAuthority: "absent",
      provisionalAuthority: "absent",
      sourceExecutionProvenanceAuthority: "absent",
      physicalAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: "absent",
    });
    expect(requireRealBuildBrowserCameraEvidenceInspection(inspection)).toBe(inspection);

    expect(() => readRealBuildBrowserCameraEvidence(withOrphanRoleByte(bytes, "render"))).toThrow(
      /consumed exactly/iu,
    );
    expect(() => readRealBuildBrowserCameraEvidence(withOrphanRoleByte(bytes, "mask"))).toThrow(
      /consumed exactly/iu,
    );
  });
});

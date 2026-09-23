import { lstatSync, realpathSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { createRealBuildPrefix50Step44CalibrationPublicationMarker } from "../e2e/real-build-prefix50-step44-calibration-publication-marker.ts";
import { captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";

export async function writeCallerAuthoredCalibrationPublicationMarker(
  outputPath: string,
  persistedManifestCommitment: Sha256Digest,
): Promise<void> {
  const output = resolve(outputPath);
  const stat = lstatSync(output, { bigint: true });
  const { bytes } = createRealBuildPrefix50Step44CalibrationPublicationMarker({
    finalOutputPath: output,
    stagingIdentity: {
      lexicalPath: output,
      realPath: realpathSync.native(output),
      device: stat.dev.toString(),
      inode: stat.ino.toString(),
    },
    descriptor: {
      evidenceStatus: "qualified-and-validated",
      persistedCaseCount: 3,
      proofCommitment: canonicalDigest({ callerAuthoredProof: true }),
      persistedManifestCommitment,
      evidenceTreeCommitment: captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment({
        outputPath: output,
        persistedCaseCount: 3,
      }),
    },
  });
  await writeFile(`${output}.publication.json`, bytes);
}

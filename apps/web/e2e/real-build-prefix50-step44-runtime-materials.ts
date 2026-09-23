import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { canonicalStringify } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
} from "./real-build-prefix50-step44-review-batch-pin.ts";
import { readRealBuildPrefix50Step44ReviewHarnessInput } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  rederiveRealBuildPrefix50Step44ProductionMaterials,
  type RealBuildPrefix50Step44ProductionMaterials,
} from "./real-build-prefix50-subbuild-return-review-production-materials.ts";

export async function rederiveRealBuildPrefix50Step44PinnedProductionMaterials(
  repositoryRoot: string,
): Promise<RealBuildPrefix50Step44ProductionMaterials> {
  const read = await readRealBuildPrefix50Step44ReviewHarnessInput(
    resolve(repositoryRoot, REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH),
    REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
  );
  const materials = await rederiveRealBuildPrefix50Step44ProductionMaterials();
  const canonicalBatch = canonicalStringify(materials.batch);
  const rederivedDigest =
    `sha256:${createHash("sha256").update(canonicalBatch).digest("hex")}` as const;
  if (
    canonicalStringify(read.input) !== canonicalBatch ||
    read.bytesHash !== REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH ||
    rederivedDigest !== read.bytesHash
  )
    throw new TypeError(
      "Step-44 pinned batch bytes were not identical to the fresh runtime-branded production result/batch.",
    );
  return materials;
}

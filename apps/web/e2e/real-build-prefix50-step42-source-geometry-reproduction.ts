// @ts-expect-error Opaque Node verifier intentionally has no caller-facing TypeScript surface.
// prettier-ignore
import * as actionPreparation from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error Opaque Node verifier intentionally has no caller-facing TypeScript surface.
// prettier-ignore
import * as officialWorldReconciliation from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error Ignored-evidence reproducer intentionally has no caller-facing TypeScript surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error Ignored-evidence verifier intentionally has no caller-facing TypeScript surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import {
  admitRealBuildPrefix50Step42SourceGeometry,
  type RealBuildPrefix50Step42SourceGeometryAdmission,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";
import type { RealBuildPrefix50VerifiedProjectionReader } from "./real-build-prefix50-projection.ts";

const { bytesFromVerifiedPrefix50ActionPreparation } = actionPreparation;
const {
  bytesFromVerifiedPrefix50OfficialWorldReconciliation,
  verifyPrefix50OfficialWorldReconciliation,
} = officialWorldReconciliation;

export interface RealBuildPrefix50Step42ReproducedSourceGeometryAuthority {
  readonly projectionReader: RealBuildPrefix50VerifiedProjectionReader;
  readonly sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission;
}

/** Replays the exact producer/verifier path and mints a process-local geometry admission. */
export async function reproduceRealBuildPrefix50Step42SourceGeometryAuthority(): Promise<RealBuildPrefix50Step42ReproducedSourceGeometryAuthority> {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  const structural = await verifyCurrentPrefix50StructuralEvents();
  const projectionReader = createRealBuildPrefix50VerifiedProjectionReader({
    actionPreparation: {
      bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
      verified: reproduced.input.actionPreparation,
    },
    officialWorldReconciliation: {
      bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
      verified: reconciliation,
    },
    structuralEvents: { bytes: structural.bytes, verified: structural.verified },
  });
  return Object.freeze({
    projectionReader,
    sourceGeometryAdmission: admitRealBuildPrefix50Step42SourceGeometry(projectionReader),
  });
}

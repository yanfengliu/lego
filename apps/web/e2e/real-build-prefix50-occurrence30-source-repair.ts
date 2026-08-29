import { createHash } from "node:crypto";

import { PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import { deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import { deriveCatalogToBuilderFrames } from "./real-build-builder-frame-selection";
import { BUILDER_PREFIX50_DESIGN_SOURCES_L } from "./real-build-builder-source-pins-l";
import {
  BUILDER_STEP1_GEOMETRY_BUNDLE,
  BUILDER_STEP1_OFFICIAL_MODEL_DIGEST,
} from "./real-build-builder-sources";
import {
  composeBuilderTransforms,
  parseOfficialModelIndex,
  resolveBuilderBoneTransform,
} from "./real-build-official";

const OFFICIAL_MODEL_DIGEST =
  "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922" as const;
const BRICK_REF = "40304bdc-7c5b-46cf-bdcc-61a53aeae2c4" as const;
const PART_REF = "add42bfd-3868-4b04-a739-fd91eac4739f" as const;
const BONE_REF = "9f1418da-cc25-49dd-abdc-d7316b734d87" as const;
const DESIGN_REVISION = "77844;B" as const;
const CATALOG_PART_ID = "builtin:corner-plate-3x3" as const;
const RAW_BONE_TRANSFORM_DIGEST =
  "sha256:51812e45f34f0e025ad1ae14dd0cfe4a67b22d1b5dbe9cb8714492f230e47d48" as const;
const TRUSTED_SOURCE_DIGEST =
  "sha256:565aae6158079faf80002730bbe5d0a36dd1bfac3cbec480129a351005390a1c" as const;
const SOURCE_PIN = BUILDER_PREFIX50_DESIGN_SOURCES_L[0];

const EXPECTED_SOURCE_PIN_COMMITMENTS = deepFreeze({
  bundleSha256: "sha256:0670c459e1e6af555b3673058eb713f65dfda3f3114adfb1f02a00414338ff04",
  primitiveXmlSha256: "sha256:748a57c72228de71847199dababa8778772ea1779a4b58a61c51fa93bcaed12a",
  shellCanonicalSha256: "sha256:aa9d1afe2af62093efb0c9d3bf6e151259599fd19311c3ab0b6770228938bd6d",
  ldrawOfficialArchiveSha256:
    "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
  ldrawUnofficialArchiveSha256:
    "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4",
  ldrawClosureSha256: "sha256:72ca520b68934fdaa384e9bbc961090538f0b4ee1269773675db1adcf3cc7fdd",
  builderGeometryDigest: "sha256:9f3736dce6637a57460d038c4fb297641f370892b25c6a0e9693d2771c280818",
  ldrawReferenceGeometryDigest:
    "sha256:d48b23d932929465a15a1a511c35cd305c06aeedc64e96ca528b5763df047433",
  builderAnchorCentersDigest:
    "sha256:c6c80ec20b9f508574199d1057a2183eea3d5e31d79f6ad1a135899515392e6f",
  catalogConnectorDigest: "sha256:80d4f556c5a2c97dafe310a092a1a0ca4b5f77183a36c8167aafd5af9f87b96b",
});

export interface RealBuildPrefix50Occurrence30SourceRepairEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-evidence/1";
  readonly officialModelDigest: typeof OFFICIAL_MODEL_DIGEST;
  readonly occurrenceOrdinal: 30;
  readonly printedStepNumber: 14;
  readonly brickRef: typeof BRICK_REF;
  readonly partRef: typeof PART_REF;
  readonly boneRef: typeof BONE_REF;
  readonly boneCount: 1;
  readonly designRevision: typeof DESIGN_REVISION;
  readonly catalogPartId: typeof CATALOG_PART_ID;
  readonly rawBoneTransformDigest: typeof RAW_BONE_TRANSFORM_DIGEST;
  readonly sourcePinTrustedDigest: typeof TRUSTED_SOURCE_DIGEST;
  readonly sourcePinCommitments: typeof EXPECTED_SOURCE_PIN_COMMITMENTS;
  readonly frameCandidateCount: 1;
  readonly frameEquivalenceClassCount: 1;
  readonly catalogToBuilderLocalTransform: RigidTransform;
  readonly builderWorldTransform: RigidTransform;
  readonly repairedSourceWorldTransform: RigidTransform;
}

/** The shape is public only so the compiler can name its input; WeakMap membership is authority. */
export interface RealBuildPrefix50Occurrence30SourceRepairProof {
  readonly schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-proof/1";
}

const verifiedProofs = new WeakMap<object, RealBuildPrefix50Occurrence30SourceRepairEvidence>();

const digest = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function ownData(value: unknown, key: string, label: string): unknown {
  const descriptor =
    value !== null && typeof value === "object"
      ? Object.getOwnPropertyDescriptor(value, key)
      : null;
  if (descriptor === undefined || descriptor === null || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an own data property.`);
  }
  return descriptor.value;
}

function exactBytes(value: unknown, label: string, maximumBytes: number): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length < 1 || value.length > maximumBytes) {
    throw new TypeError(`${label} must be a bounded nonempty Uint8Array.`);
  }
  return new Uint8Array(value);
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((coordinate, index) => coordinate === right.positionLdu[index])
  );
}

function normalizeTransform(transform: RigidTransform): RigidTransform {
  return deepFreeze({
    positionLdu: transform.positionLdu.map((coordinate) =>
      Object.is(coordinate, -0) ? 0 : coordinate,
    ) as [number, number, number],
    orientationId: transform.orientationId,
  });
}

function sourcePinCommitments() {
  return deepFreeze({
    bundleSha256: SOURCE_PIN.sourceIdentity.bundleSha256,
    primitiveXmlSha256: SOURCE_PIN.sourceIdentity.primitiveXmlSha256,
    shellCanonicalSha256: SOURCE_PIN.sourceIdentity.shellCanonicalSha256,
    ldrawOfficialArchiveSha256: SOURCE_PIN.sourceIdentity.ldrawOfficialArchiveSha256,
    ldrawUnofficialArchiveSha256: SOURCE_PIN.sourceIdentity.ldrawUnofficialArchiveSha256,
    ldrawClosureSha256: SOURCE_PIN.sourceIdentity.ldrawClosureSha256,
    builderGeometryDigest: SOURCE_PIN.builderGeometry.digest,
    ldrawReferenceGeometryDigest: SOURCE_PIN.ldrawReferenceGeometry.digest,
    builderAnchorCentersDigest: SOURCE_PIN.builderAnchorCentersDigest,
    catalogConnectorDigest: SOURCE_PIN.expectedCatalogConnectorDigest,
  });
}

function requireExactEvidence(
  evidence: RealBuildPrefix50Occurrence30SourceRepairEvidence,
): RealBuildPrefix50Occurrence30SourceRepairEvidence {
  if (
    evidence.schemaVersion !== "lego.real-build-prefix50-occurrence30-source-repair-evidence/1" ||
    evidence.officialModelDigest !== OFFICIAL_MODEL_DIGEST ||
    evidence.occurrenceOrdinal !== 30 ||
    evidence.printedStepNumber !== 14 ||
    evidence.brickRef !== BRICK_REF ||
    evidence.partRef !== PART_REF ||
    evidence.boneRef !== BONE_REF ||
    evidence.boneCount !== 1 ||
    evidence.designRevision !== DESIGN_REVISION ||
    evidence.catalogPartId !== CATALOG_PART_ID ||
    evidence.rawBoneTransformDigest !== RAW_BONE_TRANSFORM_DIGEST ||
    evidence.sourcePinTrustedDigest !== TRUSTED_SOURCE_DIGEST ||
    JSON.stringify(evidence.sourcePinCommitments) !==
      JSON.stringify(EXPECTED_SOURCE_PIN_COMMITMENTS) ||
    evidence.frameCandidateCount !== 1 ||
    evidence.frameEquivalenceClassCount !== 1 ||
    !sameTransform(evidence.catalogToBuilderLocalTransform, {
      positionLdu: [40, -4, 0],
      orientationId: "upright-yaw-180",
    }) ||
    !sameTransform(evidence.builderWorldTransform, {
      positionLdu: [50, 0, -344],
      orientationId: "upright-yaw-180",
    }) ||
    !sameTransform(evidence.repairedSourceWorldTransform, {
      positionLdu: [10, -4, -344],
      orientationId: "upright-yaw-0",
    })
  ) {
    throw new TypeError(
      "Occurrence-30 repair evidence must retain the exact official XML identity, single Bone, raw transform, committed 77844 source pins, unique fresh frame, and Builder-composed source transform.",
    );
  }
  return evidence;
}

/**
 * Independently derives the one occurrence-30 source repair from raw reviewed source bytes.
 * The returned object deliberately contains no readable evidence; only this module's WeakMap can reopen it.
 */
export function verifyRealBuildPrefix50Occurrence30SourceRepair(
  unsafeInput: unknown,
): RealBuildPrefix50Occurrence30SourceRepairProof {
  exactKeys(
    unsafeInput,
    ["builderGeometryBundleBytes", "officialModelBytes"],
    "Occurrence-30 source-repair verifier input",
  );
  const officialModelBytes = exactBytes(
    ownData(unsafeInput, "officialModelBytes", "Occurrence-30 source-repair verifier input"),
    "Occurrence-30 official XML",
    4 * 1024 * 1024,
  );
  const builderGeometryBundleBytes = exactBytes(
    ownData(
      unsafeInput,
      "builderGeometryBundleBytes",
      "Occurrence-30 source-repair verifier input",
    ),
    "Occurrence-30 Builder geometry bundle",
    2 * 1024 * 1024,
  );
  if (
    digest(officialModelBytes) !== OFFICIAL_MODEL_DIGEST ||
    BUILDER_STEP1_OFFICIAL_MODEL_DIGEST !== OFFICIAL_MODEL_DIGEST
  ) {
    throw new TypeError(
      `Occurrence-30 repair requires exact official XML ${OFFICIAL_MODEL_DIGEST}.`,
    );
  }
  if (
    builderGeometryBundleBytes.length !== BUILDER_STEP1_GEOMETRY_BUNDLE.byteLength ||
    digest(builderGeometryBundleBytes) !== BUILDER_STEP1_GEOMETRY_BUNDLE.digest
  ) {
    throw new TypeError(
      `Occurrence-30 repair requires exact Builder geometry bundle ${BUILDER_STEP1_GEOMETRY_BUNDLE.digest}.`,
    );
  }
  if (
    SOURCE_PIN.designRevision !== DESIGN_REVISION ||
    SOURCE_PIN.catalogPartId !== CATALOG_PART_ID ||
    digest(JSON.stringify(SOURCE_PIN)) !== TRUSTED_SOURCE_DIGEST ||
    JSON.stringify(sourcePinCommitments()) !== JSON.stringify(EXPECTED_SOURCE_PIN_COMMITMENTS)
  ) {
    throw new TypeError("Committed 77844 source-pin identities or digests have drifted.");
  }
  for (const slice of [SOURCE_PIN.builderGeometry, SOURCE_PIN.ldrawReferenceGeometry]) {
    const end = slice.byteOffset + slice.byteLength;
    if (
      slice.byteOffset < 0 ||
      slice.byteLength < 1 ||
      end > builderGeometryBundleBytes.length ||
      digest(builderGeometryBundleBytes.slice(slice.byteOffset, end)) !== slice.digest
    ) {
      throw new TypeError(`Committed 77844 ${slice.format} source slice no longer reproduces.`);
    }
  }
  if (
    SOURCE_PIN.builderAnchorRole !== "top-field-to-catalog-stud" ||
    digest(
      JSON.stringify(
        [...SOURCE_PIN.builderAnchorCentersLdu].sort(
          (left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2],
        ),
      ),
    ) !== SOURCE_PIN.builderAnchorCentersDigest
  ) {
    throw new TypeError("Committed 77844 Builder anchor centers no longer reproduce their digest.");
  }
  const definition = getPartDefinition(CATALOG_PART_ID);
  if (definition === undefined) {
    throw new TypeError(`Occurrence-30 catalog part ${CATALOG_PART_ID} is absent.`);
  }
  if (digest(JSON.stringify(definition.connectors)) !== SOURCE_PIN.expectedCatalogConnectorDigest) {
    throw new TypeError(
      "Occurrence-30 current connector frame differs from its committed 77844 pin.",
    );
  }
  const catalogStudCenters = definition.connectors
    .filter(({ kind }) => kind === "stud")
    .map(({ positionLdu }) => positionLdu);
  const frames = deriveCatalogToBuilderFrames(
    catalogStudCenters,
    SOURCE_PIN.builderAnchorCentersLdu,
  );
  if (frames.length !== 1) {
    throw new TypeError(
      `Occurrence-30 fresh 77844 frame derivation produced ${frames.length} candidates; exactly one is required.`,
    );
  }
  const official = parseOfficialModelIndex(officialModelBytes);
  const brick = official.bricks[BRICK_REF];
  const part = brick?.parts[0];
  if (
    official.digest !== OFFICIAL_MODEL_DIGEST ||
    brick?.brickRef !== BRICK_REF ||
    brick.designRevision !== DESIGN_REVISION ||
    brick.parts.length !== 1 ||
    part?.partRef !== PART_REF ||
    part.boneRef !== BONE_REF ||
    part.designRevision !== DESIGN_REVISION ||
    part.builderTransform === null ||
    part.builderTransform.sourceDigest !== RAW_BONE_TRANSFORM_DIGEST
  ) {
    throw new TypeError(
      "Occurrence-30 official XML row must be the exact 77844;B Brick/Part/Bone UUID tuple with one raw Bone transform.",
    );
  }
  const resolved = resolveBuilderBoneTransform(part.builderTransform);
  if (resolved.transform === null) {
    throw new TypeError(`Occurrence-30 raw Bone is not a proper transform: ${resolved.failure}.`);
  }
  const builderWorldTransform = normalizeTransform(resolved.transform);
  const repairedSourceWorldTransform = composeBuilderTransforms(builderWorldTransform, frames[0]!);
  if (repairedSourceWorldTransform === null) {
    throw new TypeError("Occurrence-30 Builder world and unique local frame do not compose.");
  }
  const evidence = requireExactEvidence(
    deepFreeze({
      schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-evidence/1" as const,
      officialModelDigest: OFFICIAL_MODEL_DIGEST,
      occurrenceOrdinal: 30 as const,
      printedStepNumber: 14 as const,
      brickRef: BRICK_REF,
      partRef: PART_REF,
      boneRef: BONE_REF,
      boneCount: 1 as const,
      designRevision: DESIGN_REVISION,
      catalogPartId: CATALOG_PART_ID,
      rawBoneTransformDigest: RAW_BONE_TRANSFORM_DIGEST,
      sourcePinTrustedDigest: TRUSTED_SOURCE_DIGEST,
      sourcePinCommitments: sourcePinCommitments(),
      frameCandidateCount: 1 as const,
      frameEquivalenceClassCount: 1 as const,
      catalogToBuilderLocalTransform: frames[0]!,
      builderWorldTransform,
      repairedSourceWorldTransform: normalizeTransform(repairedSourceWorldTransform),
    }),
  );
  const proof = Object.freeze({
    schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-proof/1" as const,
  });
  verifiedProofs.set(proof, evidence);
  return proof;
}

export function requireRealBuildPrefix50Occurrence30SourceRepairProof(
  unsafeProof: unknown,
): RealBuildPrefix50Occurrence30SourceRepairEvidence {
  const evidence =
    unsafeProof !== null && typeof unsafeProof === "object"
      ? verifiedProofs.get(unsafeProof)
      : undefined;
  if (evidence === undefined) {
    throw new TypeError(
      "Occurrence-30 repair requires the opaque proof minted from exact official XML and committed 77844 source bytes; caller-shaped transforms and proof lookalikes are forbidden.",
    );
  }
  return requireExactEvidence(evidence);
}

export const __testOnly = Object.freeze({
  expectedEvidence: Object.freeze({
    officialModelDigest: OFFICIAL_MODEL_DIGEST,
    brickRef: BRICK_REF,
    partRef: PART_REF,
    boneRef: BONE_REF,
    rawBoneTransformDigest: RAW_BONE_TRANSFORM_DIGEST,
    sourcePinTrustedDigest: TRUSTED_SOURCE_DIGEST,
    sourcePinCommitments: EXPECTED_SOURCE_PIN_COMMITMENTS,
  }),
  requireExactEvidence,
  properOrientationIds: Object.freeze(PROPER_ORIENTATIONS.map(({ id }) => id)),
});

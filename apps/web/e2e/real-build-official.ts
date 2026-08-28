import { createHash } from "node:crypto";

import type { StepFailure } from "./real-build-safety";
import { parseOfficialBuilderOrder, type OfficialBuilderOrder } from "./real-build-builder-order";

export {
  applyBuilderCanonicalCalibration,
  BUILDER_CANONICAL_CALIBRATION_SCHEMA,
  BUILDER_FRAME_EVIDENCE_PROTOCOL,
  composeBuilderTransforms,
  composeBuilderProperTransforms,
  createBuilderCanonicalCalibration,
  createBuilderFrameEvidence,
  resolveBuilderBoneTransform,
  resolveBuilderBoneProperTransform,
} from "./real-build-builder-calibration";
export type {
  BuilderCanonicalCalibration,
  BuilderFrameEvidence,
} from "./real-build-builder-calibration";

export interface LedgerTransform {
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId: string;
}

export interface BuilderBoneTransform {
  readonly matrix: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  readonly position: readonly [number, number, number];
  readonly sourceDigest: string;
}

export interface OfficialBrickRecord {
  readonly brickRef: string;
  readonly designId: string;
  readonly designRevision: string;
  readonly itemNos: readonly string[];
  readonly materialId: string;
  readonly parts: readonly {
    readonly partRef: string;
    readonly boneRef: string;
    readonly designId: string;
    readonly designRevision: string;
    readonly materialIds: readonly string[];
    readonly builderTransform: BuilderBoneTransform | null;
    readonly builderTransformFailure: string | null;
  }[];
  readonly builderTransform: BuilderBoneTransform | null;
  readonly builderTransformFailure: string | null;
  readonly canonicalTransform: LedgerTransform | null;
  readonly canonicalTransformFailure: string | null;
  readonly calibratedCatalogPartId: string | null;
  readonly frameEvidenceDigest: string | null;
}

export interface OfficialModelIndex {
  readonly digest: string;
  readonly calibrationDigest: string | null;
  readonly builderGeometryDigest: string | null;
  readonly bricks: Readonly<Record<string, OfficialBrickRecord>>;
  readonly instructionBrickRefs: ReadonlySet<string>;
  readonly directBrickRefs: ReadonlySet<string>;
  readonly multiBuildByActualRef: ReadonlyMap<string, string>;
  readonly unmatchedInventoryBrickRefs: ReadonlySet<string>;
  readonly builderOrder: OfficialBuilderOrder;
}

const digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const attributes = (source: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...source.matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/gu)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );

const baseDesign = (value: string): string => value.split(";", 1)[0]!;
const baseMaterial = (value: string): string => value.split(":", 1)[0]!;
const partMaterials = (value: string): readonly string[] => [
  ...new Set(value.split(",").map(baseMaterial)),
];

function parseBone(
  source: string,
  brickRef: string,
): {
  readonly transform: BuilderBoneTransform | null;
  readonly failure: string | null;
} {
  const bones = [...source.matchAll(/<Bone\b([^>]*)\/?\s*>/gu)];
  if (bones.length !== 1) {
    return {
      transform: null,
      failure: `Official Brick ${brickRef} has ${bones.length} Bone transforms; the current rigid-part protocol requires exactly one.`,
    };
  }
  const encoded = attributes(bones[0]![1]!).transformation;
  if (encoded === undefined) {
    return {
      transform: null,
      failure: `Official Brick ${brickRef} Bone has no transformation attribute.`,
    };
  }
  const values = encoded.split(",").map(Number);
  if (values.length !== 12 || values.some((value) => !Number.isFinite(value))) {
    return {
      transform: null,
      failure: `Official Brick ${brickRef} Bone transformation must contain 12 finite numbers; received ${values.length}.`,
    };
  }
  const tuple = values as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return {
    transform: {
      matrix: tuple.slice(0, 9) as unknown as BuilderBoneTransform["matrix"],
      position: tuple.slice(9, 12) as unknown as BuilderBoneTransform["position"],
      sourceDigest: digest(JSON.stringify(tuple)),
    },
    failure: null,
  };
}

/** Parses stable instruction identities and the exact Builder Bone transform for each physical Brick. */
export function parseOfficialModelIndex(xmlBytes: Uint8Array): OfficialModelIndex {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
  const builderOrder = parseOfficialBuilderOrder(xmlBytes);
  const bricks: Record<string, OfficialBrickRecord> = {};
  const brickContainers = [...xml.matchAll(/<Bricks\b[^>]*>([\s\S]*?)<\/Bricks>/gu)];
  if (brickContainers.length !== 1) {
    throw new TypeError(
      `Official model XML requires exactly one physical Bricks inventory; received ${brickContainers.length}.`,
    );
  }
  const brickInventory = brickContainers[0]![1]!;
  const brickStarts = [...brickInventory.matchAll(/<Brick\b/gu)];
  const brickMatches = [...brickInventory.matchAll(/<Brick\b([^>]*)>([\s\S]*?)<\/Brick>/gu)];
  if (brickStarts.length !== brickMatches.length) {
    throw new TypeError(
      `Official physical Bricks inventory contains ${brickStarts.length} Brick starts but only ${brickMatches.length} closed records; self-closing, nested, or missing records are forbidden.`,
    );
  }
  const partRefs = new Set<string>();
  const boneRefs = new Set<string>();
  for (const match of brickMatches) {
    const brick = attributes(match[1]!);
    const brickRef = brick.uuid;
    if (brickRef === undefined || brickRef.trim().length === 0) {
      throw new TypeError("Official physical Bricks inventory contains a Brick without a uuid.");
    }
    const partStarts = [...match[2]!.matchAll(/<Part\b/gu)];
    const partMatches = [...match[2]!.matchAll(/<Part\b([^>]*)>([\s\S]*?)<\/Part>/gu)];
    if (partStarts.length !== partMatches.length) {
      throw new TypeError(
        `Official physical Brick ${brickRef} contains ${partStarts.length} Part starts but only ${partMatches.length} closed records.`,
      );
    }
    const parts = partMatches.map((partMatch) => {
      const part = attributes(partMatch[1]!);
      if (
        part.uuid === undefined ||
        part.uuid.trim().length === 0 ||
        part.designID === undefined ||
        part.designID.trim().length === 0 ||
        part.materials === undefined ||
        part.materials.trim().length === 0
      ) {
        throw new TypeError(
          `Official physical Brick ${brickRef} has a Part without uuid/designID/materials.`,
        );
      }
      if (partRefs.has(part.uuid)) {
        throw new TypeError(`Official model repeats physical Part uuid ${part.uuid}.`);
      }
      partRefs.add(part.uuid);
      const bones = [...partMatch[2]!.matchAll(/<Bone\b([^>]*)\/?\s*>/gu)];
      if (bones.length !== 1) {
        throw new TypeError(
          `Official physical Part ${part.uuid} in Brick ${brickRef} requires exactly one Bone; received ${bones.length}.`,
        );
      }
      const boneRef = attributes(bones[0]![1]!).uuid;
      if (boneRef === undefined || boneRef.trim().length === 0) {
        throw new TypeError(`Official physical Part ${part.uuid} has a Bone without a uuid.`);
      }
      if (boneRefs.has(boneRef)) {
        throw new TypeError(`Official model repeats physical Bone uuid ${boneRef}.`);
      }
      boneRefs.add(boneRef);
      const bone = parseBone(partMatch[2]!, `${brickRef}/${part.uuid ?? "unidentified-part"}`);
      return {
        partRef: part.uuid,
        boneRef,
        designId: baseDesign(part.designID),
        designRevision: part.designID,
        materialIds: partMaterials(part.materials),
        builderTransform: bone.transform,
        builderTransformFailure: bone.failure,
      };
    });
    if (parts.length < 1) {
      throw new TypeError(`Official physical Brick ${brickRef} contains no Part leaves.`);
    }
    const designRevision = brick.designID;
    if (designRevision === undefined || designRevision.trim().length === 0) {
      throw new TypeError(
        `Official Brick ${brickRef} needs its own designID; ${parts.length} Part leaves cannot define one element identity.`,
      );
    }
    if (parts.length === 1 && parts[0]!.designRevision !== designRevision) {
      throw new TypeError(
        `Official single-part Brick ${brickRef} design ${designRevision} disagrees with Part ${parts[0]!.partRef} design ${parts[0]!.designRevision}.`,
      );
    }
    const itemNos = brick.itemNos?.split(",") ?? [];
    if (
      itemNos.length < 1 ||
      new Set(itemNos).size !== itemNos.length ||
      itemNos.some((itemNo) => !/^[1-9]\d*$/u.test(itemNo))
    ) {
      throw new TypeError(
        `Official Brick ${brickRef} needs one or more unique numeric itemNos; received ${JSON.stringify(
          brick.itemNos ?? "missing",
        )}.`,
      );
    }
    const materialIds = [...new Set(parts.flatMap((part) => part.materialIds))].sort();
    if (bricks[brickRef] !== undefined) {
      throw new TypeError(`Official model repeats physical Brick uuid ${brickRef}.`);
    }
    const rigidPart = parts.length === 1 ? parts[0]! : null;
    bricks[brickRef] = {
      brickRef,
      designId: baseDesign(designRevision),
      designRevision,
      itemNos,
      materialId: materialIds.join("+"),
      parts,
      builderTransform: rigidPart?.builderTransform ?? null,
      builderTransformFailure:
        rigidPart === null
          ? `Official Brick ${brickRef} is composite design ${designRevision} with ${parts.length} independently transformed Part leaves; the rigid single-part calibration protocol cannot collapse it.`
          : rigidPart.builderTransformFailure,
      canonicalTransform: null,
      canonicalTransformFailure: "Builder-to-canonical calibration has not been applied.",
      calibratedCatalogPartId: null,
      frameEvidenceDigest: null,
    };
  }
  const directBrickRefs = builderOrder.directBrickRefs;
  const multiBuildByActualRef = builderOrder.multiBuildByActualRef;
  const instructionBrickRefs = new Set([...directBrickRefs, ...multiBuildByActualRef.keys()]);
  const unmatchedInventoryBrickRefs = new Set(
    Object.keys(bricks).filter((brickRef) => !instructionBrickRefs.has(brickRef)),
  );
  if (Object.keys(bricks).length < 1 || instructionBrickRefs.size < 1) {
    throw new TypeError(
      "Official model XML has no physical Brick/Part and instruction In identities.",
    );
  }
  for (const brickRef of instructionBrickRefs) {
    if (bricks[brickRef] === undefined) {
      throw new TypeError(`Official instruction In references missing physical Brick ${brickRef}.`);
    }
  }
  for (const [actualBrickRef, originalBrickRef] of multiBuildByActualRef) {
    const actual = bricks[actualBrickRef];
    const original = bricks[originalBrickRef];
    if (!directBrickRefs.has(originalBrickRef) || actual === undefined || original === undefined) {
      throw new TypeError(
        `Official MultiBuild ${actualBrickRef} -> ${originalBrickRef} is not a valid instruction Brick pair.`,
      );
    }
    if (
      actual.designRevision !== original.designRevision ||
      actual.materialId !== original.materialId
    ) {
      throw new TypeError(
        `Official MultiBuild ${actualBrickRef} (${actual.designRevision}/${actual.materialId}) does not match ` +
          `source ${originalBrickRef} (${original.designRevision}/${original.materialId}).`,
      );
    }
  }
  return {
    digest: digest(xmlBytes),
    calibrationDigest: null,
    builderGeometryDigest: null,
    bricks,
    instructionBrickRefs,
    directBrickRefs,
    multiBuildByActualRef,
    unmatchedInventoryBrickRefs,
    builderOrder,
  };
}

export function validateOfficialModelAccounting(
  official: OfficialModelIndex,
): readonly StepFailure[] {
  const unmatched = [...official.unmatchedInventoryBrickRefs].map(
    (brickRef) => official.bricks[brickRef],
  );
  if (
    official.directBrickRefs.size === 1_395 &&
    official.multiBuildByActualRef.size === 69 &&
    official.instructionBrickRefs.size === 1_464 &&
    Object.keys(official.bricks).length === 1_465 &&
    unmatched.length === 1 &&
    unmatched[0]?.designId === "31510"
  ) {
    return [];
  }
  return [
    {
      code: "official-model-accounting-mismatch",
      stage: "input",
      inputKey: "officialModel",
      message:
        `Official XML independently yields ${official.directBrickRefs.size} direct + ` +
        `${official.multiBuildByActualRef.size} MultiBuild = ${official.instructionBrickRefs.size} ` +
        `instruction identities from ${Object.keys(official.bricks).length} physical Bricks, with unmatched ` +
        `[${unmatched.map((brick) => brick?.designId ?? "missing").join(",") || "none"}]. ` +
        `Set 6651557 requires exactly 1395 + 69 = 1464 and one unmatched 31510 separator.`,
    },
  ];
}

export function officialTransformFailure(
  brick: OfficialBrickRecord,
  stepNumber: number,
): StepFailure {
  const frameMissing =
    brick.calibratedCatalogPartId === null &&
    brick.canonicalTransformFailure?.includes("no independently verified") === true;
  return {
    code: frameMissing
      ? "official-frame-calibration-missing"
      : "official-transform-unrepresentable",
    stage: "input",
    inputKey: brick.brickRef,
    stepNumber,
    message:
      `Official Brick ${brick.brickRef} (${brick.designId}/${brick.materialId}) has no exact canonical ` +
      `transform: ${brick.canonicalTransformFailure ?? brick.builderTransformFailure ?? "missing Bone"}.`,
  };
}

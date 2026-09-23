import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import {
  SEMANTIC_COLOR_MASK_OTHER_HEX,
  SEMANTIC_COLOR_MASK_TARGET_HEX,
  type SemanticColorMaskClassification,
} from "@lego-studio/rendering";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH =
  "sha256:1146c39cf0bba33035dfe9cf531b7721e8d89067ec325e123f8e4bfeb0020369" as const;
export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT =
  "sha256:40e9e121412aa4c4ef476b65cd9b2772863359c7474c485ae6e97a7973f2704f" as const;
export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT =
  "sha256:954c9bdfc53e387a753d4f1eaf1be0a49be254e81c79c0e9c96fb4afbeb7087e" as const;
export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROLS_COMMITMENT =
  "sha256:3d30925a9630697429d6666acdac8ef8c8d009359e49202a85de22e05190ba12" as const;
export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT =
  "sha256:7726c343214e0b5868eaf919a6d0908ff3771184313c7fe27fb629fdeec5f2ea" as const;

export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_COLOR_FAMILY_IDS = Object.freeze([
  "builtin:blue",
  "builtin:dark-azure",
  "builtin:dark-blue",
  "builtin:medium-azure",
] as const);

export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS = Object.freeze([
  "builtin:blue",
  "builtin:dark-blue",
] as const);

export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_ABSENT_TARGET_COLOR_IDS = Object.freeze([
  "builtin:dark-azure",
  "builtin:medium-azure",
] as const);

export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_PART_IDS = Object.freeze([
  "part-4841202d1b20c3f4afebf7f1",
  "part-52ecb22435bb65ad24970942",
  "part-6fa165de228fcf431ca8e20b",
  "part-a587d9da735f5cdac0bdcc5a",
  "part-b5df265b6e92b7bfe02907fe",
  "part-c251b2fd6e6319a2df83c4d6",
  "part-c4f30cce7d22d5b3abb0a922",
  "part-c7d1f9de2b19e3b95ef1b339",
  "part-c975b8ba5f76fc21b4280777",
  "part-d46424c62242aaafad9f2175",
  "part-ea3c1230add9eb785b0192e9",
] as const);

export const REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS = Object.freeze([
  "builtin:dark-bluish-gray",
  "builtin:light-bluish-gray",
] as const);

export interface RealBuildPrefix50SemanticColorPolicy {
  readonly schemaVersion: string;
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly dataExclusionPolicy: string;
  readonly parentPartCount: number;
  readonly parentDocumentHash: `sha256:${string}`;
  readonly parentDocumentCommitment: `sha256:${string}`;
  readonly targetColorIds: readonly string[];
  readonly targetHex: typeof SEMANTIC_COLOR_MASK_TARGET_HEX;
  readonly otherHex: typeof SEMANTIC_COLOR_MASK_OTHER_HEX;
  readonly classification: SemanticColorMaskClassification;
  readonly classificationCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44SemanticColorPolicy extends RealBuildPrefix50SemanticColorPolicy {
  readonly schemaVersion: "lego.real-build-prefix50-step44-semantic-color-policy/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly dataExclusionPolicy: "exact-step43-parent-color-ids-no-step44-child";
  readonly parentPartCount: 257;
  readonly parentDocumentHash: typeof REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH;
  readonly parentDocumentCommitment: typeof REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT;
  readonly targetColorFamilyIds: typeof REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_COLOR_FAMILY_IDS;
  readonly targetColorIds: typeof REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS;
  readonly absentTargetColorIds: typeof REAL_BUILD_PREFIX50_STEP44_SEMANTIC_ABSENT_TARGET_COLOR_IDS;
  readonly targetHex: typeof SEMANTIC_COLOR_MASK_TARGET_HEX;
  readonly otherHex: typeof SEMANTIC_COLOR_MASK_OTHER_HEX;
  readonly classification: SemanticColorMaskClassification;
  readonly classificationCommitment: `sha256:${string}`;
  readonly grayNegativeControls: {
    readonly colorIds: typeof REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS;
    readonly partIds: readonly string[];
    readonly commitment: `sha256:${string}`;
  };
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44SemanticColorRenderEvidence {
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly projectionMatrix: readonly number[];
  readonly matrixWorldInverse: readonly number[];
  readonly rendererCameraCommitment: `sha256:${string}`;
  readonly policyCommitment: `sha256:${string}`;
  readonly classification: SemanticColorMaskClassification;
  readonly classificationCommitment: `sha256:${string}`;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactPartIdsForColors(
  parentDocument: BrickDocumentV1,
  colorIds: readonly string[],
): readonly string[] {
  const colors = new Set(colorIds);
  return parentDocument.parts
    .filter(({ colorId }) => colors.has(colorId))
    .map(({ id }) => id)
    .sort(compareStrings);
}

export function deriveRealBuildPrefix50RealDomainSemanticColorPolicy(
  parentDocument: BrickDocumentV1,
): RealBuildPrefix50SemanticColorPolicy {
  const targetColorIds = Object.freeze(["builtin:dark-azure", "builtin:medium-azure"] as const);
  const parentDocumentHash = documentStructuralHash(parentDocument);
  const parentDocumentCommitment = canonicalDigest(parentDocument);
  const validation = validateBrickDocument(parentDocument);
  const targetPartIds = exactPartIdsForColors(parentDocument, targetColorIds);
  const targetSet = new Set(targetPartIds);
  const otherPartIds = parentDocument.parts
    .map(({ id }) => id)
    .filter((id) => !targetSet.has(id))
    .sort(compareStrings);
  const otherColors = [
    ...new Set(
      parentDocument.parts
        .filter(({ id }) => otherPartIds.includes(id))
        .map(({ colorId }) => colorId),
    ),
  ].sort(compareStrings);
  if (
    !validation.documentGloballyValid ||
    validation.targetDocumentHash !== parentDocumentHash ||
    targetPartIds.length === 0 ||
    !sameStrings(otherColors, ["builtin:black"])
  )
    throw new TypeError(
      "Real-domain semantic policy requires one hard-valid dark/medium-azure child with black-only negative controls.",
    );
  const classification = deepFreeze({ targetColorIds, targetPartIds, otherPartIds });
  const classificationCommitment = canonicalDigest(classification);
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-semantic-color-policy/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    dataExclusionPolicy: "exact-page44-predecessor-colors-no-page45-no-step44-candidate" as const,
    parentPartCount: parentDocument.parts.length,
    parentDocumentHash,
    parentDocumentCommitment,
    targetColorIds,
    targetHex: SEMANTIC_COLOR_MASK_TARGET_HEX,
    otherHex: SEMANTIC_COLOR_MASK_OTHER_HEX,
    classification,
    classificationCommitment,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function deriveRealBuildPrefix50Step44SemanticColorPolicy(
  parentDocument: BrickDocumentV1,
): RealBuildPrefix50Step44SemanticColorPolicy {
  if (arguments.length !== 1)
    throw new TypeError("Step-44 semantic color policy requires exactly one parent document.");
  const parentDocumentHash = documentStructuralHash(parentDocument);
  const parentDocumentCommitment = canonicalDigest(parentDocument);
  const validation = validateBrickDocument(parentDocument);
  if (
    parentDocument.parts.length !== 257 ||
    parentDocumentHash !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH ||
    parentDocumentCommitment !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT ||
    !validation.documentGloballyValid ||
    validation.targetDocumentHash !== parentDocumentHash
  )
    throw new TypeError(
      "Step-44 semantic color policy requires the exact hard-valid 257-part shared Step-43 parent.",
    );

  const presentFamilyColorIds = REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_COLOR_FAMILY_IDS.filter(
    (colorId) => parentDocument.parts.some((part) => part.colorId === colorId),
  );
  const absentFamilyColorIds = REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_COLOR_FAMILY_IDS.filter(
    (colorId) => !parentDocument.parts.some((part) => part.colorId === colorId),
  );
  const targetPartIds = exactPartIdsForColors(
    parentDocument,
    REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS,
  );
  if (
    !sameStrings(
      presentFamilyColorIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS,
    ) ||
    !sameStrings(
      absentFamilyColorIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_ABSENT_TARGET_COLOR_IDS,
    ) ||
    !sameStrings(targetPartIds, REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_PART_IDS)
  )
    throw new TypeError(
      "Step-44 semantic color policy did not reproduce the exact blue/dark-blue parent roster or its absent azure controls.",
    );

  const targetSet = new Set(targetPartIds);
  const otherPartIds = parentDocument.parts
    .map(({ id }) => id)
    .filter((id) => !targetSet.has(id))
    .sort(compareStrings);
  const grayNegativeControlPartIds = exactPartIdsForColors(
    parentDocument,
    REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS,
  );
  if (
    targetPartIds.length !== 11 ||
    otherPartIds.length !== 246 ||
    grayNegativeControlPartIds.length !== 49 ||
    grayNegativeControlPartIds.some((id) => !otherPartIds.includes(id))
  )
    throw new TypeError(
      "Step-44 semantic color policy did not retain its exact 11/246 classification and 49 gray negative controls.",
    );

  const classification = deepFreeze({
    targetColorIds: [...REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS],
    targetPartIds: [...targetPartIds],
    otherPartIds,
  });
  const classificationCommitment = canonicalDigest(classification);
  if (classificationCommitment !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT)
    throw new TypeError(
      "Step-44 semantic color classification drifted from its exact committed parent roster.",
    );
  const grayNegativeControlBody = {
    colorIds: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS,
    partIds: grayNegativeControlPartIds,
  };
  const grayNegativeControlsCommitment = canonicalDigest(grayNegativeControlBody);
  if (
    grayNegativeControlsCommitment !==
    REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROLS_COMMITMENT
  )
    throw new TypeError(
      "Step-44 semantic color gray negative controls drifted from their exact committed parent roster.",
    );
  const grayNegativeControls = deepFreeze({
    ...grayNegativeControlBody,
    commitment: grayNegativeControlsCommitment,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-semantic-color-policy/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    dataExclusionPolicy: "exact-step43-parent-color-ids-no-step44-child" as const,
    parentPartCount: 257 as const,
    parentDocumentHash: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH,
    parentDocumentCommitment: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT,
    targetColorFamilyIds: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_COLOR_FAMILY_IDS,
    targetColorIds: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS,
    absentTargetColorIds: REAL_BUILD_PREFIX50_STEP44_SEMANTIC_ABSENT_TARGET_COLOR_IDS,
    targetHex: SEMANTIC_COLOR_MASK_TARGET_HEX,
    otherHex: SEMANTIC_COLOR_MASK_OTHER_HEX,
    classification,
    classificationCommitment,
    grayNegativeControls,
  };
  const commitment = canonicalDigest(body);
  if (commitment !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT)
    throw new TypeError("Step-44 semantic color policy drifted from its exact committed body.");
  return deepFreeze({ ...body, commitment });
}

export function requireRealBuildPrefix50Step44SemanticColorPolicy(
  policy: RealBuildPrefix50Step44SemanticColorPolicy,
): RealBuildPrefix50Step44SemanticColorPolicy {
  const { commitment, ...body } = policy;
  const classification = policy.classification;
  const grayNegativeControls = policy.grayNegativeControls;
  const allClassifiedPartIds = [...classification.targetPartIds, ...classification.otherPartIds];
  if (
    policy.schemaVersion !== "lego.real-build-prefix50-step44-semantic-color-policy/1" ||
    policy.authority !== "none" ||
    policy.sourceSetId !== "6651557" ||
    policy.dataExclusionPolicy !== "exact-step43-parent-color-ids-no-step44-child" ||
    policy.parentPartCount !== 257 ||
    policy.parentDocumentHash !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_HASH ||
    policy.parentDocumentCommitment !==
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PARENT_DOCUMENT_COMMITMENT ||
    policy.targetHex !== SEMANTIC_COLOR_MASK_TARGET_HEX ||
    policy.otherHex !== SEMANTIC_COLOR_MASK_OTHER_HEX ||
    !sameStrings(
      policy.targetColorFamilyIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_COLOR_FAMILY_IDS,
    ) ||
    !sameStrings(
      policy.targetColorIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_PRESENT_TARGET_COLOR_IDS,
    ) ||
    !sameStrings(
      policy.absentTargetColorIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_ABSENT_TARGET_COLOR_IDS,
    ) ||
    !sameStrings(classification.targetColorIds, policy.targetColorIds) ||
    !sameStrings(
      classification.targetPartIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_TARGET_PART_IDS,
    ) ||
    classification.otherPartIds.length !== 246 ||
    new Set(allClassifiedPartIds).size !== 257 ||
    canonicalDigest(classification) !==
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT ||
    policy.classificationCommitment !==
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_CLASSIFICATION_COMMITMENT ||
    !sameStrings(
      grayNegativeControls.colorIds,
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROL_COLOR_IDS,
    ) ||
    grayNegativeControls.partIds.length !== 49 ||
    grayNegativeControls.partIds.some((id) => !classification.otherPartIds.includes(id)) ||
    canonicalDigest({
      colorIds: grayNegativeControls.colorIds,
      partIds: grayNegativeControls.partIds,
    }) !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROLS_COMMITMENT ||
    grayNegativeControls.commitment !==
      REAL_BUILD_PREFIX50_STEP44_SEMANTIC_GRAY_NEGATIVE_CONTROLS_COMMITMENT ||
    canonicalDigest(body) !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT ||
    commitment !== REAL_BUILD_PREFIX50_STEP44_SEMANTIC_POLICY_COMMITMENT
  )
    throw new TypeError(
      "Step-44 semantic color policy must reproduce the exact committed parent classification and gray controls.",
    );
  return deepFreeze(policy);
}

export function requireRealBuildPrefix50SemanticColorPolicy<
  T extends RealBuildPrefix50SemanticColorPolicy,
>(policy: T): T {
  const { commitment, ...body } = policy;
  const classification = policy.classification;
  const classified = [...classification.targetPartIds, ...classification.otherPartIds];
  if (
    policy.authority !== "none" ||
    policy.sourceSetId !== "6651557" ||
    policy.parentPartCount < 1 ||
    !Number.isSafeInteger(policy.parentPartCount) ||
    policy.targetHex !== SEMANTIC_COLOR_MASK_TARGET_HEX ||
    policy.otherHex !== SEMANTIC_COLOR_MASK_OTHER_HEX ||
    canonicalDigest(classification) !== policy.classificationCommitment ||
    !sameStrings(classification.targetColorIds, policy.targetColorIds) ||
    classified.length !== policy.parentPartCount ||
    new Set(classified).size !== classified.length ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      "Real-build semantic color policy must bind one exact document roster, classification, and self commitment.",
    );
  return policy;
}

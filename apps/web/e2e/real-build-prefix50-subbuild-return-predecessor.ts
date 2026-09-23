import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { ownData } from "./real-build-prefix50-exact-compiler-foundation";
import {
  realBuildPrefix50ProjectionCommitment,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50ChildSubBuildWindow,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import { requireRealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair";
import { isolateRealBuildPrefix50DetachedSubBuild } from "./real-build-prefix50-subbuild-state";
import {
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_CHILD_PATH,
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_MEMBERS,
  type RealBuildPrefix50Step43CombinedDraft,
  type RealBuildPrefix50Step43ReturnPredecessor,
  type RealBuildPrefix50Step43ReturnPredecessorMintInput,
  type RealBuildPrefix50SubBuildReturnPartRow,
} from "./real-build-prefix50-subbuild-return-contract";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const PART_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const evidenceByPredecessor = new WeakMap<
  object,
  RealBuildPrefix50Step43ReturnPredecessorEvidence
>();

export interface RealBuildPrefix50Step43ReturnPredecessorEvidence {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly window: RealBuildPrefix50ChildSubBuildWindow;
  readonly combinedDraft: RealBuildPrefix50Step43CombinedDraft;
  readonly ordinalPartRows: readonly RealBuildPrefix50SubBuildReturnPartRow[];
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly step41RepairCommitment: `sha256:${string}`;
  readonly step42RepairCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly sourceDocumentCommitment: `sha256:${string}`;
  readonly predecessorCommitment: `sha256:${string}`;
  readonly allowSyntheticPartIdentity: boolean;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function requireDigest(value: unknown, label: string): `sha256:${string}` {
  if (typeof value !== "string" || !SHA256.test(value))
    throw new TypeError(`${label} must be an exact sha256 digest.`);
  return value as `sha256:${string}`;
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function requireExactWindow(
  projection: RealBuildPrefix50VerifiedProjection,
  value: unknown,
): RealBuildPrefix50ChildSubBuildWindow {
  const expected = projection.childSubBuildWindow;
  if (
    expected === null ||
    value !== expected ||
    expected.firstOccurrenceOrdinal !== 258 ||
    expected.lastOccurrenceOrdinal !== 280 ||
    expected.entryPrintedStepNumber !== 38 ||
    expected.lastPhysicalPrintedStepNumber !== 43 ||
    expected.returnPrintedStepNumber !== 44 ||
    expected.precedingPhaseSequence !== 71 ||
    expected.followingPhaseSequence !== 72 ||
    expected.sourceStructuralEventSequence !== 8 ||
    expected.parentStepUuid !== "c02cc03b-119d-4615-8619-4b12fd9ccf78" ||
    !samePath(expected.parentSubBuildPath, [REAL_BUILD_PREFIX50_SUBBUILD_RETURN_CHILD_PATH[0]]) ||
    expected.childSubBuildUuid !== REAL_BUILD_PREFIX50_SUBBUILD_RETURN_CHILD_PATH[1] ||
    expected.sourceStructuralEventDigest !==
      "sha256:4a4a56a9a4a802601d2fff37d8cc788cfd479e5573bf68d9013bf2aecca9f9ad" ||
    expected.memberCommitment.rows !== 23 ||
    expected.memberCommitment.bytes !== 2_141 ||
    expected.memberCommitment.digest !==
      "sha256:4944f0b5ef959fc73471c1dc9bcad76ed7b47aec0f74b76cf2d55a85f7cd725c" ||
    !samePath(expected.childSubBuildPath, REAL_BUILD_PREFIX50_SUBBUILD_RETURN_CHILD_PATH)
  )
    throw new TypeError("Prefix-50 return requires the exact branded set-6651557 child window.");
  return expected;
}

function requireDraft(value: unknown): RealBuildPrefix50Step43CombinedDraft {
  const label = "Prefix-50 step-43 combined draft";
  exactKeys(
    value,
    [
      "authority",
      "completedPrintedStep",
      "document",
      "documentHash",
      "schemaVersion",
      "sourceSetId",
    ],
    label,
  );
  const draft = value as RealBuildPrefix50Step43CombinedDraft;
  if (
    draft.schemaVersion !== "lego.real-build-prefix50-step43-combined-draft/1" ||
    draft.authority !== "none" ||
    draft.sourceSetId !== "6651557" ||
    draft.completedPrintedStep !== 43 ||
    draft.document.parts.length !== 280 ||
    draft.document.steps.length !== 43 ||
    draft.document.connections.length > 4_096 ||
    draft.document.steps.some(({ index }, stepIndex) => index !== stepIndex) ||
    requireDigest(draft.documentHash, `${label}.documentHash`) !==
      documentStructuralHash(draft.document)
  )
    throw new TypeError(`${label} must bind the exact authority-free 280-part/43-step document.`);
  return draft;
}

function requireRows(
  projection: RealBuildPrefix50VerifiedProjection,
  document: BrickDocumentV1,
  value: unknown,
  allowSyntheticPartIdentity: boolean,
): readonly RealBuildPrefix50SubBuildReturnPartRow[] {
  if (!Array.isArray(value) || value.length !== REAL_BUILD_PREFIX50_SUBBUILD_RETURN_MEMBERS.length)
    throw new TypeError("Prefix-50 return requires exactly 23 ordinal-to-part-ID rows.");
  const partById = new Map(document.parts.map((part) => [part.id, part] as const));
  const seen = new Set<string>();
  const rows = value.map((unsafeRow, index) => {
    const [ordinal, printedStepNumber, phaseSequence, phaseMemberOrdinal] =
      REAL_BUILD_PREFIX50_SUBBUILD_RETURN_MEMBERS[index]!;
    exactKeys(unsafeRow, ["ordinal", "partId"], `Prefix-50 return row ${index}`);
    const row = unsafeRow as RealBuildPrefix50SubBuildReturnPartRow;
    const occurrence = projection.occurrences[ordinal - 1];
    const part = partById.get(row.partId);
    const step = document.steps[printedStepNumber - 1];
    if (
      row.ordinal !== ordinal ||
      typeof row.partId !== "string" ||
      !PART_ID.test(row.partId) ||
      seen.has(row.partId) ||
      occurrence?.ordinal !== ordinal ||
      occurrence.printedStepNumber !== printedStepNumber ||
      occurrence.phaseSequence !== phaseSequence ||
      occurrence.phaseMemberOrdinal !== phaseMemberOrdinal ||
      !samePath(occurrence.subBuildPath, REAL_BUILD_PREFIX50_SUBBUILD_RETURN_CHILD_PATH) ||
      part === undefined ||
      (!allowSyntheticPartIdentity &&
        (part.catalogPartId !== occurrence.partIdentity.reconciledCatalogPartId ||
          part.colorId !== occurrence.colorId)) ||
      part.stepId !== step?.id ||
      step.partIds.filter((partId) => partId === row.partId).length !== 1
    )
      throw new TypeError(
        `Prefix-50 return row ${index} does not bind exact occurrence ${ordinal}, source phase, identity, color, and BuildStep membership.`,
      );
    seen.add(row.partId);
    return deepFreeze({ ordinal, partId: row.partId });
  });
  const childStepPartIds = document.steps.slice(37, 43).flatMap(({ partIds }) => partIds);
  if (
    childStepPartIds.length !== rows.length ||
    childStepPartIds.some((partId) => !seen.has(partId))
  )
    throw new TypeError(
      "Prefix-50 return requires printed steps 38..43 to contain exactly the 23 child parts.",
    );
  return deepFreeze(rows);
}

function mintValidated(
  input: Omit<RealBuildPrefix50Step43ReturnPredecessorMintInput, "step42_43SourceRepairProof">,
  repairCommitments: Readonly<{
    step41: `sha256:${string}`;
    step42: `sha256:${string}`;
    step42_43: `sha256:${string}`;
  }>,
  allowSyntheticPartIdentity: boolean,
): RealBuildPrefix50Step43ReturnPredecessor {
  const projection = requireRealBuildPrefix50VerifiedProjectionValue(input.projection);
  if (projection.sourceSetId !== "6651557")
    throw new TypeError("Prefix-50 return predecessor is scoped only to exact source set 6651557.");
  const window = requireExactWindow(projection, input.window);
  const draft = requireDraft(input.combinedDraft);
  const rows = requireRows(
    projection,
    draft.document,
    input.ordinalPartRows,
    allowSyntheticPartIdentity,
  );
  const childPartIds = rows.map(({ partId }) => partId);
  const detached = isolateRealBuildPrefix50DetachedSubBuild({
    document: draft.document,
    childPartIds,
    completedPrintedStep: 43,
  });
  const detachedStateCommitment = requireDigest(
    input.detachedStateCommitment,
    "Prefix-50 return predecessor.detachedStateCommitment",
  );
  if (
    detached.commitment !== detachedStateCommitment ||
    detached.combinedDocumentHash !== draft.documentHash ||
    detached.parentPartCount !== 257 ||
    detached.childPartCount !== 23
  )
    throw new TypeError(
      "Prefix-50 return predecessor does not match its exact Step-43 detached-state commitment and 257/23 split.",
    );
  const projectionCommitment = realBuildPrefix50ProjectionCommitment(projection);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step43-return-predecessor-evidence/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    completedPrintedStep: 43 as const,
    projectionCommitment,
    childSubBuildWindowCommitment: canonicalDigest(window),
    sourceMemberRowsCommitment: canonicalDigest(rows),
    detachedStateCommitment,
    step41RepairCommitment: repairCommitments.step41,
    step42RepairCommitment: repairCommitments.step42,
    step42_43RepairCommitment: repairCommitments.step42_43,
    sourceDocumentHash: detached.combinedDocumentHash,
    sourceDocumentCommitment: canonicalDigest(draft.document),
  };
  const evidence: RealBuildPrefix50Step43ReturnPredecessorEvidence = deepFreeze({
    projection,
    window,
    combinedDraft: draft,
    ordinalPartRows: rows,
    ...body,
    predecessorCommitment: canonicalDigest(body),
    allowSyntheticPartIdentity,
  });
  const predecessor = Object.freeze({
    schemaVersion: "lego.real-build-prefix50-step43-return-predecessor/1" as const,
  });
  evidenceByPredecessor.set(predecessor, evidence);
  return predecessor;
}

export function mintRealBuildPrefix50Step43ReturnPredecessor(
  unsafeInput: RealBuildPrefix50Step43ReturnPredecessorMintInput,
): RealBuildPrefix50Step43ReturnPredecessor {
  exactKeys(
    unsafeInput,
    [
      "combinedDraft",
      "detachedStateCommitment",
      "ordinalPartRows",
      "projection",
      "step42_43SourceRepairProof",
      "window",
    ],
    "Prefix-50 Step-43 return-predecessor input",
  );
  const projection = requireRealBuildPrefix50VerifiedProjectionValue(
    ownData(
      unsafeInput,
      "projection",
      "Prefix-50 Step-43 return-predecessor input",
    ) as RealBuildPrefix50VerifiedProjection,
  );
  const repair = requireRealBuildPrefix50Step42_43SourceRepairProof(
    ownData(
      unsafeInput,
      "step42_43SourceRepairProof",
      "Prefix-50 Step-43 return-predecessor input",
    ),
  );
  const projectionCommitment = realBuildPrefix50ProjectionCommitment(projection);
  if (repair.projectionCommitment !== projectionCommitment)
    throw new TypeError(
      "Prefix-50 Step-43 return predecessor requires the exact opaque Step-41/42/43 repair chain for this projection.",
    );
  return mintValidated(
    {
      projection,
      window: ownData(
        unsafeInput,
        "window",
        "Prefix-50 Step-43 return-predecessor input",
      ) as RealBuildPrefix50ChildSubBuildWindow,
      combinedDraft: ownData(
        unsafeInput,
        "combinedDraft",
        "Prefix-50 Step-43 return-predecessor input",
      ) as RealBuildPrefix50Step43CombinedDraft,
      ordinalPartRows: ownData(
        unsafeInput,
        "ordinalPartRows",
        "Prefix-50 Step-43 return-predecessor input",
      ) as readonly RealBuildPrefix50SubBuildReturnPartRow[],
      detachedStateCommitment: ownData(
        unsafeInput,
        "detachedStateCommitment",
        "Prefix-50 Step-43 return-predecessor input",
      ) as `sha256:${string}`,
    },
    {
      step41: repair.step41RepairCommitment,
      step42: repair.step42RepairCommitment,
      step42_43: repair.repairCommitment,
    },
    false,
  );
}

export function requireRealBuildPrefix50Step43ReturnPredecessor(
  value: unknown,
): RealBuildPrefix50Step43ReturnPredecessorEvidence {
  const evidence =
    value !== null && typeof value === "object" ? evidenceByPredecessor.get(value) : undefined;
  if (evidence === undefined)
    throw new TypeError(
      "Prefix-50 return enumeration requires the exact runtime-branded Step-43 predecessor; caller drafts and predecessor clones carry no authority.",
    );
  if (
    evidence.sourceDocumentHash !== documentStructuralHash(evidence.combinedDraft.document) ||
    evidence.sourceDocumentCommitment !== canonicalDigest(evidence.combinedDraft.document)
  )
    throw new TypeError(
      "Prefix-50 Step-43 predecessor document changed after its opaque proof was minted.",
    );
  return evidence;
}

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";

export const __testOnlyPredecessor: Readonly<{
  mintSynthetic?: (
    input: Omit<RealBuildPrefix50Step43ReturnPredecessorMintInput, "step42_43SourceRepairProof">,
  ) => RealBuildPrefix50Step43ReturnPredecessor;
}> = deepFreeze(
  TEST_MODE
    ? {
        mintSynthetic: (
          input: Omit<
            RealBuildPrefix50Step43ReturnPredecessorMintInput,
            "step42_43SourceRepairProof"
          >,
        ) =>
          mintValidated(
            input,
            {
              step41: canonicalDigest("test-step41-repair"),
              step42: canonicalDigest("test-step42-repair"),
              step42_43: canonicalDigest("test-step42-43-repair"),
            },
            true,
          ),
      }
    : {},
);

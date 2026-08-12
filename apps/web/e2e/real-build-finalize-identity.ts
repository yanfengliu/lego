import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type {
  RealBuildOptions,
  RealBuildPanelSpec,
  RealBuildStepReport,
  StepFailure,
} from "./real-build-safety";
import type { RealBuildIdentityBinding } from "./real-build-browser-output";

type CanonicalDocument = BrickDocumentV1;
type CanonicalPart = BrickDocumentV1["parts"][number];
type Transform = CanonicalPart["transform"];

interface ExpectedIdentity {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly officialTransform: Transform;
  readonly transform: Transform | null;
  readonly transformAuthority: "searched-report" | "fixed-ledger";
}

const completionFailure = (message: string, stepNumber?: number): StepFailure => ({
  code: "run-incomplete",
  stage: "validation",
  ...(stepNumber === undefined ? {} : { stepNumber }),
  message,
});

const exactTransform = (actual: Transform, expected: Transform): boolean =>
  actual.orientationId === expected.orientationId &&
  actual.positionLdu.length === 3 &&
  actual.positionLdu.every((coordinate, axis) => coordinate === expected.positionLdu[axis]);

function exactTransformMultiset(
  actual: readonly Transform[],
  expected: readonly Transform[],
): boolean {
  if (actual.length !== expected.length) return false;
  const matchedActual = new Set<number>();
  return expected.every((expectedTransform) => {
    const actualIndex = actual.findIndex(
      (actualTransform, index) =>
        !matchedActual.has(index) && exactTransform(actualTransform, expectedTransform),
    );
    if (actualIndex === -1) return false;
    matchedActual.add(actualIndex);
    return true;
  });
}

const reportTransform = (
  report: RealBuildStepReport | undefined,
  pieceIndex: number,
): Transform | null => {
  const piece = report?.pieces[pieceIndex];
  return piece?.positionLdu === null || piece?.positionLdu === undefined
    ? null
    : { positionLdu: piece.positionLdu, orientationId: piece.orientationId! };
};

function panelIdentities(
  panel: RealBuildPanelSpec,
  report: RealBuildStepReport | undefined,
): readonly ExpectedIdentity[] {
  if (panel.action.kind === "transition") return [];
  if (panel.action.kind === "multi-build-copy") {
    return panel.action.copies.map((piece) => ({
      identityKey: piece.identityKey,
      stepNumber: panel.stepNumber,
      designId: piece.designId,
      materialId: piece.materialId,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
      officialTransform: piece.transform,
      transform: piece.transform,
      transformAuthority: "fixed-ledger" as const,
    }));
  }
  return [
    ...panel.pieces.map((piece, index) => ({
      identityKey: piece.identityKey,
      stepNumber: panel.stepNumber,
      designId: piece.designId,
      materialId: piece.materialId,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
      officialTransform: piece.expectedTransform,
      transform: reportTransform(report, index),
      transformAuthority: "searched-report" as const,
    })),
    ...panel.omittedPieces.map((piece) => ({
      identityKey: piece.identityKey,
      stepNumber: panel.stepNumber,
      designId: piece.designId,
      materialId: piece.materialId,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
      officialTransform: piece.transform,
      transform: piece.transform,
      transformAuthority: "fixed-ledger" as const,
    })),
  ];
}

function expectedIdentities(input: {
  readonly options: RealBuildOptions;
  readonly reports: readonly RealBuildStepReport[];
}): readonly ExpectedIdentity[] {
  const reportByStep = new Map(input.reports.map((report) => [report.stepNumber, report]));
  return input.options.panels
    .filter(({ stepNumber }) => stepNumber <= input.options.lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .flatMap((panel) => panelIdentities(panel, reportByStep.get(panel.stepNumber)));
}

const unorderedIdentityGroupKey = (identity: ExpectedIdentity): string =>
  JSON.stringify([
    identity.stepNumber,
    identity.designId,
    identity.materialId,
    identity.catalogPartId,
    identity.colorId,
  ]);

const bindingAndPartMatch = (
  identity: ExpectedIdentity,
  binding: RealBuildIdentityBinding | undefined,
  part: CanonicalPart | undefined,
  expectedStepId: string | undefined,
): boolean =>
  binding !== undefined &&
  binding.stepNumber === identity.stepNumber &&
  binding.designId === identity.designId &&
  binding.materialId === identity.materialId &&
  binding.catalogPartId === identity.catalogPartId &&
  binding.colorId === identity.colorId &&
  part !== undefined &&
  part.stepId === expectedStepId &&
  part.catalogPartId === identity.catalogPartId &&
  part.colorId === identity.colorId;

/**
 * Binds official identity metadata and fixed placements without turning the
 * official model into a visual-search oracle. Searched transforms must survive
 * report -> identity binding -> canonical part exactly; target-frame
 * equivalence remains a separate, explicit completion failure.
 */
export function auditRealBuildIdentityBindings(input: {
  readonly options: RealBuildOptions;
  readonly document: CanonicalDocument;
  readonly reports: readonly RealBuildStepReport[];
  readonly bindings: readonly RealBuildIdentityBinding[];
}): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  const expected = expectedIdentities(input);
  const expectedByIdentity = new Map(expected.map((identity) => [identity.identityKey, identity]));
  const bindingByIdentity = new Map(
    input.bindings.map((binding) => [binding.identityKey, binding]),
  );
  const uniquePartBindings = new Set(input.bindings.map(({ partId }) => partId));
  if (
    expectedByIdentity.size !== expected.length ||
    bindingByIdentity.size !== input.bindings.length ||
    uniquePartBindings.size !== input.bindings.length ||
    input.bindings.length !== expected.length
  ) {
    failures.push(
      completionFailure(
        `Trusted ledger expects ${expected.length}/${expectedByIdentity.size} unique identities, while browser ` +
          `output binds ${input.bindings.length}/${bindingByIdentity.size} identities to ` +
          `${uniquePartBindings.size} unique canonical parts.`,
      ),
    );
  }

  const partById = new Map(input.document.parts.map((part) => [part.id, part]));
  const stepIdByNumber = new Map(
    input.document.steps.map((step) => [step.index + 1, step.id] as const),
  );
  const expectedGroupSizes = new Map<string, number>();
  for (const identity of expected) {
    const key = unorderedIdentityGroupKey(identity);
    expectedGroupSizes.set(key, (expectedGroupSizes.get(key) ?? 0) + 1);
  }

  const auditedGroups = new Set<string>();
  for (const identity of expected) {
    const groupKey = unorderedIdentityGroupKey(identity);
    const unorderedGroup = (expectedGroupSizes.get(groupKey) ?? 0) > 1;
    if (unorderedGroup && auditedGroups.has(groupKey)) continue;
    if (unorderedGroup) auditedGroups.add(groupKey);
    const group = unorderedGroup
      ? expected.filter((candidate) => unorderedIdentityGroupKey(candidate) === groupKey)
      : [identity];
    const groupBindingsValid = group.every((candidate) => {
      const binding = bindingByIdentity.get(candidate.identityKey);
      return bindingAndPartMatch(
        candidate,
        binding,
        binding === undefined ? undefined : partById.get(binding.partId),
        stepIdByNumber.get(candidate.stepNumber),
      );
    });
    const expectedTransforms = group
      .map(({ transform }) => transform)
      .filter((transform): transform is Transform => transform !== null);
    const actualTransforms = group
      .map((candidate) => {
        const binding = bindingByIdentity.get(candidate.identityKey);
        return binding === undefined ? null : (partById.get(binding.partId)?.transform ?? null);
      })
      .filter((transform): transform is Transform => transform !== null);
    if (
      !groupBindingsValid ||
      expectedTransforms.length !== group.length ||
      !exactTransformMultiset(actualTransforms, expectedTransforms)
    ) {
      failures.push(
        completionFailure(
          `${unorderedGroup ? "Unordered identity group" : "Identity"} ` +
            `${group.map(({ identityKey }) => identityKey).join(", ")} at printed step ${identity.stepNumber} ` +
            `does not bind its exact ${group.some(({ transformAuthority }) => transformAuthority === "searched-report") ? "searched-report" : "fixed-ledger"} ` +
            `transform multiset, design/material/catalog/color metadata, and canonical step ownership. Expected ` +
            `${JSON.stringify(expectedTransforms)}; observed ${JSON.stringify(actualTransforms)}.`,
          identity.stepNumber,
        ),
      );
    }
  }

  const searchedFrameMismatches = expected.filter(
    ({ transformAuthority, transform, officialTransform }) =>
      transformAuthority === "searched-report" &&
      transform !== null &&
      !exactTransform(transform, officialTransform),
  );
  if (searchedFrameMismatches.length > 0) {
    const first = searchedFrameMismatches[0]!;
    failures.push({
      code: "official-frame-calibration-missing",
      stage: "validation",
      stepNumber: first.stepNumber,
      message:
        `${searchedFrameMismatches.length} visually searched placement(s) differ from their raw calibrated ` +
        `official-model transforms; the first is ${first.identityKey} at printed step ${first.stepNumber}: ` +
        `searched ${JSON.stringify(first.transform)}, official ${JSON.stringify(first.officialTransform)}. ` +
        `The repository has no independently proven proper world-frame mapping from the booklet search branch ` +
        `to the official target. The exact valid candidate bytes remain diagnostic, but target equivalence and ` +
        `completion are unavailable; do not treat a reflection as a frame or use the official transforms to ` +
        `choose the visual-search answer.`,
    });
  }

  const expectedPartIdsByStep = new Map<number, string[]>();
  for (const binding of input.bindings) {
    const ids = expectedPartIdsByStep.get(binding.stepNumber) ?? [];
    ids.push(binding.partId);
    expectedPartIdsByStep.set(binding.stepNumber, ids);
  }
  for (const report of input.reports) {
    const step = input.document.steps.find(({ index }) => index === report.stepNumber - 1);
    const expectedPartIds = (expectedPartIdsByStep.get(report.stepNumber) ?? []).sort();
    const actualPartIds = [...(step?.partIds ?? [])].sort();
    if (
      expectedPartIds.length !== actualPartIds.length ||
      expectedPartIds.some((partId, index) => partId !== actualPartIds[index])
    ) {
      failures.push(
        completionFailure(
          `Canonical step ${report.stepNumber} part ownership does not equal its exact ledger identity binding.`,
          report.stepNumber,
        ),
      );
    }
  }
  return failures;
}

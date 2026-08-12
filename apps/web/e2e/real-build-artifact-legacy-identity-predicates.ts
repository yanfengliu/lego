import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import type { FrozenLegacyIdentityBindingV2 } from "./real-build-artifact-legacy-browser-v2";
import type { RealBuildPanelSpec, RealBuildStepReport } from "./real-build-safety";

interface ExpectedIdentity {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly officialTransform: RigidTransform;
  readonly transform: RigidTransform | null;
  readonly transformAuthority: "searched-report" | "fixed-ledger";
}

export interface FrozenLegacyFrameMismatch {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly transform: RigidTransform;
  readonly officialTransform: RigidTransform;
}

const exactTransform = (actual: RigidTransform, expected: RigidTransform): boolean =>
  actual.orientationId === expected.orientationId &&
  actual.positionLdu.length === 3 &&
  actual.positionLdu.every((coordinate, axis) => coordinate === expected.positionLdu[axis]);

function exactTransformMultiset(
  actual: readonly RigidTransform[],
  expected: readonly RigidTransform[],
): boolean {
  if (actual.length !== expected.length) return false;
  const used = new Set<number>();
  return expected.every((wanted) => {
    const index = actual.findIndex(
      (candidate, candidateIndex) => !used.has(candidateIndex) && exactTransform(candidate, wanted),
    );
    if (index < 0) return false;
    used.add(index);
    return true;
  });
}

function reportTransform(
  report: RealBuildStepReport | undefined,
  index: number,
): RigidTransform | null {
  const piece = report?.pieces[index];
  return piece?.positionLdu === null || piece?.positionLdu === undefined
    ? null
    : { positionLdu: piece.positionLdu, orientationId: piece.orientationId! };
}

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

const groupKey = (identity: ExpectedIdentity): string =>
  JSON.stringify([
    identity.stepNumber,
    identity.designId,
    identity.materialId,
    identity.catalogPartId,
    identity.colorId,
  ]);

function fail(message: string): never {
  throw new TypeError(
    `Legacy identity/document projection fails its frozen /2 predicate: ${message}.`,
  );
}

/** Frozen generation-2 identity/binding/document predicates; returns only raw frame mismatches. */
export function assertFrozenLegacyIdentityProjectionV2(input: {
  readonly panels: readonly RealBuildPanelSpec[];
  readonly reports: readonly RealBuildStepReport[];
  readonly document: BrickDocumentV1;
  readonly bindings: readonly FrozenLegacyIdentityBindingV2[];
}): readonly FrozenLegacyFrameMismatch[] {
  const reportByStep = new Map(input.reports.map((report) => [report.stepNumber, report]));
  const expected = input.panels.flatMap((panel) =>
    panelIdentities(panel, reportByStep.get(panel.stepNumber)),
  );
  const expectedById = new Map(expected.map((identity) => [identity.identityKey, identity]));
  const bindingById = new Map(input.bindings.map((binding) => [binding.identityKey, binding]));
  const bindingPartIds = new Set(input.bindings.map(({ partId }) => partId));
  const documentPartIds = new Set(input.document.parts.map(({ id }) => id));
  if (
    expectedById.size !== expected.length ||
    bindingById.size !== input.bindings.length ||
    bindingPartIds.size !== input.bindings.length ||
    input.bindings.length !== expected.length ||
    documentPartIds.size !== input.document.parts.length ||
    input.document.parts.length !== expected.length
  ) {
    fail("expected identities, bindings, and canonical parts are not unique and one-for-one");
  }
  const partById = new Map(input.document.parts.map((part) => [part.id, part]));
  const stepIdByNumber = new Map(
    input.document.steps.map((step) => [step.index + 1, step.id] as const),
  );
  const groups = new Map<string, ExpectedIdentity[]>();
  for (const identity of expected) {
    const identities = groups.get(groupKey(identity)) ?? [];
    identities.push(identity);
    groups.set(groupKey(identity), identities);
  }
  for (const group of groups.values()) {
    const expectedTransforms = group.map(({ transform }) => transform);
    if (expectedTransforms.some((transform) => transform === null)) {
      fail(
        `identity group ${group.map(({ identityKey }) => identityKey).join(", ")} lacks a transform`,
      );
    }
    const actualTransforms: RigidTransform[] = [];
    for (const identity of group) {
      const binding = bindingById.get(identity.identityKey);
      const part = binding === undefined ? undefined : partById.get(binding.partId);
      if (
        binding === undefined ||
        binding.stepNumber !== identity.stepNumber ||
        binding.designId !== identity.designId ||
        binding.materialId !== identity.materialId ||
        binding.catalogPartId !== identity.catalogPartId ||
        binding.colorId !== identity.colorId ||
        part === undefined ||
        part.stepId !== stepIdByNumber.get(identity.stepNumber) ||
        part.catalogPartId !== identity.catalogPartId ||
        part.colorId !== identity.colorId
      ) {
        fail(`identity ${identity.identityKey} changes metadata, part binding, or step ownership`);
      }
      actualTransforms.push(part.transform);
    }
    if (
      !exactTransformMultiset(actualTransforms, expectedTransforms as readonly RigidTransform[])
    ) {
      fail(
        `identity group ${group.map(({ identityKey }) => identityKey).join(", ")} changes its transform multiset`,
      );
    }
  }
  const expectedPartIdsByStep = new Map<number, string[]>();
  for (const binding of input.bindings) {
    const ids = expectedPartIdsByStep.get(binding.stepNumber) ?? [];
    ids.push(binding.partId);
    expectedPartIdsByStep.set(binding.stepNumber, ids);
  }
  for (const report of input.reports) {
    const step = input.document.steps.find(({ index }) => index === report.stepNumber - 1);
    const expectedIds = (expectedPartIdsByStep.get(report.stepNumber) ?? []).sort();
    const actualIds = [...(step?.partIds ?? [])].sort();
    if (
      expectedIds.length !== actualIds.length ||
      expectedIds.some((partId, index) => partId !== actualIds[index])
    ) {
      fail(`printed step ${report.stepNumber} changes its exact canonical part ownership`);
    }
  }
  return expected.flatMap((identity): readonly FrozenLegacyFrameMismatch[] => {
    if (
      identity.transformAuthority !== "searched-report" ||
      identity.transform === null ||
      exactTransform(identity.transform, identity.officialTransform)
    ) {
      return [];
    }
    return [
      {
        identityKey: identity.identityKey,
        stepNumber: identity.stepNumber,
        transform: identity.transform,
        officialTransform: identity.officialTransform,
      },
    ];
  });
}

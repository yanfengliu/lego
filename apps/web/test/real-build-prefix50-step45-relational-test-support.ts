import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  composeRigidTransforms,
  createCollisionWorld,
  createEmptyBrickDocument,
  deepFreeze,
  findCatalogCollisions,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import {
  createPlacementConnectorIndexes,
  discoverIndexedConnections,
} from "../src/assembly/connector-placement-enumeration";
import { enumeratePlacements, type PlacementCandidate } from "../src/assembly/enumerate-placements";
import { occupiedConnectorCapacityClaims } from "../src/connector-capacity";
import {
  type RealBuildPrefix50Step45RelationalResolverInput,
  type RealBuildPrefix50Step45OrdinalPartRow,
} from "../e2e/real-build-prefix50-step45-relational-resolver";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "../e2e/real-build-prefix50-source-placement-repair";
import { prefix50TemporaryOperations } from "../e2e/real-build-prefix50-temporary-placement";
import { compileRealBuildPrefix50ZeroPieceStepCandidate } from "../e2e/real-build-automatic-placement-candidate";
import { snapshot } from "../e2e/real-build-prefix50-exact-compiler-operations";

const CONTEXT = [
  [258, "builtin:plate-1x2-round-end", 440, -98, -86, "proper-m-00nn000p0"],
  [259, "builtin:plate-1x12", 340, -98, -78, "proper-m-00nn000p0"],
  [260, "builtin:plate-1x2-round-end", 240, -98, -86, "proper-m-00nn000p0"],
  [261, "builtin:technic-brick-1x1-axle-hole", 270, -98, -94, "proper-m-00nn000p0"],
  [262, "builtin:plate-1x2-round-end", 380, -98, -86, "proper-m-00nn000p0"],
  [263, "builtin:plate-1x2-round-end", 300, -98, -86, "proper-m-00nn000p0"],
  [264, "builtin:technic-brick-1x2-axle-hole", 340, -98, -94, "proper-m-00pp000p0"],
  [265, "builtin:technic-brick-1x1-axle-hole", 410, -98, -94, "proper-m-00nn000p0"],
  [266, "builtin:bracket-2x2-1x2-vertical-studs", 240, -88, -104, "proper-m-p0000n0p0"],
  [267, "builtin:bracket-2x2-1x2-vertical-studs", 440, -88, -104, "proper-m-p0000n0p0"],
  [268, "builtin:bracket-2x2-1x2-vertical-studs", 380, -88, -104, "proper-m-p0000n0p0"],
  [269, "builtin:bracket-2x2-1x2-vertical-studs", 300, -88, -104, "proper-m-p0000n0p0"],
  [270, "builtin:plate-1x2-round-end", 440, -80, -108, "proper-m-00n0n0n00"],
  [271, "builtin:plate-1x2-round-end", 240, -80, -108, "proper-m-00n0n0n00"],
  [272, "builtin:plate-1x2-round-end", 300, -80, -108, "proper-m-00n0n0n00"],
  [273, "builtin:plate-1x2-round-end", 380, -80, -108, "proper-m-00n0n0n00"],
  [274, "builtin:tile-1x6", 400, -72, -108, "proper-m-00n0n0n00"],
] as const;

const FIXTURE_WORLD_TRANSLATION: RigidTransform = {
  positionLdu: [0, -3_000, 0],
  orientationId: "upright-yaw-0",
};

interface FixtureRow {
  readonly ordinal: number;
  readonly colorId: string;
  readonly partIdentity: { readonly reconciledCatalogPartId: string };
}

function fixtureRow(ordinal: number, catalogPartId: string): FixtureRow {
  const receiverColor =
    ordinal === 261 || ordinal === 265
      ? "builtin:dark-azure"
      : ordinal === 264
        ? "builtin:medium-azure"
        : undefined;
  return {
    ordinal,
    colorId: receiverColor ?? getPartDefinition(catalogPartId)!.availableColorIds[0]!,
    partIdentity: { reconciledCatalogPartId: catalogPartId },
  };
}

function place(
  document: BrickDocumentV1,
  row: FixtureRow,
  transform: RigidTransform,
): BrickDocumentV1 {
  const definition = getPartDefinition(row.partIdentity.reconciledCatalogPartId)!;
  const indexes = createPlacementConnectorIndexes(
    document.parts,
    occupiedConnectorCapacityClaims(document.parts, document.connections),
    definition,
    [transform.orientationId],
  );
  const candidate: PlacementCandidate = {
    catalogPartId: definition.id,
    transform,
    connections: discoverIndexedConnections(indexes, transform, `prefix50-temp-${row.ordinal}`),
    restsOnBuildPlate: false,
  };
  const operations = prefix50TemporaryOperations(document, row, candidate);
  const addPart = operations.find(({ kind }) => kind === "addPart");
  const part = addPart?.kind === "addPart" ? addPart.part : undefined;
  const edges = operations.flatMap((operation) =>
    operation.kind === "addConnection" ? [operation.connection] : [],
  );
  if (
    part === undefined ||
    (row.ordinal !== 258 && candidate.connections.length === 0) ||
    createCollisionWorld(document.parts).findCollisionsWith(part, edges).length !== 0
  ) {
    throw new Error(
      `Step-45 fixture occurrence ${row.ordinal} is not a legal connected placement.`,
    );
  }
  return applyBuildOperations(document, operations);
}

function attachFillerChain(document: BrickDocumentV1): BrickDocumentV1 {
  const fillerCatalogPartId = "builtin:plate-1x4";
  const fillerOrdinals = [
    ...Array.from({ length: 257 }, (_, index) => index + 1),
    275,
    276,
    277,
    278,
    279,
    280,
  ];
  const fillerDefinition = getPartDefinition(fillerCatalogPartId)!;
  const fillerEnumeration = enumeratePlacements(document, fillerCatalogPartId, {
    includeBuildPlate: false,
    allowDetached: false,
    maxDistinctTransforms: 200_000,
  });
  const firstCandidates = fillerEnumeration.candidates
    .filter(
      ({ transform, connections }) =>
        transform.orientationId === "proper-m-00nn000p0" &&
        connections.length > 0 &&
        (connections.every(({ candidatePortId }) => candidatePortId.startsWith("stud:")) ||
          connections.every(({ candidatePortId }) =>
            candidatePortId.startsWith("undersideClutch:"),
          )),
    )
    .sort(
      (left, right) =>
        left.transform.positionLdu[1] - right.transform.positionLdu[1] ||
        left.transform.positionLdu[0] - right.transform.positionLdu[0] ||
        left.transform.positionLdu[2] - right.transform.positionLdu[2],
    );
  let lastDiagnostic = "no candidate visited";
  for (const first of firstCandidates.slice(0, 64)) {
    let trial = applyBuildOperations(
      document,
      prefix50TemporaryOperations(
        document,
        fixtureRow(fillerOrdinals[0]!, fillerCatalogPartId),
        first,
      ),
    );
    let previous = trial.parts.find(({ id }) => id === `prefix50-temp-${fillerOrdinals[0]}`)!;
    const localStep = first.connections.every(({ candidatePortId }) =>
      candidatePortId.startsWith("undersideClutch:"),
    )
      ? -8
      : 8;
    let failed = false;
    for (const ordinal of fillerOrdinals.slice(1)) {
      const transform = composeRigidTransforms(previous.transform, {
        positionLdu: [0, localStep, 0],
        orientationId: "upright-yaw-0",
      });
      const indexes = createPlacementConnectorIndexes(
        trial.parts,
        occupiedConnectorCapacityClaims(trial.parts, trial.connections),
        fillerDefinition,
        [transform.orientationId],
      );
      const connections = discoverIndexedConnections(
        indexes,
        transform,
        `prefix50-temp-${ordinal}`,
      );
      if (
        connections.length === 0 ||
        !connections.some(({ targetPartId }) => targetPartId === previous.id)
      ) {
        failed = true;
        break;
      }
      const candidate: PlacementCandidate = {
        catalogPartId: fillerCatalogPartId,
        transform,
        connections,
        restsOnBuildPlate: false,
      };
      const operations = prefix50TemporaryOperations(
        trial,
        fixtureRow(ordinal, fillerCatalogPartId),
        candidate,
      );
      trial = applyBuildOperations(trial, operations);
      previous = trial.parts.find(({ id }) => id === `prefix50-temp-${ordinal}`)!;
    }
    if (failed) continue;
    const collisions = findCatalogCollisions(trial.parts, trial.connections);
    const report = validateBrickDocument(trial);
    if (collisions.length === 0 && report.documentGloballyValid) {
      return trial;
    }
    lastDiagnostic = `collisions=${collisions.length}, blockers=${report.issues
      .filter(({ severity }) => severity === "blocking")
      .map(({ code }) => code)
      .join(",")}`;
  }
  throw new Error(
    `Step-45 fixture could not attach its bounded 257-part connected filler chain; accepted=${fillerEnumeration.candidates.length}, ports=${[
      ...new Set(
        fillerEnumeration.candidates.flatMap(({ connections }) =>
          connections.map(({ candidatePortId }) => candidatePortId),
        ),
      ),
    ].join(",")}, firstCandidates=${firstCandidates.length}, ${lastDiagnostic}.`,
  );
}

function sourceRepair(
  occurrenceOrdinal: 281 | 282 | 283,
  expectedReceiverOrdinal: 261 | 264 | 265,
  expectedReceiverCatalogPartId: string,
  expectedReceiverColorId: string,
  sourcePositionLdu: readonly [number, number, number],
  repairedPositionLdu: readonly [number, number, number],
  receiverPositionLdu: readonly [number, number, number],
  receiverOrientationId: string,
): RealBuildPrefix50SourcePlacementRepairProposal {
  return {
    schemaVersion: "lego.real-build-prefix50-source-placement-repair/1",
    occurrenceOrdinal,
    printedStepNumber: 45,
    catalogPartId: "builtin:axle-1x3",
    sourceWorldTransform: {
      positionLdu: sourcePositionLdu,
      orientationId: "proper-m-00pp000p0",
    },
    repairedSourceWorldTransform: {
      positionLdu: repairedPositionLdu,
      orientationId: "proper-m-00pp000p0",
    },
    sourceResidualLdu: [0, 0, 0.5],
    expectedReceiverOrdinal,
    expectedReceiverCatalogPartId,
    expectedReceiverColorId,
    expectedReceiverSourceWorldTransform: {
      positionLdu: receiverPositionLdu,
      orientationId: receiverOrientationId,
    },
    expectedReceiverPortId: "axleHole:0",
    expectedCandidatePortId: "axle:2",
    provisionalBasis: "occurrence-scoped-source-residual-awaiting-connector-proof",
  };
}

export const STEP45_TEST_SOURCE_REPAIRS = deepFreeze([
  sourceRepair(
    281,
    265,
    "builtin:technic-brick-1x1-axle-hole",
    "builtin:dark-azure",
    [410, -118, -96.5],
    [410, -118, -96],
    [410, -98, -94],
    "proper-m-00nn000p0",
  ),
  sourceRepair(
    282,
    261,
    "builtin:technic-brick-1x1-axle-hole",
    "builtin:dark-azure",
    [270, -118, -96.5],
    [270, -118, -96],
    [270, -98, -94],
    "proper-m-00nn000p0",
  ),
  sourceRepair(
    283,
    264,
    "builtin:technic-brick-1x2-axle-hole",
    "builtin:medium-azure",
    [340, -118, -96.5],
    [340, -118, -96],
    [340, -98, -94],
    "proper-m-00pp000p0",
  ),
]);

let cached: RealBuildPrefix50Step45RelationalResolverInput | undefined;
let cachedSelectedStep43: BrickDocumentV1 | undefined;

export function step45RelationalTestInput(): RealBuildPrefix50Step45RelationalResolverInput {
  if (cached !== undefined) return cached;
  const base = createEmptyBrickDocument({
    id: "step45-relational",
    name: "Step 45 relational",
    maxParts: 400,
  });
  const steps = Array.from({ length: 43 }, (_, index) => ({
    id: `printed-step-${index + 1}`,
    index,
    name: `Printed step ${index + 1}`,
    partIds: [] as string[],
  }));
  let document: BrickDocumentV1 = { ...base, steps };
  for (const [ordinal, catalogPartId, x, y, z, orientationId] of CONTEXT) {
    document = place(
      document,
      fixtureRow(ordinal, catalogPartId),
      composeRigidTransforms(FIXTURE_WORLD_TRANSLATION, {
        positionLdu: [x, y, z],
        orientationId,
      }),
    );
  }
  document = attachFillerChain(document);
  cachedSelectedStep43 = deepFreeze(document);
  document = compileRealBuildPrefix50ZeroPieceStepCandidate({
    documentSnapshot: snapshot(cachedSelectedStep43),
    printedStepNumber: 44,
    printedStep: {
      printedStepNumber: 44,
      name: "Printed step 44",
      sourceActionDigest: `sha256:${"4".repeat(64)}`,
    },
  }).document;
  const ordinalPartRows: RealBuildPrefix50Step45OrdinalPartRow[] = Array.from(
    { length: 280 },
    (_, index) => ({ ordinal: index + 1, partId: `prefix50-temp-${index + 1}` }),
  );
  cached = deepFreeze({
    selectedStep44Document: document,
    selectedStep44EvidenceCommitment: `sha256:${"a".repeat(64)}`,
    ordinalPartRows,
    sourceRepairs: STEP45_TEST_SOURCE_REPAIRS,
  });
  return cached;
}

export function step45RelationalSelectedStep43Document(): BrickDocumentV1 {
  step45RelationalTestInput();
  return cachedSelectedStep43!;
}

export function translateStep45Input(
  input: RealBuildPrefix50Step45RelationalResolverInput,
  translation: readonly [number, number, number],
): RealBuildPrefix50Step45RelationalResolverInput {
  const root: RigidTransform = { positionLdu: translation, orientationId: "upright-yaw-0" };
  return deepFreeze({
    ...input,
    selectedStep44Document: {
      ...input.selectedStep44Document,
      parts: input.selectedStep44Document.parts.map((part) => ({
        ...part,
        transform: composeRigidTransforms(root, part.transform),
      })),
    },
  });
}

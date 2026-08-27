import { BUILTIN_CATALOG_VERSION, getPartDefinition } from "@lego-studio/catalog";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  parseOfficialModelIndex,
  pieceEvidenceDigest,
  REAL_BUILD_ACTION_LEDGER_GENERATOR,
  REAL_BUILD_ACTION_LEDGER_SCHEMA,
  stepPanelEvidenceDigest,
  transitionClassificationEvidenceDigest,
  type BuilderCanonicalCalibration,
  type CoverageLedgerClaim,
  type LedgerCopyIdentity,
  type LedgerPieceIdentity,
  type LedgerStep,
  type RealBuildActionLedger,
  type TransitionClassificationEvidence,
} from "../e2e/real-build-ledger";
import { resolveBuilderBoneTransform } from "../e2e/real-build-official";
import { REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";
import { builderCuboidGeometry } from "./real-build-frame-test-fixture";

export interface RealBuildLedgerTestFixture {
  readonly officialModelBytes: Uint8Array;
  readonly rawOfficial: ReturnType<typeof parseOfficialModelIndex>;
  readonly official: ReturnType<typeof parseOfficialModelIndex>;
  readonly calibration: BuilderCanonicalCalibration;
  readonly builderCalibrationBytes: Uint8Array;
  readonly ledger: RealBuildActionLedger;
  readonly ledgerDigest: string;
  readonly pdfDigest: string;
  readonly coverageDigest: string;
  readonly manifestDigest: string;
  readonly sourceArtReboundDigest: string;
  readonly builderCalibrationDigest: string;
  readonly builderGeometryBytes: Buffer;
  readonly builderGeometryDigest: string;
  readonly transitionClassificationsDigest: string;
  readonly transitionClassificationsByStep: Readonly<
    Record<number, TransitionClassificationEvidence>
  >;
  readonly coverageByCallout: Readonly<Record<string, CoverageLedgerClaim>>;
  readonly panelEvidenceByStep: Readonly<
    Record<number, { readonly pageNumber: number; readonly digest: string }>
  >;
}

/** Rebinds a test ledger to exactly one current /4 prefix after a test mutates its rows. */
export function realBuildLedgerPrefix(
  ledger: RealBuildActionLedger,
  requestedLastStep: number,
  steps: readonly LedgerStep[] = ledger.steps.slice(0, requestedLastStep),
): RealBuildActionLedger {
  const directPieceCount = steps.reduce(
    (count, step) =>
      count + (step.action.kind === "place-callouts" ? step.action.pieces.length : 0),
    0,
  );
  const transitionStepCount = steps.filter(({ action }) => action.kind === "transition").length;
  return {
    ...ledger,
    steps,
    provenance: {
      ...ledger.provenance,
      requestedLastStep,
      alignedThroughStep: steps.length,
      directPieceCount,
      transitionStepCount,
      refusals: ledger.provenance.refusals.filter(
        ({ stepNumber }) => stepNumber <= requestedLastStep,
      ),
    },
  };
}

const FIXTURE_CASE_BRICK_REFS = ["brick-a", "brick-b", "cal-c", "cal-d"] as const;

function resolvedFixtureTransform(
  rawOfficial: ReturnType<typeof parseOfficialModelIndex>,
  brickRef: string,
): { readonly positionLdu: readonly [number, number, number]; readonly orientationId: string } {
  const resolved = resolveBuilderBoneTransform(rawOfficial.bricks[brickRef]!.builderTransform!);
  if (resolved.transform === null) {
    throw new TypeError(`Fixture Bone ${brickRef} does not resolve: ${resolved.failure}`);
  }
  return resolved.transform;
}

export function realBuildLedgerTestFixture(): RealBuildLedgerTestFixture {
  const physicalBrick = (brickRef: string, transformation: string): string =>
    `<Brick uuid="${brickRef}" designID="3005" itemNos="300501">` +
    `<Part uuid="part-${brickRef}" designID="3005" materials="1">` +
    `<Bone uuid="bone-${brickRef}" transformation="${transformation}"/>` +
    `</Part></Brick>`;
  const instructions =
    `<BuildingInstructions>` +
    `<BuildingInstruction name="Building Instruction ##B" uuid="fixture-instruction">` +
    `<Steps><Step uuid="fixture-root">` +
    `<SubBuild uuid="fixture-master"><Step uuid="fixture-master-step">` +
    `<In brickRef="brick-a"/></Step><CameraFittingRange range="0,1"/>` +
    `<StartImageView uuid="fixture-start"><Added/><Removed/></StartImageView></SubBuild>` +
    `<MultiBuild name="fixture-copy" masterSubBuildRef="fixture-master">` +
    `<MultiBuildBrick originalBrickRef="brick-a" actualBrickRef="brick-b"/></MultiBuild>` +
    `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps>` +
    `</BuildingInstruction>` +
    `<BuildingInstruction name="Group #IX" uuid="fixture-aggregate"><Steps>` +
    `<Step uuid="fixture-aggregate-step"><In brickRef="brick-a"/><In brickRef="brick-b"/>` +
    `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps>` +
    `</BuildingInstruction></BuildingInstructions>` +
    `<BIGraph><BINode uuid="fixture-primary-node" buildingInstructionRef="fixture-instruction"/>` +
    `<BINode uuid="fixture-aggregate-node" buildingInstructionRef="fixture-aggregate"/>` +
    `<Dependency predecessorRef="fixture-primary-node" successorRef="fixture-aggregate-node"/>` +
    `</BIGraph>`;
  const officialModelBytes = new TextEncoder().encode(
    `<Root><Bricks>` +
      physicalBrick("brick-a", "1,0,0,0,1,0,0,0,1,0,0,0") +
      physicalBrick("brick-b", "0,0,1,0,1,0,-1,0,0,0.8,0,0") +
      physicalBrick("cal-c", "-1,0,0,0,1,0,0,0,-1,1.6,0,0") +
      physicalBrick("cal-d", "0,0,-1,0,1,0,1,0,0,2.4,0,0") +
      `</Bricks>${instructions}</Root>`,
  );
  const rawOfficial = parseOfficialModelIndex(officialModelBytes);
  const catalogToBuilderLocalTransform = {
    positionLdu: [0, 0, 0] as const,
    orientationId: "upright-yaw-0",
  };
  const builderGeometry = builderCuboidGeometry(
    "builtin:brick-1x1",
    catalogToBuilderLocalTransform,
  );
  const definition = getPartDefinition("builtin:brick-1x1");
  if (definition === undefined) {
    throw new TypeError("Fixture catalog part builtin:brick-1x1 is absent.");
  }
  const catalogDefinitionDigest = sha256Digest(JSON.stringify(definition));
  const catalogGeometryDigest = sha256Digest(JSON.stringify(definition.geometry));
  const connectorFrameDigest = sha256Digest(JSON.stringify(definition.connectors));
  const collisionFrameDigest = sha256Digest(JSON.stringify(definition.collision));
  const trustedSourceDigest = sha256Digest("synthetic-ledger-v2-builder-source");
  const inputDigest = sha256Digest(
    JSON.stringify({
      trustedSourceDigest,
      catalogDefinitionDigest,
      catalogGeometryDigest,
      connectorFrameDigest,
      collisionFrameDigest,
      catalogToBuilderLocalTransform,
    }),
  );
  const frameEvidenceDigest = sha256Digest(
    JSON.stringify({ inputDigest, fixture: "synthetic-ledger-v2-builder-frame" }),
  );
  const calibration: BuilderCanonicalCalibration = {
    schemaVersion: "lego.builder-canonical-calibration/8",
    officialModelDigest: rawOfficial.digest,
    geometryBundle: {
      format: "lego.builder-shell-and-ldraw-triangles-f32le/2",
      byteLength: builderGeometry.bytes.length,
      digest: builderGeometry.digest,
    },
    // Derived, not restated. This fixture hand-wrote its four expected
    // transforms next to the four Bone rows they came from, so the ledger tests
    // compared the fixture with itself and stayed green through a change of
    // basis that made two of the four internally wrong. Reading them out of the
    // code under test is what makes the comparison mean something.
    cases: FIXTURE_CASE_BRICK_REFS.map((brickRef) => ({
      brickRef,
      builderTransformationDigest: rawOfficial.bricks[brickRef]!.builderTransform!.sourceDigest,
      expectedTransform: resolvedFixtureTransform(rawOfficial, brickRef),
    })),
    originPolicy: {
      protocol: "first-ordered-direct-empty-enumeration/1",
      anchorBrickRef: "brick-a",
      anchorBuilderTransformationDigest:
        rawOfficial.bricks["brick-a"]!.builderTransform!.sourceDigest,
      expectedComposedTransform: catalogToBuilderLocalTransform,
      expectedEmptyEnumerationTransform: {
        positionLdu: [0, 8, 0],
        orientationId: "upright-yaw-0",
      },
    },
    designFrames: [
      {
        designRevision: "3005",
        catalogPartId: "builtin:brick-1x1",
        catalogVersion: BUILTIN_CATALOG_VERSION,
        trustedSourceDigest,
        catalogDefinitionDigest,
        catalogToBuilderLocalTransform,
        catalogGeometryDigest,
        connectorFrameDigest,
        collisionFrameDigest,
        verification: {
          protocol: "builder-anchor-frame-plus-ldraw-surface/4",
          inputDigest,
          evidenceDigest: frameEvidenceDigest,
          uniqueBuilderVertexCount: 8,
          builderTriangleCount: builderGeometry.reference.triangleCount,
          ldrawTriangleCount: builderGeometry.reference.triangleCount,
          p95SurfaceDistanceMicroLdu: 0,
          maximumSurfaceDistanceMicroLdu: 0,
          frameCandidateCount: 1,
          frameEquivalenceClassCount: 1,
          frameSelection: "unique-stud-correspondence",
          frameWitnessMarginMicroRatio: null,
        },
      },
    ],
  };
  const builderCalibrationBytes = new TextEncoder().encode(JSON.stringify(calibration));
  const builderCalibrationDigest = sha256Digest(JSON.stringify(calibration));
  // Synthetic v2 ledger tests cannot cross the production calibration's source
  // pins, so the origin normalization is the fixture's own: the anchor lands on
  // an empty plate at [0,8,0] and every other brick keeps its offset from it.
  // The transforms themselves still come from the reader.
  const originOffset = [0, 8, 0].map(
    (coordinate, axis) =>
      coordinate - resolvedFixtureTransform(rawOfficial, "brick-a").positionLdu[axis]!,
  );
  const canonicalTransforms: Record<
    string,
    { readonly positionLdu: readonly [number, number, number]; readonly orientationId: string }
  > = Object.fromEntries(
    FIXTURE_CASE_BRICK_REFS.map((brickRef) => {
      const resolved = resolvedFixtureTransform(rawOfficial, brickRef);
      return [
        brickRef,
        {
          positionLdu: resolved.positionLdu.map(
            (coordinate, axis) => coordinate + originOffset[axis]!,
          ) as unknown as readonly [number, number, number],
          orientationId: resolved.orientationId,
        },
      ];
    }),
  );
  const official: ReturnType<typeof parseOfficialModelIndex> = {
    ...rawOfficial,
    calibrationDigest: builderCalibrationDigest,
    builderGeometryDigest: builderGeometry.digest,
    bricks: Object.fromEntries(
      Object.entries(rawOfficial.bricks).map(([brickRef, brick]) => [
        brickRef,
        {
          ...brick,
          canonicalTransform: canonicalTransforms[brickRef]!,
          canonicalTransformFailure: null,
          calibratedCatalogPartId: "builtin:brick-1x1",
          frameEvidenceDigest,
        },
      ]),
    ),
  };
  const pdfDigest = sha256Digest("pdf");
  const coverageDigest = sha256Digest("coverage");
  const manifestDigest = sha256Digest("manifest");
  const sourceArtReboundDigest = sha256Digest("source-art-rebound");
  const panelDigest = (stepNumber: number) =>
    stepPanelEvidenceDigest({
      pdfDigest,
      stepNumber,
      pageNumber: stepNumber,
      bounds: { minXPt: 0, maxXPt: 1, minYPt: 0, maxYPt: 1 },
      calloutBoxes: [],
    });
  const directBase: Omit<LedgerPieceIdentity, "evidenceDigest"> = {
    brickRef: "brick-a",
    designId: "3005",
    materialId: "1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    calloutKey: "p1-c0.png",
    identificationConfidence: "vision-kept",
    cropDigest: sha256Digest("crop-a"),
    identificationInputDigest: manifestDigest,
    transform: null,
  };
  const direct: LedgerPieceIdentity = {
    ...directBase,
    evidenceDigest: pieceEvidenceDigest({
      pdfDigest,
      panelEvidenceDigest: panelDigest(1),
      officialModelDigest: official.digest,
      coverageDigest,
      calloutManifestDigest: manifestDigest,
      sourceArtReboundDigest,
      builderCalibrationDigest,
      stepNumber: 1,
      pageNumber: 1,
      piece: directBase,
    }),
  };
  const copyBase: Omit<LedgerCopyIdentity, "evidenceDigest"> = {
    brickRef: "brick-b",
    sourceBrickRef: "brick-a",
    designId: "3005",
    materialId: "1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    calloutKey: null,
    identificationConfidence: "official-model",
    cropDigest: null,
    identificationInputDigest: official.digest,
    // The copy's declared transform has to be the calibrated Bone truth, which
    // the validator checks; taking it from the same derivation is the point.
    transform: canonicalTransforms["brick-b"]!,
  };
  const copy: LedgerCopyIdentity = {
    ...copyBase,
    evidenceDigest: pieceEvidenceDigest({
      pdfDigest,
      panelEvidenceDigest: panelDigest(2),
      officialModelDigest: official.digest,
      coverageDigest,
      calloutManifestDigest: manifestDigest,
      sourceArtReboundDigest,
      builderCalibrationDigest,
      stepNumber: 2,
      pageNumber: 2,
      piece: copyBase,
    }),
  };
  const transitionClassificationsByStep = Object.fromEntries(
    Array.from({ length: 48 }, (_, index) => {
      const stepNumber = index + 3;
      const classification = {
        stepNumber,
        pageNumber: stepNumber,
        panelEvidenceDigest: panelDigest(stepNumber),
        transition: "rotation" as const,
        localClassification: {
          schemaVersion: "lego.transition-unauthenticated-classification/1" as const,
          authenticated: false as const,
          classifierKind: "human-claim" as const,
          classifierClaimId: sha256Digest("fixture-classifier-claim"),
          reviewedPanelDigest: panelDigest(stepNumber),
          decision: "rotation" as const,
          reasonCodes: ["rotation-cue", "no-new-piece-callout"] as const,
          notes:
            "Unauthenticated local fixture claim records a rotation cue and no new piece callout.",
        },
      };
      return [
        stepNumber,
        {
          ...classification,
          evidenceDigest: transitionClassificationEvidenceDigest(classification),
        },
      ];
    }),
  ) as Readonly<Record<number, TransitionClassificationEvidence>>;
  const transitionClassificationsDigest = sha256Digest(
    JSON.stringify(transitionClassificationsByStep),
  );
  const steps: LedgerStep[] = Array.from({ length: 50 }, (_, index) => ({
    stepNumber: index + 1,
    pageNumber: index + 1,
    panelEvidenceDigest: panelDigest(index + 1),
    callouts: [],
    action: {
      kind: "transition",
      transition: "rotation",
      classificationEvidenceDigest:
        transitionClassificationsByStep[index + 1]?.evidenceDigest ?? REAL_BUILD_TEST_DIGEST,
    },
  }));
  steps[0] = {
    stepNumber: 1,
    pageNumber: 1,
    panelEvidenceDigest: panelDigest(1),
    callouts: [
      { calloutKey: "p1-c0.png", physicalBrickRefs: ["brick-a"], semanticMultiplierQuantity: 0 },
    ],
    action: { kind: "place-callouts", pieces: [direct], omittedPieces: [] },
  };
  steps[1] = {
    stepNumber: 2,
    pageNumber: 2,
    panelEvidenceDigest: panelDigest(2),
    callouts: [
      { calloutKey: "p2-c0.png", physicalBrickRefs: ["brick-b"], semanticMultiplierQuantity: 1 },
    ],
    action: { kind: "multi-build-copy", sourceStepNumber: 1, copies: [copy] },
  };
  const ledger: RealBuildActionLedger = {
    schemaVersion: REAL_BUILD_ACTION_LEDGER_SCHEMA,
    pdfDigest,
    officialModelDigest: official.digest,
    coverageDigest,
    calloutManifestDigest: manifestDigest,
    sourceArtReboundDigest,
    builderCalibrationDigest,
    transitionClassificationsDigest,
    steps,
    provenance: {
      generator: REAL_BUILD_ACTION_LEDGER_GENERATOR,
      authenticated: false,
      expectedPrintedSteps: 359,
      requestedLastStep: 50,
      alignedThroughStep: 50,
      stopReason:
        "fixture retains the requested 50-step action prefix while the source/index contract remains 359",
      directPieceCount: 1,
      transitionStepCount: 48,
      refusals: [],
    },
  };
  return {
    officialModelBytes,
    rawOfficial,
    official,
    calibration,
    builderCalibrationBytes,
    ledger,
    ledgerDigest: sha256Digest(JSON.stringify(ledger)),
    pdfDigest,
    coverageDigest,
    manifestDigest,
    sourceArtReboundDigest,
    builderCalibrationDigest,
    builderGeometryBytes: builderGeometry.bytes,
    builderGeometryDigest: builderGeometry.digest,
    transitionClassificationsDigest,
    transitionClassificationsByStep,
    panelEvidenceByStep: Object.fromEntries(
      steps.map((step) => [
        step.stepNumber,
        { pageNumber: step.pageNumber, digest: step.panelEvidenceDigest },
      ]),
    ),
    coverageByCallout: {
      "p1-c0.png": {
        pageNumber: 1,
        stepNumber: 1,
        quantity: 1,
        elementId: "300501",
        identificationConfidence: "vision-kept",
        cropDigest: direct.cropDigest,
        inputDigest: manifestDigest,
        resolution: {
          catalogPartId: direct.catalogPartId,
          colorId: direct.colorId,
          partNum: direct.designId,
        },
      },
      "p2-c0.png": {
        pageNumber: 2,
        stepNumber: 2,
        quantity: 2,
        resolution: {
          catalogPartId: copy.catalogPartId,
          colorId: copy.colorId,
          partNum: copy.designId,
        },
      },
    },
  };
}

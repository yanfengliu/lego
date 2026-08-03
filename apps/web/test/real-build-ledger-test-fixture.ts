import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  applyBuilderCanonicalCalibration,
  createBuilderFrameEvidence,
  parseOfficialModelIndex,
  pieceEvidenceDigest,
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
import { REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";
import { builderCuboidGeometry } from "./real-build-frame-test-fixture";

export interface RealBuildLedgerTestFixture {
  readonly rawOfficial: ReturnType<typeof parseOfficialModelIndex>;
  readonly official: ReturnType<typeof parseOfficialModelIndex>;
  readonly calibration: BuilderCanonicalCalibration;
  readonly ledger: RealBuildActionLedger;
  readonly ledgerDigest: string;
  readonly pdfDigest: string;
  readonly coverageDigest: string;
  readonly manifestDigest: string;
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

export function realBuildLedgerTestFixture(): RealBuildLedgerTestFixture {
  const rawOfficial = parseOfficialModelIndex(
    new TextEncoder().encode(
      `<Root>` +
        `<Brick uuid="brick-a"><Part designID="3005" materials="1"><Bone transformation="1,0,0,0,1,0,0,0,1,0,0,0"/></Part></Brick>` +
        `<Brick uuid="brick-b"><Part designID="3005" materials="1"><Bone transformation="0,0,1,0,1,0,-1,0,0,0.8,0,0"/></Part></Brick>` +
        `<Brick uuid="cal-c"><Part designID="3005" materials="1"><Bone transformation="-1,0,0,0,1,0,0,0,-1,1.6,0,0"/></Part></Brick>` +
        `<Brick uuid="cal-d"><Part designID="3005" materials="1"><Bone transformation="0,0,-1,0,1,0,1,0,0,2.4,0,0"/></Part></Brick>` +
        `<In brickRef="brick-a"/><In brickRef="brick-b"/>` +
        `<MultiBuildBrick originalBrickRef="brick-a" actualBrickRef="brick-b"/></Root>`,
    ),
  );
  const catalogToBuilderLocalTransform = {
    positionLdu: [0, 0, 0] as const,
    orientationId: "upright-yaw-0",
  };
  const builderGeometry = builderCuboidGeometry(
    "builtin:brick-1x1",
    catalogToBuilderLocalTransform,
  );
  const frameEvidence = createBuilderFrameEvidence({
    catalogPartId: "builtin:brick-1x1",
    catalogToBuilderLocalTransform,
    builderGeometry: builderGeometry.reference,
    builderGeometryBundleBytes: builderGeometry.bytes,
    builderGeometryBundleDigest: builderGeometry.digest,
    protocol: "builder-native-manifest-frame/1",
  });
  const calibration: BuilderCanonicalCalibration = {
    schemaVersion: "lego.builder-canonical-calibration/5",
    matrixConvention: "lxf-row-major-transposed-to-canonical-column-vector",
    builderUnitsPerLdu: 0.04,
    axisMapping: ["x", "-y", "z"],
    maximumMatrixError: 0.000001,
    maximumPositionErrorLdu: 0.001,
    maximumFrameP95DistanceLdu: 2,
    builderGeometryBundleDigest: builderGeometry.digest,
    cases: [
      ["brick-a", [0, 0, 0], "upright-yaw-0"],
      ["brick-b", [20, 0, 0], "upright-yaw-270"],
      ["cal-c", [40, 0, 0], "upright-yaw-180"],
      ["cal-d", [60, 0, 0], "upright-yaw-90"],
    ].map(([brickRef, positionLdu, orientationId]) => ({
      brickRef: brickRef as string,
      builderTransformationDigest:
        rawOfficial.bricks[brickRef as string]!.builderTransform!.sourceDigest,
      expectedTransform: {
        positionLdu: positionLdu as [number, number, number],
        orientationId: orientationId as string,
      },
    })),
    designFrames: [
      {
        designRevision: "3005",
        catalogPartId: "builtin:brick-1x1",
        catalogVersion: BUILTIN_CATALOG_VERSION,
        catalogDefinitionDigest: frameEvidence.catalogDefinitionDigest,
        route: "builder-native",
        catalogToBuilderLocalTransform,
        builderGeometry: builderGeometry.reference,
        catalogGeometryDigest: frameEvidence.catalogGeometryDigest,
        connectorFrameDigest: frameEvidence.connectorFrameDigest,
        collisionFrameDigest: frameEvidence.collisionFrameDigest,
        verification: {
          protocol: "builder-native-manifest-frame/1",
          inputDigest: frameEvidence.inputDigest,
          evidenceDigest: frameEvidence.evidenceDigest,
          sampleCount: frameEvidence.sampleCount,
          builderTriangleCount: frameEvidence.builderTriangleCount,
          p95SurfaceDistanceLdu: frameEvidence.p95SurfaceDistanceLdu,
        },
      },
    ],
  };
  const builderCalibrationDigest = sha256Digest(JSON.stringify(calibration));
  const official = applyBuilderCanonicalCalibration(
    rawOfficial,
    new TextEncoder().encode(JSON.stringify(calibration)),
    builderCalibrationDigest,
    builderGeometry.bytes,
    builderGeometry.digest,
  );
  const pdfDigest = sha256Digest("pdf");
  const coverageDigest = sha256Digest("coverage");
  const manifestDigest = sha256Digest("manifest");
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
    transform: { positionLdu: [20, 0, 0], orientationId: "upright-yaw-270" },
  };
  const copy: LedgerCopyIdentity = {
    ...copyBase,
    evidenceDigest: pieceEvidenceDigest({
      pdfDigest,
      panelEvidenceDigest: panelDigest(2),
      officialModelDigest: official.digest,
      coverageDigest,
      calloutManifestDigest: manifestDigest,
      builderCalibrationDigest,
      stepNumber: 2,
      pageNumber: 2,
      piece: copyBase,
    }),
  };
  const transitionClassificationsByStep = Object.fromEntries(
    Array.from({ length: 357 }, (_, index) => {
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
  const steps: LedgerStep[] = Array.from({ length: 359 }, (_, index) => ({
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
    schemaVersion: "lego.real-build-action-ledger/2",
    pdfDigest,
    officialModelDigest: official.digest,
    coverageDigest,
    calloutManifestDigest: manifestDigest,
    builderCalibrationDigest,
    transitionClassificationsDigest,
    steps,
  };
  return {
    rawOfficial,
    official,
    calibration,
    ledger,
    ledgerDigest: sha256Digest(JSON.stringify(ledger)),
    pdfDigest,
    coverageDigest,
    manifestDigest,
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

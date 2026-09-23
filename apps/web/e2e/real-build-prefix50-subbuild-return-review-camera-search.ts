import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import type { OrthographicViewFrame, OrthographicViewParameters } from "@lego-studio/rendering";

import {
  deriveRealBuildPrefix50Step44InteriorFeatureSource,
  deriveRealBuildPrefix50Step44SemanticBlueCyanMask,
  measureRealBuildPrefix50Step44InteriorFeatures,
} from "./real-build-prefix50-subbuild-return-review-camera-interior.ts";
import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { searchRealBuildPrefix50EligibleMaskSimilarity } from "./real-build-prefix50-subbuild-return-review-camera-registration.ts";
import {
  deriveRealBuildPrefix50Step44CameraRefusalReasons,
  deriveRealBuildPrefix50Step44FeatureCorroboration,
  deriveRealBuildPrefix50Step44GeometrySelection,
} from "./real-build-prefix50-subbuild-return-review-camera-search-decisions.ts";
import {
  applyRegistrationProposal,
  branchFace,
  cameraPass,
  cloneCameraFrame,
  cloneCameraParameters,
  eligibleAgreement,
  foregroundMask,
  registrationProposal,
  requireCameraMask,
  requireCameraRender,
  requireStableBranches,
} from "./real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraAlignmentPass,
  type RealBuildPrefix50Step44CameraBranchKey,
  type RealBuildPrefix50Step44CameraRenderEvidence,
  type RealBuildPrefix50Step44CameraSearchRefusal,
  type RealBuildPrefix50Step44CameraSearchAttemptEvidence,
  type RealBuildPrefix50Step44CameraSearchResult,
  type RealBuildPrefix50Step44ParentCameraMeasurement,
  type RealBuildPrefix50Step44SemanticColorArtifactBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import {
  requireRealBuildPrefix50SemanticColorPolicy,
  type RealBuildPrefix50SemanticColorPolicy,
  type RealBuildPrefix50Step44SemanticColorRenderEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";

export * from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";

type GeometryBranchMeasurement = Omit<
  RealBuildPrefix50Step44ParentCameraMeasurement,
  "commitment" | "semanticColorArtifact" | "interiorFeatureMeasurement"
>;

interface MeasuredGeometryBranch {
  readonly geometry: GeometryBranchMeasurement;
  readonly publishedRender: RealBuildPrefix50Step44CameraRenderEvidence;
  readonly renderArtifacts: Readonly<Record<string, Uint8Array>>;
}

const liveCameraAttemptEvidenceBrands = new WeakSet<object>();

const WIDTH = REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH;
const HEIGHT = REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT;
const THRESHOLDS = REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS;

export class RealBuildPrefix50Step44CameraSearchRefusalError extends TypeError {
  readonly code = "STEP44_CAMERA_SEARCH_REFUSED" as const;
  readonly attemptCommitment: Sha256Digest;
  readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];

  constructor(input: {
    readonly attemptCommitment: Sha256Digest;
    readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];
    readonly diagnostic: string;
  }) {
    super(input.diagnostic);
    this.name = "RealBuildPrefix50Step44CameraSearchRefusalError";
    this.attemptCommitment = input.attemptCommitment;
    this.refusalReasons = Object.freeze([...input.refusalReasons]);
  }
}

function proposalFor(
  rgba: Uint8Array,
  parameters: OrthographicViewParameters,
  target: Uint8Array,
  eligible: Uint8Array,
) {
  return registrationProposal(
    searchRealBuildPrefix50EligibleMaskSimilarity({
      source: { width: WIDTH, height: HEIGHT, mask: foregroundMask(rgba) },
      target: { width: WIDTH, height: HEIGHT, mask: target },
      eligibleTarget: { width: WIDTH, height: HEIGHT, mask: eligible },
    }),
    parameters,
  );
}

function renderArtifactFile(
  branchIndex: number,
  passKind: "seed" | "confirmation" | "rebase",
): string {
  return `real-build-prefix50-step44-page45-camera-branch-${branchIndex
    .toString()
    .padStart(2, "0")}-${passKind}.png`;
}

function semanticArtifactFile(branchIndex: number): string {
  return `real-build-prefix50-step44-page45-camera-branch-${branchIndex
    .toString()
    .padStart(2, "0")}-semantic-blue-cyan.png`;
}

const BEAUTY_RESTORATION_ARTIFACT_FILE =
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png";

function requireSemanticRender<TPolicy extends RealBuildPrefix50SemanticColorPolicy>(input: {
  readonly render: RealBuildPrefix50Step44SemanticColorRenderEvidence;
  readonly beauty: RealBuildPrefix50Step44CameraRenderEvidence;
  readonly parameters: OrthographicViewParameters;
  readonly frame: OrthographicViewFrame;
  readonly policy: TPolicy;
  readonly label: string;
}): RealBuildPrefix50Step44SemanticColorRenderEvidence {
  const { render, beauty, policy } = input;
  const pngBytes = new Uint8Array(render.pngBytes);
  const rgba = new Uint8Array(render.rgba);
  const projectionMatrix = Object.freeze([...render.projectionMatrix]);
  const matrixWorldInverse = Object.freeze([...render.matrixWorldInverse]);
  const request = {
    scene: "model-only" as const,
    renderMode: "semantic-color-id-mask" as const,
    targetColorIds: [...policy.targetColorIds],
    backgroundHex: 0x899093,
    parameters: cloneCameraParameters(input.parameters),
    frame: cloneCameraFrame(input.frame),
  };
  if (
    !(render.pngBytes instanceof Uint8Array) ||
    !(render.rgba instanceof Uint8Array) ||
    rgba.byteLength !== WIDTH * HEIGHT * 4 ||
    pngBytes.byteLength === 0 ||
    render.pngDigest !== sha256RealBuildPrefix50Step44ReviewBytes(pngBytes) ||
    render.pixelDigest !== sha256RealBuildPrefix50Step44ReviewBytes(rgba) ||
    render.policyCommitment !== policy.commitment ||
    render.classificationCommitment !== policy.classificationCommitment ||
    canonicalDigest(render.classification) !== policy.classificationCommitment ||
    canonicalDigest(projectionMatrix) !== canonicalDigest(beauty.projectionMatrix) ||
    canonicalDigest(matrixWorldInverse) !== canonicalDigest(beauty.matrixWorldInverse) ||
    render.rendererCameraCommitment !==
      canonicalDigest({
        request,
        policyCommitment: policy.commitment,
        classificationCommitment: policy.classificationCommitment,
        projectionMatrix,
        matrixWorldInverse,
      })
  )
    throw new TypeError(
      `${input.label} must bind the exact semantic policy, published beauty camera matrices, categorical pixels, and PNG bytes.`,
    );
  return Object.freeze({
    pngBytes,
    rgba,
    pngDigest: render.pngDigest,
    pixelDigest: render.pixelDigest,
    projectionMatrix,
    matrixWorldInverse,
    rendererCameraCommitment: render.rendererCameraCommitment,
    policyCommitment: render.policyCommitment,
    classification: render.classification,
    classificationCommitment: render.classificationCommitment,
  });
}

async function measureGeometryBranch(input: {
  readonly branchIndex: number;
  readonly branchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly seedParameters: OrthographicViewParameters;
  readonly frame: OrthographicViewFrame;
  readonly target: Uint8Array;
  readonly eligible: Uint8Array;
  readonly render: (
    parameters: OrthographicViewParameters,
    frame: OrthographicViewFrame,
  ) => Promise<RealBuildPrefix50Step44CameraRenderEvidence>;
}): Promise<MeasuredGeometryBranch> {
  const seedParameters = cloneCameraParameters(input.seedParameters);
  const frame = cloneCameraFrame(input.frame);
  const passes: RealBuildPrefix50Step44CameraAlignmentPass[] = [];
  const renders: RealBuildPrefix50Step44CameraRenderEvidence[] = [];
  const artifacts: Record<string, Uint8Array> = {};
  const capture = async (
    passKind: "seed" | "confirmation" | "rebase",
    parameters: OrthographicViewParameters,
  ) => {
    const requestParameters = cloneCameraParameters(parameters);
    const render = requireCameraRender(
      await input.render(requestParameters, frame),
      `Step-44 camera branch ${input.branchKey} ${passKind} render`,
      requestParameters,
      frame,
    );
    const artifactFile = renderArtifactFile(input.branchIndex, passKind);
    if (artifacts[artifactFile] !== undefined)
      throw new TypeError(`Step-44 camera render artifact ${artifactFile} was captured twice.`);
    artifacts[artifactFile] = new Uint8Array(render.pngBytes);
    renders.push(render);
    return {
      render,
      parameters: requestParameters,
      artifactFile,
      agreement: eligibleAgreement({
        renderedForeground: foregroundMask(render.rgba),
        target: input.target,
        eligible: input.eligible,
      }),
    };
  };

  const seed = await capture("seed", seedParameters);
  const initialProposal = proposalFor(
    seed.render.rgba,
    seed.parameters,
    input.target,
    input.eligible,
  );
  passes.push(
    cameraPass({
      passIndex: 0,
      passKind: "seed",
      artifactFile: seed.artifactFile,
      parameters: seed.parameters,
      frame,
      render: seed.render,
      agreement: seed.agreement,
      proposal: initialProposal,
      predictedIntersectionOverUnion: initialProposal.diagnostics.predictedIntersectionOverUnion,
      incomingPredictionActualIntersectionOverUnionDrift: null,
      settled: false,
    }),
  );

  let converged = false;
  if (initialProposal.status === "locally-contained") {
    const confirmationParameters = applyRegistrationProposal(
      seed.parameters,
      initialProposal.transform!,
    );
    const confirmation = await capture("confirmation", confirmationParameters);
    const initialDrift = Math.abs(
      initialProposal.diagnostics.predictedIntersectionOverUnion -
        confirmation.agreement.intersectionOverUnion,
    );
    const needsRebase = initialDrift > THRESHOLDS.maximumPredictionActualIntersectionOverUnionDrift;
    const rebaseProposal = needsRebase
      ? proposalFor(confirmation.render.rgba, confirmationParameters, input.target, input.eligible)
      : null;
    passes.push(
      cameraPass({
        passIndex: 1,
        passKind: "confirmation",
        artifactFile: confirmation.artifactFile,
        parameters: confirmationParameters,
        frame,
        render: confirmation.render,
        agreement: confirmation.agreement,
        proposal: rebaseProposal,
        predictedIntersectionOverUnion:
          rebaseProposal?.diagnostics.predictedIntersectionOverUnion ?? null,
        incomingPredictionActualIntersectionOverUnionDrift: initialDrift,
        settled: !needsRebase,
      }),
    );
    converged = !needsRebase;
    if (needsRebase && rebaseProposal?.status === "locally-contained") {
      const rebaseParameters = applyRegistrationProposal(
        confirmationParameters,
        rebaseProposal.transform!,
      );
      const rebase = await capture("rebase", rebaseParameters);
      const rebaseDrift = Math.abs(
        rebaseProposal.diagnostics.predictedIntersectionOverUnion -
          rebase.agreement.intersectionOverUnion,
      );
      converged = rebaseDrift <= THRESHOLDS.maximumPredictionActualIntersectionOverUnionDrift;
      passes.push(
        cameraPass({
          passIndex: 2,
          passKind: "rebase",
          artifactFile: rebase.artifactFile,
          parameters: rebaseParameters,
          frame,
          render: rebase.render,
          agreement: rebase.agreement,
          proposal: null,
          predictedIntersectionOverUnion: null,
          incomingPredictionActualIntersectionOverUnionDrift: rebaseDrift,
          settled: converged,
        }),
      );
    }
  }

  let publishedPassIndex = 0;
  for (let index = 1; index < passes.length; index += 1)
    if (passes[index]!.intersectionOverUnion > passes[publishedPassIndex]!.intersectionOverUnion)
      publishedPassIndex = index;
  const published = passes[publishedPassIndex]!;
  const branch = branchFace(input.branchKey);
  const body = {
    branchIndex: input.branchIndex,
    branchKey: input.branchKey,
    branchFace: branch,
    expectedPanelFace: input.expectedPanelFace,
    geometryEligible: branch === input.expectedPanelFace,
    seedParameters,
    frame,
    alignmentMethod: "coverage-preserving-direct-eligible-silhouette-registration" as const,
    alignmentPasses: passes,
    alignmentPassesCommitment: canonicalDigest(passes),
    converged,
    publishedPassIndex,
    selectedParameters: published.parameters,
    selectedCameraCommitment: published.cameraCommitment,
    selectedRendererCameraCommitment: published.rendererCameraCommitment,
    selectedPngDigest: published.pngDigest,
    selectedPixelDigest: published.pixelDigest,
    selectedIntersectionOverUnion: published.intersectionOverUnion,
  };
  return {
    geometry: deepFreeze({ ...body, geometryCommitment: canonicalDigest(body) }),
    publishedRender: renders[publishedPassIndex]!,
    renderArtifacts: Object.freeze(artifacts),
  };
}

export async function searchRealBuildPrefix50Step44ParentCamera<
  TPolicy extends RealBuildPrefix50SemanticColorPolicy,
>(input: {
  readonly branches: readonly {
    readonly branchKey: RealBuildPrefix50Step44CameraBranchKey;
    readonly parameters: OrthographicViewParameters;
  }[];
  readonly expectedPanelFace: "studs-up" | "underside";
  readonly sourceRgba: Uint8Array;
  readonly frame: OrthographicViewFrame;
  readonly parentOnlyTargetMask: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly render: (
    parameters: OrthographicViewParameters,
    frame: OrthographicViewFrame,
  ) => Promise<RealBuildPrefix50Step44CameraRenderEvidence>;
  readonly semanticPolicy: TPolicy;
  readonly renderSemantic: (
    parameters: OrthographicViewParameters,
    frame: OrthographicViewFrame,
    policy: TPolicy,
  ) => Promise<RealBuildPrefix50Step44SemanticColorRenderEvidence>;
  readonly attemptSink: (
    evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence,
  ) => Promise<void> | void;
}): Promise<RealBuildPrefix50Step44CameraSearchResult> {
  if (typeof input.attemptSink !== "function")
    throw new TypeError(
      "Step-44 camera search requires an attempt sink before any refusal-capable render work.",
    );
  if (typeof input.render !== "function" || typeof input.renderSemantic !== "function")
    throw new TypeError(
      "Step-44 camera search requires separate beauty and semantic render callbacks before any render work.",
    );
  const semanticPolicy = requireRealBuildPrefix50SemanticColorPolicy(input.semanticPolicy);
  requireStableBranches(input.branches);
  const branches = input.branches.map((branch, branchIndex) =>
    Object.freeze({
      branchKey: branch.branchKey,
      parameters: cloneCameraParameters(
        branch.parameters,
        `Step-44 camera branch ${branchIndex} parameters`,
      ),
    }),
  );
  const frame = cloneCameraFrame(input.frame);
  const target = requireCameraMask(input.parentOnlyTargetMask, "Step-44 parent-only target");
  const eligible = requireCameraMask(input.eligibleMask, "Step-44 eligible region");
  const sourceRgba = new Uint8Array(input.sourceRgba);
  const featureSource = deriveRealBuildPrefix50Step44InteriorFeatureSource({
    width: WIDTH,
    height: HEIGHT,
    sourceRgba,
    eligibleMask: eligible,
  });
  const geometryRows: MeasuredGeometryBranch[] = [];
  for (let branchIndex = 0; branchIndex < branches.length; branchIndex += 1) {
    const branch = branches[branchIndex]!;
    geometryRows.push(
      await measureGeometryBranch({
        branchIndex,
        branchKey: branch.branchKey,
        expectedPanelFace: input.expectedPanelFace,
        seedParameters: branch.parameters,
        frame,
        target,
        eligible,
        render: input.render,
      }),
    );
  }
  const geometry = deriveRealBuildPrefix50Step44GeometrySelection(
    geometryRows.map((row) => row.geometry),
    input.expectedPanelFace,
  );
  const semanticArtifacts: Record<string, Uint8Array> = {};
  const branchMeasurements: RealBuildPrefix50Step44ParentCameraMeasurement[] = [];
  for (const row of geometryRows) {
    const semanticRender = requireSemanticRender({
      render: await input.renderSemantic(row.geometry.selectedParameters, frame, semanticPolicy),
      beauty: row.publishedRender,
      parameters: row.geometry.selectedParameters,
      frame,
      policy: semanticPolicy,
      label: `Step-44 camera branch ${row.geometry.branchKey} semantic render`,
    });
    const semanticBlueCyanMask = deriveRealBuildPrefix50Step44SemanticBlueCyanMask(
      semanticRender.rgba,
      WIDTH,
      HEIGHT,
    );
    const interiorFeatureMeasurement = measureRealBuildPrefix50Step44InteriorFeatures({
      source: featureSource,
      beautyRenderRgba: row.publishedRender.rgba,
      semanticBlueCyanMask,
      semanticPolicyCommitment: semanticPolicy.commitment,
    });
    if (
      interiorFeatureMeasurement.beautyRenderPixelDigest !== row.geometry.selectedPixelDigest ||
      interiorFeatureMeasurement.semanticPolicyCommitment !== semanticPolicy.commitment
    )
      throw new TypeError(
        `Step-44 camera branch ${row.geometry.branchKey} feature measurement drifted from its geometry-published render.`,
      );
    const artifactFile = semanticArtifactFile(row.geometry.branchIndex);
    semanticArtifacts[artifactFile] = new Uint8Array(semanticRender.pngBytes);
    const semanticArtifactBody = {
      artifactFile,
      pngDigest: semanticRender.pngDigest,
      pixelDigest: semanticRender.pixelDigest,
      semanticBlueCyanMaskDigest: interiorFeatureMeasurement.semanticMaskPixelDigest,
      projectionMatrix: semanticRender.projectionMatrix,
      matrixWorldInverse: semanticRender.matrixWorldInverse,
      rendererCameraCommitment: semanticRender.rendererCameraCommitment,
      policyCommitment: semanticRender.policyCommitment,
      classificationCommitment: semanticRender.classificationCommitment,
    };
    const semanticColorArtifact: RealBuildPrefix50Step44SemanticColorArtifactBinding = deepFreeze({
      ...semanticArtifactBody,
      commitment: canonicalDigest(semanticArtifactBody),
    });
    const body = { ...row.geometry, semanticColorArtifact, interiorFeatureMeasurement };
    branchMeasurements.push(deepFreeze({ ...body, commitment: canonicalDigest(body) }));
  }
  const feature = deriveRealBuildPrefix50Step44FeatureCorroboration({
    rows: branchMeasurements,
    geometry,
    sourceCommitment: featureSource.evidence.commitment,
  });
  const controlledIndex = Math.max(
    0,
    geometryRows.findIndex((row) => row.geometry.branchKey === geometry.selectedBranchKey),
  );
  const controlledRow = geometryRows[controlledIndex]!;
  const restorationRender = requireCameraRender(
    await input.render(controlledRow.geometry.selectedParameters, frame),
    `Step-44 camera branch ${controlledRow.geometry.branchKey} beauty restoration control`,
    controlledRow.geometry.selectedParameters,
    frame,
  );
  const publishedBytes = controlledRow.publishedRender.pngBytes;
  const byteIdenticalToPublishedRender =
    restorationRender.pngDigest === controlledRow.publishedRender.pngDigest &&
    restorationRender.pixelDigest === controlledRow.publishedRender.pixelDigest &&
    restorationRender.pngBytes.length === publishedBytes.length &&
    restorationRender.pngBytes.every((value, index) => value === publishedBytes[index]);
  const beautyRestorationBody = {
    artifactFile: BEAUTY_RESTORATION_ARTIFACT_FILE,
    controlledBranchKey: controlledRow.geometry.branchKey,
    controlledCameraCommitment: controlledRow.geometry.selectedCameraCommitment,
    pngDigest: restorationRender.pngDigest,
    pixelDigest: restorationRender.pixelDigest,
    projectionMatrix: restorationRender.projectionMatrix,
    matrixWorldInverse: restorationRender.matrixWorldInverse,
    rendererCameraCommitment: restorationRender.rendererCameraCommitment,
    byteIdenticalToPublishedRender,
  };
  const beautyRestorationControl = deepFreeze({
    ...beautyRestorationBody,
    commitment: canonicalDigest(beautyRestorationBody),
  });
  const reasons = [
    ...deriveRealBuildPrefix50Step44CameraRefusalReasons({
      rows: geometryRows.map((row) => row.geometry),
      geometry,
      feature,
    }),
    ...(byteIdenticalToPublishedRender ? [] : (["beauty-restoration-control-failed"] as const)),
  ];
  const geometryRenderArtifacts: Readonly<Record<string, Uint8Array>> = Object.freeze(
    Object.assign({}, ...geometryRows.map((row) => row.renderArtifacts)),
  );
  const renderCount = Object.keys(geometryRenderArtifacts).length;
  if (renderCount < 16 || renderCount > 48)
    throw new TypeError(
      `Step-44 camera search captured ${renderCount} actual renders; expected one to three for each of 16 branches.`,
    );
  const renderArtifacts: Readonly<Record<string, Uint8Array>> = Object.freeze({
    ...geometryRenderArtifacts,
    ...semanticArtifacts,
    [BEAUTY_RESTORATION_ARTIFACT_FILE]: new Uint8Array(restorationRender.pngBytes),
  });
  const semanticRenderCount = Object.keys(semanticArtifacts).length;
  const totalCaptureCount = Object.keys(renderArtifacts).length;
  if (semanticRenderCount !== 16 || totalCaptureCount !== renderCount + 17)
    throw new TypeError(
      "Step-44 camera search must retain exactly one semantic render per branch and one beauty restoration control.",
    );
  const branchMeasurementsCommitment = canonicalDigest(branchMeasurements);
  const attemptBody = {
    schemaVersion: "lego.real-build-prefix50-step44-camera-search-attempt/2" as const,
    expectedPanelFace: input.expectedPanelFace,
    sourceEligibleMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(input.eligibleMask),
    parentOnlyTargetMaskDigest: sha256RealBuildPrefix50Step44ReviewBytes(
      input.parentOnlyTargetMask,
    ),
    thresholds: THRESHOLDS,
    renderCount,
    maximumRenderCount: 48 as const,
    semanticRenderCount: 16 as const,
    restorationControlRenderCount: 1 as const,
    totalCaptureCount,
    maximumTotalCaptureCount: 65 as const,
    beautyRestorationControl,
    metricCalibrationCommitment: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    geometrySelection: geometry,
    geometrySelectionCommitment: geometry.commitment,
    featureCorroboration: feature,
    featureCorroborationCommitment: feature.commitment,
    branchMeasurements,
    branchMeasurementsCommitment,
    status: reasons.length === 0 ? ("resolved" as const) : ("refused" as const),
    refusalReasons: reasons,
  };
  const attempt = deepFreeze({ ...attemptBody, commitment: canonicalDigest(attemptBody) });
  const sinkArtifacts = Object.freeze(
    Object.fromEntries(
      Object.entries(renderArtifacts).map(([artifactFile, bytes]) => [
        artifactFile,
        new Uint8Array(bytes),
      ]),
    ),
  );
  const attemptEvidence = Object.freeze({ attempt, renderArtifacts: sinkArtifacts });
  liveCameraAttemptEvidenceBrands.add(attemptEvidence);
  await input.attemptSink(attemptEvidence);
  const selectedIndex = branchMeasurements.findIndex(
    (row) => row.branchKey === geometry.selectedBranchKey,
  );
  if (attempt.status === "refused")
    throw new RealBuildPrefix50Step44CameraSearchRefusalError({
      attemptCommitment: attempt.commitment,
      refusalReasons: reasons,
      diagnostic: `Step-44 camera attempt refused after the required attempt sink completed: ${reasons.join(
        ", ",
      )}; controls=${branchMeasurements
        .map(
          (row) =>
            `${row.branchKey}:passes=${row.alignmentPasses.length},converged=${row.converged},iou=${row.selectedIntersectionOverUnion.toFixed(6)},blueF1=${row.interiorFeatureMeasurement.f1.toFixed(6)}`,
        )
        .join(";")}.`,
    });
  if (selectedIndex < 0)
    throw new TypeError(
      "Step-44 resolved camera attempt did not retain its geometry-selected branch.",
    );
  const selected = branchMeasurements[selectedIndex]!;
  return Object.freeze({
    attempt,
    branchMeasurements,
    branchMeasurementsCommitment,
    geometrySelection: geometry,
    geometrySelectionCommitment: geometry.commitment,
    featureCorroboration: feature,
    featureCorroborationCommitment: feature.commitment,
    selectedBranchKey: selected.branchKey,
    selectedParameters: selected.selectedParameters,
    selectedFrame: frame,
    selectedCameraCommitment: selected.selectedCameraCommitment,
    selectedRendererCameraCommitment: selected.selectedRendererCameraCommitment,
    selectedParentPngDigest: selected.selectedPngDigest,
    selectedParentPixelDigest: selected.selectedPixelDigest,
    selectedIntersectionOverUnion: selected.selectedIntersectionOverUnion,
    branchWinnerMargin: geometry.expectedFaceGeometryMargin!,
    selectedAlignmentPassCount: selected.alignmentPasses.length,
    thresholds: THRESHOLDS,
    selectedControlRender: geometryRows[selectedIndex]!.publishedRender,
  });
}

export function requireRealBuildPrefix50LiveCameraSearchAttemptEvidence(
  evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence,
): RealBuildPrefix50Step44CameraSearchAttemptEvidence {
  if (!liveCameraAttemptEvidenceBrands.has(evidence))
    throw new TypeError(
      "Camera calibration requires attempt evidence minted by the live 16-branch renderer search.",
    );
  return evidence;
}

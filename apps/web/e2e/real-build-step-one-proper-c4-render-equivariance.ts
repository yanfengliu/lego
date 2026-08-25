import {
  applyBuildOperations,
  canonicalDigest,
  createEmptyBrickDocument,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { createPlacePartTransaction } from "../src/manual-commands";
import {
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  PANEL_CAMERA_ANGULAR_HYPOTHESES,
  snapshotPanelCameraBinaryMask,
} from "./real-build-panel-camera-resolver-boundary";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";
import { mapRealBuildStepOneProperC4MemberCameraToRepresentative } from "./real-build-step-one-proper-c4-camera-equivariance";
import {
  inspectRealBuildStepOneMaskRendererFactoryConfiguration,
  inspectRealBuildStepOnePreparedMaskRenderer,
  type RealBuildStepOneMaskRendererFactory,
} from "./real-build-step-one-silhouette-renderer";

const QUARTER_TURNS = [0, 90, 180, 270] as const;
type QuarterTurn = (typeof QUARTER_TURNS)[number];
const inspections = new WeakMap<
  object,
  Readonly<{
    factory: RealBuildStepOneMaskRendererFactory;
    configurationDigest: Sha256Digest;
    sourceBindingDigest: Sha256Digest;
  }>
>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_MAP_GET = WeakMap.prototype.get;
const SAFE_WEAK_MAP_SET = WeakMap.prototype.set;

export interface RealBuildStepOneProperC4RendererEquivarianceInspection {
  readonly schemaVersion: "lego.real-build-step-one-proper-c4-renderer-equivariance/1";
  readonly configurationDigest: Sha256Digest;
  readonly sourceBindingDigest: Sha256Digest;
  readonly controlDocumentDigest: Sha256Digest;
  readonly maskDigests: readonly (readonly Sha256Digest[])[];
  readonly maskAreas: readonly (readonly number[])[];
  readonly parityDigest: Sha256Digest;
  readonly accounting: Readonly<{
    controlDocuments: 4;
    rendererPreparations: 4;
    physicalRenderCalls: 32;
    rendererDisposals: 4;
  }>;
  readonly exactParity: true;
  readonly backendClaim: "calibrated-same-factory-only";
  readonly physicalFrameAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly authority: "absent";
}

function digestBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Hex(bytes)}` as Sha256Digest;
}

export function realBuildStepOneProperC4SourceBindingDigest(
  input: RealBuildCompiledObservationSourceInput,
): Sha256Digest {
  const source = snapshotRealBuildCompiledObservationSource(input);
  return canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-source-binding/1",
    provisionalStepIdentity: source.provisionalStepIdentity,
    observationMode: source.observationMode,
    registrationPanelStepNumber: source.registrationPanelStepNumber,
    pageNumber: source.pageNumber,
    panelDigest: source.panelDigest,
    cropDigest: source.cropDigest,
    sourceDescriptorDigest: source.sourceDescriptorDigest,
    exclusionDescriptorDigest: source.exclusionDescriptorDigest,
    measure: source.measure,
    widthPx: source.widthPx,
    heightPx: source.heightPx,
    sourceMaskDigest: digestBytes(source.sourceMask),
    excludedMaskDigest: source.excludedMask === null ? null : digestBytes(source.excludedMask),
  });
}

function rotatePosition(
  [x, y, z]: readonly [number, number, number],
  turn: QuarterTurn,
): readonly [number, number, number] {
  const rotated =
    turn === 0 ? [x, y, z] : turn === 90 ? [z, y, -x] : turn === 180 ? [-x, y, -z] : [-z, y, x];
  return intrinsicRealBuildFreeze(
    rotated.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)),
  ) as unknown as readonly [number, number, number];
}

function controlDocuments() {
  const layout = [
    {
      catalogPartId: "builtin:plate-6x6",
      colorId: "builtin:light-bluish-gray",
      positionLdu: [0, 8, 0] as const,
    },
    {
      catalogPartId: "builtin:brick-2x4",
      colorId: "builtin:red",
      positionLdu: [-20, -8, -20] as const,
    },
    {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:white",
      positionLdu: [50, -8, -50] as const,
    },
  ] as const;
  return QUARTER_TURNS.map((turn) => {
    let document = createEmptyBrickDocument({
      id: `proper-c4-calibration-q${turn}`,
      name: `Proper C4 calibration q${turn}`,
      maxParts: 16,
    });
    for (const entry of layout) {
      const transaction = createPlacePartTransaction(document, {
        catalogPartId: entry.catalogPartId,
        colorId: entry.colorId,
        transform: {
          positionLdu: rotatePosition(entry.positionLdu, turn),
          orientationId: `upright-yaw-${turn}`,
        },
      });
      document = applyBuildOperations(document, transaction.operations);
    }
    return document;
  });
}

function hypothesisIndex(hypothesis: StepCameraLatticeHypothesis): number {
  return PANEL_CAMERA_ANGULAR_HYPOTHESES.findIndex(
    (candidate) =>
      candidate.latticeHand === hypothesis.latticeHand &&
      candidate.latticeDeterminant === hypothesis.latticeDeterminant &&
      candidate.turnDegrees === hypothesis.turnDegrees,
  );
}

/**
 * Calibrates the exact factory/configuration object used by the reduction against one
 * repository-owned asymmetric four-member control. This is instrument evidence, not a
 * universal theorem about arbitrary renderer callbacks and never physical-frame authority.
 */
export function calibrateRealBuildStepOneProperC4RendererEquivariance(input: {
  readonly prepareModelMaskRenderer: RealBuildStepOneMaskRendererFactory;
  readonly source: RealBuildCompiledObservationSourceInput;
}): RealBuildStepOneProperC4RendererEquivarianceInspection {
  const source = snapshotRealBuildCompiledObservationSource(input.source);
  const configuration = inspectRealBuildStepOneMaskRendererFactoryConfiguration(
    input.prepareModelMaskRenderer,
    source,
  );
  if (
    !Object.is(configuration.frame.target[0], 0) ||
    !Object.is(configuration.frame.target[2], 0)
  ) {
    throw new RangeError(
      "Proper-C4 renderer calibration requires a C4-fixed frame target with exact x=0 and z=0.",
    );
  }
  const documents = controlDocuments();
  const pixelCount = source.widthPx * source.heightPx;
  const masks: Uint8Array[][] = [];
  let preparations = 0;
  let renders = 0;
  let disposals = 0;
  for (let memberIndex = 0; memberIndex < documents.length; memberIndex += 1) {
    let supplied: unknown;
    try {
      supplied = SAFE_REFLECT_APPLY(input.prepareModelMaskRenderer, undefined, [
        intrinsicRealBuildFreeze({
          candidateId: `proper-c4-calibration-q${QUARTER_TURNS[memberIndex]!}`,
          document: documents[memberIndex]!,
        }),
      ]);
    } catch (caught) {
      throw new TypeError("Proper-C4 renderer calibration could not prepare its control scene.", {
        cause: caught,
      });
    }
    const prepared = inspectRealBuildStepOnePreparedMaskRenderer(supplied);
    preparations += 1;
    const memberMasks: Uint8Array[] = [];
    let renderFailure: unknown;
    try {
      for (const hypothesis of PANEL_CAMERA_ANGULAR_HYPOTHESES) {
        renders += 1;
        memberMasks.push(
          snapshotPanelCameraBinaryMask(
            SAFE_REFLECT_APPLY(prepared.render, prepared.owner, [hypothesis]),
            pixelCount,
            `Proper-C4 calibration member ${memberIndex}`,
          ),
        );
      }
    } catch (caught) {
      renderFailure = caught;
    }
    try {
      SAFE_REFLECT_APPLY(prepared.dispose, prepared.owner, []);
      disposals += 1;
    } catch (caught) {
      throw new TypeError(
        "Proper-C4 renderer calibration could not dispose its control scene; discard the calibration and clean the task-owned context.",
        { cause: caught },
      );
    }
    if (renderFailure !== undefined) {
      throw new TypeError("Proper-C4 renderer calibration could not render its control orbit.", {
        cause: renderFailure,
      });
    }
    masks.push(memberMasks);
  }
  const maskDigests = intrinsicRealBuildFreeze(
    masks.map((member) => intrinsicRealBuildFreeze(member.map(digestBytes))),
  );
  const maskAreas = intrinsicRealBuildFreeze(
    masks.map((member) =>
      intrinsicRealBuildFreeze(
        member.map((mask) => mask.reduce((total, pixel) => total + pixel, 0)),
      ),
    ),
  );
  for (let memberIndex = 0; memberIndex < QUARTER_TURNS.length; memberIndex += 1) {
    for (
      let cameraIndex = 0;
      cameraIndex < PANEL_CAMERA_ANGULAR_HYPOTHESES.length;
      cameraIndex += 1
    ) {
      const representative = mapRealBuildStepOneProperC4MemberCameraToRepresentative(
        PANEL_CAMERA_ANGULAR_HYPOTHESES[cameraIndex]!,
        QUARTER_TURNS[memberIndex]!,
      );
      const representativeIndex = hypothesisIndex(representative);
      if (
        representativeIndex < 0 ||
        maskDigests[memberIndex]![cameraIndex] !== maskDigests[0]![representativeIndex]
      ) {
        throw new TypeError(
          "Proper-C4 renderer calibration did not reproduce exact member/camera mask parity.",
        );
      }
    }
  }
  if (
    preparations !== 4 ||
    renders !== 32 ||
    disposals !== 4 ||
    new Set(maskDigests[0]).size !== 8 ||
    maskAreas.flat().some((area) => area < 1 || area >= pixelCount)
  ) {
    throw new TypeError(
      "Proper-C4 renderer calibration requires four disposed scenes, 32 renders, eight distinct representative masks, and bounded nonempty silhouettes.",
    );
  }
  const sourceBindingDigest = realBuildStepOneProperC4SourceBindingDigest(source);
  const controlDocumentDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-renderer-control/1",
    documents,
  });
  const parityDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-renderer-parity/1",
    configurationDigest: configuration.configurationDigest,
    sourceBindingDigest,
    controlDocumentDigest,
    maskDigests,
    maskAreas,
  });
  const result = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-step-one-proper-c4-renderer-equivariance/1" as const,
    configurationDigest: configuration.configurationDigest,
    sourceBindingDigest,
    controlDocumentDigest,
    maskDigests,
    maskAreas,
    parityDigest,
    accounting: intrinsicRealBuildFreeze({
      controlDocuments: 4 as const,
      rendererPreparations: 4 as const,
      physicalRenderCalls: 32 as const,
      rendererDisposals: 4 as const,
    }),
    exactParity: true as const,
    backendClaim: "calibrated-same-factory-only" as const,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: intrinsicRealBuildFreeze({ status: "absent" as const, authorized: false }),
    authority: "absent" as const,
  });
  SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, inspections, [
    result,
    intrinsicRealBuildFreeze({
      factory: input.prepareModelMaskRenderer,
      configurationDigest: configuration.configurationDigest,
      sourceBindingDigest,
    }),
  ]);
  return result;
}

export function requireRealBuildStepOneProperC4RendererEquivariance(
  value: unknown,
  prepareModelMaskRenderer: RealBuildStepOneMaskRendererFactory,
  source: RealBuildCompiledObservationSourceInput,
): RealBuildStepOneProperC4RendererEquivarianceInspection {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Proper-C4 reduction requires one same-factory renderer calibration.");
  }
  const retained = SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, inspections, [value]) as
    | Readonly<{
        factory: RealBuildStepOneMaskRendererFactory;
        configurationDigest: Sha256Digest;
        sourceBindingDigest: Sha256Digest;
      }>
    | undefined;
  const configuration = inspectRealBuildStepOneMaskRendererFactoryConfiguration(
    prepareModelMaskRenderer,
    source,
  );
  const sourceBindingDigest = realBuildStepOneProperC4SourceBindingDigest(source);
  if (
    retained === undefined ||
    retained.factory !== prepareModelMaskRenderer ||
    retained.configurationDigest !== configuration.configurationDigest ||
    retained.sourceBindingDigest !== sourceBindingDigest
  ) {
    throw new TypeError(
      "Proper-C4 reduction requires the exact calibration from this factory, configuration, and source binding.",
    );
  }
  return value as RealBuildStepOneProperC4RendererEquivarianceInspection;
}

import {
  applyBuildOperations,
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import * as rendering from "@lego-studio/rendering";

import {
  enumeratePlacements,
  placementOccupancyKey,
  type PlacementCandidate,
} from "../src/assembly/enumerate-placements";
import { createPlacePartTransaction } from "../src/manual-commands";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type { RealBuildCompiledObservationSourceInput } from "./real-build-compiled-observation-source";
import {
  snapshotRealBuildEnumeratedPlacementOffer,
  type RealBuildEnumeratedPlacementOffer,
} from "./real-build-enumerated-placement-witness";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
} from "./real-build-prepared-step-authority";
import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "./real-build-panel-camera-resolver-boundary";
import {
  createRealBuildStepOneProperC4DataArray,
  createRealBuildStepOneProperC4DataObject,
  parseRealBuildStepOneProperC4BrowserJson,
  snapshotRealBuildStepOneProperC4DataObject,
} from "./real-build-step-one-proper-c4-data-snapshot";
import { inspectRealBuildStepOneProperC4Quotient } from "./real-build-step-one-proper-c4-quotient";
import { runRealBuildStepOneProperC4RenderReduction } from "./real-build-step-one-proper-c4-render-reduction";
import { calibrateRealBuildStepOneProperC4RendererEquivariance } from "./real-build-step-one-proper-c4-render-equivariance";
import {
  createRealBuildStepOneSilhouetteRendererFactory,
  inspectRealBuildStepOneMaskRendererFactoryConfiguration,
} from "./real-build-step-one-silhouette-renderer";
import {
  createRealBuildStepOneProperC4ContactCanvas,
  drawRealBuildStepOneProperC4ContactFrame,
} from "./real-build-step-one-proper-c4-visual-evidence";

export interface RealBuildStepOneProperC4BrowserIntegrationInput {
  readonly preparedRunInputBase64: string;
  readonly source: Omit<RealBuildCompiledObservationSourceInput, "sourceMask" | "excludedMask"> & {
    readonly sourceMaskBase64: string;
    readonly excludedMaskBase64: string | null;
  };
}

const SOURCE_INPUT_KEYS = [
  "provisionalStepIdentity",
  "observationMode",
  "registrationPanelStepNumber",
  "pageNumber",
  "panelDigest",
  "cropDigest",
  "sourceDescriptorDigest",
  "exclusionDescriptorDigest",
  "measure",
  "widthPx",
  "heightPx",
  "sourceMaskBase64",
  "excludedMaskBase64",
] as const;

function decodeBase64(value: string, label: string, maximumBytes: number): Uint8Array {
  if (typeof value !== "string" || value.length > Math.ceil(maximumBytes / 3) * 4 + 4) {
    throw new RangeError(`${label} exceeds its bounded base64 envelope.`);
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch (caught) {
    throw new TypeError(`${label} is not canonical base64.`, { cause: caught });
  }
  if (binary.length > maximumBytes) throw new RangeError(`${label} decodes above its byte limit.`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  let canonical = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    canonical += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  if (btoa(canonical) !== value) throw new TypeError(`${label} is not canonical base64.`);
  return bytes;
}

function distinct(candidates: readonly PlacementCandidate[]): readonly PlacementCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentRawCandidates(
  rootDocument: ReturnType<typeof createEmptyBrickDocument>,
  preparedStep: ReturnType<typeof inspectRealBuildPreparedStepInput>,
): readonly {
  readonly partIds: readonly [string, string];
  readonly offeredCandidates: readonly [
    RealBuildEnumeratedPlacementOffer,
    RealBuildEnumeratedPlacementOffer,
  ];
}[] {
  const [firstPiece, secondPiece] = preparedStep.expectedAtomicPieces;
  if (firstPiece === undefined || secondPiece === undefined) {
    throw new TypeError("Proper-C4 browser integration requires exactly two prepared pieces.");
  }
  const firstCandidates = distinct(
    enumeratePlacements(rootDocument, firstPiece.catalogPartId, {
      includeBuildPlate: true,
    }).candidates,
  );
  const rawCandidates = firstCandidates.flatMap((first) => {
    const firstTransaction = createPlacePartTransaction(rootDocument, {
      catalogPartId: first.catalogPartId,
      colorId: firstPiece.colorId,
      transform: first.transform,
    });
    const firstDocument = applyBuildOperations(rootDocument, firstTransaction.operations);
    const firstOffer = snapshotRealBuildEnumeratedPlacementOffer(first);
    return distinct(
      enumeratePlacements(firstDocument, secondPiece.catalogPartId, {}).candidates,
    ).map((second) => {
      const secondTransaction = createPlacePartTransaction(firstDocument, {
        catalogPartId: second.catalogPartId,
        colorId: secondPiece.colorId,
        transform: second.transform,
      });
      return createRealBuildStepOneProperC4DataObject(
        "partIds",
        createRealBuildStepOneProperC4DataArray(firstTransaction.partId, secondTransaction.partId),
        "offeredCandidates",
        createRealBuildStepOneProperC4DataArray(
          firstOffer,
          snapshotRealBuildEnumeratedPlacementOffer(second),
        ),
      ) as unknown as {
        readonly partIds: readonly [string, string];
        readonly offeredCandidates: readonly [
          RealBuildEnumeratedPlacementOffer,
          RealBuildEnumeratedPlacementOffer,
        ];
      };
    });
  });
  if (rawCandidates.length !== 400) {
    throw new TypeError(
      `Proper-C4 browser integration enumerated ${rawCandidates.length} rows; expected exactly 400.`,
    );
  }
  return createRealBuildStepOneProperC4DataArray(
    ...rawCandidates,
  ) as unknown as typeof rawCandidates;
}

/** Genuine-browser composition of the exact source, current quotient, calibration, and 20 closures. */
export function runRealBuildStepOneProperC4BrowserIntegration(inputJson: string) {
  const parsed = parseRealBuildStepOneProperC4BrowserJson(
    inputJson,
    "Proper-C4 browser integration input",
    8 * 1024 * 1024,
  );
  const inputRecord = snapshotRealBuildStepOneProperC4DataObject(
    parsed,
    "Proper-C4 browser integration input",
    ["preparedRunInputBase64", "source"],
  );
  const sourceRecord = snapshotRealBuildStepOneProperC4DataObject(
    inputRecord.source,
    "Proper-C4 browser integration source",
    SOURCE_INPUT_KEYS,
  );
  const input = {
    preparedRunInputBase64: inputRecord.preparedRunInputBase64,
    source: sourceRecord,
  } as unknown as RealBuildStepOneProperC4BrowserIntegrationInput;
  const preparedBytes = decodeBase64(
    input.preparedRunInputBase64,
    "Proper-C4 prepared run input",
    16 * 1024 * 1024,
  );
  const sourceMask = decodeBase64(
    input.source.sourceMaskBase64,
    "Proper-C4 source mask",
    1_048_576,
  );
  const excludedMask =
    input.source.excludedMaskBase64 === null
      ? null
      : decodeBase64(input.source.excludedMaskBase64, "Proper-C4 excluded mask", 1_048_576);
  const source: RealBuildCompiledObservationSourceInput = {
    provisionalStepIdentity: input.source.provisionalStepIdentity,
    observationMode: input.source.observationMode,
    registrationPanelStepNumber: input.source.registrationPanelStepNumber,
    pageNumber: input.source.pageNumber,
    panelDigest: input.source.panelDigest,
    cropDigest: input.source.cropDigest,
    sourceDescriptorDigest: input.source.sourceDescriptorDigest,
    exclusionDescriptorDigest: input.source.exclusionDescriptorDigest,
    measure: input.source.measure,
    widthPx: input.source.widthPx,
    heightPx: input.source.heightPx,
    sourceMask,
    excludedMask,
  };
  const preparedStep = inspectRealBuildPreparedStepInput(preparedBytes, 1);
  const policy = inspectRealBuildPreparedObservationPolicy(preparedBytes);
  const rootDocument = createEmptyBrickDocument({
    id: "prepared-search-empty-parent",
    name: "Prepared search empty parent",
    maxParts: 1_464,
  });
  const rootDocumentHash = documentStructuralHash(rootDocument);
  const rootDocumentSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(rootDocument),
    expectedDocumentHash: rootDocumentHash,
  });
  const quotient = inspectRealBuildStepOneProperC4Quotient(
    createRealBuildStepOneProperC4DataObject(
      "rootDocumentSnapshot",
      rootDocumentSnapshot,
      "preparedStep",
      preparedStep,
      "rawCandidates",
      currentRawCandidates(rootDocument, preparedStep),
    ),
  );
  const contacts = Array.from({ length: 8 }, (_, index) =>
    createRealBuildStepOneProperC4ContactCanvas("camera", String(index)),
  );
  const alternateContact = createRealBuildStepOneProperC4ContactCanvas(
    "alternate",
    "zoom-out-camera-0",
  );
  const scratch = document.createElement("canvas");
  scratch.width = source.widthPx;
  scratch.height = source.heightPx;
  const scratchContext = scratch.getContext("2d");
  if (scratchContext === null) throw new TypeError("Proper-C4 contact scratch needs 2D canvas.");
  const counts = {
    calibration: { preparations: 0, renders: 0, disposals: 0 },
    reduction: { preparations: 0, renders: 0, disposals: 0 },
    verification: { preparations: 0, renders: 0, disposals: 0 },
    alternateFrame: { preparations: 0, renders: 0, disposals: 0, contactFrames: 0 },
    contactFramesByCamera: Array.from({ length: 8 }, () => 0),
    instructionRendererDisposals: 0,
  };
  const reductionDocuments: unknown[] = [];
  const sceneRecords = new WeakMap<
    object,
    { kind: "calibration" | "reduction" | "verification"; renders: number }
  >();
  const instructionRenderer = rendering.createInstructionRenderer({
    width: source.widthPx,
    height: source.heightPx,
  });
  const instructionRendererBoundary = instructionRenderer as unknown as {
    readonly render: (root: unknown, camera: unknown) => ArrayLike<number>;
    readonly dispose: () => void;
  };
  try {
    const instrumentedRendering = {
      deriveBrickScene(subject: unknown, options: unknown) {
        const scene = rendering.deriveBrickScene(
          subject as ReturnType<typeof createEmptyBrickDocument>,
          options as Parameters<typeof rendering.deriveBrickScene>[1],
        );
        const id = (subject as { readonly id?: unknown }).id;
        const kind =
          typeof id === "string" && id.startsWith("proper-c4-calibration-q")
            ? ("calibration" as const)
            : counts.reduction.preparations < 100
              ? ("reduction" as const)
              : ("verification" as const);
        counts[kind].preparations += 1;
        if (kind === "reduction") {
          reductionDocuments.push(
            JSON.parse(
              canonicalBrickDocument(subject as ReturnType<typeof createEmptyBrickDocument>),
            ),
          );
        }
        sceneRecords.set(scene.root, { kind, renders: 0 });
        let disposed = false;
        return {
          root: scene.root,
          dispose() {
            if (!disposed) {
              disposed = true;
              counts[kind].disposals += 1;
            }
            scene.dispose();
          },
        };
      },
      setInstructionSilhouetteMode: rendering.setInstructionSilhouetteMode,
      createOrthographicViewCamera: rendering.createOrthographicViewCamera,
    };
    const renderer = {
      render(root: unknown, camera: unknown): Uint8Array {
        const pixels = new Uint8Array(instructionRendererBoundary.render(root, camera));
        const record = sceneRecords.get(root as object);
        if (record === undefined) throw new TypeError("Proper-C4 renderer lost its scene record.");
        counts[record.kind].renders += 1;
        if (record.kind === "reduction") {
          const cameraIndex = record.renders;
          const contact = contacts[cameraIndex];
          const frameIndex = counts.contactFramesByCamera[cameraIndex];
          if (contact === undefined || frameIndex === undefined) {
            throw new RangeError(`Proper-C4 reduction emitted unexpected camera ${cameraIndex}.`);
          }
          drawRealBuildStepOneProperC4ContactFrame({
            context: contact.context,
            scratch,
            scratchContext,
            pixels,
            widthPx: source.widthPx,
            heightPx: source.heightPx,
            index: frameIndex,
          });
          counts.contactFramesByCamera[cameraIndex] = frameIndex + 1;
        }
        record.renders += 1;
        return pixels;
      },
    };
    const factory = createRealBuildStepOneSilhouetteRendererFactory({
      rendering: instrumentedRendering,
      renderer,
      fittedView: { azimuthDegrees: 37, elevationDegrees: 29, pixelsPerUnit: 30 },
      frame: {
        widthPx: source.widthPx,
        heightPx: source.heightPx,
        target: [0, 0, 0],
        sceneRadius: 60,
      },
      centrePx: [source.widthPx / 2, source.heightPx / 2],
      widthPx: source.widthPx,
      heightPx: source.heightPx,
      registrationPanelStepNumber: 2,
    });
    const equivariance = calibrateRealBuildStepOneProperC4RendererEquivariance({
      prepareModelMaskRenderer: factory,
      source,
    });
    const reduction = runRealBuildStepOneProperC4RenderReduction(
      createRealBuildStepOneProperC4DataObject(
        "equivariance",
        equivariance,
        "policy",
        policy,
        "prepareModelMaskRenderer",
        factory,
        "preparedStep",
        preparedStep,
        "quotient",
        quotient,
        "rootDocumentSnapshot",
        rootDocumentSnapshot,
        "source",
        source,
      ),
    );
    if (reductionDocuments.length !== 100) {
      throw new TypeError(
        `Proper-C4 visual sweep retained ${reductionDocuments.length} representative documents; expected 100.`,
      );
    }
    const expectedRepresentativeHashes = reduction.closures.flatMap((closure) =>
      closure.representativeRows.slice(0, 5).map(({ documentHash }) => documentHash),
    );
    if (
      expectedRepresentativeHashes.length !== 100 ||
      reductionDocuments.some(
        (visualDocument, index) =>
          documentStructuralHash(visualDocument as ReturnType<typeof createEmptyBrickDocument>) !==
          expectedRepresentativeHashes[index],
      )
    ) {
      throw new TypeError(
        "Proper-C4 alternate visual sweep does not bind the exact ordered representative documents.",
      );
    }
    const alternateFactory = createRealBuildStepOneSilhouetteRendererFactory({
      rendering,
      renderer: {
        render(root: unknown, camera: unknown): Uint8Array {
          const pixels = new Uint8Array(instructionRendererBoundary.render(root, camera));
          drawRealBuildStepOneProperC4ContactFrame({
            context: alternateContact.context,
            scratch,
            scratchContext,
            pixels,
            widthPx: source.widthPx,
            heightPx: source.heightPx,
            index: counts.alternateFrame.contactFrames,
          });
          counts.alternateFrame.renders += 1;
          counts.alternateFrame.contactFrames += 1;
          return pixels;
        },
      },
      fittedView: { azimuthDegrees: 37, elevationDegrees: 29, pixelsPerUnit: 20 },
      frame: {
        widthPx: source.widthPx,
        heightPx: source.heightPx,
        target: [0, 0, 0],
        sceneRadius: 60,
      },
      centrePx: [source.widthPx / 2, source.heightPx / 2],
      widthPx: source.widthPx,
      heightPx: source.heightPx,
      registrationPanelStepNumber: 2,
    });
    const alternateFrameConfiguration = inspectRealBuildStepOneMaskRendererFactoryConfiguration(
      alternateFactory,
      {
        widthPx: source.widthPx,
        heightPx: source.heightPx,
        registrationPanelStepNumber: 2,
      },
    );
    if (alternateFrameConfiguration.configurationDigest === reduction.rendererConfigurationDigest) {
      throw new TypeError("Proper-C4 alternate visual frame did not change renderer scale.");
    }
    for (let index = 0; index < reductionDocuments.length; index += 1) {
      const prepared = alternateFactory({
        candidateId: `proper-c4-visual-${index}`,
        document: reductionDocuments[index],
      });
      counts.alternateFrame.preparations += 1;
      try {
        prepared.render(PANEL_CAMERA_ANGULAR_HYPOTHESES[0]!);
      } finally {
        prepared.dispose();
        counts.alternateFrame.disposals += 1;
      }
    }
    return {
      rawRosterDigest: quotient.rawRosterDigest,
      quotientDigest: quotient.quotientDigest,
      equivariance,
      integrationDigest: reduction.integrationDigest,
      rendererConfigurationDigest: reduction.rendererConfigurationDigest,
      sourceBindingDigest: reduction.sourceBindingDigest,
      closureDigestsDigest: reduction.closureDigestsDigest,
      populationEquivariance: reduction.rendererPopulationEquivariance,
      searchLedger: reduction.searchLedger,
      cameraLedger: reduction.cameraLedger,
      accounting: reduction.accounting,
      visualEvidence: {
        cameraSheets: contacts.length,
        framesPerCamera: counts.contactFramesByCamera,
        alternateFrame: {
          cameraIndex: 0,
          configurationDigest: alternateFrameConfiguration.configurationDigest,
          pixelsPerUnit: alternateFrameConfiguration.fittedView.pixelsPerUnit,
          frames: counts.alternateFrame.contactFrames,
        },
        authority: "absent",
      },
      globalAggregation: {
        representativeRowsDigest: reduction.globalAggregation.representativeRowsDigest,
        inverseExpandedRowsDigest: reduction.globalAggregation.inverseExpandedRowsDigest,
        rankingDigest: reduction.globalAggregation.rankingDigest,
        aggregationDigest: reduction.globalAggregation.aggregationDigest,
        selection: reduction.globalAggregation.selection,
        representativeRows: reduction.globalAggregation.representativeRows.length,
        inverseExpandedRows: reduction.globalAggregation.inverseExpandedRows.length,
        inverseMap: reduction.globalAggregation.quotientInverseMap.length,
      },
      counts,
      acceptedDocument: reduction.acceptedDocument,
      acceptedTransition: reduction.acceptedTransition,
      physicalFrameAuthority: reduction.physicalFrameAuthority,
      placementAuthority: reduction.placementAuthority,
      completionAuthority: reduction.completionAuthority,
      authority: reduction.authority,
    };
  } finally {
    instructionRendererBoundary.dispose();
    counts.instructionRendererDisposals += 1;
  }
}

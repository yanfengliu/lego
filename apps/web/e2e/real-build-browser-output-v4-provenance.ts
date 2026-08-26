import { canonicalDigest } from "@lego-studio/brick-kernel";

import type {
  RealBuildCompiledObservationCameraCommitment,
  RealBuildCompiledObservationMaskReference,
  RealBuildCompiledObservationSourceCommitment,
} from "./real-build-compiled-observation-closure-types";
import type { RealBuildCompiledLineageChildCandidate } from "./real-build-compiled-placement-lineage-types";
import { requireRealBuildBrowserCameraEvidenceInspection } from "./real-build-browser-output-v4-camera-evidence-reader";
import type {
  RealBuildBrowserCameraEvidencePreparedPanel,
  RealBuildBrowserCameraEvidenceRow,
} from "./real-build-browser-output-v4-camera-evidence-types";
import {
  requireRealBuildBrowserOutputV4EnvelopeInspection,
  type RealBuildBrowserOutputV4EnvelopeInspection,
} from "./real-build-browser-output-v4-envelope";
import {
  requireRealBuildBrowserBranchDetailedInspection,
  type RealBuildBrowserBranchDetailedInspection,
} from "./real-build-browser-output-v4-semantic";
import { requireRealBuildBrowserOutputV4SourceEvidenceInspection } from "./real-build-browser-output-v4-source-evidence-reader";
import type {
  RealBuildBrowserOutputV4SourceEvidenceInspection,
  RealBuildBrowserOutputV4SourceEvidenceMaskReference,
  RealBuildBrowserOutputV4SourceEvidencePanel,
} from "./real-build-browser-output-v4-source-evidence-types";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  snapshotRealBuildBrowserOutputV4ProvenanceInput,
  type RealBuildBrowserOutputV4ProvenanceInput,
} from "./real-build-browser-output-v4-provenance-input";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";
import type { RealBuildPanelRasterSpec } from "./real-build-safety";

export const REAL_BUILD_BROWSER_OUTPUT_V4_DERIVATION_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "source-and-camera-bytes-reproduce-but-pdf-render-execution-is-not-proven" as const,
});

export interface RealBuildBrowserOutputV4ProvenanceStepInspection {
  readonly stepNumber: number;
  readonly sourceCommitments: number;
  readonly cameraCommitments: number;
  readonly scoredObservations: number;
  readonly sourceAndCameraDerivation: "verified" | "not-applicable";
  readonly provisionalAuthority: "absent";
  readonly sourceExecutionProvenanceAuthority: "absent";
}

export interface RealBuildBrowserOutputV4ProvenanceInspection {
  readonly schemaVersion: "lego.real-build-browser-output-v4-provenance-inspection/2";
  readonly sourceIndexPanels: 359;
  readonly preparedActionPanels: number;
  readonly passiveObservationPanels: number;
  readonly indexedBranchSteps: number;
  readonly cameraRows: number;
  readonly steps: readonly RealBuildBrowserOutputV4ProvenanceStepInspection[];
  readonly derivationReproducible: true;
  readonly provenanceAuthority: "absent";
  readonly provisionalAuthority: "absent";
  readonly sourceExecutionProvenanceAuthority: "absent";
  readonly placementAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_DERIVATION_AUTHORITY;
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_DERIVATION_AUTHORITY;
}

const inspections = new WeakSet<object>();
const REFLECT_APPLY = Reflect.apply;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

function inspectionAdd(value: object): void {
  REFLECT_APPLY(WEAK_SET_ADD, inspections, [value]);
}

function inspectionHas(value: object): boolean {
  return REFLECT_APPLY(WEAK_SET_HAS, inspections, [value]) as boolean;
}

function sameBounds(
  left: {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  },
  right: {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  },
): boolean {
  return (
    left.minXPt === right.minXPt &&
    left.maxXPt === right.maxXPt &&
    left.minYPt === right.minYPt &&
    left.maxYPt === right.maxYPt
  );
}

function bindPreparedPanels(
  envelope: RealBuildBrowserOutputV4EnvelopeInspection,
  source: RealBuildBrowserOutputV4SourceEvidenceInspection,
): ReadonlyMap<number, RealBuildPanelRasterSpec> {
  const manifest = source.manifest;
  const prepared = envelope.preparedBoundary;
  if (
    manifest.preparedRunInputDigest !== prepared.preparedRunInputDigest ||
    manifest.pdfDigest !== prepared.inputDigests.pdf ||
    manifest.rasterPolicy.renderScale !== prepared.renderScale ||
    manifest.rasterPolicy.panelWidth !== prepared.panelWidth ||
    manifest.rasterPolicy.workFactor !== prepared.workFactor ||
    manifest.panels.length !== 359 ||
    prepared.panels.length !== prepared.lastStep ||
    prepared.passivePanels.length > prepared.fartherPanelMaximumReachSteps
  ) {
    throw new TypeError(
      "Browser output /4 source manifest does not bind the exact prepared run, PDF, raster policy, and 359-panel set.",
    );
  }
  const preparedPanels = [...prepared.panels, ...prepared.passivePanels];
  const byStep = new Map<number, RealBuildPanelRasterSpec>();
  for (let index = 0; index < preparedPanels.length; index += 1) {
    const expected = preparedPanels[index]!;
    const expectedStepNumber = index + 1;
    const actual = manifest.panels[expected.stepNumber - 1];
    if (
      actual === undefined ||
      expected.stepNumber !== expectedStepNumber ||
      byStep.has(expected.stepNumber)
    ) {
      throw new TypeError(
        `Browser output /4 prepared action/passive window must be an ordered unique prefix; row ${index} names ${expected.stepNumber}.`,
      );
    }
    const expectedPanelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest: manifest.pdfDigest,
      stepNumber: expected.stepNumber,
      pageNumber: expected.pageNumber,
      bounds: expected,
      calloutBoxes: expected.calloutBoxes,
    });
    const expectedCropDescriptorDigest = canonicalDigest({
      schemaVersion: "lego.real-build-calibration-crop/1",
      panel: {
        stepNumber: expected.stepNumber,
        pageNumber: expected.pageNumber,
        minXPt: expected.minXPt,
        maxXPt: expected.maxXPt,
        minYPt: expected.minYPt,
        maxYPt: expected.maxYPt,
        calloutBoxes: expected.calloutBoxes,
        panelEvidenceDigest: expectedPanelEvidenceDigest,
      },
      highWidth: actual.highWidth,
      highHeight: actual.highHeight,
    });
    if (
      actual.stepNumber !== expected.stepNumber ||
      actual.pageNumber !== expected.pageNumber ||
      !sameBounds(actual, expected) ||
      actual.calloutBoxes.length !== expected.calloutBoxes.length ||
      actual.calloutBoxes.some(
        (box, boxIndex) => !sameBounds(box, expected.calloutBoxes[boxIndex]!),
      ) ||
      actual.panelEvidenceDigest !== expectedPanelEvidenceDigest ||
      actual.cropDescriptorDigest !== expectedCropDescriptorDigest
    ) {
      throw new TypeError(
        `Browser output /4 source panel ${expected.stepNumber} does not preserve its exact prepared page, crop, or callouts.`,
      );
    }
    byStep.set(expected.stepNumber, expected);
  }
  return byStep;
}

function sameMaskReference(
  left: RealBuildCompiledObservationMaskReference,
  right: RealBuildCompiledObservationMaskReference,
): boolean {
  return (
    left.role === right.role &&
    left.offset === right.offset &&
    left.bytes === right.bytes &&
    left.digest === right.digest &&
    left.encoding === right.encoding &&
    left.widthPx === right.widthPx &&
    left.heightPx === right.heightPx
  );
}

function sameMaskContent(
  source: RealBuildBrowserOutputV4SourceEvidenceMaskReference,
  compiled: RealBuildCompiledObservationMaskReference,
): boolean {
  return (
    source.contentEncoding === compiled.encoding &&
    source.byteLength === compiled.bytes &&
    source.packedDigest === compiled.digest &&
    source.width === compiled.widthPx &&
    source.height === compiled.heightPx
  );
}

function namedMask(
  panel: RealBuildBrowserOutputV4SourceEvidencePanel,
  name: "own-panel-source" | "own-panel-exclusion" | "lookahead-source" | "lookahead-exclusion",
): RealBuildBrowserOutputV4SourceEvidenceMaskReference {
  const mask = panel.masks.find((candidate) => candidate.name === name);
  if (mask === undefined) {
    throw new TypeError(`Source evidence step ${panel.stepNumber} has no ${name} mask.`);
  }
  return mask;
}

function bindSourceCommitment(
  source: RealBuildCompiledObservationSourceCommitment,
  detailed: RealBuildBrowserBranchDetailedInspection["steps"][number],
  sourcePanel: RealBuildBrowserOutputV4SourceEvidencePanel,
): void {
  const mode =
    source.observationMode === "own-panel" ? sourcePanel.ownPanel : sourcePanel.lookahead;
  const sourceMask = namedMask(
    sourcePanel,
    source.observationMode === "own-panel" ? "own-panel-source" : "lookahead-source",
  );
  const excludedMask = namedMask(
    sourcePanel,
    source.observationMode === "own-panel" ? "own-panel-exclusion" : "lookahead-exclusion",
  );
  if (
    source.preparedRunInputDigest !== detailed.preparedStep.preparedRunInputDigest ||
    source.preparedStepIdentity !== detailed.preparedStep.printedStepIdentity ||
    source.compiledThroughStepNumber !== detailed.stepNumber ||
    source.registrationPanelStepNumber !== sourcePanel.stepNumber ||
    source.pageNumber !== sourcePanel.pageNumber ||
    source.panelDigest !== sourcePanel.panelEvidenceDigest ||
    source.cropDigest !== sourcePanel.cropDescriptorDigest ||
    source.sourceDescriptorDigest !== mode.sourceDescriptorDigest ||
    source.exclusionDescriptorDigest !== mode.exclusionDescriptorDigest ||
    source.measure !== mode.measure ||
    !sameMaskContent(sourceMask, source.sourceMask) ||
    !sameMaskContent(excludedMask, source.excludedMask)
  ) {
    throw new TypeError(
      `Browser output /4 branch step ${detailed.stepNumber} source ${source.sourceId} does not bind its exact prepared panel and reproduced source/exclusion masks.`,
    );
  }
}

function samePreparedSource(
  source: RealBuildCompiledObservationSourceCommitment,
  camera: RealBuildBrowserCameraEvidencePreparedPanel,
): boolean {
  return (
    source.preparedRunInputDigest === camera.preparedRunInputDigest &&
    source.preparedStepIdentity === camera.preparedStepIdentity &&
    source.provisionalStepIdentity === camera.provisionalStepIdentity &&
    source.observationMode === camera.observationMode &&
    source.compiledThroughStepNumber === camera.compiledThroughStepNumber &&
    source.registrationPanelStepNumber === camera.registrationPanelStepNumber &&
    source.pageNumber === camera.pageNumber &&
    source.panelDigest === camera.panelDigest &&
    source.cropDigest === camera.cropDigest &&
    source.sourceDescriptorDigest === camera.sourceDescriptorDigest &&
    source.exclusionDescriptorDigest === camera.exclusionDescriptorDigest &&
    source.measure === camera.measure
  );
}

function exactChild(
  children: readonly RealBuildCompiledLineageChildCandidate[],
  row: RealBuildBrowserCameraEvidenceRow,
): RealBuildCompiledLineageChildCandidate {
  const matching = children.filter(
    (child) =>
      child.candidateId === row.child.candidateId &&
      child.documentHash === row.child.documentHash &&
      child.canonicalBytesHash === row.child.canonicalBytesDigest &&
      child.canonicalByteLength === row.child.canonicalByteLength,
  );
  if (matching.length !== 1) {
    throw new TypeError(
      `Browser camera ${row.cameraId} does not uniquely bind one compiled exact child byte string.`,
    );
  }
  return matching[0]!;
}

function bindCameraCommitment(
  camera: RealBuildCompiledObservationCameraCommitment,
  source: RealBuildCompiledObservationSourceCommitment,
  row: RealBuildBrowserCameraEvidenceRow,
  detailed: RealBuildBrowserBranchDetailedInspection["steps"][number],
  preparedPanel: RealBuildPanelRasterSpec,
): void {
  exactChild(detailed.lineageInspection.evidence.childCandidates, row);
  if (
    camera.cameraId !== row.cameraId ||
    camera.sourceId !== row.sourceId ||
    camera.candidateId !== row.child.candidateId ||
    camera.documentHash !== row.child.documentHash ||
    camera.d4CameraRecipeDigest !== row.d4CameraRecipeDigest ||
    camera.rendererSnapshotDigest !== row.rendererSnapshotDigest ||
    !sameMaskReference(camera.candidateMask, row.candidateMask) ||
    !samePreparedSource(source, row.preparedPanel) ||
    !sameMaskReference(source.sourceMask, row.sourceMask) ||
    !sameMaskReference(source.excludedMask, row.excludedMask) ||
    row.preparedPanel.pageNumber !== preparedPanel.pageNumber ||
    row.preparedPanel.face !== preparedPanel.panelFace ||
    !sameBounds(row.preparedPanel.crop, preparedPanel)
  ) {
    throw new TypeError(
      `Browser camera ${row.cameraId} does not bind the closure source, exact child, D4 recipe, renderer, masks, and prepared panel.`,
    );
  }
}

function sameRole(
  left: { readonly role: string; readonly bytes: number; readonly digest: string },
  right: { readonly role: string; readonly bytes: number; readonly digest: string },
): boolean {
  return left.role === right.role && left.bytes === right.bytes && left.digest === right.digest;
}

/**
 * Cross-binds already replayed source/camera roles to the prepared panels and
 * typed branch closures. It proves deterministic derivation only; exact PDF
 * render execution and the opaque provisional identity remain explicitly absent.
 */
export function inspectRealBuildBrowserOutputV4Provenance(
  inputValue: RealBuildBrowserOutputV4ProvenanceInput,
): RealBuildBrowserOutputV4ProvenanceInspection {
  const input = snapshotRealBuildBrowserOutputV4ProvenanceInput(inputValue);
  const envelope = requireRealBuildBrowserOutputV4EnvelopeInspection(input.envelope);
  const branch = requireRealBuildBrowserBranchDetailedInspection(input.branch);
  const source = requireRealBuildBrowserOutputV4SourceEvidenceInspection(input.source);
  const camera = requireRealBuildBrowserCameraEvidenceInspection(input.camera);
  if (
    branch.preparedRun.preparedRunInputDigest !== envelope.preparedRun.preparedRunInputDigest ||
    source.manifest.preparedRunInputDigest !== envelope.preparedRun.preparedRunInputDigest
  ) {
    throw new TypeError(
      "Browser output /4 prepared-run digest differs across envelope, branch, and source inspections.",
    );
  }
  const preparedPanelsByStep = bindPreparedPanels(envelope, source);
  if (
    !sameRole(branch.branch.compiledBranchRole, envelope.envelope.evidence.compiledBranchRole) ||
    !sameRole(branch.branch.observationRole, envelope.envelope.evidence.branchObservationRole) ||
    !sameRole(camera.manifest.renderRole, envelope.envelope.evidence.cameraRenderRole) ||
    !sameRole(camera.manifest.maskRole, envelope.envelope.evidence.cameraMaskRole)
  ) {
    throw new TypeError(
      "Browser output /4 external branch or camera role descriptors differ from the envelope commitments.",
    );
  }

  const cameraRows = new Map<string, RealBuildBrowserCameraEvidenceRow>();
  for (const row of camera.manifest.rows) {
    if (cameraRows.has(row.cameraId)) {
      throw new TypeError(`Browser camera manifest duplicates ${row.cameraId}.`);
    }
    cameraRows.set(row.cameraId, row);
  }
  const usedCameraIds = new Set<string>();
  const steps: RealBuildBrowserOutputV4ProvenanceStepInspection[] = [];
  let expectedCameraMaskBaseOffset = 0;
  for (const detailed of branch.steps) {
    const closure = detailed.observation?.closure ?? null;
    if (closure === null) {
      steps.push(
        intrinsicRealBuildFreeze({
          stepNumber: detailed.stepNumber,
          sourceCommitments: 0,
          cameraCommitments: 0,
          scoredObservations: 0,
          sourceAndCameraDerivation: "not-applicable" as const,
          provisionalAuthority: "absent" as const,
          sourceExecutionProvenanceAuthority: "absent" as const,
        }),
      );
      continue;
    }
    const sources = new Map(closure.sources.map((source) => [source.sourceId, source]));
    for (const sourceCommitment of closure.sources) {
      const preparedPanel = preparedPanelsByStep.get(sourceCommitment.registrationPanelStepNumber);
      const panel = source.manifest.panels[sourceCommitment.registrationPanelStepNumber - 1];
      if (preparedPanel === undefined || panel === undefined) {
        throw new TypeError(
          `Browser branch step ${detailed.stepNumber} source ${sourceCommitment.sourceId} names panel ${sourceCommitment.registrationPanelStepNumber} outside the prepared action/passive window.`,
        );
      }
      bindSourceCommitment(sourceCommitment, detailed, panel);
    }
    for (const cameraCommitment of closure.cameras) {
      const row = cameraRows.get(cameraCommitment.cameraId);
      const sourceCommitment = sources.get(cameraCommitment.sourceId);
      if (row === undefined || sourceCommitment === undefined) {
        throw new TypeError(
          `Browser branch step ${detailed.stepNumber} camera ${cameraCommitment.cameraId} has no exact external row or source.`,
        );
      }
      const panel = preparedPanelsByStep.get(row.preparedPanel.registrationPanelStepNumber);
      if (panel === undefined) {
        throw new TypeError(
          `Browser camera ${row.cameraId} names missing prepared panel ${row.preparedPanel.registrationPanelStepNumber}.`,
        );
      }
      if (row.maskRoleBaseOffset !== expectedCameraMaskBaseOffset) {
        throw new TypeError(
          `Browser branch step ${detailed.stepNumber} camera ${row.cameraId} uses global mask base ${row.maskRoleBaseOffset}; expected ${expectedCameraMaskBaseOffset} for its exact closure-local role.`,
        );
      }
      bindCameraCommitment(cameraCommitment, sourceCommitment, row, detailed, panel);
      usedCameraIds.add(row.cameraId);
    }
    if (closure.cameras.length > 0) expectedCameraMaskBaseOffset += closure.roleBytes;
    let scoredObservations = 0;
    for (const observation of closure.observations) {
      if (observation.cameraId === null) continue;
      const row = cameraRows.get(observation.cameraId);
      if (
        row === undefined ||
        observation.status !== "scored" ||
        observation.score !== row.registration.score ||
        observation.shiftPx?.[0] !== row.registration.shiftPx[0] ||
        observation.shiftPx?.[1] !== row.registration.shiftPx[1]
      ) {
        throw new TypeError(
          `Browser observation ${observation.observationId} does not bind its replayed camera registration score and shift.`,
        );
      }
      scoredObservations += 1;
    }
    steps.push(
      intrinsicRealBuildFreeze({
        stepNumber: detailed.stepNumber,
        sourceCommitments: closure.sources.length,
        cameraCommitments: closure.cameras.length,
        scoredObservations,
        sourceAndCameraDerivation: "verified" as const,
        provisionalAuthority: "absent" as const,
        sourceExecutionProvenanceAuthority: "absent" as const,
      }),
    );
  }
  const orphan = camera.manifest.rows.find((row) => !usedCameraIds.has(row.cameraId));
  if (orphan !== undefined) {
    throw new TypeError(
      `Browser camera manifest retains orphan ${orphan.cameraId} outside every branch closure.`,
    );
  }
  if (expectedCameraMaskBaseOffset !== camera.manifest.maskRole.bytes) {
    throw new TypeError(
      `Browser camera role closes at ${camera.manifest.maskRole.bytes} bytes; expected ${expectedCameraMaskBaseOffset} from its ordered camera-bearing closure roles.`,
    );
  }
  const inspection = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-browser-output-v4-provenance-inspection/2" as const,
    sourceIndexPanels: 359 as const,
    preparedActionPanels: envelope.preparedBoundary.panels.length,
    passiveObservationPanels: envelope.preparedBoundary.passivePanels.length,
    indexedBranchSteps: branch.steps.length,
    cameraRows: camera.manifest.rows.length,
    steps: intrinsicRealBuildFreeze(steps),
    derivationReproducible: true as const,
    provenanceAuthority: "absent" as const,
    provisionalAuthority: "absent" as const,
    sourceExecutionProvenanceAuthority: "absent" as const,
    placementAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_DERIVATION_AUTHORITY,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_DERIVATION_AUTHORITY,
  });
  inspectionAdd(inspection);
  return inspection;
}

export function requireRealBuildBrowserOutputV4ProvenanceInspection(
  value: unknown,
): RealBuildBrowserOutputV4ProvenanceInspection {
  if (value === null || typeof value !== "object" || !inspectionHas(value)) {
    throw new TypeError(
      "Browser output /4 provenance must be the exact authority-free cross-binding result.",
    );
  }
  return value as RealBuildBrowserOutputV4ProvenanceInspection;
}

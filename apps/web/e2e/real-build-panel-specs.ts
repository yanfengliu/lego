import type { PanelFace } from "../src/assembly/panel-face";
import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import { sha256Digest } from "./real-build-artifacts";
import {
  contractFailure,
  readCalloutCropInput,
  type CalloutResolution,
} from "./real-build-input-files";
import { isTrustedIdentificationConfidence } from "./real-build-identification-trust";
import {
  actionEvidenceDigest,
  type LedgerStep,
  type OfficialModelIndex,
} from "./real-build-ledger";
import {
  resolveCoverageCallout,
  type RealBuildInputDigests,
  type RealBuildPanelSpec,
  type StepFailure,
  type V5ManifestCallout,
} from "./real-build-safety";

function isExecutableLedgerStep(value: unknown): value is LedgerStep {
  if (typeof value !== "object" || value === null) return false;
  const step = value as {
    stepNumber?: unknown;
    pageNumber?: unknown;
    callouts?: unknown;
    action?: unknown;
  };
  if (
    !Number.isInteger(step.stepNumber) ||
    !Number.isInteger(step.pageNumber) ||
    !Array.isArray(step.callouts) ||
    !step.callouts.every(
      (callout) =>
        typeof callout === "object" &&
        callout !== null &&
        typeof (callout as { calloutKey?: unknown }).calloutKey === "string" &&
        Array.isArray((callout as { physicalBrickRefs?: unknown }).physicalBrickRefs) &&
        Number.isInteger(
          (callout as { semanticMultiplierQuantity?: unknown }).semanticMultiplierQuantity,
        ),
    ) ||
    typeof step.action !== "object" ||
    step.action === null
  ) {
    return false;
  }
  const action = step.action as {
    kind?: unknown;
    pieces?: unknown;
    omittedPieces?: unknown;
    copies?: unknown;
  };
  return (
    (action.kind === "place-callouts" &&
      Array.isArray(action.pieces) &&
      action.pieces.every((piece) => typeof piece === "object" && piece !== null) &&
      Array.isArray(action.omittedPieces) &&
      action.omittedPieces.every((piece) => typeof piece === "object" && piece !== null)) ||
    (action.kind === "multi-build-copy" &&
      Array.isArray(action.copies) &&
      action.copies.every((piece) => typeof piece === "object" && piece !== null)) ||
    action.kind === "transition"
  );
}

export function buildRealBuildPanelSpecs(input: {
  readonly repoRoot: string;
  readonly calloutDirectory: string;
  readonly panels: readonly StepPanel[];
  /**
   * Which face each printed step is drawn from, over the contiguous prefix the
   * caller derived. A step absent from this map gets a null face and the run
   * refuses it rather than assuming studs-up.
   */
  readonly facesByStep: ReadonlyMap<number, PanelFace>;
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  readonly stepByCalloutIdentity: ReadonlyMap<string, number>;
  readonly manifestCallouts: readonly V5ManifestCallout[];
  readonly ledgerSteps: readonly unknown[];
  readonly officialModel: OfficialModelIndex | null;
  /** `null` when the coverage closure never bound; an empty object is a bound but empty index. */
  readonly coverageByCallout: Readonly<Record<string, CalloutResolution>> | null;
  readonly inputDigests: RealBuildInputDigests;
}): readonly RealBuildPanelSpec[] {
  const ledgerByStep = new Map<number, LedgerStep>();
  for (const step of input.ledgerSteps) {
    if (isExecutableLedgerStep(step) && !ledgerByStep.has(step.stepNumber)) {
      ledgerByStep.set(step.stepNumber, step);
    }
  }

  return input.panels.map((panel) => {
    const entries = input.manifestCallouts.filter(
      ({ identity, evidenceKind }) =>
        input.stepByCalloutIdentity.get(identity) === panel.stepNumber &&
        evidenceKind === "part-art",
    );
    const ledgerStep = ledgerByStep.get(panel.stepNumber);
    const rawQuantity =
      ledgerStep === undefined
        ? entries.reduce((total, entry) => total + entry.quantity, 0)
        : ledgerStep.callouts.reduce(
            (total, callout) =>
              total + callout.physicalBrickRefs.length + callout.semanticMultiplierQuantity,
            0,
          );
    const classifiedPhysical =
      ledgerStep === undefined
        ? entries.reduce((total, entry) => total + (entry.physicalQuantity ?? entry.quantity), 0)
        : ledgerStep.callouts.reduce(
            (total, callout) => total + callout.physicalBrickRefs.length,
            0,
          );
    const semanticQuantity =
      ledgerStep === undefined
        ? entries.reduce((total, entry) => total + (entry.semanticMultiplierQuantity ?? 0), 0)
        : ledgerStep.callouts.reduce(
            (total, callout) => total + callout.semanticMultiplierQuantity,
            0,
          );
    const coverageFailures: StepFailure[] = [];
    const missingDesigns = new Set<string>();
    const unresolvedCallouts = new Set<string>();

    for (const entry of entries) {
      const unsafeCropPath = `${input.calloutDirectory}/${entry.file}`;
      let cropDigest: string | null = null;
      try {
        cropDigest = sha256Digest(
          readCalloutCropInput(input.repoRoot, unsafeCropPath, unsafeCropPath),
        );
      } catch (error) {
        coverageFailures.push(
          contractFailure(
            unsafeCropPath,
            `Manifest callout ${entry.file} could not be read through a contained bounded descriptor: ${String(error)}.`,
          ),
        );
      }
      if (cropDigest === null) {
        coverageFailures.push(
          contractFailure(
            unsafeCropPath,
            `Manifest callout ${entry.file} has no safe retained crop at ${unsafeCropPath}.`,
          ),
        );
        continue;
      }
      if (cropDigest !== entry.sha256) {
        coverageFailures.push(
          contractFailure(
            unsafeCropPath,
            `Manifest callout ${entry.identity} declares crop digest ${entry.sha256}, but retained bytes at ` +
              `${unsafeCropPath} hash to ${cropDigest}. Republish the crop run; neither manifest nor bytes may ` +
              `silently replace the other.`,
          ),
        );
        continue;
      }
      // An unbound closure leaves nothing to resolve against. Resolving against a
      // substituted empty index would report every callout as uncovered, which is
      // a claim about the substitute rather than about the coverage artifact.
      if (input.coverageByCallout === null) continue;
      const resolved = resolveCoverageCallout(input.coverageByCallout, {
        identity: entry.identity,
        pageNumber: entry.pageNumber,
        stepNumber: panel.stepNumber,
        quantity: entry.quantity,
        cropDigest,
        identificationInputDigest: input.inputDigests.calloutManifest,
      });
      if (resolved.failure !== null || resolved.claim === null) {
        coverageFailures.push(resolved.failure!);
        unresolvedCallouts.add(`${entry.file} (${entry.quantity}x)`);
        continue;
      }
      const claim = resolved.claim;
      if (claim.resolution?.catalogPartId === null || claim.resolution === null) {
        if (claim.resolution === null) unresolvedCallouts.add(`${entry.file} (${entry.quantity}x)`);
        else missingDesigns.add(`${claim.resolution.partNum} "${claim.resolution.name}"`);
      }
    }

    const pieces: RealBuildPanelSpec["pieces"][number][] = [];
    const omittedPieces: RealBuildPanelSpec["omittedPieces"][number][] = [];
    let action: RealBuildPanelSpec["action"];
    const actionDigest =
      ledgerStep === undefined
        ? "missing"
        : actionEvidenceDigest({
            ledgerDigest: input.inputDigests.actionLedger,
            officialModelDigest: input.inputDigests.officialModel,
            builderCalibrationDigest: input.inputDigests.builderCalibration,
            transitionClassificationsDigest: input.inputDigests.transitionClassifications,
            step: ledgerStep,
          });
    if (ledgerStep?.action.kind === "place-callouts") {
      for (const piece of ledgerStep.action.pieces) {
        if (
          piece.calloutKey === null ||
          !isTrustedIdentificationConfidence(piece.identificationConfidence)
        ) {
          continue;
        }
        const expectedTransform =
          input.officialModel?.bricks[piece.brickRef]?.canonicalTransform ?? null;
        if (expectedTransform === null) continue;
        pieces.push({
          identityKey: piece.brickRef,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          calloutKey: piece.calloutKey,
          // The ledger piece's own confidence, so the run contract records which
          // trust source actually placed each piece rather than one fixed label.
          identificationConfidence: piece.identificationConfidence,
          cropDigest: piece.cropDigest,
          identificationInputDigest: piece.identificationInputDigest,
          expectedTransform,
        });
      }
      for (const piece of ledgerStep.action.omittedPieces) {
        const officialTransform =
          input.officialModel?.bricks[piece.brickRef]?.canonicalTransform ?? null;
        if (officialTransform === null) continue;
        omittedPieces.push({
          identityKey: piece.brickRef,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          evidenceDigest: piece.evidenceDigest,
          transform: officialTransform,
        });
      }
      action = {
        kind: "place-callouts",
        assembledPieces: pieces.length + omittedPieces.length,
        evidenceDigest: actionDigest,
      };
    } else if (ledgerStep?.action.kind === "multi-build-copy") {
      const copies = ledgerStep.action.copies.flatMap((copy) => {
        const transform = input.officialModel?.bricks[copy.brickRef]?.canonicalTransform ?? null;
        return transform === null
          ? []
          : [
              {
                identityKey: copy.brickRef,
                sourceIdentityKey: copy.sourceBrickRef,
                designId: copy.designId,
                materialId: copy.materialId,
                catalogPartId: copy.catalogPartId,
                colorId: copy.colorId,
                evidenceDigest: copy.evidenceDigest,
                transform,
              },
            ];
      });
      action = {
        kind: "multi-build-copy",
        assembledPieces: copies.length,
        sourceStepNumber: ledgerStep.action.sourceStepNumber,
        evidenceDigest: actionDigest,
        copies,
      };
    } else if (ledgerStep?.action.kind === "transition") {
      action = {
        kind: "transition",
        assembledPieces: 0,
        transition: ledgerStep.action.transition,
        panelEvidenceDigest: ledgerStep.panelEvidenceDigest,
        classificationEvidenceDigest: ledgerStep.action.classificationEvidenceDigest,
        evidenceDigest: actionDigest,
      };
    } else {
      action = {
        kind: "transition",
        assembledPieces: 0,
        transition: "unclassified",
        panelEvidenceDigest: null,
        classificationEvidenceDigest: null,
        evidenceDigest: actionDigest,
      };
    }

    return {
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      panelFace: input.facesByStep.get(panel.stepNumber) ?? null,
      minXPt: panel.bounds.minXPt,
      maxXPt: panel.bounds.maxXPt,
      minYPt: panel.bounds.minYPt,
      maxYPt: panel.bounds.maxYPt,
      calloutBoxes: input.calloutBoxesByStep[panel.stepNumber] ?? [],
      mappedCalloutKeys: entries.map(({ identity }) => identity),
      pieces,
      omittedPieces,
      calloutPieces: rawQuantity,
      classifiedPhysicalCalloutPieces: classifiedPhysical,
      semanticMultiplierQuantity: semanticQuantity,
      omittedPhysicalPieces: omittedPieces.length,
      action,
      coverageFailures,
      missingDesigns: [...missingDesigns],
      unresolvedCallouts: [...unresolvedCallouts],
    };
  });
}

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  readSampleBooklet,
  sampleBookletCalloutBoxes,
  sampleBookletPanels,
} from "./booklet-fixture";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import {
  beginAtomicRun,
  createRealBuildRunContract,
  enumerateRealBuildCodeRoots,
  planAtomicRunDirectory,
  REAL_BUILD_SCORE_SCHEMA,
  sha256Digest,
  snapshotRealBuildCodeRoots,
  validateRealBuildOutputRoot,
  verifyRealBuildArtifactManifest,
  writeRealBuildArtifactManifest,
} from "./real-build-artifacts";
import {
  OFFICIAL_REAL_BUILD_ACCOUNTING,
  inputRejectedRealBuildResult,
  preflightRealBuildOptions,
} from "./real-build-contract";
import { finalizeExecutedRealBuildResult, realBuildExecutionFailure } from "./real-build-finalize";
import {
  actionEvidenceDigest,
  applyBuilderCanonicalCalibration,
  isUnauthenticatedTransitionClassification,
  parseOfficialModelIndex,
  stepPanelEvidenceDigest,
  transitionClassificationEvidenceDigest,
  validateOfficialModelAccounting,
  validateRealBuildActionLedger,
  type BuilderCanonicalCalibration,
  type LedgerStep,
  type OfficialModelIndex,
  type RealBuildActionLedger,
  type TransitionClassificationEvidence,
} from "./real-build-ledger";
import {
  bindCalloutsToBookletPanels,
  isAtomicStepComplete,
  isV4ManifestCallout,
  resolveCoverageCallout,
  type CoverageCalloutClaim,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildResult,
  type StepFailure,
  type V4ManifestCallout,
} from "./real-build-safety";
import type { RealBuildBrowserOutput } from "./real-build-browser-output";
import {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  resolveRealBuildPath,
  sourceDriftFailures,
  writeRealBuildReplayClosure,
} from "./real-build-replay";
import { REAL_BUILD_SOURCE_ROOTS } from "./real-build-source-roots";
import { realBuildRunBudgets, realBuildRunThresholds } from "./real-build-run-contract";
import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

const OUTPUT_ROOT = process.env.LEGO_REAL_BUILD_OUT ?? "output/real-build";
const COVERAGE_PATH =
  process.env.LEGO_REAL_BUILD_COVERAGE ?? "output/real-build/catalog-coverage.json";
const MANIFEST_PATH =
  process.env.LEGO_REAL_BUILD_MANIFEST ?? "output/callout-thumbnails/manifest.json";
const CALLOUT_DIRECTORY = process.env.LEGO_REAL_BUILD_CALLOUTS ?? "output/callout-thumbnails";
const EXPECTED_PRINTED_STEPS = 359 as const;
const MINIMUM_WHOLE_STEP_SCORE = 0.45;
const REAL_BUILD_REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";
const MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE = 8;
const HIGHLIGHT_CALIBRATION_PATH =
  process.env.LEGO_REAL_BUILD_HIGHLIGHT_CALIBRATION ??
  "output/real-build/highlight-exclusivity-calibration.json";
const OFFICIAL_MODEL_PATH =
  process.env.LEGO_REAL_BUILD_OFFICIAL_MODEL ?? "output/official-model/vx1087034_21066_a.xml";
const ACTION_LEDGER_PATH =
  process.env.LEGO_REAL_BUILD_ACTION_LEDGER ?? "output/real-build/action-ledger.json";
const BUILDER_CALIBRATION_PATH =
  process.env.LEGO_REAL_BUILD_BUILDER_CALIBRATION ??
  "output/real-build/builder-canonical-calibration.json";
const BUILDER_GEOMETRY_PATH =
  process.env.LEGO_REAL_BUILD_BUILDER_GEOMETRY ?? "output/real-build/builder-shell-geometry.bin";
const TRANSITION_CLASSIFICATIONS_PATH =
  process.env.LEGO_REAL_BUILD_TRANSITIONS ?? "output/real-build/transition-classifications.json";

interface CalloutManifest {
  readonly schemaVersion?: string;
  readonly sourceHash?: string;
  readonly calloutCount?: number;
  readonly callouts?: readonly unknown[];
}

interface CalloutResolution extends CoverageCalloutClaim {
  readonly stepNumber: number | null;
  readonly elementId: string | null;
  readonly resolution: {
    readonly catalogPartId: string | null;
    readonly colorId: string;
    readonly partNum: string;
    readonly name: string;
  } | null;
}

interface HighlightCalibration {
  readonly schemaVersion?: string;
  readonly minimumExclusiveHighlightPixelsPerPiece?: number;
  readonly retainedCaseDigests?: readonly string[];
}

interface TransitionClassificationBundle {
  readonly schemaVersion?: string;
  readonly pdfDigest?: string;
  readonly entries?: readonly TransitionClassificationEvidence[];
}

const contractFailure = (inputKey: string, message: string): StepFailure => ({
  code: "input-digest-mismatch",
  stage: "input",
  inputKey,
  message,
});

function readJsonInput<T>(path: string, failures: StepFailure[]): { bytes: Buffer; value: T } {
  let resolved: string;
  try {
    resolved = resolveRealBuildPath(process.cwd(), path, {
      mustExist: true,
      label: "real-build JSON input",
    });
  } catch (error) {
    failures.push({
      code: "path-policy-violation",
      stage: "input",
      inputKey: path,
      message: `Required real-build input path is missing or unsafe: ${String(error)}.`,
    });
    return { bytes: Buffer.alloc(0), value: {} as T };
  }
  const bytes = readFileSync(resolved);
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) as T };
  } catch (error) {
    failures.push(
      contractFailure(
        path,
        `Required real-build input ${path} is not valid JSON: ${String(error)}.`,
      ),
    );
    return { bytes, value: {} as T };
  }
}

function readBinaryInput(path: string, failures: StepFailure[]): Buffer {
  let resolved: string;
  try {
    resolved = resolveRealBuildPath(process.cwd(), path, {
      mustExist: true,
      label: "real-build binary input",
    });
  } catch (error) {
    failures.push({
      code: "path-policy-violation",
      stage: "input",
      inputKey: path,
      message: `Required real-build binary input path is missing or unsafe: ${String(error)}.`,
    });
    return Buffer.alloc(0);
  }
  return readFileSync(resolved);
}

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

test("rebuilds the real booklet from its own printed steps", async ({ page, browserName }) => {
  test.setTimeout(3_600_000);
  test.skip(
    !REAL_BUILD_REQUIRED,
    "set LEGO_REAL_BUILD_REQUIRED=1 to execute the retained real-booklet probe",
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const preparationFailures: StepFailure[] = [];
  let effectiveOutputRoot = OUTPUT_ROOT;
  try {
    validateRealBuildOutputRoot(OUTPUT_ROOT);
  } catch (error) {
    preparationFailures.push(contractFailure("LEGO_REAL_BUILD_OUT", String(error)));
    effectiveOutputRoot = "output/real-build";
  }
  const coverageInput = readJsonInput<{
    readonly schemaVersion?: string;
    readonly byCallout?: unknown;
    readonly inputDigests?: { readonly pdf?: string; readonly calloutManifest?: string };
  }>(COVERAGE_PATH, preparationFailures);
  const manifestInput = readJsonInput<CalloutManifest>(MANIFEST_PATH, preparationFailures);
  const calibrationInput = readJsonInput<HighlightCalibration>(
    HIGHLIGHT_CALIBRATION_PATH,
    preparationFailures,
  );
  const ledgerInput = readJsonInput<RealBuildActionLedger>(ACTION_LEDGER_PATH, preparationFailures);
  const builderCalibrationInput = readJsonInput<BuilderCanonicalCalibration>(
    BUILDER_CALIBRATION_PATH,
    preparationFailures,
  );
  const transitionInput = readJsonInput<TransitionClassificationBundle>(
    TRANSITION_CLASSIFICATIONS_PATH,
    preparationFailures,
  );
  const officialModelBytes = readBinaryInput(OFFICIAL_MODEL_PATH, preparationFailures);
  const builderGeometryBytes = readBinaryInput(BUILDER_GEOMETRY_PATH, preparationFailures);
  const { bytes: pdfBytes, source } = await readSampleBooklet();
  const inputDigests = {
    pdf: sha256Digest(pdfBytes),
    calloutManifest: sha256Digest(manifestInput.bytes),
    coverage: sha256Digest(coverageInput.bytes),
    officialModel: sha256Digest(officialModelBytes),
    actionLedger: sha256Digest(ledgerInput.bytes),
    highlightCalibration: sha256Digest(calibrationInput.bytes),
    builderCalibration: sha256Digest(builderCalibrationInput.bytes),
    builderGeometry: sha256Digest(builderGeometryBytes),
    transitionClassifications: sha256Digest(transitionInput.bytes),
  };
  if (
    manifestInput.value.schemaVersion !== "lego.callout-thumbnails/4" ||
    manifestInput.value.sourceHash !== inputDigests.pdf
  ) {
    preparationFailures.push(
      contractFailure(
        MANIFEST_PATH,
        `Callout input must use lego.callout-thumbnails/4 and bind the exact booklet PDF. Manifest ` +
          `${JSON.stringify(manifestInput.value.schemaVersion ?? "missing")}/` +
          `${JSON.stringify(manifestInput.value.sourceHash ?? "missing")}; live PDF ${inputDigests.pdf}.`,
      ),
    );
  }
  if (
    coverageInput.bytes.length > 0 &&
    coverageInput.value.schemaVersion !== "lego.real-build-catalog-coverage/1"
  ) {
    preparationFailures.push(
      contractFailure(
        COVERAGE_PATH,
        `Catalog coverage must use lego.real-build-catalog-coverage/1 and stable v4 callout identities; ` +
          `received ${JSON.stringify(coverageInput.value.schemaVersion ?? "missing")}.`,
      ),
    );
  }
  let officialModel: OfficialModelIndex | null = null;
  if (
    officialModelBytes.length > 0 &&
    builderCalibrationInput.bytes.length > 0 &&
    builderGeometryBytes.length > 0
  ) {
    try {
      officialModel = applyBuilderCanonicalCalibration(
        parseOfficialModelIndex(officialModelBytes),
        builderCalibrationInput.bytes,
        inputDigests.builderCalibration,
        builderGeometryBytes,
        inputDigests.builderGeometry,
      );
      preparationFailures.push(...validateOfficialModelAccounting(officialModel));
    } catch (error) {
      preparationFailures.push({
        code: "builder-calibration-invalid",
        stage: "input",
        inputKey: BUILDER_CALIBRATION_PATH,
        message:
          `Official model Bone transforms could not be resolved through the exact versioned Builder ` +
          `calibration and separate raw Builder Shell geometry role: ` +
          `${error instanceof Error ? error.message : String(error)}.`,
      });
    }
  }
  const validCalibration =
    calibrationInput.value.schemaVersion === "lego.highlight-exclusivity-calibration/1" &&
    calibrationInput.value.minimumExclusiveHighlightPixelsPerPiece ===
      MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE &&
    Array.isArray(calibrationInput.value.retainedCaseDigests) &&
    calibrationInput.value.retainedCaseDigests.length >= 2 &&
    calibrationInput.value.retainedCaseDigests.every((digest) =>
      /^sha256:[0-9a-f]{64}$/u.test(digest),
    );
  const highlightCalibrationDigest = validCalibration ? sha256Digest(calibrationInput.bytes) : null;
  if (calibrationInput.bytes.length > 0 && !validCalibration) {
    preparationFailures.push(
      contractFailure(
        HIGHLIGHT_CALIBRATION_PATH,
        `Highlight calibration must use lego.highlight-exclusivity-calibration/1, bind at least two retained ` +
          `case digests, and calibrate threshold ${MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE}.`,
      ),
    );
  }
  const transitionEntries = Array.isArray(transitionInput.value.entries)
    ? transitionInput.value.entries
    : [];
  const transitionClassificationsByStep = Object.fromEntries(
    transitionEntries.map((entry) => [entry.stepNumber, entry]),
  ) as Readonly<Record<number, TransitionClassificationEvidence>>;
  const transitionBundleValid =
    transitionInput.value.schemaVersion === "lego.transition-classifications/1" &&
    transitionInput.value.pdfDigest === inputDigests.pdf &&
    transitionEntries.length > 0 &&
    new Set(transitionEntries.map(({ stepNumber }) => stepNumber)).size ===
      transitionEntries.length &&
    transitionEntries.every(
      (entry) =>
        Number.isInteger(entry.stepNumber) &&
        Number.isInteger(entry.pageNumber) &&
        /^sha256:[0-9a-f]{64}$/u.test(entry.panelEvidenceDigest) &&
        /^sha256:[0-9a-f]{64}$/u.test(entry.evidenceDigest) &&
        entry.evidenceDigest !== entry.panelEvidenceDigest &&
        ["rotation", "attachment", "final-view"].includes(entry.transition) &&
        isUnauthenticatedTransitionClassification(entry.localClassification) &&
        entry.localClassification.decision === entry.transition &&
        entry.localClassification.reviewedPanelDigest === entry.panelEvidenceDigest &&
        transitionClassificationEvidenceDigest({
          stepNumber: entry.stepNumber,
          pageNumber: entry.pageNumber,
          panelEvidenceDigest: entry.panelEvidenceDigest,
          transition: entry.transition,
          localClassification: entry.localClassification,
        }) === entry.evidenceDigest,
    );
  if (transitionInput.bytes.length > 0 && !transitionBundleValid) {
    preparationFailures.push({
      code: "transition-classification-unverified",
      stage: "input",
      inputKey: TRANSITION_CLASSIFICATIONS_PATH,
      message:
        `Transition classification input must use lego.transition-classifications/1, bind the exact PDF, ` +
        `contain unique typed step/page/panel rows, and contain a bounded explicitly unauthenticated local ` +
        `classification claim whose decision and canonical digest reproduce exactly.`,
    });
  }
  const lastStep = Number(process.env.LEGO_REAL_BUILD_LAST_STEP ?? 12);
  if (!Number.isInteger(lastStep) || lastStep < 1 || lastStep > EXPECTED_PRINTED_STEPS) {
    preparationFailures.push(
      contractFailure(
        "LEGO_REAL_BUILD_LAST_STEP",
        `LEGO_REAL_BUILD_LAST_STEP must be an integer from 1 through 359; received ${lastStep}.`,
      ),
    );
  }

  const rawCoverageIndex = coverageInput.value.byCallout;
  const byCallout =
    typeof rawCoverageIndex === "object" &&
    rawCoverageIndex !== null &&
    !Array.isArray(rawCoverageIndex)
      ? (rawCoverageIndex as Readonly<Record<string, CalloutResolution>>)
      : {};
  if (Object.keys(byCallout).length === 0) {
    preparationFailures.push(
      contractFailure(
        `${COVERAGE_PATH}#byCallout`,
        `Coverage has no object-valued byCallout index; regenerate it from the bound callout manifest.`,
      ),
    );
  }
  const rawManifestCallouts = Array.isArray(manifestInput.value.callouts)
    ? manifestInput.value.callouts
    : [];
  const manifestCallouts: V4ManifestCallout[] = rawManifestCallouts.filter(isV4ManifestCallout);
  if (manifestCallouts.length === 0) {
    preparationFailures.push(
      contractFailure(
        `${MANIFEST_PATH}#callouts`,
        `The callout manifest has no callout array; regenerate the full 359-step manifest.`,
      ),
    );
  }
  if (
    manifestCallouts.length !== rawManifestCallouts.length ||
    manifestInput.value.calloutCount !== manifestCallouts.length ||
    new Set(manifestCallouts.map(({ identity }) => identity)).size !== manifestCallouts.length
  ) {
    preparationFailures.push(
      contractFailure(
        `${MANIFEST_PATH}#callouts`,
        `The v4 callout manifest must contain exactly calloutCount unique, typed identity records; received ` +
          `${manifestCallouts.length}/${rawManifestCallouts.length} typed rows for declared count ` +
          `${JSON.stringify(manifestInput.value.calloutCount ?? "missing")}.`,
      ),
    );
  }
  const ledgerSteps: readonly unknown[] = Array.isArray(ledgerInput.value.steps)
    ? ledgerInput.value.steps
    : [];
  const ledgerByStep = new Map<number, LedgerStep>();
  for (const step of ledgerSteps) {
    if (isExecutableLedgerStep(step) && !ledgerByStep.has(step.stepNumber)) {
      ledgerByStep.set(step.stepNumber, step);
    }
  }
  const coarsePanels = sampleBookletPanels(source);
  const probedPages = [...new Set(coarsePanels.map(({ pageNumber }) => pageNumber))];
  const boxesByPage = await sampleBookletCalloutBoxes(pdfBytes, source, probedPages);
  const panels = sampleBookletPanels(
    source,
    new Map(
      [...boxesByPage].map(([pageNumber, entries]) => [pageNumber, entries.map(({ box }) => box)]),
    ),
  );
  const panelBindings = bindCalloutsToBookletPanels({
    lastStep: Number.isInteger(lastStep) ? lastStep : 1,
    manifestCallouts,
    panels,
    sourcePages: source.pages,
  });
  preparationFailures.push(...panelBindings.failures);
  const calloutBoxesByStep = Object.fromEntries(
    panels.map((panel) => {
      const boxes = (boxesByPage.get(panel.pageNumber) ?? [])
        .filter(
          ({ labelXPt, labelYPt }) =>
            labelXPt >= panel.bounds.minXPt &&
            labelXPt < panel.bounds.maxXPt &&
            labelYPt >= panel.bounds.minYPt &&
            labelYPt < panel.bounds.maxYPt,
        )
        .map(({ box }) => box);
      return [panel.stepNumber, boxes] as const;
    }),
  );
  const panelEvidenceByStep = Object.fromEntries(
    panels.map((panel) => [
      panel.stepNumber,
      {
        pageNumber: panel.pageNumber,
        digest: stepPanelEvidenceDigest({
          pdfDigest: inputDigests.pdf,
          stepNumber: panel.stepNumber,
          pageNumber: panel.pageNumber,
          bounds: panel.bounds,
          calloutBoxes: calloutBoxesByStep[panel.stepNumber] ?? [],
        }),
      },
    ]),
  );
  if (officialModel !== null) {
    preparationFailures.push(
      ...validateRealBuildActionLedger({
        ledger: ledgerInput.value,
        ledgerDigest: inputDigests.actionLedger,
        lastStep: Number.isInteger(lastStep) ? lastStep : 1,
        official: officialModel,
        pdfDigest: inputDigests.pdf,
        coverageDigest: inputDigests.coverage,
        calloutManifestDigest: inputDigests.calloutManifest,
        builderCalibrationDigest: inputDigests.builderCalibration,
        transitionClassificationsDigest: inputDigests.transitionClassifications,
        coverageByCallout: byCallout,
        panelEvidenceByStep,
        transitionClassificationsByStep,
      }),
    );
  }

  const specs: RealBuildPanelSpec[] = panels.map((panel) => {
    const entries = manifestCallouts.filter(
      ({ identity, evidenceKind }) =>
        panelBindings.stepByIdentity.get(identity) === panel.stepNumber &&
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
      const unsafeCropPath = join(CALLOUT_DIRECTORY, entry.file);
      let cropPath: string | null = null;
      try {
        cropPath = resolveRealBuildPath(process.cwd(), unsafeCropPath, {
          mustExist: true,
          label: "callout crop",
        });
      } catch (error) {
        coverageFailures.push({
          code: "path-policy-violation",
          stage: "input",
          inputKey: unsafeCropPath,
          message: `Callout crop path is missing or unsafe: ${String(error)}.`,
        });
      }
      const cropDigest = cropPath === null ? null : sha256Digest(readFileSync(cropPath));
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
      const resolved = resolveCoverageCallout(byCallout, {
        identity: entry.identity,
        pageNumber: entry.pageNumber,
        stepNumber: panel.stepNumber,
        quantity: entry.quantity,
        cropDigest,
        identificationInputDigest: inputDigests.calloutManifest,
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
        continue;
      }
    }

    const pieces: RealBuildPanelSpec["pieces"][number][] = [];
    const omittedPieces: RealBuildPanelSpec["omittedPieces"][number][] = [];
    let action: RealBuildPanelSpec["action"];
    const actionDigest =
      ledgerStep === undefined
        ? "missing"
        : actionEvidenceDigest({
            ledgerDigest: inputDigests.actionLedger,
            officialModelDigest: inputDigests.officialModel,
            builderCalibrationDigest: inputDigests.builderCalibration,
            transitionClassificationsDigest: inputDigests.transitionClassifications,
            step: ledgerStep,
          });
    if (ledgerStep?.action.kind === "place-callouts") {
      for (const piece of ledgerStep.action.pieces) {
        if (piece.calloutKey === null || piece.identificationConfidence !== "vision-kept") continue;
        const expectedTransform = officialModel?.bricks[piece.brickRef]?.canonicalTransform ?? null;
        if (expectedTransform === null) continue;
        pieces.push({
          identityKey: piece.brickRef,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          calloutKey: piece.calloutKey,
          identificationConfidence: "vision-kept",
          cropDigest: piece.cropDigest,
          identificationInputDigest: piece.identificationInputDigest,
          expectedTransform,
        });
      }
      for (const piece of ledgerStep.action.omittedPieces) {
        const officialTransform = officialModel?.bricks[piece.brickRef]?.canonicalTransform ?? null;
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
        const transform = officialModel?.bricks[copy.brickRef]?.canonicalTransform ?? null;
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
      minXPt: panel.bounds.minXPt,
      maxXPt: panel.bounds.maxXPt,
      minYPt: panel.bounds.minYPt,
      maxYPt: panel.bounds.maxYPt,
      calloutBoxes: calloutBoxesByStep[panel.stepNumber] ?? [],
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

  const options: RealBuildOptions = {
    ...bookletProbeUrls(),
    latticeUrl: workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts"),
    renderingUrl: RENDERING_MODULE_URL,
    kernelUrl: BRICK_KERNEL_MODULE_URL,
    commandsUrl: MANUAL_COMMANDS_MODULE_URL,
    assemblyUrl: ASSEMBLY_MODULE_URL,
    panels: specs,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
    lastStep: Number.isInteger(lastStep) ? lastStep : 1,
    renderScale: 6,
    panelWidth: 1_000,
    workFactor: 2,
    maxRendersPerPiece: 24,
    blindRenderBudget: 220,
    proximityMarginPx: 14,
    targetPartCount: OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces,
    maxParts: OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces,
    minimumScoreMargin: 0.01,
    minimumWholeStepScore: MINIMUM_WHOLE_STEP_SCORE,
    minimumExclusiveHighlightPixelsPerPiece: MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE,
    highlightCalibrationDigest,
    accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
    inputDigests,
    coverageInputBindings: {
      pdf: coverageInput.value.inputDigests?.pdf ?? null,
      calloutManifest: coverageInput.value.inputDigests?.calloutManifest ?? null,
    },
    coverageByCallout: byCallout,
  };
  const inputFailures = [...preparationFailures, ...preflightRealBuildOptions(options)];
  const codeSnapshots = snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
  const sourceFiles = enumerateRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
  const preImportSourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
  const runContract = createRealBuildRunContract({
    inputDigests,
    panels: specs,
    budgets: realBuildRunBudgets(options),
    thresholds: realBuildRunThresholds(options),
    codeSnapshots,
  });
  const plan = planAtomicRunDirectory({
    outputRoot: effectiveOutputRoot,
    inputDigests,
    runContractDigest: runContract.contractDigest,
  });
  const run = beginAtomicRun(plan);
  const sourceMirror = materializeRealBuildSourceMirror({
    directory: run.directory,
    repoRoot: process.cwd(),
    sourceFiles,
    fixedInputs: [{ path: "inputs/booklet.pdf", bytes: pdfBytes }],
  });
  const mirrorUrl = (path: string): string =>
    `/@fs/${resolve(sourceMirror, path).replaceAll("\\", "/")}`;
  const executionOptions: RealBuildOptions = {
    ...options,
    pdfjsUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.mjs"),
    workerUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.worker.mjs"),
    pdfUrl: mirrorUrl("inputs/booklet.pdf"),
    latticeUrl: mirrorUrl("packages/rendering/src/camera-fit-lattice.ts"),
    renderingUrl: mirrorUrl("packages/rendering/src/index.ts"),
    kernelUrl: mirrorUrl("packages/brick-kernel/src/index.ts"),
    commandsUrl: mirrorUrl("apps/web/src/manual-commands.ts"),
    assemblyUrl: mirrorUrl("apps/web/src/assembly/index.ts"),
  };
  const executionDriverUrl = mirrorUrl("apps/web/e2e/real-build-run.ts");

  let result: RealBuildResult;
  let retainedBrowserOutput: RealBuildBrowserOutput | null = null;
  if (inputFailures.length > 0) {
    result = inputRejectedRealBuildResult(executionOptions, inputFailures);
  } else {
    await page.addInitScript(() => {
      Object.defineProperty(window, "WebSocket", { value: class {}, writable: true });
    });
    let browserOutput: RealBuildBrowserOutput;
    try {
      await page.goto("/");
      browserOutput = (await page.evaluate(
        async ({ driverUrl, driverOptions }) => {
          const driver = await import(/* @vite-ignore */ driverUrl);
          return driver.runRealBuild(driverOptions);
        },
        { driverUrl: executionDriverUrl, driverOptions: executionOptions },
      )) as RealBuildBrowserOutput;
    } catch (error) {
      browserOutput = {
        schemaVersion: "lego.real-build-browser-output/1",
        status: "failed",
        reports: [],
        documentJson: null,
        identityBindings: [],
        fetchedPdfDigest: null,
        failure: {
          code: "dynamic-import-failed",
          stage: "loading",
          inputKey: "browser-driver",
          message:
            `Playwright could not load and invoke the digest-bound real-build browser driver: ` +
            `${error instanceof Error ? error.message : String(error)}.`,
        },
        totalElapsedMs: 0,
      };
    }
    const postRunSnapshots = snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
    const postRunSourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
    const mirrorPostRunBundle = captureRealBuildSourceBundle(sourceMirror, sourceFiles);
    const drift = [
      ...sourceDriftFailures(preImportSourceBundle, postRunSourceBundle),
      ...sourceDriftFailures(preImportSourceBundle, mirrorPostRunBundle),
    ];
    if (JSON.stringify(postRunSnapshots) !== JSON.stringify(codeSnapshots) || drift.length > 0) {
      browserOutput = {
        schemaVersion: "lego.real-build-browser-output/1",
        status: "failed",
        reports: browserOutput.reports,
        documentJson: browserOutput.documentJson,
        identityBindings: browserOutput.identityBindings,
        fetchedPdfDigest: browserOutput.fetchedPdfDigest,
        failure: {
          code: "source-drift-detected",
          stage: "replay",
          inputKey: "codeSnapshots",
          message:
            `Result-determining source changed between immutable pre-import capture, execution mirror, and ` +
            `post-run verification: ${drift.slice(0, 8).join("; ") || "digest map changed"}. The browser ` +
            `output is retained diagnostically but cannot be finalized.`,
        },
        totalElapsedMs: browserOutput.totalElapsedMs,
      };
    }
    retainedBrowserOutput = browserOutput;
    result = finalizeExecutedRealBuildResult({ options: executionOptions, browserOutput });
  }

  const artifactFiles: string[] = [];
  for (const step of result.steps) {
    const tag = String(step.stepNumber).padStart(3, "0");
    for (const [kind, png] of [
      ["panel", step.panelPng],
      ["build", step.buildPng],
    ] as const) {
      if (png !== null) {
        const file = `step-${tag}-${kind}.png`;
        writeFileSync(join(run.directory, file), Buffer.from(png.split(",")[1]!, "base64"));
        artifactFiles.push(file);
      }
    }
  }
  if (result.documentJson !== null) {
    writeFileSync(join(run.directory, "document.json"), result.documentJson);
    artifactFiles.push("document.json");
  }
  const built = result.steps.filter(isAtomicStepComplete);
  const score = {
    schemaVersion: REAL_BUILD_SCORE_SCHEMA,
    authority: result.authority,
    runId: plan.runId,
    status: result.status,
    inputDigests,
    accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
    lastStep: options.lastStep,
    stepsAttempted: result.steps.length,
    stepsComplete: built.length,
    piecesPlaced: result.steps.reduce((total, step) => total + step.placedPieces, 0),
    finalParts: result.finalParts,
    structuralHash: result.structuralHash,
    inputFailures: result.inputFailures,
    completionFailures: result.completionFailures,
    failures: result.steps
      .filter((step) => step.outcome.status === "failed")
      .map((step) => ({ stepNumber: step.stepNumber, failure: step.outcome.failure })),
    totalElapsedMs: result.totalElapsedMs,
    steps: result.steps.map(({ panelPng, buildPng, ...step }) => ({
      ...step,
      panelPng:
        panelPng === null ? null : `step-${String(step.stepNumber).padStart(3, "0")}-panel.png`,
      buildPng:
        buildPng === null ? null : `step-${String(step.stepNumber).padStart(3, "0")}-build.png`,
    })),
  };
  writeFileSync(join(run.directory, "score.json"), `${JSON.stringify(score, null, 1)}\n`);
  artifactFiles.push("score.json");
  const replayRoles = [
    { role: "pdf", bytes: pdfBytes },
    { role: "callout-manifest", bytes: manifestInput.bytes },
    { role: "coverage", bytes: coverageInput.bytes },
    { role: "official-model", bytes: officialModelBytes },
    { role: "action-ledger", bytes: ledgerInput.bytes },
    { role: "highlight-calibration", bytes: calibrationInput.bytes },
    { role: "builder-calibration", bytes: builderCalibrationInput.bytes },
    { role: "builder-geometry", bytes: builderGeometryBytes },
    { role: "transition-classifications", bytes: transitionInput.bytes },
    { role: "run-contract", bytes: Buffer.from(JSON.stringify(runContract)) },
    { role: "prepared-options", bytes: Buffer.from(JSON.stringify(executionOptions)) },
    ...(retainedBrowserOutput === null
      ? []
      : [
          {
            role: "browser-output",
            bytes: Buffer.from(JSON.stringify(retainedBrowserOutput)),
          },
        ]),
  ];
  const replayClosure = writeRealBuildReplayClosure({
    directory: run.directory,
    repoRoot: sourceMirror,
    roles: replayRoles,
    sourceFiles,
    environment: {
      schemaVersion: "lego.real-build-environment/1",
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      versions: process.versions,
      browser: {
        name: browserName,
        version: page.context().browser()?.version() ?? "unavailable",
      },
      playwright: "@playwright/test (exact package bytes retained in source bundle)",
      runContractDigest: runContract.contractDigest,
    },
    browserOutputRetained: retainedBrowserOutput !== null,
  });
  writeRealBuildArtifactManifest({
    directory: run.directory,
    runId: plan.runId,
    runContract,
    result,
    artifactFiles,
    replayClosure,
  });
  const published = await run.publish(verifyRealBuildArtifactManifest);
  console.log(
    `${result.authority.kind}/${result.status}: ${built.length}/${result.steps.length} steps complete; ` +
      `retained unauthenticated evidence ${published}`,
  );

  expect(result.schemaVersion).toBe("lego.real-build-result/3");
  expect(result.inputDigests).toEqual(inputDigests);
  const executionFailure = realBuildExecutionFailure(result);
  expect(executionFailure, executionFailure?.message).toBeNull();
  if (result.status === "completed") {
    expect(options.lastStep).toBe(EXPECTED_PRINTED_STEPS);
    expect(result.steps).toHaveLength(EXPECTED_PRINTED_STEPS);
    expect(result.finalParts).toBe(OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces);
    expect(result.documentJson).not.toBeNull();
    for (const step of result.steps) {
      expect(isAtomicStepComplete(step)).toBe(true);
      expect(step.validation.documentGloballyValid).toBe(true);
    }
  } else {
    expect(result.status).toBe("prefix-complete");
    expect(result.steps).toHaveLength(options.lastStep);
  }
});

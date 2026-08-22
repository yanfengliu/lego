import { canonicalStringify, sha256Hex } from "@lego-studio/brick-kernel";

import { readRealBuildBrowserCameraEvidence } from "./real-build-browser-output-v4-camera-evidence-reader";
import type { RealBuildBrowserCameraEvidenceBytes } from "./real-build-browser-output-v4-camera-evidence-types";
import {
  inspectRealBuildBrowserOutputV4Envelope,
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes,
} from "./real-build-browser-output-v4-envelope";
import { inspectRealBuildBrowserOutputV4Provenance } from "./real-build-browser-output-v4-provenance";
import { snapshotRealBuildBrowserOutputV4ReaderInput } from "./real-build-browser-output-v4-reader-input";
import {
  advanceRealBuildBrowserOutputV4PlacementFrontier,
  createInitialRealBuildBrowserOutputV4Frontier,
} from "./real-build-browser-output-v4-reader-frontier";
import {
  REAL_BUILD_BROWSER_OUTPUT_V4_READER_ABSENT_COMPLETION_AUTHORITY,
  REAL_BUILD_BROWSER_OUTPUT_V4_READER_INSPECTION_SCHEMA,
  type InspectRealBuildBrowserOutputV4Input,
  type RealBuildBrowserOutputV4Inspection,
} from "./real-build-browser-output-v4-reader-types";
import {
  deriveRealBuildBrowserOutputV4PlacementBindings,
  deriveRealBuildBrowserOutputV4MissingRoleFailure,
  deriveRealBuildBrowserOutputV4TerminalPlacementFailure,
  realBuildBrowserOutputV4IdentityDigest,
  requireRealBuildBrowserOutputV4FailedReport,
  requireRealBuildBrowserOutputV4IdentityBindings,
  requireRealBuildBrowserOutputV4SelectedPlacementReport,
  requireRealBuildBrowserOutputV4TransitionReport,
} from "./real-build-browser-output-v4-reader-validation";
import { inspectRealBuildBrowserBranchDetailedEvidence } from "./real-build-browser-output-v4-semantic";
import { requireRealBuildBrowserOutputV4SourceEvidenceInspection } from "./real-build-browser-output-v4-source-evidence-reader";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { requireRealBuildSourceDerivationPrimordials } from "./real-build-source-derivation-primordials";
import {
  inspectRealBuildPreparedPanelFromRunInput,
  requireRealBuildPreparedPanelResolvedPrerequisites,
} from "./real-build-prepared-step-authority";
import {
  advanceRealBuildBrowserOutputV4TransitionFrontier,
  readRealBuildBrowserOutputV4TransitionEvidenceManifest,
} from "./real-build-browser-output-v4-transition-frontier";

const inspections = new WeakSet<object>();
const TEXT_ENCODER = new TextEncoder();
const REFLECT_APPLY = Reflect.apply;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

function inspectionAdd(value: object): void {
  REFLECT_APPLY(WEAK_SET_ADD, inspections, [value]);
}

function inspectionHas(value: object): boolean {
  return REFLECT_APPLY(WEAK_SET_HAS, inspections, [value]) as boolean;
}

function bindFinishedSourceManifest(
  sourceInspection: unknown,
  expected: { readonly bytes: number; readonly digest: string },
) {
  const source = requireRealBuildBrowserOutputV4SourceEvidenceInspection(sourceInspection);
  const bytes = TEXT_ENCODER.encode(canonicalStringify(source.manifest));
  const digest = `sha256:${sha256Hex(bytes)}`;
  if (bytes.byteLength !== expected.bytes || digest !== expected.digest) {
    throw new TypeError(
      "Browser output /4 finished source inspection is not the exact manifest committed by the envelope.",
    );
  }
  return source;
}

function exactFailureBinding(
  envelope: ReturnType<typeof inspectRealBuildBrowserOutputV4Envelope>,
): void {
  if (envelope.envelope.status !== "failed") return;
  if (envelope.envelope.reports.length === 0) {
    throw new TypeError(
      "Browser output /4 failed tuples require at least one retained report whose failure can be reproduced; empty-prefix input rejection needs a separate typed evidence role.",
    );
  }
  const reportFailure = envelope.envelope.reports.at(-1)!.outcome.failure;
  if (
    reportFailure === null ||
    canonicalStringify(reportFailure) !== canonicalStringify(envelope.envelope.failure)
  ) {
    throw new TypeError(
      "Browser output /4 outer failure must equal the terminal retained report failure.",
    );
  }
}

/**
 * Reads the complete generation-4 tuple and induces one exact terminal prefix.
 * The result is reproducible inspection only: source execution provenance,
 * physical-frame authority, user placement, and completion admission stay absent.
 */
export function inspectRealBuildBrowserOutputV4(
  inputValue: InspectRealBuildBrowserOutputV4Input,
): RealBuildBrowserOutputV4Inspection {
  requireRealBuildSourceDerivationPrimordials();
  const input = snapshotRealBuildBrowserOutputV4ReaderInput(inputValue);
  const envelope = inspectRealBuildBrowserOutputV4Envelope(
    input.browserOutput,
    input.preparedRunInputBytes,
  );
  exactFailureBinding(envelope);
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
    envelope,
    "branchEvidence",
    input.branchEvidenceBytes,
  );
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
    envelope,
    "sourceManifest",
    input.sourceManifestBytes,
  );
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
    envelope,
    "cameraManifest",
    input.cameraManifestBytes,
  );
  verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
    envelope,
    "transitionManifest",
    input.transitionManifestBytes,
  );

  const branch = inspectRealBuildBrowserBranchDetailedEvidence(
    input.branchEvidenceBytes,
    input.compiledBranchRoleBytes,
    input.branchObservationRoleBytes,
    input.preparedRunInputBytes,
  );
  const source = bindFinishedSourceManifest(
    input.sourceInspection,
    envelope.envelope.evidence.sourceManifest,
  );
  const camera = readRealBuildBrowserCameraEvidence({
    manifestBytes: input.cameraManifestBytes,
    renderRoleBytes: input.cameraRenderRoleBytes,
    maskRoleBytes: input.cameraMaskRoleBytes,
  } as RealBuildBrowserCameraEvidenceBytes);
  inspectRealBuildBrowserOutputV4Provenance({ envelope, branch, source, camera });
  const transitions = readRealBuildBrowserOutputV4TransitionEvidenceManifest(
    input.transitionManifestBytes,
  );

  const branchByStep = new Map(branch.steps.map((step) => [step.stepNumber, step]));
  const transitionByStep = new Map(transitions.rows.map((row) => [row.stepNumber, row]));
  let frontier = createInitialRealBuildBrowserOutputV4Frontier(envelope.preparedBoundary.maxParts);
  const expectedBindings = [];
  let completedSteps = 0;
  let branchSteps = 0;
  let transitionSteps = 0;
  for (const report of envelope.envelope.reports) {
    const preparedPanel = requireRealBuildPreparedPanelResolvedPrerequisites(
      inspectRealBuildPreparedPanelFromRunInput(envelope.preparedRun, report.stepNumber),
    );
    const branchStep = branchByStep.get(report.stepNumber);
    const transitionRow = transitionByStep.get(report.stepNumber);
    if (preparedPanel.actionKind === "place-callouts") {
      if (transitionRow !== undefined) {
        throw new TypeError(
          `Browser output /4 placement step ${report.stepNumber} has an orphan transition row.`,
        );
      }
      if (branchStep === undefined) {
        const failure = deriveRealBuildBrowserOutputV4MissingRoleFailure(preparedPanel);
        requireRealBuildBrowserOutputV4FailedReport(
          report,
          frontier.documentSnapshot.document.parts.length,
          { failure, attemptedMechanism: null },
        );
        continue;
      }
      branchSteps += 1;
      branchByStep.delete(report.stepNumber);
      const parent = frontier.documentSnapshot;
      const advanced = advanceRealBuildBrowserOutputV4PlacementFrontier({
        frontier,
        step: branchStep,
      });
      if (advanced.status === "terminal") {
        requireRealBuildBrowserOutputV4FailedReport(
          report,
          frontier.documentSnapshot.document.parts.length,
          deriveRealBuildBrowserOutputV4TerminalPlacementFailure(branchStep, advanced),
        );
        continue;
      }
      requireRealBuildBrowserOutputV4SelectedPlacementReport(report, branchStep, advanced, camera);
      expectedBindings.push(
        ...deriveRealBuildBrowserOutputV4PlacementBindings({
          parent,
          selected: advanced,
          preparedPanel: envelope.preparedBoundary.panels[report.stepNumber - 1]!,
          stepNumber: report.stepNumber,
        }),
      );
      frontier = advanced.frontier;
      completedSteps += 1;
      continue;
    }
    if (branchStep !== undefined) {
      throw new TypeError(
        `Browser output /4 non-placement step ${report.stepNumber} has an orphan branch row.`,
      );
    }
    if (preparedPanel.actionKind === "transition") {
      if (transitionRow === undefined) {
        const failure = deriveRealBuildBrowserOutputV4MissingRoleFailure(preparedPanel);
        requireRealBuildBrowserOutputV4FailedReport(
          report,
          frontier.documentSnapshot.document.parts.length,
          { failure, attemptedMechanism: null },
        );
        continue;
      }
      transitionByStep.delete(report.stepNumber);
      const next = advanceRealBuildBrowserOutputV4TransitionFrontier({
        frontier,
        preparedPanel,
        row: transitionRow,
      });
      requireRealBuildBrowserOutputV4TransitionReport(report, transitionRow);
      frontier = next;
      transitionSteps += 1;
      completedSteps += 1;
      continue;
    }
    if (transitionRow !== undefined) {
      throw new TypeError(
        `Browser output /4 fixed-ledger step ${report.stepNumber} has an orphan transition row.`,
      );
    }
    if (report.outcome.status === "complete") {
      throw new TypeError(
        `Browser output /4 fixed-ledger step ${report.stepNumber} claims completion without separate physical-frame authority and deterministic fixed-action replay.`,
      );
    }
    const failure = deriveRealBuildBrowserOutputV4MissingRoleFailure(preparedPanel);
    requireRealBuildBrowserOutputV4FailedReport(
      report,
      frontier.documentSnapshot.document.parts.length,
      {
        failure,
        attemptedMechanism: null,
      },
    );
  }
  if (branchByStep.size !== 0 || transitionByStep.size !== 0) {
    throw new TypeError(
      `Browser output /4 retains ${branchByStep.size} orphan branch step(s) and ${transitionByStep.size} orphan transition row(s) outside its report prefix.`,
    );
  }
  if (envelope.envelope.documentJson !== frontier.documentSnapshot.canonicalBytes) {
    throw new TypeError(
      "Browser output /4 terminal documentJson does not byte-equal the exact replayed frontier.",
    );
  }
  requireRealBuildBrowserOutputV4IdentityBindings(
    envelope.envelope.identityBindings,
    expectedBindings,
  );
  const inspection = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_READER_INSPECTION_SCHEMA,
    envelopeInspection: envelope,
    status: envelope.envelope.status,
    retainedReports: envelope.envelope.reports.length,
    completedSteps,
    throughStepNumber: frontier.throughStepNumber,
    branchSteps,
    transitionSteps,
    terminalDocument: frontier.documentSnapshot,
    identityBindings: envelope.envelope.identityBindings,
    outputIdentityDigest: realBuildBrowserOutputV4IdentityDigest({
      envelope: envelope.envelope,
      preparedRunInputDigest: envelope.preparedRun.preparedRunInputDigest,
      terminalDocument: frontier.documentSnapshot,
    }),
    derivationReproducible: true as const,
    sourceExecutionProvenanceAuthority: "absent" as const,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_READER_ABSENT_COMPLETION_AUTHORITY,
  });
  inspectionAdd(inspection);
  return inspection;
}

export function requireRealBuildBrowserOutputV4Inspection(
  value: unknown,
): RealBuildBrowserOutputV4Inspection {
  if (value === null || typeof value !== "object" || !inspectionHas(value)) {
    throw new TypeError(
      "Browser output /4 inspection must be the exact branded result of complete tuple replay.",
    );
  }
  return value as RealBuildBrowserOutputV4Inspection;
}

export type {
  InspectRealBuildBrowserOutputV4Input,
  RealBuildBrowserOutputV4Inspection,
} from "./real-build-browser-output-v4-reader-types";

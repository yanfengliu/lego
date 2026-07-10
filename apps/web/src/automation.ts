import {
  canonicalStringify,
  documentStructuralHash,
  normalizeBrickDocument,
} from "@lego-studio/brick-kernel";
import type { CandidateMetrics } from "@lego-studio/generation";
import type { BrickDocumentV1, ValidationReportV1 } from "@lego-studio/protocol";

import type { BrickViewportHandle, BrickViewportSnapshot } from "./components/BrickViewport";

export interface AutomationCandidateSummary {
  readonly candidateId: string;
  readonly state: "preview" | "hard-valid" | "duplicate" | "rejected";
  readonly documentHash: string | null;
  readonly operationCount: number;
  readonly failureCodes: readonly string[];
  readonly rank: number | null;
  readonly metrics: CandidateMetrics | null;
  readonly lineage: {
    readonly parentCandidateId: string | null;
    readonly strategyId: string;
  };
}

export interface AutomationActiveJobSummary {
  readonly jobId: string;
  readonly state: "running" | "ready" | "failed";
  readonly baseRevision: string;
  readonly baseDocumentHash: string;
  readonly verificationDurationMs: number | null;
}

export interface AutomationAppState {
  readonly document: BrickDocumentV1;
  readonly selectedPartId: string | null;
  readonly validationReport: ValidationReportV1;
  readonly candidateValidation: ValidationReportV1 | null;
  readonly activeJob: AutomationActiveJobSummary | null;
  readonly candidatePopulation: readonly AutomationCandidateSummary[];
  readonly candidate: AutomationCandidateSummary | null;
  readonly commandError: string | null;
}

export interface ModelSnapshot {
  readonly schemaVersion: "lego.model-snapshot/1";
  readonly documentId: string;
  readonly revision: string;
  readonly structuralHash: string;
  readonly partCount: number;
  readonly connectionCount: number;
  readonly selectedPartId: string | null;
  readonly documentGloballyValid: boolean;
}

export interface AutomationBridgeTarget {
  render_app_to_text?: () => string;
  capture_model_views?: () => Promise<Record<string, string>>;
  get_model_snapshot?: () => ModelSnapshot;
  advanceTime?: (milliseconds: number) => Promise<ModelSnapshot>;
}

function modelSnapshot(state: AutomationAppState): ModelSnapshot {
  return {
    schemaVersion: "lego.model-snapshot/1",
    documentId: state.document.id,
    revision: state.document.revision,
    structuralHash: documentStructuralHash(state.document),
    partCount: state.document.parts.length,
    connectionCount: state.document.connections.length,
    selectedPartId: state.selectedPartId,
    documentGloballyValid: state.validationReport.documentGloballyValid,
  };
}

export function installAutomationBridge(
  target: AutomationBridgeTarget,
  getState: () => AutomationAppState,
  getViewport: () => BrickViewportHandle | null,
): () => void {
  const renderAppToText = () => {
    const state = getState();
    const renderer: BrickViewportSnapshot | null = getViewport()?.getSnapshot() ?? null;
    return canonicalStringify({
      schemaVersion: "lego.app-observation/1",
      document: normalizeBrickDocument(state.document),
      documentHash: documentStructuralHash(state.document),
      selection: { partId: state.selectedPartId },
      activeJob: state.activeJob,
      candidatePopulation: state.candidatePopulation,
      candidate: state.candidate,
      candidateValidation: state.candidateValidation,
      validation: state.validationReport,
      lineage: state.candidate
        ? { candidateId: state.candidate.candidateId, ...state.candidate.lineage }
        : null,
      overlay: {
        validationVisible: true,
        candidatePreviewVisible: state.candidate?.state === "preview",
      },
      renderer,
      error: state.commandError,
    });
  };
  const captureModelViews = async () => getViewport()?.captureCanonicalViews() ?? {};
  const getModelSnapshot = () => modelSnapshot(getState());
  const advanceTime = async (milliseconds: number) => {
    if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 60_000) {
      throw new RangeError("advanceTime milliseconds must be between 0 and 60000");
    }
    await Promise.resolve();
    return getModelSnapshot();
  };

  target.render_app_to_text = renderAppToText;
  target.capture_model_views = captureModelViews;
  target.get_model_snapshot = getModelSnapshot;
  target.advanceTime = advanceTime;

  return () => {
    if (target.render_app_to_text === renderAppToText) delete target.render_app_to_text;
    if (target.capture_model_views === captureModelViews) delete target.capture_model_views;
    if (target.get_model_snapshot === getModelSnapshot) delete target.get_model_snapshot;
    if (target.advanceTime === advanceTime) delete target.advanceTime;
  };
}

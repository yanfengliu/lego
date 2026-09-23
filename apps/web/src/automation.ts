import {
  canonicalStringify,
  documentStructuralHash,
  normalizeBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ValidationReportV1 } from "@lego-studio/protocol";

import type {
  BrickViewportHandle,
  BrickViewportSnapshot,
  InstructionViewCaptureRequest,
  InstructionViewCaptureResult,
} from "./components/BrickViewport";

export interface AutomationPlaybackState {
  readonly position: number;
  readonly terminalPosition: number;
  readonly stepId: string | null;
  readonly stepName: string;
  readonly addedPartCount: number;
  readonly previewDocument: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
  readonly blockingCodes: readonly string[];
  readonly buildable: boolean;
  readonly connected: boolean;
  readonly exact: boolean;
  readonly mode: "membership-preview" | "operation-trace-exact";
  readonly traceCommitment: `sha256:${string}` | null;
}

export interface AutomationAppState {
  readonly document: BrickDocumentV1;
  readonly selectedPartId: string | null;
  readonly validationReport: ValidationReportV1;
  readonly commandError: string | null;
  readonly playback: AutomationPlaybackState | null;
}

export interface AutomationModelCaptureOptions {
  readonly scene?: "presentation" | "model-only";
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
  capture_model_views?: (
    options?: AutomationModelCaptureOptions,
  ) => Promise<Record<string, string>>;
  capture_instruction_view?: (
    request: InstructionViewCaptureRequest,
  ) => Promise<InstructionViewCaptureResult>;
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
      validation: state.validationReport,
      overlay: { validationVisible: true },
      playback:
        state.playback === null
          ? null
          : {
              position: state.playback.position,
              terminalPosition: state.playback.terminalPosition,
              stepId: state.playback.stepId,
              stepName: state.playback.stepName,
              addedPartCount: state.playback.addedPartCount,
              previewDocumentHash: documentStructuralHash(state.playback.previewDocument),
              validation: state.playback.validationReport,
              blockingCodes: state.playback.blockingCodes,
              buildable: state.playback.buildable,
              connected: state.playback.connected,
              exact: state.playback.exact,
              mode: state.playback.mode,
              traceCommitment: state.playback.traceCommitment,
            },
      renderer,
      error: state.commandError,
    });
  };
  const captureModelViews = async (options?: AutomationModelCaptureOptions) =>
    getViewport()?.captureCanonicalViews(options) ?? {};
  const captureInstructionView = async (request: InstructionViewCaptureRequest) => {
    const viewport = getViewport();
    if (viewport === null) throw new Error("Instruction-view capture requires a live viewport.");
    return viewport.captureInstructionView(request);
  };
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
  target.capture_instruction_view = captureInstructionView;
  target.get_model_snapshot = getModelSnapshot;
  target.advanceTime = advanceTime;

  return () => {
    if (target.render_app_to_text === renderAppToText) delete target.render_app_to_text;
    if (target.capture_model_views === captureModelViews) delete target.capture_model_views;
    if (target.capture_instruction_view === captureInstructionView)
      delete target.capture_instruction_view;
    if (target.get_model_snapshot === getModelSnapshot) delete target.get_model_snapshot;
    if (target.advanceTime === advanceTime) delete target.advanceTime;
  };
}

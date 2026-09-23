import {
  applyBuildOperations,
  deriveBuildSequenceFromTrace,
  invertBuildOperations,
  type BuildPlaybackTraceV1,
  type TruthMigrationReport,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, BuildOperation } from "@lego-studio/protocol";

export const EDITOR_HISTORY_LIMIT = 500;

export interface EditorTransaction {
  readonly label: string;
  readonly operations: readonly BuildOperation[];
}

export interface EditorState {
  readonly document: BrickDocumentV1;
  /** Derived replay evidence; every structural editor command invalidates it. */
  readonly playbackTrace: BuildPlaybackTraceV1 | null;
  /** Why persisted derived replay evidence was dropped while preserving the document. */
  readonly playbackTraceRecovery: string | null;
  readonly selectedPartId: string | null;
  readonly undoStack: readonly EditorTransaction[];
  readonly redoStack: readonly EditorTransaction[];
}

export class EditorTruthHistoryRecoveryError extends Error {
  public readonly code = "TRUTH_HISTORY_UNVERIFIED" as const;

  public constructor(fromCatalogVersion: string) {
    super(
      `This project is pinned to ${fromCatalogVersion}, and its stored undo/redo history cannot be verified against the current truth. The stored project was left unchanged; a compatible truth migration or recovery tool is required before editing.`,
    );
    this.name = "EditorTruthHistoryRecoveryError";
  }
}

export type EditorAction =
  | { readonly type: "selectPart"; readonly partId: string | null }
  | { readonly type: "applyTransaction"; readonly transaction: EditorTransaction }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "restoreState"; readonly state: EditorState }
  | { readonly type: "replaceDocument"; readonly document: BrickDocumentV1 }
  | { readonly type: "renameDocument"; readonly name: string };

export function createEditorState(
  document: BrickDocumentV1,
  playbackTrace: BuildPlaybackTraceV1 | null = null,
): EditorState {
  if (playbackTrace !== null) deriveBuildSequenceFromTrace(document, playbackTrace);
  return {
    document,
    playbackTrace,
    playbackTraceRecovery: null,
    selectedPartId: null,
    undoStack: [],
    redoStack: [],
  };
}

/** Applies the migration outcome only after the kernel has decided it. */
export function restoreEditorStateAfterTruthMigration(
  state: EditorState,
  migratedDocument: BrickDocumentV1,
  report: TruthMigrationReport,
): EditorState {
  if (!report.migrated) {
    if (report.blockingReasons.length === 0) return state;
    if (state.undoStack.length > 0 || state.redoStack.length > 0) {
      throw new EditorTruthHistoryRecoveryError(report.fromCatalogVersion);
    }
    return { ...state, playbackTrace: null };
  }
  return {
    ...state,
    document: migratedDocument,
    playbackTrace: null,
    playbackTraceRecovery: null,
    undoStack: [],
    redoStack: [],
  };
}

function selectedPartStillExists(
  document: BrickDocumentV1,
  selectedPartId: string | null,
): string | null {
  return selectedPartId && document.parts.some(({ id }) => id === selectedPartId)
    ? selectedPartId
    : null;
}

function appendHistory(
  history: readonly EditorTransaction[],
  transaction: EditorTransaction,
): readonly EditorTransaction[] {
  const retained = history.slice(-(EDITOR_HISTORY_LIMIT - 1));
  return [...retained, transaction];
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "selectPart":
      return {
        ...state,
        selectedPartId:
          action.partId === null || state.document.parts.some(({ id }) => id === action.partId)
            ? action.partId
            : state.selectedPartId,
      };
    case "applyTransaction": {
      const document = applyBuildOperations(state.document, action.transaction.operations);
      return {
        document,
        playbackTrace: null,
        playbackTraceRecovery: null,
        selectedPartId: selectedPartStillExists(document, state.selectedPartId),
        undoStack: appendHistory(state.undoStack, action.transaction),
        redoStack: [],
      };
    }
    case "undo": {
      const transaction = state.undoStack.at(-1);
      if (!transaction) return state;
      const document = applyBuildOperations(
        state.document,
        invertBuildOperations(transaction.operations),
      );
      return {
        document,
        playbackTrace: null,
        playbackTraceRecovery: null,
        selectedPartId: selectedPartStillExists(document, state.selectedPartId),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, transaction],
      };
    }
    case "redo": {
      const transaction = state.redoStack.at(-1);
      if (!transaction) return state;
      const document = applyBuildOperations(state.document, transaction.operations);
      return {
        document,
        playbackTrace: null,
        playbackTraceRecovery: null,
        selectedPartId: selectedPartStillExists(document, state.selectedPartId),
        undoStack: appendHistory(state.undoStack, transaction),
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    case "restoreState":
      return action.state;
    case "renameDocument": {
      const name = action.name.trim();
      if (name.length === 0 || name === state.document.name) return state;
      // A name is cosmetic, so it does not enter the undo history.
      return { ...state, document: { ...state.document, name } };
    }
    case "replaceDocument":
      return createEditorState(action.document);
  }
}

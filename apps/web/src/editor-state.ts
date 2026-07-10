import { applyBuildOperations, invertBuildOperations } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, BuildOperation } from "@lego-studio/protocol";

export interface EditorTransaction {
  readonly label: string;
  readonly operations: readonly BuildOperation[];
}

export interface EditorState {
  readonly document: BrickDocumentV1;
  readonly selectedPartId: string | null;
  readonly undoStack: readonly EditorTransaction[];
  readonly redoStack: readonly EditorTransaction[];
}

export type EditorAction =
  | { readonly type: "selectPart"; readonly partId: string | null }
  | { readonly type: "applyTransaction"; readonly transaction: EditorTransaction }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "replaceDocument"; readonly document: BrickDocumentV1 };

export function createEditorState(document: BrickDocumentV1): EditorState {
  return {
    document,
    selectedPartId: null,
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
        selectedPartId: selectedPartStillExists(document, state.selectedPartId),
        undoStack: [...state.undoStack, action.transaction],
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
        selectedPartId: selectedPartStillExists(document, state.selectedPartId),
        undoStack: [...state.undoStack, transaction],
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    case "replaceDocument":
      return createEditorState(action.document);
  }
}

import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  createBuildPlaybackTrace,
  createEmptyBrickDocument,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import {
  EDITOR_HISTORY_LIMIT,
  createEditorState,
  EditorTruthHistoryRecoveryError,
  editorReducer,
  restoreEditorStateAfterTruthMigration,
} from "./editor-state";
import {
  ManualCommandError,
  createAddPartTransaction,
  createRemovePartTransaction,
  createUpdatePartTransaction,
} from "./manual-commands";

describe("manual editor command history", () => {
  it("retains a bounded recent undo checkpoint during long editing sessions", () => {
    const empty = createEmptyBrickDocument({ id: "bounded", name: "Bounded history" });
    const addition = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    let state = editorReducer(createEditorState(empty), {
      type: "applyTransaction",
      transaction: addition,
    });

    for (let index = 0; index < EDITOR_HISTORY_LIMIT + 5; index += 1) {
      state = editorReducer(state, {
        type: "applyTransaction",
        transaction: createUpdatePartTransaction(
          state.document,
          addition.partId,
          { colorId: index % 2 === 0 ? "builtin:yellow" : "builtin:red" },
          false,
        ),
      });
    }

    expect(state.undoStack).toHaveLength(EDITOR_HISTORY_LIMIT);
    for (let index = 0; index < EDITOR_HISTORY_LIMIT; index += 1) {
      state = editorReducer(state, { type: "undo" });
    }
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(EDITOR_HISTORY_LIMIT);
    expect(editorReducer(state, { type: "undo" })).toBe(state);
  });

  it("restores a replay-validated persisted editor state without dropping history", () => {
    const empty = createEmptyBrickDocument({ id: "restored", name: "Restored" });
    const transaction = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const persisted = editorReducer(createEditorState(empty), {
      type: "applyTransaction",
      transaction,
    });

    const restored = editorReducer(createEditorState(empty), {
      type: "restoreState",
      state: persisted,
    });

    expect(restored).toBe(persisted);
    expect(restored.document.parts).toHaveLength(1);
    expect(restored.undoStack).toHaveLength(1);
  });

  it("retains replay evidence only across selection and cosmetic document renames", () => {
    const empty = createEmptyBrickDocument({ id: "trace-editor", name: "Trace editor" });
    const addition = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const authored = editorReducer(createEditorState(empty), {
      type: "applyTransaction",
      transaction: addition,
    });
    const trace = createBuildPlaybackTrace(empty, [[addition.operations]]);
    const exact = createEditorState(authored.document, trace);

    const selected = editorReducer(exact, { type: "selectPart", partId: addition.partId });
    const renamed = editorReducer(selected, { type: "renameDocument", name: "Display name" });
    expect(selected.playbackTrace).toBe(trace);
    expect(renamed.playbackTrace).toBe(trace);

    const recolor = createUpdatePartTransaction(
      authored.document,
      addition.partId,
      { colorId: "builtin:yellow" },
      false,
    );
    expect(
      editorReducer(exact, { type: "applyTransaction", transaction: recolor }).playbackTrace,
    ).toBeNull();

    const withHistory = {
      ...authored,
      playbackTrace: trace,
      playbackTraceRecovery: "old notice",
    };
    const undone = editorReducer(withHistory, { type: "undo" });
    expect(undone.playbackTrace).toBeNull();
    expect(undone.playbackTraceRecovery).toBeNull();

    const withRedo = { ...exact, redoStack: [recolor] };
    expect(editorReducer(withRedo, { type: "redo" }).playbackTrace).toBeNull();
    expect(
      editorReducer(exact, { type: "replaceDocument", document: empty }).playbackTrace,
    ).toBeNull();
  });

  it("clears history only after truth migration succeeds", () => {
    const empty = createEmptyBrickDocument({ id: "truth-history", name: "Truth history" });
    const addition = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const state = editorReducer(createEditorState(empty), {
      type: "applyTransaction",
      transaction: addition,
    });
    const migratedDocument = { ...state.document, name: "Migrated truth" };
    const restored = restoreEditorStateAfterTruthMigration(state, migratedDocument, {
      schemaVersion: "lego.truth-migration/2",
      migrated: true,
      fromCatalogVersion: "builtin.basic-parts/29",
      toCatalogVersion: "builtin.basic-parts/30",
      fromTruthHash: `sha256:${"1".repeat(64)}`,
      toTruthHash: `sha256:${"2".repeat(64)}`,
      addedColorIds: [],
      addedCatalogPartIds: [],
      catalogInterpretationChanges: [],
      truthComponentChanges: [],
      blockingReasons: [],
    });

    expect(restored.document).toBe(migratedDocument);
    expect(restored.undoStack).toEqual([]);
    expect(restored.redoStack).toEqual([]);
    expect(restored.playbackTrace).toBeNull();
    expect(restored.playbackTraceRecovery).toBeNull();
  });

  it("keeps blocked empty-history projects usable but refuses unverified active history", () => {
    const empty = createEditorState(
      createEmptyBrickDocument({ id: "blocked-truth", name: "Blocked truth" }),
    );
    const blockedReport = {
      schemaVersion: "lego.truth-migration/2" as const,
      migrated: false,
      fromCatalogVersion: "unknown-catalog/999",
      toCatalogVersion: "builtin.basic-parts/30",
      fromTruthHash: `sha256:${"1".repeat(64)}`,
      toTruthHash: `sha256:${"2".repeat(64)}`,
      addedColorIds: [],
      addedCatalogPartIds: [],
      catalogInterpretationChanges: [],
      truthComponentChanges: [],
      blockingReasons: ["No compatible truth migration is available"],
    };

    const restoredEmpty = restoreEditorStateAfterTruthMigration(
      empty,
      empty.document,
      blockedReport,
    );
    expect(restoredEmpty.document).toBe(empty.document);
    expect(restoredEmpty.undoStack).toEqual([]);
    expect(restoredEmpty.redoStack).toEqual([]);

    const withHistory = {
      ...empty,
      undoStack: [{ label: "Unverified", operations: [] }],
    };
    expect(() =>
      restoreEditorStateAfterTruthMigration(withHistory, empty.document, blockedReport),
    ).toThrowError(EditorTruthHistoryRecoveryError);
  });

  it("adds, connects, undoes, and redoes explicit transactions", () => {
    const empty = createEmptyBrickDocument({ id: "editor", name: "Editor" });
    const first = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    let state = editorReducer(createEditorState(empty), {
      type: "applyTransaction",
      transaction: first,
    });
    state = editorReducer(state, { type: "selectPart", partId: first.partId });
    const second = createAddPartTransaction(state.document, {
      catalogPartId: "builtin:plate-1x1",
      colorId: "builtin:blue",
      selectedPartId: first.partId,
    });
    state = editorReducer(state, { type: "applyTransaction", transaction: second });

    expect(state.document.parts).toHaveLength(2);
    expect(state.document.connections).toHaveLength(1);
    expect(validateBrickDocument(state.document).documentGloballyValid).toBe(true);

    state = editorReducer(state, { type: "undo" });
    expect(state.document.parts).toHaveLength(1);
    state = editorReducer(state, { type: "redo" });
    expect(state.document.parts).toHaveLength(2);
    expect(state.document.connections).toHaveLength(1);
  });

  it("requires a selected free attachment target after the first part", () => {
    const empty = createEmptyBrickDocument({ id: "target", name: "Target" });
    const first = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const onePart = applyBuildOperations(empty, first.operations);
    expect(() =>
      createAddPartTransaction(onePart, {
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:red",
        selectedPartId: null,
      }),
    ).toThrow(ManualCommandError);
  });

  it("records every coincident stud contact for a multi-stud attachment", () => {
    const empty = createEmptyBrickDocument({ id: "multi-contact", name: "Multi contact" });
    const first = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-2x2",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const onePart = applyBuildOperations(empty, first.operations);
    const second = createAddPartTransaction(onePart, {
      catalogPartId: "builtin:brick-2x2",
      colorId: "builtin:blue",
      selectedPartId: first.partId,
    });
    const stack = applyBuildOperations(onePart, second.operations);

    expect(stack.connections).toHaveLength(4);
    expect(validateBrickDocument(stack).documentGloballyValid).toBe(true);
  });

  it("removes incident connections before a part and restores them on undo", () => {
    const empty = createEmptyBrickDocument({ id: "remove", name: "Remove" });
    const first = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const onePart = applyBuildOperations(empty, first.operations);
    const second = createAddPartTransaction(onePart, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:blue",
      selectedPartId: first.partId,
    });
    const stack = applyBuildOperations(onePart, second.operations);
    const removal = createRemovePartTransaction(stack, first.partId);
    expect(removal.operations.map(({ kind }) => kind)).toEqual(["removeConnection", "removePart"]);

    let state = editorReducer(createEditorState(stack), {
      type: "applyTransaction",
      transaction: removal,
    });
    expect(state.document.parts).toHaveLength(1);
    state = editorReducer(state, { type: "undo" });
    expect(state.document.parts).toHaveLength(2);
    expect(state.document.connections).toHaveLength(1);
  });

  it("requires explicit detach for transform changes but not recolors", () => {
    const empty = createEmptyBrickDocument({ id: "detach", name: "Detach" });
    const first = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const onePart = applyBuildOperations(empty, first.operations);
    const second = createAddPartTransaction(onePart, {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:blue",
      selectedPartId: first.partId,
    });
    const stack = applyBuildOperations(onePart, second.operations);
    expect(() =>
      createUpdatePartTransaction(
        stack,
        second.partId,
        { transform: { positionLdu: [20, -24, 0], orientationId: "upright-yaw-0" } },
        false,
      ),
    ).toThrow(/explicit detach/);
    expect(
      createUpdatePartTransaction(stack, second.partId, { colorId: "builtin:yellow" }, false)
        .operations,
    ).toHaveLength(1);
    const uiShapedRecolor = createUpdatePartTransaction(
      stack,
      second.partId,
      {
        colorId: "builtin:yellow",
        transform: stack.parts.find(({ id }) => id === second.partId)!.transform,
      },
      false,
    );
    const recolored = applyBuildOperations(stack, uiShapedRecolor.operations);
    expect(recolored.connections).toEqual(stack.connections);
    expect(recolored.parts.find(({ id }) => id === second.partId)?.colorId).toBe("builtin:yellow");
  });
});

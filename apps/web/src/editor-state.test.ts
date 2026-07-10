import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  createEmptyBrickDocument,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { createEditorState, editorReducer } from "./editor-state";
import {
  ManualCommandError,
  createAddPartTransaction,
  createRemovePartTransaction,
  createUpdatePartTransaction,
} from "./manual-commands";

describe("manual editor command history", () => {
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

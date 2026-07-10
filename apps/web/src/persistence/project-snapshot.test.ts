import { describe, expect, it } from "vitest";

import {
  canonicalStringify,
  createEmptyBrickDocument,
  createPartInstance,
} from "@lego-studio/brick-kernel";
import type { BuildOperation } from "@lego-studio/protocol";

import { createEditorState, editorReducer } from "../editor-state";
import { createAddPartTransaction } from "../manual-commands";
import {
  ProjectSnapshotError,
  createStoredEditorProject,
  parseStoredEditorProject,
} from "./project-snapshot";

function fixture() {
  const empty = createEmptyBrickDocument({ id: "project-1", name: "Saved model" });
  const part = createPartInstance({ id: "part-1", catalogPartId: "builtin:brick-1x2" });
  const operations: BuildOperation[] = [
    {
      kind: "addPart",
      operationId: "add-part-1",
      part,
      semanticRegionIds: [],
    },
  ];
  const state = editorReducer(createEditorState(empty), {
    type: "applyTransaction",
    transaction: { label: "Add part", operations },
  });
  return { empty, part, operations, state };
}

function expectSnapshotError(value: unknown, code: ProjectSnapshotError["code"]): void {
  try {
    parseStoredEditorProject(value);
    throw new Error("Expected project parsing to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectSnapshotError);
    expect(error).toMatchObject({ code });
  }
}

describe("stored editor project snapshots", () => {
  it("round-trips a bounded editor state and deeply freezes detached data", () => {
    const { state } = fixture();
    const stored = createStoredEditorProject("project-1", 4, state);
    const parsed = parseStoredEditorProject(structuredClone(stored));

    expect(canonicalStringify(parsed)).toBe(canonicalStringify(stored));
    expect(parsed).not.toBe(stored);
    expect(parsed.generation).toBe(4);
    expect(parsed.documentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(parsed.snapshotHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(parsed.state.undoStack).toHaveLength(1);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.state.document.parts[0])).toBe(true);
    expect(Object.isFrozen(parsed.state.undoStack[0]?.operations)).toBe(true);
  });

  it("detaches caller objects before retaining them", () => {
    const { state } = fixture();
    const mutable = structuredClone(state);
    const stored = createStoredEditorProject("project-1", 1, mutable);

    // @ts-expect-error Deliberately exercise a caller that violates the readonly API at runtime.
    mutable.document.name = "Mutated after save";
    // @ts-expect-error Deliberately exercise a caller that violates the readonly API at runtime.
    mutable.undoStack[0]!.label = "Mutated transaction";

    expect(stored.state.document.name).toBe("Saved model");
    expect(stored.state.undoStack[0]?.label).toBe("Add part");
  });

  it("strips transient command helper fields from persisted transactions", () => {
    const empty = createEmptyBrickDocument({ id: "project-1", name: "Saved model" });
    const transaction = createAddPartTransaction(empty, {
      catalogPartId: "builtin:brick-1x2",
      colorId: "builtin:red",
      selectedPartId: null,
    });
    const state = editorReducer(createEditorState(empty), {
      type: "applyTransaction",
      transaction,
    });

    const stored = createStoredEditorProject("project-1", 1, state);

    expect(Object.keys(stored.state.undoStack[0]!).sort()).toEqual(["label", "operations"]);
    expect(stored.state.undoStack[0]).not.toHaveProperty("partId");
    expect(parseStoredEditorProject(structuredClone(stored))).toEqual(stored);
  });

  it("rejects a forged document hash and unknown stored fields", () => {
    const stored = createStoredEditorProject("project-1", 1, fixture().state);
    expectSnapshotError(
      { ...stored, documentHash: `sha256:${"f".repeat(64)}` },
      "DOCUMENT_HASH_MISMATCH",
    );
    expectSnapshotError({ ...stored, providerToken: "forbidden" }, "PROJECT_SCHEMA_INVALID");
  });

  it("binds document metadata, history labels, and generations into exact content hashes", () => {
    const stored = createStoredEditorProject("project-1", 1, fixture().state);
    expectSnapshotError(
      {
        ...stored,
        state: { ...stored.state, document: { ...stored.state.document, name: "Other" } },
      },
      "DOCUMENT_HASH_MISMATCH",
    );
    expectSnapshotError(
      {
        ...stored,
        state: {
          ...stored.state,
          undoStack: [{ ...stored.state.undoStack[0]!, label: "Other label" }],
        },
      },
      "SNAPSHOT_HASH_MISMATCH",
    );
    expectSnapshotError({ ...stored, generation: 2 }, "SNAPSHOT_HASH_MISMATCH");
  });

  it("replays undo history from its exact before-values", () => {
    const { state } = fixture();
    const stored = createStoredEditorProject("project-1", 1, state);
    const forged = structuredClone(stored);
    const operation = forged.state.undoStack[0]!.operations[0]!;
    if (operation.kind !== "addPart") throw new Error("Unexpected fixture operation");
    // @ts-expect-error Deliberately forge persisted before-values after structured cloning.
    operation.part.colorId = "builtin:yellow";

    expectSnapshotError(forged, "HISTORY_REPLAY_FAILED");
  });

  it("rejects malformed operations, selections, and excessive history", () => {
    const { state } = fixture();
    const stored = createStoredEditorProject("project-1", 1, state);
    expectSnapshotError(
      {
        ...stored,
        state: {
          ...stored.state,
          undoStack: [{ label: "Bad", operations: [{ kind: "javascript", source: "x" }] }],
        },
      },
      "PROJECT_SCHEMA_INVALID",
    );
    expectSnapshotError(
      { ...stored, state: { ...stored.state, selectedPartId: "missing-part" } },
      "PROJECT_SCHEMA_INVALID",
    );
    expectSnapshotError(
      {
        ...stored,
        state: {
          ...stored.state,
          undoStack: Array.from({ length: 501 }, () => stored.state.undoStack[0]),
        },
      },
      "PROJECT_LIMIT_EXCEEDED",
    );
  });

  it("rejects invalid generations and non-cloneable hostile input", () => {
    const stored = createStoredEditorProject("project-1", 1, fixture().state);
    expectSnapshotError({ ...stored, generation: -1 }, "PROJECT_SCHEMA_INVALID");
    expectSnapshotError(new Proxy(stored, {}), "PROJECT_SCHEMA_INVALID");
  });
});

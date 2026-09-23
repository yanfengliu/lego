import { describe, expect, it } from "vitest";

import {
  canonicalDigest,
  canonicalStringify,
  createBuildPlaybackTrace,
  createEmptyBrickDocument,
  createPartInstance,
  migrateDocumentTruth,
} from "@lego-studio/brick-kernel";
import type { BuildOperation } from "@lego-studio/protocol";

import {
  createEditorState,
  EditorTruthHistoryRecoveryError,
  editorReducer,
  restoreEditorStateAfterTruthMigration,
  type EditorState,
} from "../editor-state";
import { createAddPartTransaction } from "../manual-commands";
import {
  ProjectSnapshotError,
  PROJECT_SNAPSHOT_LIMITS,
  createStoredEditorProject,
  parseStoredEditorProject,
  type StoredEditorProject,
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

function stateWithPlaybackTrace(): EditorState {
  const { empty, operations, state } = fixture();
  return { ...state, playbackTrace: createBuildPlaybackTrace(empty, [[operations]]) };
}

function rehashStoredProject(
  stored: StoredEditorProject,
  state: unknown,
  documentHash = stored.documentHash,
): unknown {
  return {
    ...stored,
    documentHash,
    state,
    snapshotHash: canonicalDigest({
      schemaVersion: stored.schemaVersion,
      projectId: stored.projectId,
      generation: stored.generation,
      documentHash,
      state,
    }),
  };
}

function legacyStoredProject(state: EditorState): unknown {
  const legacyState = {
    document: state.document,
    redoStack: state.redoStack,
    selectedPartId: state.selectedPartId,
    undoStack: state.undoStack,
  };
  const documentHash = canonicalDigest(state.document);
  return {
    schemaVersion: "lego.local-project/1",
    projectId: "project-1",
    generation: 7,
    documentHash,
    snapshotHash: canonicalDigest({
      schemaVersion: "lego.local-project/1",
      projectId: "project-1",
      generation: 7,
      documentHash,
      state: legacyState,
    }),
    state: legacyState,
  };
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

  it("round-trips and deeply freezes a version-2 operation replay trace", () => {
    const stored = createStoredEditorProject("project-1", 8, stateWithPlaybackTrace());
    const parsed = parseStoredEditorProject(structuredClone(stored));

    expect(stored.schemaVersion).toBe("lego.local-project/2");
    expect(parsed.state.playbackTrace?.traceCommitment).toBe(
      stored.state.playbackTrace?.traceCommitment,
    );
    expect(parsed.state.playbackTraceRecovery).toBeNull();
    expect(Object.isFrozen(parsed.state.playbackTrace)).toBe(true);
    expect(Object.isFrozen(parsed.state.playbackTrace?.transitions[0]?.operationGroups[0])).toBe(
      true,
    );
  });

  it("migrates an authentic version-1 snapshot to version 2 without inventing replay evidence", () => {
    const { state } = fixture();
    const parsed = parseStoredEditorProject(legacyStoredProject(state));

    expect(parsed).toMatchObject({ schemaVersion: "lego.local-project/2", generation: 7 });
    expect(parsed.state.playbackTrace).toBeNull();
    expect(parsed.state.playbackTraceRecovery).toBeNull();
    expect(parsed.state.undoStack).toEqual(state.undoStack);
    expect(parsed.state.redoStack).toEqual(state.redoStack);
  });

  it("distinguishes tampered trace bytes from an intact snapshot carrying stale derived evidence", () => {
    const stored = createStoredEditorProject("project-1", 3, stateWithPlaybackTrace());
    const playbackTrace = {
      ...stored.state.playbackTrace!,
      targetDocumentHash: `sha256:${"f".repeat(64)}`,
    };
    const state = { ...stored.state, playbackTrace };

    expectSnapshotError({ ...stored, state }, "SNAPSHOT_HASH_MISMATCH");

    const recovered = parseStoredEditorProject(rehashStoredProject(stored, state));
    expect(recovered.state.document).toEqual(stored.state.document);
    expect(recovered.state.undoStack).toEqual(stored.state.undoStack);
    expect(recovered.state.playbackTrace).toBeNull();
    expect(recovered.state.playbackTraceRecovery).toContain(
      "dropped without changing the authored document or history",
    );
  });

  it("loads intact future trace schemas as authored truth with explicit recovery", () => {
    const stored = createStoredEditorProject("project-1", 3, stateWithPlaybackTrace());
    const state = {
      ...stored.state,
      playbackTrace: { ...stored.state.playbackTrace!, schemaVersion: "future-trace/99" },
    };
    const recovered = parseStoredEditorProject(rehashStoredProject(stored, state));

    expect(recovered.state.document).toEqual(stored.state.document);
    expect(recovered.state.playbackTrace).toBeNull();
    expect(recovered.state.playbackTraceRecovery).toContain("dropped");
  });

  it("preserves nonempty history when an old unknown truth migration is blocked", () => {
    const stored = createStoredEditorProject("project-1", 3, stateWithPlaybackTrace());
    const firstTransaction = stored.state.undoStack[0];
    const staleOperation = firstTransaction?.operations[0];
    if (firstTransaction === undefined || staleOperation?.kind !== "addPart") {
      throw new Error("Unexpected history fixture");
    }
    // Schema-valid but irreconcilable with the stored document: undo would try
    // to remove a yellow part while the document contains the original red one.
    const staleUndoStack = [
      {
        ...firstTransaction,
        operations: [
          {
            ...staleOperation,
            part: { ...staleOperation.part, colorId: "builtin:yellow" },
          },
          ...firstTransaction.operations.slice(1),
        ],
      },
      ...stored.state.undoStack.slice(1),
    ];
    const oldDocument = {
      ...stored.state.document,
      truth: {
        ...stored.state.document.truth,
        catalog: {
          ...stored.state.document.truth.catalog,
          version: "unknown-catalog/999",
        },
      },
    };
    const state = { ...stored.state, document: oldDocument, undoStack: staleUndoStack };
    const documentHash = canonicalDigest(oldDocument);
    const parsed = parseStoredEditorProject(rehashStoredProject(stored, state, documentHash));

    expect(parsed.state.undoStack).toEqual(staleUndoStack);
    expect(parsed.state.undoStack).toHaveLength(1);
    expect(parsed.state.playbackTrace).toBeNull();
    expect(parsed.state.playbackTraceRecovery).toContain("pinned truth requires migration");

    const migration = migrateDocumentTruth(parsed.state.document);
    expect(migration.report.migrated).toBe(false);
    expect(migration.report.blockingReasons.length).toBeGreaterThan(0);
    expect(() =>
      restoreEditorStateAfterTruthMigration(parsed.state, migration.document, migration.report),
    ).toThrowError(EditorTruthHistoryRecoveryError);
    try {
      restoreEditorStateAfterTruthMigration(parsed.state, migration.document, migration.report);
      throw new Error("Expected blocked history restoration to fail closed");
    } catch (error) {
      expect(error).toMatchObject({
        name: "EditorTruthHistoryRecoveryError",
        code: "TRUTH_HISTORY_UNVERIFIED",
      });
      expect(error).toHaveProperty(
        "message",
        expect.stringContaining(
          "stored undo/redo history cannot be verified against the current truth",
        ),
      );
      expect(error).toHaveProperty("message", expect.stringContaining("left unchanged"));
      expect(error).toHaveProperty(
        "message",
        expect.stringContaining("compatible truth migration or recovery tool"),
      );
    }
  });

  it("rejects oversized and noncanonical nested trace values behind typed project errors", () => {
    const stored = createStoredEditorProject("project-1", 3, stateWithPlaybackTrace());
    expectSnapshotError(
      {
        ...stored,
        state: {
          ...stored.state,
          playbackTrace: { payload: "x".repeat(PROJECT_SNAPSHOT_LIMITS.maxBytes) },
        },
      },
      "PROJECT_LIMIT_EXCEEDED",
    );

    const sparse: unknown[] = [];
    sparse.length = 1;
    for (const playbackTrace of [undefined, Number.NaN, new Map(), new Date(0), sparse]) {
      expectSnapshotError(
        { ...stored, state: { ...stored.state, playbackTrace } },
        "PROJECT_SCHEMA_INVALID",
      );
    }
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

    expectSnapshotError(rehashStoredProject(stored, forged.state), "HISTORY_REPLAY_FAILED");
  });

  it("rejects malformed operations, selections, and excessive history", () => {
    const { state } = fixture();
    const stored = createStoredEditorProject("project-1", 1, state);
    expectSnapshotError(
      rehashStoredProject(stored, {
        ...stored.state,
        undoStack: [{ label: "Bad", operations: [{ kind: "javascript", source: "x" }] }],
      }),
      "PROJECT_SCHEMA_INVALID",
    );
    expectSnapshotError(
      rehashStoredProject(stored, { ...stored.state, selectedPartId: "missing-part" }),
      "PROJECT_SCHEMA_INVALID",
    );
    expectSnapshotError(
      rehashStoredProject(stored, {
        ...stored.state,
        undoStack: Array.from({ length: 501 }, () => stored.state.undoStack[0]),
      }),
      "PROJECT_LIMIT_EXCEEDED",
    );
  });

  it("rejects invalid generations and non-cloneable hostile input", () => {
    const stored = createStoredEditorProject("project-1", 1, fixture().state);
    expectSnapshotError({ ...stored, generation: -1 }, "PROJECT_SCHEMA_INVALID");
    expectSnapshotError(new Proxy(stored, {}), "PROJECT_SCHEMA_INVALID");
  });
});

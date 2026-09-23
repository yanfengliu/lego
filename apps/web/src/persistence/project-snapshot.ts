import {
  applyBuildOperations,
  canonicalDigest,
  canonicalStringify,
  createBuiltinTruthSnapshot,
  deepFreeze,
  deriveBuildSequenceFromTrace,
  documentStructuralHash,
  invertBuildOperations,
  type BuildPlaybackTraceV1,
} from "@lego-studio/brick-kernel";
import {
  validateBrickDocumentV1,
  validateBuildOperation,
  type BrickDocumentV1,
  type BuildOperation,
} from "@lego-studio/protocol";

import { EDITOR_HISTORY_LIMIT, type EditorState, type EditorTransaction } from "../editor-state";

export const PROJECT_SNAPSHOT_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxHistoryEntries: EDITOR_HISTORY_LIMIT,
  maxOperationsPerTransaction: 10_000,
  maxTotalHistoryOperations: 50_000,
  maxLabelLength: 256,
} as const);

export type ProjectSnapshotErrorCode =
  | "PROJECT_SCHEMA_INVALID"
  | "PROJECT_LIMIT_EXCEEDED"
  | "DOCUMENT_HASH_MISMATCH"
  | "SNAPSHOT_HASH_MISMATCH"
  | "HISTORY_REPLAY_FAILED";

export class ProjectSnapshotError extends Error {
  public readonly code: ProjectSnapshotErrorCode;

  public constructor(code: ProjectSnapshotErrorCode, message: string) {
    super(message);
    this.name = "ProjectSnapshotError";
    this.code = code;
  }
}

export interface StoredEditorProjectV2 {
  readonly schemaVersion: "lego.local-project/2";
  readonly projectId: string;
  readonly generation: number;
  readonly documentHash: string;
  readonly snapshotHash: string;
  readonly state: EditorState;
}

export type StoredEditorProject = StoredEditorProjectV2;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PROJECT_KEYS = [
  "documentHash",
  "generation",
  "projectId",
  "schemaVersion",
  "snapshotHash",
  "state",
];
const LEGACY_STATE_KEYS = ["document", "redoStack", "selectedPartId", "undoStack"];
const STATE_KEYS = [
  "document",
  "playbackTrace",
  "playbackTraceRecovery",
  "redoStack",
  "selectedPartId",
  "undoStack",
];
const TRANSACTION_KEYS = ["label", "operations"];

function invalid(message: string): never {
  throw new ProjectSnapshotError("PROJECT_SCHEMA_INVALID", message);
}

function limit(message: string): never {
  throw new ProjectSnapshotError("PROJECT_LIMIT_EXCEEDED", message);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function detachAndBound(value: unknown): unknown {
  let detached: unknown;
  try {
    detached = structuredClone(value);
  } catch {
    return invalid("Stored project must be detached structured-cloneable data");
  }
  let canonicalJson: string;
  try {
    canonicalJson = canonicalStringify(detached);
  } catch {
    return invalid("Stored project must be finite canonical JSON data without sparse arrays");
  }
  if (new TextEncoder().encode(canonicalJson).byteLength > PROJECT_SNAPSHOT_LIMITS.maxBytes) {
    return limit("Stored project exceeds the local project byte limit");
  }
  return detached;
}

function parseTransaction(value: unknown): EditorTransaction {
  if (!isPlainRecord(value) || !hasExactKeys(value, TRANSACTION_KEYS)) {
    return invalid("Editor transaction has an invalid shape");
  }
  if (
    typeof value.label !== "string" ||
    value.label.length < 1 ||
    value.label.length > PROJECT_SNAPSHOT_LIMITS.maxLabelLength
  ) {
    return invalid("Editor transaction label is invalid");
  }
  if (!Array.isArray(value.operations) || value.operations.length < 1) {
    return invalid("Editor transaction operations are invalid");
  }
  if (value.operations.length > PROJECT_SNAPSHOT_LIMITS.maxOperationsPerTransaction) {
    return limit("Editor transaction exceeds the operation limit");
  }
  const operations: BuildOperation[] = [];
  for (const operation of value.operations) {
    let valid = false;
    try {
      valid = validateBuildOperation(operation);
    } catch {
      // Hostile stored values fail closed.
    }
    if (!valid) return invalid("Editor transaction contains an invalid operation");
    operations.push(operation as BuildOperation);
  }
  return { label: value.label, operations };
}

function parseHistory(value: unknown, label: string): EditorTransaction[] {
  if (!Array.isArray(value)) return invalid(`${label} history is invalid`);
  if (value.length > PROJECT_SNAPSHOT_LIMITS.maxHistoryEntries) {
    return limit(`${label} history exceeds the entry limit`);
  }
  return value.map(parseTransaction);
}

/** True when the document pins a truth snapshot other than this kernel's. */
function documentAwaitsTruthMigration(document: BrickDocumentV1): boolean {
  return canonicalDigest(document.truth) !== canonicalDigest(createBuiltinTruthSnapshot());
}

function verifyHistory(
  document: BrickDocumentV1,
  undoStack: readonly EditorTransaction[],
  redoStack: readonly EditorTransaction[],
): void {
  try {
    let origin = document;
    for (let index = undoStack.length - 1; index >= 0; index -= 1) {
      origin = applyBuildOperations(origin, invertBuildOperations(undoStack[index]!.operations));
    }
    let replayed = origin;
    for (const transaction of undoStack) {
      replayed = applyBuildOperations(replayed, transaction.operations);
    }
    if (documentStructuralHash(replayed) !== documentStructuralHash(document)) {
      throw new Error("Undo history does not reproduce the stored document");
    }

    let redoResult = document;
    for (let index = redoStack.length - 1; index >= 0; index -= 1) {
      redoResult = applyBuildOperations(redoResult, redoStack[index]!.operations);
    }
  } catch (error) {
    throw new ProjectSnapshotError(
      "HISTORY_REPLAY_FAILED",
      error instanceof Error ? error.message : "Stored editor history cannot be replayed",
    );
  }
}

function snapshotDigest(
  schemaVersion: "lego.local-project/1" | "lego.local-project/2",
  projectId: string,
  generation: number,
  documentHash: string,
  state: unknown,
): string {
  try {
    return canonicalDigest({
      schemaVersion,
      projectId,
      generation,
      documentHash,
      state,
    });
  } catch {
    return invalid("Stored project snapshot must be finite canonical JSON data");
  }
}

export function parseStoredEditorProject(value: unknown): StoredEditorProjectV2 {
  const detached = detachAndBound(value);
  if (!isPlainRecord(detached) || !hasExactKeys(detached, PROJECT_KEYS)) {
    return invalid("Stored project has an invalid shape");
  }
  if (
    (detached.schemaVersion !== "lego.local-project/1" &&
      detached.schemaVersion !== "lego.local-project/2") ||
    typeof detached.projectId !== "string" ||
    !IDENTIFIER_PATTERN.test(detached.projectId) ||
    !Number.isSafeInteger(detached.generation) ||
    (detached.generation as number) < 0 ||
    typeof detached.documentHash !== "string" ||
    !HASH_PATTERN.test(detached.documentHash) ||
    typeof detached.snapshotHash !== "string" ||
    !HASH_PATTERN.test(detached.snapshotHash)
  ) {
    return invalid("Stored project identity or generation is invalid");
  }
  const legacy = detached.schemaVersion === "lego.local-project/1";
  if (
    !isPlainRecord(detached.state) ||
    !hasExactKeys(detached.state, legacy ? LEGACY_STATE_KEYS : STATE_KEYS)
  ) {
    return invalid("Stored editor state has an invalid shape");
  }

  let documentValid = false;
  try {
    documentValid = validateBrickDocumentV1(detached.state.document);
  } catch {
    // Hostile stored values fail closed.
  }
  if (!documentValid) return invalid("Stored project document is invalid");
  const document = detached.state.document as BrickDocumentV1;
  const documentHash = canonicalDigest(document);
  if (documentHash !== detached.documentHash) {
    throw new ProjectSnapshotError(
      "DOCUMENT_HASH_MISMATCH",
      "Stored project document hash does not match its canonical bytes",
    );
  }
  const snapshotHash = snapshotDigest(
    detached.schemaVersion,
    detached.projectId,
    detached.generation as number,
    documentHash,
    detached.state,
  );
  if (snapshotHash !== detached.snapshotHash) {
    throw new ProjectSnapshotError(
      "SNAPSHOT_HASH_MISMATCH",
      "Stored project snapshot hash does not match its canonical content",
    );
  }

  const selectedPartId = detached.state.selectedPartId;
  if (
    selectedPartId !== null &&
    (typeof selectedPartId !== "string" ||
      !IDENTIFIER_PATTERN.test(selectedPartId) ||
      !document.parts.some(({ id }) => id === selectedPartId))
  ) {
    return invalid("Stored selection does not name a document part");
  }
  const undoStack = parseHistory(detached.state.undoStack, "Undo");
  const redoStack = parseHistory(detached.state.redoStack, "Redo");
  const totalOperations = [...undoStack, ...redoStack].reduce(
    (total, transaction) => total + transaction.operations.length,
    0,
  );
  if (totalOperations > PROJECT_SNAPSHOT_LIMITS.maxTotalHistoryOperations) {
    return limit("Stored editor history exceeds the total operation limit");
  }
  // Operations authored under an older truth cannot be replayed against the
  // current kernel, so a document awaiting migration skips replay validation.
  // Its history remains hash-bound and is preserved until App knows whether
  // migration succeeded or was blocked.
  const awaitingTruthMigration = documentAwaitsTruthMigration(document);
  if (!awaitingTruthMigration) verifyHistory(document, undoStack, redoStack);

  const storedPlaybackTrace = legacy ? null : detached.state.playbackTrace;
  const storedPlaybackTraceRecovery = legacy ? null : detached.state.playbackTraceRecovery;
  if (
    storedPlaybackTraceRecovery !== null &&
    (typeof storedPlaybackTraceRecovery !== "string" ||
      storedPlaybackTraceRecovery.length < 1 ||
      storedPlaybackTraceRecovery.length > 512)
  ) {
    return invalid("Stored playback trace recovery notice is invalid");
  }
  let playbackTrace: BuildPlaybackTraceV1 | null = null;
  let playbackTraceRecovery = storedPlaybackTraceRecovery as string | null;
  if (storedPlaybackTrace !== null && !awaitingTruthMigration) {
    try {
      deriveBuildSequenceFromTrace(document, storedPlaybackTrace);
      playbackTrace = storedPlaybackTrace as BuildPlaybackTraceV1;
    } catch (error) {
      playbackTraceRecovery =
        `Stored operation replay trace was dropped without changing the authored document or history: ${
          error instanceof Error ? error.message : "the trace could not be replayed"
        }`.slice(0, 512);
    }
  } else if (storedPlaybackTrace !== null && awaitingTruthMigration) {
    playbackTraceRecovery =
      "Stored operation replay trace was dropped because its pinned truth requires migration.";
  }

  const state = {
    document,
    playbackTrace,
    playbackTraceRecovery,
    selectedPartId,
    undoStack,
    redoStack,
  } satisfies EditorState;
  const parsedState = legacy
    ? { ...state, playbackTrace: null, playbackTraceRecovery: null }
    : state;
  const migratedSnapshotHash = snapshotDigest(
    "lego.local-project/2",
    detached.projectId,
    detached.generation as number,
    documentHash,
    parsedState,
  );

  return deepFreeze({
    schemaVersion: "lego.local-project/2" as const,
    projectId: detached.projectId,
    generation: detached.generation as number,
    documentHash,
    snapshotHash: migratedSnapshotHash,
    // Parsing preserves hash-bound history. App clears it only after the
    // migration kernel reports a successful truth rewrite.
    state: parsedState,
  });
}

export function createStoredEditorProject(
  projectId: string,
  generation: number,
  state: EditorState,
): StoredEditorProjectV2 {
  // Editor command helpers may return useful transient fields (for example,
  // `partId`) alongside the transaction contract. The reducer intentionally
  // accepts that structural subtype, but persistence must retain only the
  // versioned project schema.
  const canonicalState = {
    document: state.document,
    playbackTrace: state.playbackTrace,
    playbackTraceRecovery: state.playbackTraceRecovery,
    selectedPartId: state.selectedPartId,
    undoStack: state.undoStack.map(({ label, operations }) => ({ label, operations })),
    redoStack: state.redoStack.map(({ label, operations }) => ({ label, operations })),
  } satisfies EditorState;
  const documentHash = canonicalDigest(canonicalState.document);
  return parseStoredEditorProject({
    schemaVersion: "lego.local-project/2",
    projectId,
    generation,
    documentHash,
    snapshotHash: snapshotDigest(
      "lego.local-project/2",
      projectId,
      generation,
      documentHash,
      canonicalState,
    ),
    state: canonicalState,
  });
}

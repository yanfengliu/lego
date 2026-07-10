import type { EditorState } from "../editor-state";
import {
  ProjectSnapshotError,
  createStoredEditorProject,
  parseStoredEditorProject,
  type StoredEditorProjectV1,
} from "./project-snapshot";

const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";

export type ProjectRepositoryErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_BLOCKED"
  | "STORAGE_FAILED"
  | "WRITE_CONFLICT"
  | "CORRUPT_PROJECT";

export class ProjectRepositoryError extends Error {
  public readonly code: ProjectRepositoryErrorCode;
  public override readonly cause: unknown;

  public constructor(code: ProjectRepositoryErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ProjectRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface ProjectRepository {
  load(projectId: string): Promise<StoredEditorProjectV1 | null>;
  save(
    projectId: string,
    state: EditorState,
    expectedGeneration: number,
  ): Promise<StoredEditorProjectV1>;
  delete(projectId: string, expectedGeneration: number): Promise<void>;
  close(): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () =>
        reject(
          new ProjectRepositoryError("STORAGE_FAILED", "IndexedDB request failed", request.error),
        ),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () =>
        reject(
          new ProjectRepositoryError(
            "STORAGE_FAILED",
            "IndexedDB transaction was aborted",
            transaction.error,
          ),
        ),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () =>
        reject(
          new ProjectRepositoryError(
            "STORAGE_FAILED",
            "IndexedDB transaction failed",
            transaction.error,
          ),
        ),
      { once: true },
    );
  });
}

export class IndexedDbProjectRepository implements ProjectRepository {
  readonly #databasePromise: Promise<IDBDatabase>;

  public constructor(
    factory: IDBFactory | undefined = globalThis.indexedDB,
    databaseName = "brick-studio",
  ) {
    if (!factory) {
      this.#databasePromise = Promise.reject(
        new ProjectRepositoryError("STORAGE_UNAVAILABLE", "IndexedDB is unavailable"),
      );
      return;
    }
    this.#databasePromise = new Promise((resolve, reject) => {
      let settled = false;
      const request = factory.open(databaseName, DATABASE_VERSION);
      request.addEventListener(
        "upgradeneeded",
        () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(PROJECT_STORE)) {
            database.createObjectStore(PROJECT_STORE, { keyPath: "projectId" });
          }
        },
        { once: true },
      );
      request.addEventListener(
        "success",
        () => {
          const database = request.result;
          if (settled) {
            database.close();
            return;
          }
          settled = true;
          database.addEventListener("versionchange", () => database.close());
          resolve(database);
        },
        { once: true },
      );
      request.addEventListener(
        "error",
        () => {
          if (settled) return;
          settled = true;
          reject(
            new ProjectRepositoryError(
              "STORAGE_FAILED",
              "Could not open the local project database",
              request.error,
            ),
          );
        },
        { once: true },
      );
      request.addEventListener(
        "blocked",
        () => {
          if (settled) return;
          settled = true;
          reject(
            new ProjectRepositoryError(
              "STORAGE_BLOCKED",
              "A different app version is blocking the local project database",
            ),
          );
        },
        { once: true },
      );
    });
  }

  public async load(projectId: string): Promise<StoredEditorProjectV1 | null> {
    const database = await this.#databasePromise;
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const completion = transactionComplete(transaction);
    try {
      const raw = await requestResult(transaction.objectStore(PROJECT_STORE).get(projectId));
      await completion;
      if (raw === undefined) return null;
      return parseStoredEditorProject(raw);
    } catch (error) {
      await completion.catch(() => undefined);
      if (error instanceof ProjectSnapshotError) {
        throw new ProjectRepositoryError(
          "CORRUPT_PROJECT",
          "The local project failed integrity checks and was left unchanged",
          error,
        );
      }
      throw error;
    }
  }

  public async save(
    projectId: string,
    state: EditorState,
    expectedGeneration: number,
  ): Promise<StoredEditorProjectV1> {
    const database = await this.#databasePromise;
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(PROJECT_STORE);
    try {
      const raw = await requestResult(store.get(projectId));
      let currentGeneration = 0;
      if (raw !== undefined) {
        try {
          currentGeneration = parseStoredEditorProject(raw).generation;
        } catch (error) {
          throw new ProjectRepositoryError(
            "CORRUPT_PROJECT",
            "Refusing to overwrite a corrupt local project",
            error,
          );
        }
      }
      if (currentGeneration !== expectedGeneration) {
        throw new ProjectRepositoryError(
          "WRITE_CONFLICT",
          `Expected local project generation ${expectedGeneration}, found ${currentGeneration}`,
        );
      }
      const stored = createStoredEditorProject(projectId, expectedGeneration + 1, state);
      await requestResult(store.put(stored));
      await completion;
      return stored;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have completed or aborted.
      }
      await completion.catch(() => undefined);
      throw error;
    }
  }

  public async delete(projectId: string, expectedGeneration: number): Promise<void> {
    const database = await this.#databasePromise;
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(PROJECT_STORE);
    try {
      const raw = await requestResult(store.get(projectId));
      let currentGeneration = 0;
      if (raw !== undefined) {
        try {
          currentGeneration = parseStoredEditorProject(raw).generation;
        } catch (error) {
          throw new ProjectRepositoryError(
            "CORRUPT_PROJECT",
            "Refusing to delete a corrupt local project without explicit recovery",
            error,
          );
        }
      }
      if (currentGeneration !== expectedGeneration) {
        throw new ProjectRepositoryError(
          "WRITE_CONFLICT",
          `Expected local project generation ${expectedGeneration}, found ${currentGeneration}`,
        );
      }
      await requestResult(store.delete(projectId));
      await completion;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have completed or aborted.
      }
      await completion.catch(() => undefined);
      throw error;
    }
  }

  public async close(): Promise<void> {
    (await this.#databasePromise).close();
  }
}

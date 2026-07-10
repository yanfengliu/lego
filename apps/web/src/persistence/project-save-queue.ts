import type { EditorState } from "../editor-state";
import type { ProjectRepository } from "./indexeddb-project-repository";
import { createStoredEditorProject, type StoredEditorProjectV1 } from "./project-snapshot";

interface SaveSlot {
  state: EditorState;
  readonly promise: Promise<StoredEditorProjectV1>;
  readonly resolve: (stored: StoredEditorProjectV1) => void;
  readonly reject: (error: unknown) => void;
}

interface IdleWaiter {
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

function createSaveSlot(state: EditorState): SaveSlot {
  let resolve!: (stored: StoredEditorProjectV1) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<StoredEditorProjectV1>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { state, promise, resolve, reject };
}

export class ProjectSaveQueue {
  readonly #repository: ProjectRepository;
  readonly #projectId: string;
  #generation: number;
  #active: SaveSlot | null = null;
  #pending: SaveSlot | null = null;
  readonly #idleWaiters: IdleWaiter[] = [];
  #failure: unknown = null;

  public constructor(repository: ProjectRepository, projectId: string, initialGeneration: number) {
    this.#repository = repository;
    this.#projectId = projectId;
    this.#generation = initialGeneration;
  }

  public get generation(): number {
    return this.#generation;
  }

  public enqueue(state: EditorState): Promise<StoredEditorProjectV1> {
    if (this.#failure !== null) return Promise.reject(this.#failure);

    let capturedState: EditorState;
    try {
      capturedState = createStoredEditorProject(this.#projectId, 0, state).state;
    } catch (error) {
      this.#failure = error;
      this.#pending?.reject(error);
      this.#pending = null;
      this.#settleIdle(error);
      return Promise.reject(error);
    }
    if (this.#active === null) {
      const slot = createSaveSlot(capturedState);
      this.#active = slot;
      void this.#run(slot);
      return slot.promise;
    }
    if (this.#pending === null) this.#pending = createSaveSlot(capturedState);
    else this.#pending.state = capturedState;
    return this.#pending.promise;
  }

  public flush(): Promise<void> {
    if (this.#failure !== null) return Promise.reject(this.#failure);
    if (this.#active === null) return Promise.resolve();
    return new Promise<void>((resolve, reject) => this.#idleWaiters.push({ resolve, reject }));
  }

  async #run(slot: SaveSlot): Promise<void> {
    try {
      const stored = await this.#repository.save(this.#projectId, slot.state, this.#generation);
      this.#generation = stored.generation;
      slot.resolve(stored);
      if (this.#failure !== null) {
        this.#active = null;
        this.#settleIdle(this.#failure);
        return;
      }
      const next = this.#pending;
      this.#pending = null;
      if (next) {
        this.#active = next;
        void this.#run(next);
        return;
      }
      this.#active = null;
      this.#settleIdle();
    } catch (error) {
      this.#failure = error;
      slot.reject(error);
      this.#pending?.reject(error);
      this.#pending = null;
      this.#active = null;
      this.#settleIdle(error);
    }
  }

  #settleIdle(error?: unknown): void {
    for (const waiter of this.#idleWaiters.splice(0)) {
      if (error === undefined) waiter.resolve();
      else waiter.reject(error);
    }
  }
}

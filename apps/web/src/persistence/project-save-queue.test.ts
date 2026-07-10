import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";

import { createEditorState, type EditorState } from "../editor-state";
import type { ProjectRepository } from "./indexeddb-project-repository";
import { ProjectSaveQueue } from "./project-save-queue";
import { createStoredEditorProject, type StoredEditorProjectV1 } from "./project-snapshot";

class RecordingRepository implements ProjectRepository {
  public readonly calls: Array<{
    readonly projectId: string;
    readonly state: EditorState;
    readonly expectedGeneration: number;
  }> = [];
  public firstSaveRelease: (() => void) | null = null;
  public failure: Error | null = null;

  public async load(): Promise<StoredEditorProjectV1 | null> {
    return null;
  }

  public async save(
    projectId: string,
    state: EditorState,
    expectedGeneration: number,
  ): Promise<StoredEditorProjectV1> {
    this.calls.push({ projectId, state, expectedGeneration });
    if (this.calls.length === 1 && this.firstSaveRelease === null) {
      await new Promise<void>((resolve) => {
        this.firstSaveRelease = resolve;
      });
    }
    if (this.failure) throw this.failure;
    return createStoredEditorProject(projectId, expectedGeneration + 1, state);
  }

  public async delete(): Promise<void> {}
  public async close(): Promise<void> {}
}

function state(name: string) {
  return createEditorState(createEmptyBrickDocument({ id: name.toLowerCase(), name }));
}

describe("project save queue", () => {
  it("serializes saves, coalesces pending states, and advances compare-and-swap generations", async () => {
    const repository = new RecordingRepository();
    const queue = new ProjectSaveQueue(repository, "project-1", 3);
    const first = queue.enqueue(state("First"));
    const second = queue.enqueue(state("Second"));
    const third = queue.enqueue(state("Third"));

    await Promise.resolve();
    expect(repository.calls).toHaveLength(1);
    expect(second).toBe(third);
    repository.firstSaveRelease?.();
    await expect(first).resolves.toMatchObject({ generation: 4 });
    await expect(second).resolves.toMatchObject({ generation: 5 });
    await expect(third).resolves.toMatchObject({ generation: 5 });
    expect(repository.calls.map(({ expectedGeneration }) => expectedGeneration)).toEqual([3, 4]);
    expect(repository.calls.map(({ state: saved }) => saved.document.name)).toEqual([
      "First",
      "Third",
    ]);
    expect(queue.generation).toBe(5);
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it("detaches queued state before asynchronous storage", async () => {
    const repository = new RecordingRepository();
    const queue = new ProjectSaveQueue(repository, "project-1", 0);
    const mutable = structuredClone(state("Original"));
    const save = queue.enqueue(mutable);

    // @ts-expect-error Deliberately violate the readonly caller contract after enqueue.
    mutable.document.name = "Changed later";
    await Promise.resolve();
    repository.firstSaveRelease?.();
    await save;

    expect(repository.calls[0]?.state.document.name).toBe("Original");
  });

  it("stops later writes after a failed save", async () => {
    const repository = new RecordingRepository();
    repository.failure = new Error("disk full");
    const queue = new ProjectSaveQueue(repository, "project-1", 0);
    const first = queue.enqueue(state("First"));
    const second = queue.enqueue(state("Second"));

    await Promise.resolve();
    repository.firstSaveRelease?.();
    await expect(first).rejects.toThrow("disk full");
    await expect(second).rejects.toThrow("disk full");
    expect(repository.calls).toHaveLength(1);
    await expect(queue.flush()).rejects.toThrow("disk full");
  });

  it("reports capture failures asynchronously and poisons the queue", async () => {
    const repository = new RecordingRepository();
    const queue = new ProjectSaveQueue(repository, "project-1", 0);
    const malformed = {
      ...state("Broken"),
      undoStack: [{ label: "Broken", operations: [] }],
    } as unknown as EditorState;

    let save!: Promise<StoredEditorProjectV1>;
    expect(() => {
      save = queue.enqueue(malformed);
    }).not.toThrow();
    await expect(save).rejects.toMatchObject({ code: "PROJECT_SCHEMA_INVALID" });
    await expect(queue.enqueue(state("Later"))).rejects.toMatchObject({
      code: "PROJECT_SCHEMA_INVALID",
    });
    expect(repository.calls).toHaveLength(0);
    await expect(queue.flush()).rejects.toMatchObject({ code: "PROJECT_SCHEMA_INVALID" });
  });

  it("drops a pending save when a later capture failure poisons an active queue", async () => {
    const repository = new RecordingRepository();
    const queue = new ProjectSaveQueue(repository, "project-1", 0);
    const first = queue.enqueue(state("First"));
    const pending = queue.enqueue(state("Pending"));
    const malformed = {
      ...state("Broken"),
      undoStack: [{ label: "Broken", operations: [] }],
    } as unknown as EditorState;

    await expect(queue.enqueue(malformed)).rejects.toMatchObject({
      code: "PROJECT_SCHEMA_INVALID",
    });
    await expect(pending).rejects.toMatchObject({ code: "PROJECT_SCHEMA_INVALID" });
    repository.firstSaveRelease?.();
    await expect(first).resolves.toMatchObject({ generation: 1 });
    expect(repository.calls.map(({ state: saved }) => saved.document.name)).toEqual(["First"]);
    await expect(queue.flush()).rejects.toMatchObject({ code: "PROJECT_SCHEMA_INVALID" });
  });
});

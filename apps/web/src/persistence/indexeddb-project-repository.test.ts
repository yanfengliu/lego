import { describe, expect, it } from "vitest";

import { IndexedDbProjectRepository, ProjectRepositoryError } from "./indexeddb-project-repository";

describe("IndexedDB project repository", () => {
  it("fails explicitly when IndexedDB is unavailable", async () => {
    const repository = new IndexedDbProjectRepository(undefined, "unavailable-test");

    await expect(repository.load("project-1")).rejects.toMatchObject({
      name: "ProjectRepositoryError",
      code: "STORAGE_UNAVAILABLE",
    } satisfies Partial<ProjectRepositoryError>);
  });
});

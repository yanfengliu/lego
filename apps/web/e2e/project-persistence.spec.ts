import { expect, test } from "@playwright/test";

test("persists exact editor state and undo history across reloads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("0 parts · saved locally")).toBeVisible();

  await page.getByRole("button", { name: "Place at origin" }).click();
  await expect(page.getByText("1 parts · saved locally")).toBeVisible();

  await page.reload();
  await expect(page.getByText("1 parts · saved locally")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("0 parts · saved locally")).toBeVisible();

  await page.reload();
  await expect(page.getByText("0 parts · saved locally")).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("1 parts · saved locally")).toBeVisible();
});

test("keeps the manual editor available when browser persistence is unavailable", async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Brick Studio" })).toBeVisible();
  await expect(page.getByText("0 parts · session only")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("IndexedDB is unavailable");

  await page.getByRole("button", { name: "Place at origin" }).click();
  await expect(page.getByText("1 parts · session only")).toBeVisible();
});

test("enforces IndexedDB compare-and-swap and preserves corrupt rows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("0 parts · saved locally")).toBeVisible();

  const result = await page.evaluate(async () => {
    const repositoryModulePath = "/src/persistence/indexeddb-project-repository.ts";
    const { IndexedDbProjectRepository } = await import(/* @vite-ignore */ repositoryModulePath);
    const seedRepository = new IndexedDbProjectRepository(indexedDB, "brick-studio");
    const seed = await seedRepository.load("primary-project");
    await seedRepository.close();
    if (!seed) throw new Error("The app did not create its initial durable state");

    const databaseName = `repository-contract-${crypto.randomUUID()}`;
    const firstRepository = new IndexedDbProjectRepository(indexedDB, databaseName);
    const secondRepository = new IndexedDbProjectRepository(indexedDB, databaseName);
    const first = await firstRepository.save("project-1", seed.state, 0);
    const race = await Promise.allSettled([
      firstRepository.save("project-1", seed.state, 1),
      secondRepository.save("project-1", seed.state, 1),
    ]);
    const raceCodes = race.map((entry) =>
      entry.status === "fulfilled"
        ? `saved:${entry.value.generation}`
        : `failed:${(entry.reason as { code?: string }).code ?? "unknown"}`,
    );
    const latest = await firstRepository.load("project-1");
    if (!latest) throw new Error("The raced project disappeared");

    const rawDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const corrupt = structuredClone(latest);
    corrupt.state.document.name = "tampered without updating hashes";
    await new Promise<void>((resolve, reject) => {
      const transaction = rawDatabase.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(corrupt);
      transaction.addEventListener("complete", () => resolve(), { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
    });
    rawDatabase.close();

    const errorCode = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
        return "none";
      } catch (error) {
        return (error as { code?: string }).code ?? "unknown";
      }
    };
    const corruptLoad = await errorCode(() => firstRepository.load("project-1"));
    const corruptSave = await errorCode(() =>
      firstRepository.save("project-1", seed.state, latest.generation),
    );
    const corruptDelete = await errorCode(() =>
      firstRepository.delete("project-1", latest.generation),
    );

    await firstRepository.close();
    await secondRepository.close();
    return {
      firstGeneration: first.generation,
      latestGeneration: latest.generation,
      raceCodes: raceCodes.sort(),
      corruptLoad,
      corruptSave,
      corruptDelete,
    };
  });

  expect(result).toEqual({
    firstGeneration: 1,
    latestGeneration: 2,
    raceCodes: ["failed:WRITE_CONFLICT", "saved:2"],
    corruptLoad: "CORRUPT_PROJECT",
    corruptSave: "CORRUPT_PROJECT",
    corruptDelete: "CORRUPT_PROJECT",
  });
});

test("closes its database connection when a schema version changes", async ({ page }) => {
  await page.goto("/");
  const upgraded = await page.evaluate(async () => {
    const repositoryModulePath = "/src/persistence/indexeddb-project-repository.ts";
    const { IndexedDbProjectRepository } = await import(/* @vite-ignore */ repositoryModulePath);
    const databaseName = `versionchange-${crypto.randomUUID()}`;
    const repository = new IndexedDbProjectRepository(indexedDB, databaseName);
    await repository.load("missing");
    const versionTwo = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 2);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Upgrade was blocked")), {
        once: true,
      });
    });
    const version = versionTwo.version;
    versionTwo.close();
    await repository.close();
    return version;
  });

  expect(upgraded).toBe(2);
});

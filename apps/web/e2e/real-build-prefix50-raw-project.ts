import type { Page } from "@playwright/test";
import { canonicalDigest } from "@lego-studio/brick-kernel";

export interface RawStoredProjectCommitment {
  readonly schemaVersion: "lego.local-project/2";
  readonly canonicalRowCommitment: `sha256:${string}`;
}

async function readRawPrimaryProject(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("brick-studio", 1);
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction("projects", "readonly");
        const request = transaction.objectStore("projects").get("primary-project");
        request.addEventListener("success", () => resolve(request.result ?? null), {
          once: true,
        });
        request.addEventListener("error", () => reject(request.error), { once: true });
      });
    } finally {
      database.close();
    }
  });
}

export async function rawPrimaryProjectCommitment(page: Page): Promise<RawStoredProjectCommitment> {
  const raw = await readRawPrimaryProject(page);
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { schemaVersion?: unknown }).schemaVersion !== "lego.local-project/2"
  ) {
    throw new Error("Raw primary-project row is absent or is not schema lego.local-project/2.");
  }
  return {
    schemaVersion: "lego.local-project/2",
    canonicalRowCommitment: canonicalDigest(raw),
  };
}

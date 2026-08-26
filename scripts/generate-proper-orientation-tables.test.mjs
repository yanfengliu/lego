import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("proper-orientation generated tables", () => {
  it("matches the checked-in TypeScript and Python outputs byte-for-byte", () => {
    const repositoryRoot = resolve(import.meta.dirname, "..");
    expect(() =>
      execFileSync(
        process.execPath,
        [resolve(import.meta.dirname, "generate-proper-orientation-tables.mjs"), "--check"],
        { cwd: repositoryRoot, stdio: "pipe" },
      ),
    ).not.toThrow();
  });
});

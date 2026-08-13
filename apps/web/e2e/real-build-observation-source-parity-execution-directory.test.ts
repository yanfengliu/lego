import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createRealBuildSourceParityExecutionDirectory,
  removeRealBuildSourceParityExecutionDirectory,
} from "./real-build-observation-source-parity-execution-directory";

const roots: string[] = [];

const temporaryRoot = (label: string): string => {
  const root = mkdtempSync(join(tmpdir(), label));
  roots.push(root);
  return root;
};

const windowsIt = process.platform === "win32" ? it : it.skip;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("source-parity execution directories", () => {
  windowsIt("creates unique direct repo tmp children and removes only the selected sibling", () => {
    const repoRoot = temporaryRoot("lego-source-parity-execution-root-");
    const first = createRealBuildSourceParityExecutionDirectory(repoRoot);
    const second = createRealBuildSourceParityExecutionDirectory(repoRoot);
    const expectedParent = resolve(repoRoot, "tmp");

    expect(first).not.toBe(second);
    for (const directory of [first, second]) {
      expect(dirname(directory)).toBe(expectedParent);
      expect(relative(repoRoot, directory).replaceAll("\\", "/")).toMatch(
        /^tmp\/lego-source-parity-execution-[^/]+$/u,
      );
    }

    writeFileSync(join(first, "first.txt"), "first");
    writeFileSync(join(second, "second.txt"), "second");
    removeRealBuildSourceParityExecutionDirectory(repoRoot, first);

    expect(existsSync(first)).toBe(false);
    expect(readFileSync(join(second, "second.txt"), "utf8")).toBe("second");
  });

  it("refuses outside, non-prefixed, and unowned prefixed directories before removal", () => {
    const repoRoot = temporaryRoot("lego-source-parity-refusal-root-");
    const outside = temporaryRoot("lego-source-parity-refusal-outside-");
    const nonPrefixed = join(repoRoot, "tmp", "not-source-parity-owned");
    const prefixedNotOwned = join(
      repoRoot,
      "tmp",
      `lego-source-parity-execution-${process.pid}-00000000-0000-4000-8000-000000000000`,
    );
    mkdirSync(nonPrefixed, { recursive: true });
    mkdirSync(prefixedNotOwned, { recursive: true });
    writeFileSync(join(outside, "outside.txt"), "outside");
    writeFileSync(join(nonPrefixed, "inside.txt"), "inside");
    writeFileSync(join(prefixedNotOwned, "prefixed.txt"), "prefixed");

    expect(() => removeRealBuildSourceParityExecutionDirectory(repoRoot, outside)).toThrow(
      /expected one process-owned direct tmp\/lego-source-parity-execution-/u,
    );
    expect(() => removeRealBuildSourceParityExecutionDirectory(repoRoot, nonPrefixed)).toThrow(
      /expected one process-owned direct tmp\/lego-source-parity-execution-/u,
    );
    expect(() => removeRealBuildSourceParityExecutionDirectory(repoRoot, prefixedNotOwned)).toThrow(
      /expected one process-owned direct tmp\/lego-source-parity-execution-/u,
    );
    expect(readFileSync(join(outside, "outside.txt"), "utf8")).toBe("outside");
    expect(readFileSync(join(nonPrefixed, "inside.txt"), "utf8")).toBe("inside");
    expect(readFileSync(join(prefixedNotOwned, "prefixed.txt"), "utf8")).toBe("prefixed");
  });

  windowsIt("refuses junction traversal and preserves the linked target", () => {
    const repoRoot = temporaryRoot("lego-source-parity-link-root-");
    const linkedTarget = temporaryRoot("lego-source-parity-link-target-");
    const directory = createRealBuildSourceParityExecutionDirectory(repoRoot);
    const link = join(directory, "outside-link");
    writeFileSync(join(linkedTarget, "retained.txt"), "retained");
    symlinkSync(resolve(linkedTarget), link, "junction");

    expect(() => removeRealBuildSourceParityExecutionDirectory(repoRoot, directory)).toThrow(
      /removal refused symlink or junction/u,
    );
    expect(existsSync(directory)).toBe(true);
    expect(existsSync(link)).toBe(true);
    expect(readFileSync(join(linkedTarget, "retained.txt"), "utf8")).toBe("retained");
  });
});

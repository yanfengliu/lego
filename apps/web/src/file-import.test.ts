import { describe, expect, it, vi } from "vitest";

import { StaleFileImportError, readBoundedFileText } from "./file-import";

describe("bounded file reads", () => {
  it("rejects oversized files before allocating their text", async () => {
    const text = vi.fn(async () => "never");
    await expect(readBoundedFileText({ size: 101, text }, 100, () => true)).rejects.toThrow(
      RangeError,
    );
    expect(text).not.toHaveBeenCalled();
  });

  it("rejects a delayed read after a newer document action wins", async () => {
    let resolveText!: (value: string) => void;
    const text = () => new Promise<string>((resolve) => (resolveText = resolve));
    let current = true;
    const pending = readBoundedFileText({ size: 10, text }, 100, () => current);
    current = false;
    resolveText("stale");
    await expect(pending).rejects.toBeInstanceOf(StaleFileImportError);
  });
});

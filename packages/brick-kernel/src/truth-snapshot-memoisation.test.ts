/**
 * Recomputing pinned truth per call turns catalog growth into a timeout that
 * reads as a hang.
 *
 * `validateBrickDocument` rebuilt the builtin truth snapshot on every call, and
 * building it digests the whole catalog. Growing the catalog from 14 parts to 32
 * pushed two tests past vitest's 5-second limit — and a timeout is not an
 * assertion failure: `editor-state.test.ts` and `maker-worker-response.test.ts`
 * reported a hang, not a regression, and nothing in either message named the
 * catalog. The snapshot is a pure function of compile-time constants, so it is
 * computed once and frozen.
 *
 * What is asserted here is identity rather than elapsed time, because a timing
 * assertion is the same false signal the defect produced: it fails for the
 * machine as readily as for the code. If the same call returns the same frozen
 * object, it was not rebuilt.
 */

import { describe, expect, it } from "vitest";

import { BUILTIN_CATALOG } from "@lego-studio/catalog";

import { createBuiltinTruthSnapshot, createEmptyBrickDocument } from "./factory";
import { validateBrickDocument } from "./validation";

describe("the builtin truth snapshot is built once, not per call", () => {
  it("returns one frozen object however often it is asked", () => {
    const first = createBuiltinTruthSnapshot();
    const second = createBuiltinTruthSnapshot();

    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.catalog)).toBe(true);
    // The reason it matters, stated where it is enforced: this many part
    // definitions are digested to build it, and the timeout arrived at 32.
    expect(BUILTIN_CATALOG.parts.length).toBeGreaterThan(32);
  });

  it("does not rebuild it once per validation", () => {
    const before = createBuiltinTruthSnapshot();
    const document = createEmptyBrickDocument({ id: "memoisation", name: "Memoisation" });
    for (let call = 0; call < 50; call += 1) {
      expect(validateBrickDocument(document).truthSnapshotHash).toBe(
        validateBrickDocument(document).truthSnapshotHash,
      );
    }
    expect(createBuiltinTruthSnapshot()).toBe(before);
  });
});

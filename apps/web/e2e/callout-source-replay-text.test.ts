import { describe, expect, it } from "vitest";

import {
  MAX_SOURCE_REPLAY_TEXT_CHARS,
  MAX_SOURCE_REPLAY_TEXT_ITEMS,
  assertBoundedReplayTextItems,
  buildBoundedReplayTextMask,
} from "./callout-source-replay-text";

describe("independent source replay text bounds", () => {
  it("refuses an oversized item list before transformation", () => {
    expect(() =>
      assertBoundedReplayTextItems(Array.from({ length: MAX_SOURCE_REPLAY_TEXT_ITEMS + 1 })),
    ).toThrow(/at most 20000 before text transformation or search/u);
  });

  it("refuses oversized aggregate text before searching labels", () => {
    expect(() =>
      assertBoundedReplayTextItems([{ str: "x".repeat(MAX_SOURCE_REPLAY_TEXT_CHARS + 1) }]),
    ).toThrow(/more than 20000 aggregate string characters/u);
  });

  it("charges every intersected rectangle before writing the text mask", () => {
    expect(() =>
      buildBoundedReplayTextMask({
        sourceBoxPx: { left: 0, top: 0, right: 9, bottom: 9 },
        width: 10,
        height: 10,
        textBounds: [
          { left: 0, top: 0, right: 9, bottom: 9 },
          { left: 0, top: 0, right: 9, bottom: 9 },
        ],
        maximumWrites: 100,
      }),
    ).toThrow(/exceed 100 aggregate pixel writes before mask mutation/u);
  });

  it("builds the bounded source-box-relative mask", () => {
    const mask = buildBoundedReplayTextMask({
      sourceBoxPx: { left: 10, top: 20, right: 12, bottom: 21 },
      width: 3,
      height: 2,
      textBounds: [{ left: 11, top: 20, right: 20, bottom: 20 }],
    });
    expect([...mask]).toEqual([0, 1, 1, 0, 0, 0]);
  });
});

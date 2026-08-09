import { describe, expect, it } from "vitest";

import { parsePanelReading } from "./panel-placement-ask.mjs";
import {
  PANEL_PLACEMENT_MAX_NOTE_LENGTH,
  PANEL_PLACEMENT_PROMPT,
  PANEL_PLACEMENT_PROMPT_DIGEST,
} from "./panel-placement-prompt.mjs";

/**
 * The reply schema is a filter and never a repair.
 *
 * Every case below is a line a model actually could send. What matters is that
 * a line the schema will not take is discarded with its reason rather than
 * quietly coerced into something the converter would then act on — the same rule
 * the part-identification answer schema follows, for the same reason: a reply
 * the validator threw out and a reply that never arrived are different events
 * and only one of them is fixed by asking again.
 */

const IDS = ["P1", "P2"];
const line = (over = {}) =>
  JSON.stringify({
    id: "P1",
    visible: true,
    longAxis: "up-and-right",
    anchorId: "P2",
    relation: "on-top-of",
    side: "down-and-right",
    overlapStuds: 3,
    confidence: 0.8,
    ...over,
  });

describe("the panel-placement prompt", () => {
  it("is digested, so an answer set can name the prompt it answered", () => {
    expect(PANEL_PLACEMENT_PROMPT_DIGEST).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("names the escape and says when to take it", () => {
    expect(PANEL_PLACEMENT_PROMPT).toContain("cannot-tell");
    expect(PANEL_PLACEMENT_PROMPT).toContain("cannotTell is different from note and is required");
    expect(PANEL_PLACEMENT_PROMPT).toContain("false is a correct answer");
  });

  it("refuses to ask for a measurement, which is the field that would collect fiction", () => {
    expect(PANEL_PLACEMENT_PROMPT).toContain("Do not give coordinates");
    expect(PANEL_PLACEMENT_PROMPT).not.toContain("positionLdu");
  });
});

describe("parsing a panel reading", () => {
  it("takes a well-formed panel line and piece lines", () => {
    const parsed = parsePanelReading(
      `{"id":"panel","viewpoint":"from-underneath","newPieceOutlines":2}\n${line()}\n${line({ id: "P2", anchorId: null })}`,
      IDS,
    );
    expect(parsed.panel?.viewpoint).toBe("from-underneath");
    expect(parsed.pieces).toHaveLength(2);
    expect(parsed.rejected).toEqual([]);
  });

  it("keeps the surviving lines when one is malformed, and says which and why", () => {
    const parsed = parsePanelReading(
      `{"id":"panel","viewpoint":"from-above","newPieceOutlines":1}\n${line()}\n${line({ id: "P2", relation: "glued-to" })}`,
      IDS,
    );
    expect(parsed.pieces.map((piece) => piece.id)).toEqual(["P1"]);
    expect(parsed.rejected.join(" ")).toContain("relation is not in the vocabulary");
  });

  it("requires cannotTell whenever the reader declined, so a refusal carries its reason", () => {
    const withoutReason = parsePanelReading(line({ visible: false }), IDS);
    expect(withoutReason.pieces).toHaveLength(0);
    expect(withoutReason.rejected.join(" ")).toContain("cannotTell is required");
    const withReason = parsePanelReading(
      line({ visible: false, cannotTell: "hidden behind the hull" }),
      IDS,
    );
    expect(withReason.pieces).toHaveLength(1);
    expect(withReason.pieces[0].cannotTell).toBe("hidden behind the hull");
  });

  it("accepts a built-piece anchor only in the one form the converter can resolve", () => {
    expect(parsePanelReading(line({ anchorId: "built:Green 4x2" }), IDS).pieces).toHaveLength(1);
    expect(parsePanelReading(line({ anchorId: "the big black one" }), IDS).pieces).toHaveLength(0);
    expect(parsePanelReading(line({ anchorId: "built:Green" }), IDS).pieces).toHaveLength(0);
  });

  it("refuses a piece that anchors on itself", () => {
    expect(parsePanelReading(line({ anchorId: "P1" }), IDS).rejected.join(" ")).toContain(
      "cannot be its own anchor",
    );
  });

  it("refuses an id it was not told about, so a reply cannot invent a piece", () => {
    expect(parsePanelReading(line({ id: "P9" }), IDS).pieces).toHaveLength(0);
  });

  it("drops both copies when a piece is answered twice, rather than taking the first", () => {
    const parsed = parsePanelReading(`${line()}\n${line({ side: "up-and-left" })}`, IDS);
    expect(parsed.pieces).toHaveLength(0);
    expect(parsed.rejected.join(" ")).toContain("second line for P1");
  });

  it("bounds the free text a reply may carry", () => {
    const long = "x".repeat(PANEL_PLACEMENT_MAX_NOTE_LENGTH + 1);
    expect(parsePanelReading(line({ note: long }), IDS).pieces).toHaveLength(0);
  });

  it("ignores prose around the JSON rather than failing the whole reply", () => {
    const parsed = parsePanelReading(`Here is my answer:\n${line()}\nHope that helps.`, IDS);
    expect(parsed.pieces).toHaveLength(1);
  });
});

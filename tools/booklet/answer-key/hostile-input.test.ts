import { describe, expect, it } from "vitest";

import { BUILD_UNIT_LIMITS } from "./build-units.ts";
import { AnswerKeyFormatError, flattenBuildSequence, parseLxfml } from "./index.ts";
import { LXFML_LIMITS } from "./lxfml.ts";
import { parseXmlTree } from "./xml-tree.ts";

/**
 * The answer-key readers against hostile input: every case ends in an
 * AnswerKeyFormatError that names the file and the fault, never in a
 * RangeError from the call stack or the regexp engine. Bound: sizes stay
 * under a few megabytes so the suite is quick; the reader is linear, so the
 * shapes, not the sizes, are what these pin.
 */
const read = (source: string) => () => parseXmlTree(source, "hostile.xml", LXFML_LIMITS);

describe("answer-key hostile input", () => {
  it("refuses an element with more attributes than the limit instead of overflowing the stack", () => {
    const many = Array.from({ length: 1_500_000 }, (_, index) => ` a${index}="c"`).join("");
    expect(read(`<a${many}/>`)).toThrow(/hostile\.xml <a> #1 has more than 64 attributes/u);
    expect(read(`<a${' b="c"'.repeat(200_000)}/>`)).toThrow(/repeats attribute b/u);
  });

  it("refuses unterminated and malformed tags, naming where", () => {
    expect(read(`<a b="${"x".repeat(2_000_000)}`)).toThrow(/has a malformed attribute/u);
    expect(read(`<a${" ".repeat(2_000_000)}`)).toThrow(/the file is truncated/u);
    expect(read("<a ".repeat(500_000))).toThrow(/has a malformed attribute/u);
    expect(read('<a></a b="c">')).toThrow(/a closing tag carries no attributes/u);
    expect(read('<a b="c"d="e"/>')).toThrow(/attributes need whitespace between them/u);
    expect(read("<a><1/></a>")).toThrow(/opens no tag/u);
  });

  it("bounds depth for self-closing elements too", () => {
    const deep = (depth: number) => `${"<a>".repeat(depth)}<b/>${"</a>".repeat(depth)}`;
    expect(read(deep(LXFML_LIMITS.maxDepth - 1))).not.toThrow();
    expect(read(deep(LXFML_LIMITS.maxDepth))).toThrow(/nests deeper than 96 elements at <b>/u);
    expect(read("<a>".repeat(100_000))).toThrow(AnswerKeyFormatError);
  });

  it("keeps an attribute named __proto__ as data", () => {
    const root = parseXmlTree('<a __proto__="x" c="d"/>', "proto.xml", LXFML_LIMITS);
    expect(Object.keys(root.attributes)).toEqual(["__proto__", "c"]);
    expect(root.attributes["__proto__"]).toBe("x");
  });

  it("refuses a MultiBuild copy chain past the limit with a clear error, iteratively", () => {
    const chain = (length: number) => {
      const brick = (index: number) =>
        `<Brick uuid="b${index}" designID="3024"><Part designID="3024" materials="1"><Bone refID="0" transformation="1,0,0,0,1,0,0,0,1,0,0,0"/></Part></Brick>`;
      const copies = Array.from(
        { length: length - 1 },
        (_, index) =>
          `<MultiBuildBrick originalBrickRef="b${index}" actualBrickRef="b${index + 1}"/>`,
      ).join("");
      return parseLxfml(
        `<LXFML><Bricks>${Array.from({ length }, (_, index) => brick(index)).join("")}</Bricks><BuildingInstructions><BuildingInstruction><Steps><Step><SubBuild uuid="s"><Step><In brickRef="b0"/></Step></SubBuild><MultiBuild masterSubBuildRef="s">${copies}</MultiBuild></Step></Steps></BuildingInstruction></BuildingInstructions></LXFML>`,
        "chain.lxfml",
      );
    };
    const within = flattenBuildSequence(chain(BUILD_UNIT_LIMITS.maxCopyDepth + 1));
    expect(within.problems).toEqual([]);
    expect(within.units[0]!.copyCount).toBe(BUILD_UNIT_LIMITS.maxCopyDepth);
    expect(() => flattenBuildSequence(chain(5_000))).toThrow(
      /MultiBuild copies chain more than 64 deep at brick b65/u,
    );
  });
});

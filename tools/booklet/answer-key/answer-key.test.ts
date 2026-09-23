import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AnswerKeyFormatError,
  assemblyKeyAt,
  flattenBuildSequence,
  loadAnswerKey,
  parseLxfml,
} from "./index.ts";

/** A synthetic four-brick model: A, a sub-build holding B (built twice via a MultiBuild copy C), then D. */
const bone = (x: number) => `<Bone refID="0" transformation="1,0,0,0,1,0,0,0,1,${x},0,0"/>`;
const brick = (uuid: string, design: string, item: string, x: number) =>
  `<Brick uuid="${uuid}" designID="${design}" itemNos="${item}"><Part designID="${design}" materials="26">${bone(x)}</Part></Brick>`;
const LXFML = `<?xml version="1.0" encoding="UTF-8"?>
<LXFML versionMajor="8">
  <Bricks>${brick("a", "3023;S", "302326", 0)}${brick("b", "3024;N", "302426", 1)}${brick("c", "3024;N", "302426", 2)}${brick("d", "3001;A", "300126", 3)}</Bricks>
  <BuildingInstructions>
    <BuildingInstruction name="main"><Steps>
      <Step name="1"><In brickRef="a"/></Step>
      <Step name="2">
        <SubBuild uuid="sb"><Step name="2.1"><In brickRef="b"/></Step></SubBuild>
        <MultiBuild name="twice" masterSubBuildRef="sb"><MultiBuildBrick originalBrickRef="b" actualBrickRef="c"/></MultiBuild>
      </Step>
      <Step name="3"><In brickRef="d"/></Step>
    </Steps></BuildingInstruction>
  </BuildingInstructions>
  <Bags><NumberedBag name="1BASE"><Brick brickRef="a"/><Brick brickRef="b"/></NumberedBag><LooseBag name="loose"><Brick brickRef="d"/></LooseBag></Bags>
</LXFML>`;

describe("LXFML answer key", () => {
  it("flattens sub-builds before the step that attaches them and joins repeat copies to their master", () => {
    const model = parseLxfml(LXFML, "fixture");
    expect(model.bricks.map(({ designId, itemNos }) => `${designId}:${itemNos.join()}`)).toEqual([
      "3023:302326",
      "3024:302426",
      "3024:302426",
      "3001:300126",
    ]);
    expect(model.bags.get("a")).toEqual({ name: "1BASE", bag: 1 });
    expect(model.bags.get("d")).toEqual({ name: "loose", bag: null });
    const sequence = flattenBuildSequence(model);
    expect(sequence.problems).toEqual([]);
    expect(
      sequence.units.map(({ stepName, brickRefs }) => `${stepName}:${brickRefs.join("")}`),
    ).toEqual(["1:a", "2.1:bc", "2:", "3:d"]);
    const b = sequence.placements.get("b")!;
    const c = sequence.placements.get("c")!;
    expect(c.copyOf).toBe("b");
    // The copy is its own physical sub-assembly until unit 2 attaches both.
    expect(assemblyKeyAt(b, 1)).toBe("sb");
    expect(assemblyKeyAt(c, 1)).not.toBe(assemblyKeyAt(b, 1));
    expect(assemblyKeyAt(b, 2)).toBe("model");
    expect(assemblyKeyAt(c, 2)).toBe("model");
    expect(sequence.unplaced).toEqual([]);
  });

  it("names the file and the fault when the model cannot be an answer key", () => {
    expect(() => parseLxfml(LXFML.replace('uuid="b"', 'uuid="a"'), "dup.lxfml")).toThrow(
      /dup\.lxfml repeats brick uuid a/u,
    );
    expect(() =>
      parseLxfml(
        LXFML.replace('brickRef="d"/></LooseBag>', 'brickRef="zz"/></LooseBag>'),
        "bag.lxfml",
      ),
    ).toThrow(/bag\.lxfml bag "loose" lists brick zz, which is not in the Bricks inventory/u);
    expect(() =>
      parseLxfml(LXFML.replace("1,0,0,0,1,0,0,0,1,0,0,0", "1,0,0"), "pose.lxfml"),
    ).toThrow(AnswerKeyFormatError);
  });

  describe("loading", () => {
    let dir: string | null = null;
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
      dir = null;
    });

    it("reports an absent LXFML as input absent instead of failing", () => {
      const load = loadAnswerKey({
        lxfmlPath: join(tmpdir(), "no-such-answer-key.xml"),
        ldrawPath: null,
      });
      expect(load.status).toBe("absent");
      expect(load.status === "absent" && load.reason).toMatch(
        /input absent: no official LXFML at .*BOOKLET_LXFML/u,
      );
    });

    it("loads a present LXFML and leaves a missing LDraw export absent", () => {
      dir = mkdtempSync(join(tmpdir(), "answer-key-"));
      writeFileSync(join(dir, "model.xml"), LXFML);
      const load = loadAnswerKey({
        lxfmlPath: join(dir, "model.xml"),
        ldrawPath: join(dir, "missing.ldr"),
      });
      expect(load.status).toBe("loaded");
      if (load.status !== "loaded") return;
      expect(load.key.model.bricks).toHaveLength(4);
      expect(load.key.ldraw.status).toBe("absent");
      expect(load.key.source.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    });
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  currentPlayerStamp,
  generatorCodeDigest,
  STAMP_FILE,
  stalenessOf,
  type PlayerInputPaths,
} from "./freshness.ts";
import { PLAYER_SETS } from "./sets.ts";

const SET = PLAYER_SETS[0]!;

describe("player data freshness", () => {
  let root = "";
  let inputs: PlayerInputPaths;
  const out = () => join(root, "out");
  const write = (path: string, text: string) => {
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "player-freshness-"));
    inputs = {
      booklet: join(root, "booklet.pdf"),
      lxfml: join(root, "model.xml"),
      ldraw: join(root, "model.ldr"),
      library: join(root, "library.zip"),
      meshFallback: join(root, "pack.json"),
    };
    for (const path of Object.values(inputs)) write(path, "v1");
    write(join(root, "tools/booklet/stage.ts"), "export const a = 1;");
    write(join(root, "tools/booklet/stage.test.ts"), "test");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const generate = () => {
    write(join(out(), "steps.json"), "{}");
    write(join(out(), "model.mpd"), "0 FILE m.ldr");
    write(join(out(), STAMP_FILE), JSON.stringify(currentPlayerStamp(SET, inputs, root)));
  };

  it("is current right after a run, and names what went missing or changed since", () => {
    expect(stalenessOf(out(), currentPlayerStamp(SET, inputs, root))).toBe("steps.json is missing");
    generate();
    expect(stalenessOf(out(), currentPlayerStamp(SET, inputs, root))).toBeNull();

    write(inputs.booklet, "v2");
    expect(stalenessOf(out(), currentPlayerStamp(SET, inputs, root))).toBe(
      "the booklet PDF changed",
    );
    generate();
    rmSync(inputs.meshFallback);
    expect(stalenessOf(out(), currentPlayerStamp(SET, inputs, root))).toBe(
      `the Builder mesh pack is missing at ${inputs.meshFallback}`,
    );
    generate();
    expect(stalenessOf(out(), currentPlayerStamp({ ...SET, name: "Renamed" }, inputs, root))).toBe(
      "the set's manifest entry changed",
    );
    rmSync(join(out(), STAMP_FILE));
    expect(stalenessOf(out(), currentPlayerStamp(SET, inputs, root))).toBe(
      "stamp.json is missing or unreadable",
    );
  });

  it("counts a change to the generating code, not to its tests or line endings", () => {
    write(join(root, "tools/booklet/stage.ts"), "export const a = 1;\n");
    const before = generatorCodeDigest(root);
    write(join(root, "tools/booklet/stage.test.ts"), "a changed test");
    expect(generatorCodeDigest(root)).toBe(before);
    write(join(root, "tools/booklet/stage.ts"), "export const a = 1;\r\n");
    expect(generatorCodeDigest(root)).toBe(before);
    write(join(root, "tools/booklet/stage.ts"), "export const a = 2;\n");
    expect(generatorCodeDigest(root)).not.toBe(before);
  });
});

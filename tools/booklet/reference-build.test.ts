import { describe, expect, it } from "vitest";

import { deriveBuildSequence, importBrickDocumentFromLDraw } from "@lego-studio/brick-kernel";

import { playBack, type PlaybackBrick, type PlaybackStepInput } from "./playback.ts";
import {
  buildReferenceFile,
  centringShift,
  REFERENCE_STAND_IN_COLOR_ID,
  referenceStepName,
} from "./reference-build.ts";

/** Synthetic official poses of a real catalog part (LDraw 3024, a 1x1 plate); no official data. */
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function plate(
  uuid: string,
  position: readonly number[],
  options: Partial<PlaybackBrick> = {},
): PlaybackBrick {
  return {
    uuid,
    design: "3024.dat",
    catalogPartId: "builtin:plate-1x1",
    ldrawColor: 4,
    colorId: "builtin:red",
    pose: { matrix: IDENTITY, positionLdu: position },
    assemblyAt: () => "model",
    ...options,
  };
}
const steps = (...bricksPerStep: PlaybackBrick[][]): PlaybackStepInput[] =>
  bricksPerStep.map((bricks, index) => ({
    step: index + 1,
    page: 11 + index,
    lastUnit: index,
    bricks,
  }));

describe("reference build file", () => {
  it("writes the valid prefix as one editor step per printed step, and the editor reads it back step for step", () => {
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [],
        [plate("b", [0, -8, 0], { colorId: null, ldrawColor: 47 })],
        // Collides with "a": the prefix ends before it.
        [plate("c", [0, 0, 0])],
      ),
    );
    expect(playback.steps.map(({ status }) => status)).toEqual([
      "valid",
      "valid",
      "valid",
      "invalid",
    ]);

    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(3);
    expect(result.document.name).toMatch(/^REFERENCE BUILD from LEGO's official model/u);

    const imported = importBrickDocumentFromLDraw(result.text);
    expect(imported.steps.map(({ index, name, partIds }) => [index, name, partIds.length])).toEqual(
      [
        [1, "Printed step 1 (p. 11) · reference", 1],
        [2, "Printed step 2 (p. 12) · reference · no new parts", 0],
        [3, "Printed step 3 (p. 13) · reference · 1 colour stand-in", 1],
      ],
    );
    const standIn = imported.parts.find(({ stepId }) => stepId === "printed-step-003")!;
    expect(standIn.colorId).toBe(REFERENCE_STAND_IN_COLOR_ID);
    expect(standIn.semanticTags).toEqual(["colour-stand-in-ldraw-47"]);

    // The editor's playback: a state per printed step, the empty one included.
    const sequence = deriveBuildSequence(imported);
    expect(
      sequence.states.map(({ addedPartIds, cumulativePartCount }) => [
        addedPartIds.length,
        cumulativePartCount,
      ]),
    ).toEqual([
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 2],
    ]);
    expect(sequence.buildable).toBe(true);
  });

  it("writes nothing when the first printed step is not valid, and says why", () => {
    const playback = playBack(steps([plate("a", [0, 0, 0]), plate("b", [0, 0, 0])]));
    expect(buildReferenceFile(playback)).toEqual({
      status: "not-built",
      reason: "no printed step is valid",
    });
  });

  it("cuts the file back to the last state the editor can hold as one document, and says where", () => {
    // Two plates each resting on the build plate: playback reports two components, the editor needs one.
    const playback = playBack(steps([plate("a", [0, 0, 0])], [plate("far", [100, 0, 0])]));
    expect(playback.steps.map(({ status }) => status)).toEqual(["valid", "valid"]);
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(1);
    expect(result.shortenedBy).toBe("step 2: not one hard-valid document (DISCONNECTED_ASSEMBLY)");
    expect(importBrickDocumentFromLDraw(result.text).parts).toHaveLength(1);
  });

  it("names a step that opens a sub-build, since the file draws it where it ends up", () => {
    const subBuild = (lastUnit: number) => (lastUnit >= 2 ? "model" : "sub");
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [0, -8, 0], { assemblyAt: subBuild })],
        [plate("u", [0, -16, 0])],
      ),
    );
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.steps.map(({ startsSubBuild }) => startsSubBuild)).toEqual([false, true, false]);
    expect(result.document.steps[1]!.name).toBe(
      "Printed step 2 (p. 12) · reference · sub-build drawn in place",
    );
  });

  it("centres the model on the build plate by whole studs", () => {
    const at = (x: number, z: number) => ({ transform: { positionLdu: [x, 8, z] } });
    expect(centringShift([at(0, -400), at(600, -100)])).toEqual([-300, 0, 240]);
    expect(centringShift([at(-10, 9)])).toEqual([0, 0, 0]);
    expect(centringShift([at(35, 10)])).toEqual([-40, 0, -20]);
    expect(centringShift([])).toEqual([0, 0, 0]);
  });

  it("names every note a step can carry, in a fixed order", () => {
    expect(
      referenceStepName({
        step: 44,
        page: 45,
        added: 0,
        cumulative: 300,
        colorStandIns: 2,
        startsSubBuild: true,
      }),
    ).toBe(
      "Printed step 44 (p. 45) · reference · no new parts · sub-build drawn in place · 2 colour stand-ins",
    );
  });
});

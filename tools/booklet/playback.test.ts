import { describe, expect, it } from "vitest";

import {
  assemblyOfPart,
  playBack,
  type PlaybackBrick,
  type PlaybackStepInput,
} from "./playback.ts";

/**
 * Synthetic official poses of a real catalog part (LDraw 3024, a 1x1 plate),
 * so the kernel validators and the editor's connection discovery run for real.
 */
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
    assemblyAfter: () => "model",
    ...options,
  };
}
const steps = (...bricksPerStep: PlaybackBrick[][]): PlaybackStepInput[] =>
  bricksPerStep.map((bricks, index) => ({ step: index + 1, page: 11, bricks }));

describe("reference playback", () => {
  it("accepts a plate pressed onto the one below it, seated on the build plate", () => {
    const result = playBack(steps([plate("a", [0, 0, 0])], [plate("b", [0, -8.0000000001, 0])]));
    expect(result.steps.map(({ status }) => status)).toEqual(["valid", "valid"]);
    expect(result.placed.map(({ frameBasis }) => frameBasis)).toEqual([
      "measured-ldraw-frame",
      "measured-ldraw-frame",
    ]);
    expect(result.frameBases).toEqual({ "measured-ldraw-frame": 2, "mesh-asset-frame": 0 });
    // The anchor rests on the editor's build plate: a plate's centre sits 4 LDU above y = +12.
    expect(result.placed[0]!.transform.positionLdu[1]).toBe(8);
  });

  it("reports a collision on the step that introduces it and keeps it in later states", () => {
    const result = playBack(
      steps([plate("a", [0, 0, 0])], [plate("b", [0, 0, 0])], [plate("c", [0, -8, 0])]),
    );
    expect(result.steps.map(({ status, newIssues }) => `${status}/${newIssues}`)).toEqual([
      "valid/0",
      "invalid/2",
      "invalid/0",
    ]);
    expect(result.steps[1]!.issues.map(({ code }) => code)).toContain("PART_BODY_COLLISION");
  });

  it("fails a model part that neither rests on the plate nor connects to one that does", () => {
    const result = playBack(steps([plate("a", [0, 0, 0])], [plate("b", [100, -80, 0])]));
    expect(result.steps[1]!.status).toBe("invalid");
    expect(result.steps[1]!.issues.map(({ code, bricks }) => `${code}:${bricks.join()}`)).toEqual([
      "UNSUPPORTED_COMPONENT:b",
    ]);
  });

  it("validates a pending sub-build on its own and joins it to the model on the step that attaches it", () => {
    const subBuild = (step: number) => (step >= 2 ? "model" : "sub");
    const result = playBack(
      steps(
        [plate("a", [0, 0, 0]), plate("s", [0, -8, 0], { assemblyAfter: subBuild })],
        [plate("t", [0, -16, 0])],
      ),
    );
    expect(
      result.steps.map(({ status, pendingSubAssemblies }) => `${status}/${pendingSubAssemblies}`),
    ).toEqual(["valid/1", "valid/0"]);
    // Each placed part records the assemblies it belonged to, step by step.
    const s = result.placed.find(({ uuid }) => uuid === "s")!;
    expect(s.assemblies).toEqual([
      { fromStep: 1, assembly: "sub" },
      { fromStep: 2, assembly: "model" },
    ]);
    expect([0, 1, 2, 3].map((step) => assemblyOfPart(s, step))).toEqual([
      null,
      "sub",
      "model",
      "model",
    ]);
    expect(result.placed.find(({ uuid }) => uuid === "t")!.assemblies).toEqual([
      { fromStep: 2, assembly: "model" },
    ]);
  });

  it("places a sub-build that attaches in the step that builds it straight into its parent", () => {
    // Built and attached in step 2, as the booklet joins an inset sub-build in the step that completes it.
    const joinsAtTwo = (step: number) => (step >= 2 ? "model" : "sub");
    const result = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [
          plate("s", [0, -8, 0], { assemblyAfter: joinsAtTwo }),
          plate("t", [0, -16, 0], { assemblyAfter: joinsAtTwo }),
        ],
      ),
    );
    expect(
      result.steps.map(({ status, pendingSubAssemblies }) => `${status}/${pendingSubAssemblies}`),
    ).toEqual(["valid/0", "valid/0"]);
    expect(result.placed.map(({ assemblies }) => assemblies)).toEqual([
      [{ fromStep: 1, assembly: "model" }],
      [{ fromStep: 2, assembly: "model" }],
      [{ fromStep: 2, assembly: "model" }],
    ]);
  });

  it("blocks a step the catalog or the document cannot represent, and every step after it", () => {
    const tilted = [0.7071, 0, 0.7071, 0, 1, 0, -0.7071, 0, 0.7071];
    const result = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("m", [0, -8, 0], { catalogPartId: null, design: "86996.dat" })],
        [plate("b", [0, -8, 0])],
      ),
    );
    expect(result.steps.map(({ status }) => status)).toEqual([
      "valid",
      "catalog-blocked",
      "catalog-blocked",
    ]);
    expect(result.steps[1]!.blocks).toEqual([
      {
        uuid: "m",
        design: "86996.dat",
        kind: "design-missing",
        detail: "no catalog part declares 86996.dat",
      },
    ]);
    const hinge = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("h", [0, -8, 0], { pose: { matrix: tilted, positionLdu: [0, -8, 0] } })],
      ),
    );
    expect(hinge.steps[1]!.blocks.map(({ kind }) => kind)).toEqual(["orientation-off-lattice"]);
  });
});

import { describe, expect, it } from "vitest";

import { deriveBuildSequence, importBrickDocumentFromLDraw } from "@lego-studio/brick-kernel";

import { playBack, type PlaybackBrick, type PlaybackStepInput } from "./playback.ts";
import {
  buildReferenceFile,
  centringShift,
  REFERENCE_STAND_IN_COLOR_ID,
  referenceBuildRecord,
  referenceStepName,
} from "./reference-build.ts";

/**
 * Synthetic official poses of real catalog parts (LDraw 3024, a 1x1 plate, and
 * 3623, a 1x3 plate); no official data.
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
/** A 1x3 plate along x: laid one plate up, centred between two 1x1 plates 40 LDU apart, it joins them. */
const bridge = (uuid: string, position: readonly number[]): PlaybackBrick =>
  plate(uuid, position, { design: "3623.dat", catalogPartId: "builtin:plate-1x3" });
const steps = (...bricksPerStep: PlaybackBrick[][]): PlaybackStepInput[] =>
  bricksPerStep.map((bricks, index) => ({ step: index + 1, page: 11 + index, bricks }));
/** A sub-build that attaches after printed step `step`; null never attaches. */
const subBuildUntil =
  (step: number | null) =>
  (after: number): string =>
    step !== null && after >= step ? "model" : "sub";

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
    expect(result.shortenedBy).toBeNull();
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

  it("writes through a state whose only disconnection is a sub-build playback holds pending", () => {
    // Step 2 builds sub-build "s" beside the model, drawn where it ends up; step 3 attaches it and bridges the two.
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [40, 0, 0], { assemblyAfter: subBuildUntil(3) })],
        [bridge("c", [20, -8, 0])],
      ),
    );
    expect(
      playback.steps.map(({ status, pendingSubAssemblies }) => `${status}/${pendingSubAssemblies}`),
    ).toEqual(["valid/0", "valid/1", "valid/0"]);

    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(3);
    expect(result.shortenedBy).toBeNull();
    expect(result.steps.map(({ startsSubBuild }) => startsSubBuild)).toEqual([false, true, false]);
    const sequence = deriveBuildSequence(importBrickDocumentFromLDraw(result.text));
    // The editor calls the step-2 state a subassembly: buildable, not yet one piece.
    expect(
      sequence.states.map(({ stepIndex, buildable, connected }) => [
        stepIndex,
        buildable,
        connected,
      ]),
    ).toEqual([
      [-1, true, true],
      [1, true, true],
      [2, true, false],
      [3, true, true],
    ]);
    expect(sequence.states[2]!.blockingCodes).toEqual(["DISCONNECTED_ASSEMBLY"]);
  });

  it("cuts the file where the model falls apart with no pending sub-build to explain it, even when a later step joins the pieces", () => {
    // Playback holds the model up by the build plate, two pieces and all; the file must not call that a sub-build.
    const playback = playBack(
      steps([plate("a", [0, 0, 0])], [plate("b", [40, 0, 0])], [bridge("c", [20, -8, 0])]),
    );
    expect(
      playback.steps.map(({ status, plateHeldComponents }) => `${status}/${plateHeldComponents}`),
    ).toEqual(["valid/1", "valid/2", "valid/1"]);
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(1);
    expect(result.shortenedBy).toBe(
      "step 2: DISCONNECTED_ASSEMBLY that no pending sub-build explains (the model is in 2 unconnected pieces)",
    );
    expect(importBrickDocumentFromLDraw(result.text).parts).toHaveLength(1);
    // A file cut short keeps the centring of the whole valid prefix.
    expect(result.centringLdu).toEqual(centringShift(playback.placed));
  });

  it("cuts the file where the model ends in two pieces, and says where", () => {
    // Two plates each resting on the build plate: playback reports two components, the editor needs one.
    const playback = playBack(steps([plate("a", [0, 0, 0])], [plate("far", [100, 0, 0])]));
    expect(playback.steps.map(({ status }) => status)).toEqual(["valid", "valid"]);
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(1);
    expect(result.shortenedBy).toBe(
      "step 2: DISCONNECTED_ASSEMBLY that no pending sub-build explains (the model is in 2 unconnected pieces)",
    );
    expect(importBrickDocumentFromLDraw(result.text).parts).toHaveLength(1);
  });

  it("writes a prefix that ends while a sub-build is pending through its last valid step", () => {
    // The pending sub-build is drawn where it ends up, on the model, so the last state is one connected document.
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [0, -8, 0], { assemblyAfter: subBuildUntil(null) })],
        // Collides with "a": the prefix ends before it.
        [plate("c", [0, 0, 0])],
      ),
    );
    expect(
      playback.steps.map(({ status, pendingSubAssemblies }) => `${status}/${pendingSubAssemblies}`),
    ).toEqual(["valid/0", "valid/1", "invalid/1"]);
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(2);
    expect(result.shortenedBy).toBeNull();
    expect(result.document.steps[1]!.name).toBe(
      "Printed step 2 (p. 12) · reference · sub-build drawn in place",
    );
  });

  it("cuts a file that would end with a pending sub-build apart, since the exporter takes only a connected document", () => {
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [40, 0, 0], { assemblyAfter: subBuildUntil(null) })],
      ),
    );
    expect(playback.steps.map(({ status }) => status)).toEqual(["valid", "valid"]);
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(1);
    expect(result.shortenedBy).toBe(
      "step 2: the LDraw exporter refused it (a pending sub-build is still apart there): Document is not globally valid: DISCONNECTED_ASSEMBLY",
    );
  });

  it("cuts the file at a collision a pending sub-build drawn in place makes, which playback cannot see until it attaches", () => {
    // Playback validates the pending sub-build on its own, so step 2 is valid; the file's one document is not.
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [0, 0, 0], { assemblyAfter: subBuildUntil(null) })],
      ),
    );
    expect(playback.steps.map(({ status }) => status)).toEqual(["valid", "valid"]);
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.throughStep).toBe(1);
    expect(result.shortenedBy).toBe(
      "step 2: the editor's build playback calls it unbuildable (DISCONNECTED_ASSEMBLY, PART_BODY_COLLISION, PART_STUD_COLLISION)",
    );
  });

  it("names a step that opens a sub-build, since the file draws it where it ends up", () => {
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [0, -8, 0], { assemblyAfter: subBuildUntil(3) })],
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

  it("does not name a step whose sub-build attaches in the step that builds it", () => {
    // As the booklet builds an inset sub-build and joins it to the model in one printed step.
    const joinsAtTwo = { assemblyAfter: subBuildUntil(2) };
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("s", [0, -8, 0], joinsAtTwo), plate("t", [0, -16, 0], joinsAtTwo)],
      ),
    );
    const result = buildReferenceFile(playback);
    if (result.status !== "built") throw new Error(result.reason);
    expect(result.steps.map(({ startsSubBuild }) => startsSubBuild)).toEqual([false, false]);
    expect(result.document.steps[1]!.name).toBe("Printed step 2 (p. 12) · reference");
  });

  it("records the steps the file holds and why it stops short, for a reader to hold the file to", () => {
    const playback = playBack(
      steps(
        [plate("a", [0, 0, 0])],
        [plate("b", [0, -8, 0], { colorId: null, ldrawColor: 47 })],
        [plate("s", [40, 0, 0], { assemblyAfter: subBuildUntil(null) })],
      ),
    );
    const result = buildReferenceFile(playback);
    expect(referenceBuildRecord(result, playback)).toEqual({
      status: "built",
      file: "reference-build.mpd",
      validThrough: 3,
      firstStep: 1,
      throughStep: 2,
      parts: 2,
      colorStandIns: 1,
      shortenedBy:
        "step 3: the LDraw exporter refused it (a pending sub-build is still apart there): Document is not globally valid: DISCONNECTED_ASSEMBLY",
      steps: [
        { step: 1, added: 1, cumulative: 1, colorStandIns: 0, startsSubBuild: false },
        { step: 2, added: 1, cumulative: 2, colorStandIns: 1, startsSubBuild: false },
      ],
    });

    const whole = playBack(steps([plate("a", [0, 0, 0])]));
    expect(referenceBuildRecord(buildReferenceFile(whole), whole)).toMatchObject({
      validThrough: 1,
      throughStep: 1,
      shortenedBy: null,
    });
    const none = playBack(steps([plate("a", [0, 0, 0]), plate("c", [0, 0, 0])]));
    expect(referenceBuildRecord(buildReferenceFile(none), none)).toEqual({
      status: "not-built",
      reason: "no printed step is valid",
    });
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

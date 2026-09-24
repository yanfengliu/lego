import { describe, expect, it } from "vitest";

import type { AnswerKey } from "./answer-key/index.ts";
import { identityMatches } from "./align-identity.ts";
import { repairAlignment, stepMatches } from "./align-repair.ts";
import { runAlignStage } from "./align-stage.ts";
import { identifyStageOf, stepIdentities } from "./identify-stage.ts";
import type { BookletRead } from "./read.ts";

/**
 * Alignment by identity on synthetic steps and bricks, no booklet and no
 * official data. Letters stand for element ids: P a 2x4 plate, L a light grey
 * 1x2 plate, B a black 1x2x2 brick, D a dark grey 1x3 brick, A an arch.
 *
 * The first case is printed step 31's defect in miniature: the official order
 * builds the dark grey bricks one step before the booklet draws them, and the
 * callout counts of both steps still come out equal, so the alignment by
 * counts gives step 1 the wrong parts and calls it matched. Bound: the
 * synthetic steps exercise the criterion, the repair and the stage wiring; the
 * real booklet's numbers come from `npm run booklet`.
 */
interface SyntheticStep {
  readonly callouts: readonly (readonly [element: string, count: number, flags?: string[]])[];
}

/** Printed steps, the official units in build order, and identification of every callout. */
function fixture(steps: readonly SyntheticStep[], units: readonly (readonly string[])[]) {
  let serial = 0;
  const unitRefs = units.map((elements) => elements.map((element) => `${element}#${serial++}`));
  const bricks = unitRefs.flat().map((uuid, row) => ({
    row: row + 1,
    uuid,
    designId: uuid.split("#")[0]!,
    designRevision: uuid.split("#")[0]!,
    itemNos: [uuid.split("#")[0]!],
    materialId: "1",
    parts: [],
  }));
  const quantities: Record<string, number> = {};
  for (const { itemNos } of bricks) quantities[itemNos[0]!] = (quantities[itemNos[0]!] ?? 0) + 1;
  const read = {
    steps: steps.map(({ callouts }, index) => ({
      step: index + 1,
      page: 11 + index,
      callouts: callouts.map(([, count]) => count),
      pieces: callouts.reduce((sum, [, count]) => sum + count, 0),
    })),
    inventory: { quantities },
    bagOpenings: [],
  } as unknown as BookletRead;
  const key = {
    model: { bricks, bags: new Map() },
    brickByUuid: new Map(bricks.map((brick) => [brick.uuid, brick])),
    sequence: {
      units: unitRefs.map((brickRefs, index) => ({ index, brickRefs })),
      placements: new Map(),
      unplaced: [],
      problems: [],
    },
  } as unknown as AnswerKey;
  const callouts = steps.flatMap(({ callouts: list }, index) =>
    list.map(([elementId, count, flags = []], at) => ({
      id: `p${11 + index}|q${count}|x${at}|y0`,
      step: index + 1,
      count,
      elementId,
      flags,
    })),
  );
  const residuals = callouts
    .filter(({ flags }) => flags.length > 0)
    .map(({ id, flags }) => ({ calloutId: id, flags }));
  const identify = identifyStageOf(read, {
    source: {
      sha256: "sha256:synthetic",
      byteLength: 0,
      pageCount: steps.length,
      pdfjsVersion: "",
    },
    summary: {} as never,
    text: {} as never,
    assignment: { cost: 0, lowerBound: 0, provenOptimal: true, nodes: 1 },
    callouts: callouts as never,
    steps: [],
    reconciliation: [],
    residuals: residuals as never,
    timingsMs: {},
  });
  return { read, key, identify };
}

/** Each step's parts, as sorted element letters. */
const parts = (stage: ReturnType<typeof runAlignStage>) =>
  stage.steps.map(({ bricks }) =>
    bricks
      .map((uuid) => uuid.split("#")[0])
      .sort()
      .join(""),
  );

describe("alignment by identity", () => {
  // Step 1 draws P, L and two B; step 2 draws two D, an arch and a B. The official order
  // builds the two D in the first unit and the L and one B in the second.
  const STEP_31 = fixture(
    [
      {
        callouts: [
          ["P", 1],
          ["L", 1],
          ["B", 2],
        ],
      },
      {
        callouts: [
          ["D", 2],
          ["A", 1],
          ["B", 1],
        ],
      },
    ],
    [
      ["P", "B", "D", "D"],
      ["B", "L", "A", "B"],
    ],
  );

  it("gives a step the parts its callouts draw where counts alone give it others", () => {
    const { read, key, identify } = STEP_31;
    const byCounts = runAlignStage(read, key, null);
    // Counts 2+1+1 against 2+1+1 in both steps: matched by run order, and wrong.
    expect(byCounts.basis).toBe("counts");
    expect(byCounts.steps.map(({ verdict, matchedBy }) => `${verdict}/${matchedBy}`)).toEqual([
      "counts/run order",
      "counts/run order",
    ]);
    expect(parts(byCounts)).toEqual(["BDDP", "ABBL"]);

    const byIdentity = runAlignStage(read, key, identify);
    expect(byIdentity.basis).toBe("identity");
    expect(parts(byIdentity)).toEqual(["BBLP", "ABDD"]);
    expect(byIdentity.steps.map(({ verdict, matchedBy }) => `${verdict}/${matchedBy}`)).toEqual([
      "identity/repair",
      "identity/repair",
    ]);
    expect(byIdentity.identity).toEqual({
      exact: 2,
      exactByRunOrder: 0,
      exactByRepair: 2,
      exactWithoutCallouts: 0,
      countFallback: 0,
      mismatched: 0,
    });
    // The comparison line keeps what counts alone would have done.
    expect(byIdentity.byCounts).toMatchObject({ matchedByRunOrder: 2, fittedByRepair: 0 });
    expect(byIdentity.partsChangedFromCounts).toEqual([1, 2]);
  });

  it("scores identification against the model and says which way the booklet moved each element", () => {
    const score = runAlignStage(STEP_31.read, STEP_31.key, STEP_31.identify).identityScore!;
    expect(score).toMatchObject({
      stepsWithCallouts: 2,
      stepsAgreeingByRunOrder: 0,
      stepsMovedByBooklet: 2,
      stepsUnexplained: 0,
      callouts: 6,
      calloutsAgreeing: 6,
    });
    expect(
      score.moves.map(
        ({ pieces, element, bookletStep, modelStep, direction }) =>
          `${pieces}x${element} ${bookletStep}<-${modelStep} ${direction}`,
      ),
    ).toEqual(["1xB 1<-2 booklet earlier", "1xL 1<-2 booklet earlier", "2xD 2<-1 booklet later"]);
    expect(
      score.differences.map(({ step, identifiedOnly, modelOnly }) => [
        step,
        identifiedOnly,
        modelOnly,
      ]),
    ).toEqual([
      [1, { B: 1, L: 1 }, { D: 2 }],
      [2, { D: 2 }, { B: 1, L: 1 }],
    ]);
  });

  it("matches a flagged callout by count only and calls the step a count fallback", () => {
    const { read, key, identify } = fixture(
      [
        {
          callouts: [
            ["P", 1],
            // Identification's guess is wrong and flagged; the model's element there is L.
            ["A", 1, ["low-margin"]],
          ],
        },
        { callouts: [["B", 2]] },
      ],
      [
        ["P", "L"],
        ["B", "B"],
      ],
    );
    const stage = runAlignStage(read, key, identify);
    expect(
      stage.steps.map(
        ({ verdict, matchedBy, countedCallouts }) => `${verdict}/${matchedBy}/${countedCallouts}`,
      ),
    ).toEqual(["count fallback/run order/1", "identity/run order/0"]);
    expect(stage.identityScore).toMatchObject({
      callouts: 3,
      calloutsAgreeing: 2,
      stepsUnexplained: 1,
    });
    expect(stage.identityScore!.calloutDifferences).toEqual([
      {
        step: 1,
        calloutId: "p11|q1|x1|y0",
        count: 1,
        identified: "A",
        flagged: true,
        modelUnclaimed: { L: 1 },
      },
    ]);
  });

  it("reports a step whose trusted callouts the model cannot supply as a mismatch, never as a fit", () => {
    const { read, key, identify } = fixture(
      [
        {
          callouts: [
            ["P", 1],
            ["L", 1],
          ],
        },
        { callouts: [["B", 2]] },
      ],
      // The model has no L anywhere: identification and the model disagree, and counts would hide it.
      [
        ["P", "A"],
        ["B", "B"],
      ],
    );
    const stage = runAlignStage(read, key, identify);
    expect(stage.steps.map(({ verdict }) => verdict)).toEqual(["mismatch", "identity"]);
    expect(runAlignStage(read, key, null).steps.map(({ verdict }) => verdict)).toEqual([
      "counts",
      "counts",
    ]);
    expect(stage.windows[0]).toMatchObject({
      solved: false,
      outcome: "unsolved (no redistribution)",
    });
  });

  it("widens the repair window when the booklet moves a part further than the smallest balanced window", () => {
    // The booklet draws the arch at step 1; the model builds it at step 4, three steps later.
    const { read, key, identify } = fixture(
      [
        { callouts: [["A", 1]] },
        { callouts: [["B", 1]] },
        { callouts: [["L", 1]] },
        { callouts: [["D", 1]] },
        { callouts: [["P", 1]] },
      ],
      [["D"], ["B"], ["L"], ["A"], ["P"]],
    );
    const stage = runAlignStage(read, key, identify);
    expect(parts(stage)).toEqual(["A", "B", "L", "D", "P"]);
    expect(stage.windows).toHaveLength(1);
    expect(stage.windows[0]).toMatchObject({ solved: true, firstStep: 1, lastStep: 4, moved: 2 });
    expect(stage.windows[0]!.windowsTried).toBeGreaterThan(1);
    // By counts every step matches its one "1x" by run order, the arch at step 4 included.
    expect(parts(runAlignStage(read, key, null))).toEqual(["D", "B", "L", "A", "P"]);
  });

  it("moves the brick the model builds nearest the step that receives it, keeping a sub-build whole", () => {
    // Pages 35-36 in miniature: the booklet builds sub-build B (units 1-3: B, P, then a second B,
    // then L on top) before sub-build A (unit 0: two D), and step 2 adds a wall of three B.
    const { read, key, identify } = fixture(
      [
        {
          callouts: [
            ["P", 1],
            ["B", 2],
            ["L", 1],
          ],
        },
        {
          callouts: [
            ["D", 2],
            ["B", 3],
          ],
        },
      ],
      [["D", "D"], ["B", "P"], ["B"], ["L"], ["B", "B", "B"]],
    );
    const stage = runAlignStage(read, key, identify);
    // The second B of step 1 is unit 2's, built right after the first; not unit 4's last.
    expect(stage.steps.map(({ bricks }) => bricks.join(" "))).toEqual([
      "B#2 P#3 B#4 L#5",
      "D#0 D#1 B#6 B#7 B#8",
    ]);
  });

  it("aligns a step by counts alone when identification read other callout quantities than the text", () => {
    const { read } = fixture([{ callouts: [["P", 2]] }], [["P", "P"]]);
    const [identity] = stepIdentities(read, {
      callouts: [
        { id: "a", step: 1, count: 1, elementId: "P" },
        { id: "b", step: 1, count: 1, elementId: "P" },
      ] as never,
      residuals: [],
    });
    expect(identity).toMatchObject({
      target: null,
      countsOnly: "identification reads callouts 1+1, the text read 2",
    });
  });
});

describe("the identity criterion", () => {
  const target = (elements: Record<string, number>, flagged: number[] = []) => ({
    elements: new Map(Object.entries(elements)),
    flagged,
  });
  const counts = (entries: Record<string, number>) => new Map(Object.entries(entries));

  it("wants every trusted element exactly, and matches the rest against the flagged quantities", () => {
    expect(identityMatches(counts({ P: 1, B: 2 }), target({ P: 1, B: 2 }))).toBe(true);
    expect(identityMatches(counts({ P: 1, D: 2 }), target({ P: 1, B: 2 }))).toBe(false);
    expect(identityMatches(counts({ P: 1, B: 3 }), target({ P: 1, B: 2 }))).toBe(false);
    expect(identityMatches(counts({ P: 1, D: 2 }), target({ P: 1 }, [2]))).toBe(true);
    expect(identityMatches(counts({ P: 1, D: 1, A: 2 }), target({ P: 1 }, [2, 1]))).toBe(true);
    expect(identityMatches(counts({ P: 1, D: 3 }), target({ P: 1 }, [2, 1]))).toBe(false);
    // A flagged callout is another element than the trusted ones: the booklet calls each element out once.
    expect(identityMatches(counts({ P: 2 }), target({ P: 1 }, [1]))).toBe(false);
  });

  it("holds the repair to identity: a window whose trusted elements balance is redistributed, one that cannot is left alone", () => {
    const brick = (uuid: string, order: number) => ({ uuid, element: uuid[0]!, order });
    const steps = [
      { callouts: [2], identity: target({ B: 2 }), bricks: [brick("D1", 0), brick("D2", 1)] },
      { callouts: [2], identity: target({ D: 2 }), bricks: [brick("B1", 2), brick("B2", 3)] },
    ];
    const repaired = repairAlignment(steps);
    expect(repaired.steps.every(stepMatches)).toBe(true);
    expect(repaired.steps.map(({ bricks }) => bricks.map(({ uuid }) => uuid).join())).toEqual([
      "B1,B2",
      "D1,D2",
    ]);
    // Counts alone see 2 against 2 twice and repair nothing.
    const byCounts = repairAlignment(steps.map(({ callouts, bricks }) => ({ callouts, bricks })));
    expect(byCounts.windows).toEqual([]);

    // No B in the window at all: nothing to redistribute, so the bricks stay and the window says why.
    const short = repairAlignment([
      { callouts: [2], identity: target({ B: 2 }), bricks: [brick("D1", 0), brick("D2", 1)] },
      { callouts: [2], identity: target({ D: 2 }), bricks: [brick("A1", 2), brick("A2", 3)] },
    ]);
    expect(short.steps.map(({ bricks }) => bricks.map(({ uuid }) => uuid).join())).toEqual([
      "D1,D2",
      "A1,A2",
    ]);
    expect(short.windows).toEqual([
      expect.objectContaining({
        solved: false,
        outcome: "unsolved (no redistribution)",
        reason: "no redistribution makes every step match",
      }),
    ]);
  });
});

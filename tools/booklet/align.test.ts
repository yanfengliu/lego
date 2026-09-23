import { describe, expect, it } from "vitest";

import { alignSteps, checkInventoryAgainstModel } from "./align.ts";
import { repairAlignment, stepMatches } from "./align-repair.ts";

const unit = (...elements: string[]) => ({ elements });

describe("step alignment", () => {
  it("gives each printed step the run of build units whose element counts equal its callouts", () => {
    // Printed step 2 draws a boxed sub-build: units 1 and 2 (the sub-build and the step attaching it).
    const alignment = alignSteps(
      [
        { step: 1, page: 11, callouts: [2] },
        { step: 2, page: 11, callouts: [1, 1] },
        { step: 3, page: 12, callouts: [4] },
      ],
      [unit("p", "p"), unit("q"), unit("r"), unit("s", "s", "s", "s")],
    );
    expect(alignment.mismatchedSteps).toEqual([]);
    expect(alignment.steps.map(({ unitStart, unitEnd }) => [unitStart, unitEnd])).toEqual([
      [0, 1],
      [1, 3],
      [3, 4],
    ]);
  });

  it("reports a step whose callouts no run can explain instead of forcing it", () => {
    const alignment = alignSteps(
      [
        { step: 1, page: 11, callouts: [3] },
        { step: 2, page: 11, callouts: [1] },
      ],
      [unit("p", "p"), unit("q", "q")],
    );
    expect(alignment.matchedSteps).toBe(0);
    expect(alignment.mismatchedSteps).toEqual([1, 2]);
  });

  it("repairs two printed steps that swapped sibling bricks, moving as few as possible", () => {
    const brick = (uuid: string, element: string, order: number) => ({ uuid, element, order });
    const repaired = repairAlignment([
      { callouts: [2], bricks: [brick("a", "x", 0), brick("b", "x", 1)] },
      { callouts: [1], bricks: [brick("c", "y", 2), brick("d", "z", 3)] },
      { callouts: [1, 1], bricks: [brick("e", "w", 4)] },
    ]);
    expect(repaired.steps.every(stepMatches)).toBe(true);
    expect(repaired.windows).toHaveLength(1);
    expect(repaired.windows[0]).toMatchObject({ solved: true, outcome: "solved", moved: 1 });
  });

  it("reports a window whose search hit the node budget as unsolved and leaves its steps alone", () => {
    const brick = (uuid: string, element: string, order: number) => ({ uuid, element, order });
    const steps = [
      { callouts: [2], bricks: [brick("a", "x", 0), brick("b", "x", 1)] },
      { callouts: [1], bricks: [brick("c", "y", 2), brick("d", "z", 3)] },
      { callouts: [1, 1], bricks: [brick("e", "w", 4)] },
    ];
    // Budget 3 lets the search find a redistribution but not prove it moves the fewest bricks.
    const repaired = repairAlignment(steps, { nodeBudget: 3 });
    expect(repaired.windows[0]).toMatchObject({
      solved: false,
      outcome: "unsolved (budget)",
      moved: 0,
    });
    expect(repaired.windows[0]!.reason).toMatch(/stopped at its budget of 3 nodes/u);
    expect(repaired.steps.map(({ bricks }) => bricks.map(({ uuid }) => uuid).join(""))).toEqual([
      "ab",
      "cd",
      "e",
    ]);
  });

  it("checks per-element conservation between the printed inventory and the official bricks", () => {
    const check = checkInventoryAgainstModel({ "302326": 2, "300126": 1 }, [
      "302326",
      "302326",
      "300126",
      "999",
    ]);
    expect(check.mismatches).toEqual([]);
    expect(check.missingFromInventory).toEqual(["999"]);
  });
});

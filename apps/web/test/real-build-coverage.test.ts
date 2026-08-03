import { describe, expect, it } from "vitest";

import { bindCalloutsToBookletPanels } from "../e2e/real-build-coverage";

const panels = [
  {
    stepNumber: 1,
    pageNumber: 11,
    bounds: { minXPt: 0, maxXPt: 100, minYPt: 0, maxYPt: 50 },
  },
  {
    stepNumber: 2,
    pageNumber: 11,
    bounds: { minXPt: 0, maxXPt: 100, minYPt: 50, maxYPt: 100 },
  },
] as const;

const sourcePages = [
  {
    pageNumber: 11,
    textElements: [
      { text: "1x", xPt: 10, yPt: 20 },
      { text: "1x", xPt: 10, yPt: 20 },
      { text: "2x", xPt: 10, yPt: 80 },
    ],
  },
] as const;
const stepOne = {
  identity: "p11|q1|x10.000|y20.000",
  file: "runs/test/step-one.png",
  pageNumber: 11,
  stepNumber: 1,
  quantity: 1,
  evidenceKind: "part-art",
  sha256: `sha256:${"1".repeat(64)}`,
} as const;
const stepTwo = {
  identity: "p11|q2|x10.000|y80.000",
  file: "runs/test/step-two.png",
  pageNumber: 11,
  stepNumber: 2,
  quantity: 2,
  evidenceKind: "part-art",
  sha256: `sha256:${"2".repeat(64)}`,
} as const;

describe("booklet callout panel bindings", () => {
  it("derives stable callout steps from current PDF coordinates and panel bounds", () => {
    const result = bindCalloutsToBookletPanels({
      lastStep: 2,
      manifestCallouts: [stepOne, stepTwo],
      panels,
      sourcePages,
    });

    expect(result.failures).toEqual([]);
    expect([...result.stepByIdentity]).toEqual([
      [stepOne.identity, 1],
      [stepTwo.identity, 2],
    ]);
  });

  it("refuses a requested callout moved into the unvalidated tail", () => {
    const result = bindCalloutsToBookletPanels({
      lastStep: 1,
      manifestCallouts: [{ ...stepOne, stepNumber: 2 }, stepTwo],
      panels,
      sourcePages,
    });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      code: "input-digest-mismatch",
      inputKey: stepOne.identity,
      stepNumber: 1,
    });
    expect(result.failures[0]!.message).toContain("independently located");
  });

  it("ignores a tail-only mapping defect until that step enters scope", () => {
    const badTail = { ...stepTwo, stepNumber: null };
    expect(
      bindCalloutsToBookletPanels({
        lastStep: 1,
        manifestCallouts: [stepOne, badTail],
        panels,
        sourcePages,
      }).failures,
    ).toEqual([]);

    const full = bindCalloutsToBookletPanels({
      lastStep: 2,
      manifestCallouts: [stepOne, badTail],
      panels,
      sourcePages,
    });
    expect(full.failures).toHaveLength(1);
    expect(full.failures[0]!.inputKey).toBe(stepTwo.identity);
  });

  it("refuses a requested identity that has no exact current PDF quantity label", () => {
    const stale = { ...stepOne, identity: "p11|q1|x11.000|y20.000" };
    const result = bindCalloutsToBookletPanels({
      lastStep: 1,
      manifestCallouts: [stale, stepTwo],
      panels,
      sourcePages,
    });

    expect(result.failures.map(({ inputKey }) => inputKey).sort()).toEqual(
      [stale.identity, stepOne.identity].sort(),
    );
  });

  it("uses the fixed semantic identity contract even when the real action is vector-boxed", () => {
    const semantic = {
      ...stepOne,
      identity: "p33|q4|x274.854|y340.077",
      pageNumber: 33,
      stepNumber: 29,
      quantity: 4,
      evidenceKind: "subassembly-repeat",
    };
    const semanticPanels = [
      {
        stepNumber: 29,
        pageNumber: 33,
        bounds: { minXPt: 200, maxXPt: 400, minYPt: 300, maxYPt: 400 },
      },
    ];
    const semanticPages = [
      {
        pageNumber: 33,
        textElements: [{ text: "4x", xPt: 274.854, yPt: 340.077 }],
      },
    ];

    expect(
      bindCalloutsToBookletPanels({
        lastStep: 29,
        manifestCallouts: [semantic],
        panels: semanticPanels,
        sourcePages: semanticPages,
      }).failures,
    ).toEqual([]);
    const result = bindCalloutsToBookletPanels({
      lastStep: 29,
      manifestCallouts: [{ ...semantic, evidenceKind: "part-art" }],
      panels: semanticPanels,
      sourcePages: semanticPages,
    });

    expect(result.failures).toEqual([
      expect.objectContaining({ inputKey: semantic.identity, stepNumber: 29 }),
    ]);
    expect(result.failures[0]!.message).toContain("subassembly-repeat");
  });
});

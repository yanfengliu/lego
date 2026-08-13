import { describe, expect, it } from "vitest";

import {
  carryLineagedFartherFrontier,
  createLineagedFartherOriginFrontier,
  createRealBuildValidatedFartherPlacementTransitionBatch,
  findFirstLineagedRevealingPanel,
  type FirstLineagedRevealingPanelAuthority,
  type LineagedFartherCarryAuthority,
  type LineagedFartherOriginAuthority,
} from "../e2e/real-build-farther-panel";

describe("lineaged farther execution authority", () => {
  it("fails origin, carry, and panel selection closed until trusted producers exist", () => {
    const origin = createLineagedFartherOriginFrontier(
      {} as LineagedFartherOriginAuthority<unknown>,
    );
    const carry = carryLineagedFartherFrontier({} as LineagedFartherCarryAuthority<unknown>);
    const panel = findFirstLineagedRevealingPanel(
      {} as FirstLineagedRevealingPanelAuthority<unknown>,
    );

    expect(origin).toMatchObject({ frontier: null, refusal: { code: "farther-input-invalid" } });
    expect(carry).toMatchObject({ frontier: null, refusal: { code: "farther-input-invalid" } });
    expect(panel).toMatchObject({
      frontier: null,
      decision: null,
      refusal: { code: "farther-input-invalid" },
    });
    expect(panel.refusal?.message).toMatch(/public camera evidence is inspection-only/u);
  });

  it("does not inspect fake scores, reset cursors, negative rows, or hostile keys", () => {
    let invoked = 0;
    const hostile = new Proxy(
      {
        frontier: { observationPanelStepNumber: 0, panelRendersUsed: 0 },
        panels: [{ status: "not-observable" }, { agreement: 1 }],
      },
      {
        get() {
          invoked += 1;
          throw new Error("must remain inert");
        },
        ownKeys() {
          invoked += 1;
          throw new Error("must remain inert");
        },
      },
    );

    const origin = createLineagedFartherOriginFrontier(
      hostile as unknown as LineagedFartherOriginAuthority<unknown>,
    );
    const carry = carryLineagedFartherFrontier(
      hostile as unknown as LineagedFartherCarryAuthority<unknown>,
    );
    const panel = findFirstLineagedRevealingPanel(
      hostile as unknown as FirstLineagedRevealingPanelAuthority<unknown>,
    );
    expect([origin.frontier, carry.frontier, panel.decision]).toEqual([null, null, null]);
    expect(invoked).toBe(0);
  });

  it("refuses unrelated child witnesses until restricted automatic compilation exists", () => {
    expect(() =>
      createRealBuildValidatedFartherPlacementTransitionBatch({
        parents: [{ parent: {}, children: [{ pieces: [] }] }],
      }),
    ).toThrow(/automatic BuildProgram compiler authority/u);
  });
});

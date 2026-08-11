import { describe, expect, it } from "vitest";

import {
  createFartherOriginFrontier,
  findFirstRevealingPanel,
  type FartherOriginInput,
  type FirstRevealingPanelInput,
} from "./real-build-farther-panel";

type ProbeDocument = { readonly hash: string };

const originInput = (): FartherOriginInput<ProbeDocument> => ({
  stepNumber: 5,
  candidates: ["a", "b"].map((id, index) => ({
    candidateId: id,
    document: { hash: id },
    documentHash: `sha256:${id}`,
    pieces: [
      {
        catalogPartId: `builtin:${id}`,
        colorId: "builtin:black",
        transform: { positionLdu: [0, index, 0], orientationId: "upright-yaw-0" },
      },
    ],
  })),
});

const origin = createFartherOriginFrontier(originInput()).frontier!;

const panelInput = (panels: unknown): FirstRevealingPanelInput<ProbeDocument> =>
  ({
    frontier: origin,
    originEvidence: { stepNumber: 5, status: "unseparated", margin: 0, minimumMargin: 0.01 },
    panels,
    minimumAgreement: 0.85,
    minimumMargin: 0.02,
    maximumPanelRenders: 16,
    maximumReachSteps: 1,
    fartherPanelsAvailable: false,
  }) as FirstRevealingPanelInput<ProbeDocument>;

describe("farther-panel hostile runtime inputs", () => {
  it("snapshots dense-array data instead of invoking a proxy's hidden map override", () => {
    const bypassedCandidates = [
      {
        get candidateId(): never {
          throw new Error("unparsed candidate escaped the parser");
        },
      },
      { candidateId: "also-unparsed" },
    ];
    const candidates = new Proxy([null, null], {
      get(target, key, receiver) {
        return key === "map" ? () => bypassedCandidates : Reflect.get(target, key, receiver);
      },
    });
    const originResult = createFartherOriginFrontier({
      stepNumber: 5,
      candidates,
    } as unknown as FartherOriginInput<ProbeDocument>);
    expect(originResult.refusal?.code).toBe("farther-input-invalid");
    expect(originResult.refusal?.message).toContain(
      "origin.candidates[0] is null; required an object",
    );

    const panels = new Proxy([null], {
      get(target, key, receiver) {
        return key === "map"
          ? () => [{ stepNumber: 6, status: "visible" }]
          : Reflect.get(target, key, receiver);
      },
    });
    const panelResult = findFirstRevealingPanel(panelInput(panels));
    expect(panelResult.refusal?.code).toBe("farther-input-invalid");
    expect(panelResult.refusal?.message).toContain(
      "panel.panels[0] is null; required a panel object",
    );
  });

  it("rejects object and array accessors without invoking their getters", () => {
    let objectGetterCalls = 0;
    const unsafeOrigin = Object.defineProperties(
      {},
      {
        stepNumber: { enumerable: true, value: 5 },
        candidates: {
          enumerable: true,
          get() {
            objectGetterCalls += 1;
            throw new Error("object getter must not run");
          },
        },
      },
    );
    const objectResult = createFartherOriginFrontier(
      unsafeOrigin as FartherOriginInput<ProbeDocument>,
    );
    expect(objectGetterCalls).toBe(0);
    expect(objectResult.refusal?.message).toContain(
      "origin.candidates must be an own data property; accessors are not accepted",
    );

    let arrayGetterCalls = 0;
    const candidates = [null, null];
    Object.defineProperty(candidates, 0, {
      configurable: true,
      enumerable: true,
      get() {
        arrayGetterCalls += 1;
        throw new Error("array getter must not run");
      },
    });
    const arrayResult = createFartherOriginFrontier({
      stepNumber: 5,
      candidates,
    } as unknown as FartherOriginInput<ProbeDocument>);
    expect(arrayGetterCalls).toBe(0);
    expect(arrayResult.refusal?.message).toContain(
      "origin.candidates[0] must be an own data property; accessors are not accepted",
    );
  });

  it("turns proxy traps and unprintable thrown values into frozen typed refusals", () => {
    const trapResult = createFartherOriginFrontier(
      new Proxy(
        {},
        {
          ownKeys() {
            throw "ownKeys exploded";
          },
        },
      ) as FartherOriginInput<ProbeDocument>,
    );
    expect(trapResult.refusal?.message).toContain(
      "input could not be inspected safely: ownKeys exploded",
    );

    const unprintable = {
      toString(): never {
        throw new Error("unprintable");
      },
    };
    const thrownValueResult = createFartherOriginFrontier(
      new Proxy(
        {},
        {
          ownKeys() {
            throw unprintable;
          },
        },
      ) as FartherOriginInput<ProbeDocument>,
    );
    expect(thrownValueResult.refusal?.message).toContain("unknown inspection failure");
    expect(Object.isFrozen(thrownValueResult)).toBe(true);
    expect(Object.isFrozen(thrownValueResult.refusal)).toBe(true);

    const symbolicMessage = new Error("replaced");
    Object.defineProperty(symbolicMessage, "message", { value: Symbol("symbolic-message") });
    const symbolicMessageResult = createFartherOriginFrontier(
      new Proxy(
        {},
        {
          ownKeys() {
            throw symbolicMessage;
          },
        },
      ) as FartherOriginInput<ProbeDocument>,
    );
    expect(symbolicMessageResult.refusal?.message).toContain("Symbol(symbolic-message)");
  });

  it("enforces the exact keys of both panel union variants", () => {
    const notObservable = findFirstRevealingPanel(
      panelInput([{ stepNumber: 6, status: "not-observable", reason: "occluded", scores: [] }]),
    );
    expect(notObservable.refusal?.message).toContain('unexpected key "scores"');

    const scored = findFirstRevealingPanel(
      panelInput([
        {
          stepNumber: 6,
          status: "scored",
          subject: "origin",
          scores: [],
          reason: "occluded",
        },
      ]),
    );
    expect(scored.refusal?.message).toContain('unexpected key "reason"');
    expect(Object.isFrozen(scored.evidence.panels)).toBe(true);
  });
});

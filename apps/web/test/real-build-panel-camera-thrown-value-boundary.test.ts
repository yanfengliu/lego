import { inspect } from "node:util";

import { describe, expect, it } from "vitest";

import { createRealBuildPanelCameraBranchBudgetLedger } from "../e2e/real-build-panel-camera-branch-budget";
import { resolveRealBuildPanelCameraFrontier } from "../e2e/real-build-panel-camera-frontier";
import { resolveRealBuildPanelCameraBranches } from "../e2e/real-build-panel-camera-resolver";
import { frontierInput } from "./real-build-panel-camera-frontier.fixture";
import { BUILT_MASK, observedInput } from "./real-build-panel-camera-resolver.fixture";

function hostileThrownValue() {
  let trapCalls = 0;
  const trapped = () => {
    trapCalls += 1;
    throw new Error("hostile thrown-value trap must not run");
  };
  const value = new Proxy(Object.create(null) as object, {
    get: trapped,
    getOwnPropertyDescriptor: trapped,
    getPrototypeOf: trapped,
    has: trapped,
    ownKeys: trapped,
  });
  return { value, trapCalls: () => trapCalls };
}

function captureError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("Expected boundary operation to throw.");
}

function expectInert(error: Error, trapCalls: () => number, message: RegExp): void {
  expect(error).toBeInstanceOf(TypeError);
  expect(error.message).toMatch(message);
  expect((error as Error & { readonly cause?: unknown }).cause).toBeUndefined();
  expect(inspect(error)).toContain("TypeError");
  expect(trapCalls()).toBe(0);
}

describe("panel-camera thrown-value boundaries", () => {
  it("discards hostile scalar hash and ledger thrown values", () => {
    const hostileHash = hostileThrownValue();
    const hashError = captureError(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        hashDocument: () => {
          throw hostileHash.value;
        },
      }),
    );
    expectInert(hashError, hostileHash.trapCalls, /hashDocument threw an untrusted value/u);

    const hostileLedger = hostileThrownValue();
    const ledgerError = captureError(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger: {
          budget: 8,
          reserved: 0,
          refusedReservation: false,
          failedReservation: null,
          tryReserve() {
            throw hostileLedger.value;
          },
        },
      }),
    );
    expectInert(ledgerError, hostileLedger.trapCalls, /tryReserve\(8\) threw an untrusted value/u);
  });

  it("discards a hostile scalar renderer value even when the callback poisons its ledger", () => {
    const hostile = hostileThrownValue();
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(9);
    const error = captureError(() =>
      resolveRealBuildPanelCameraBranches({
        ...observedInput(),
        ledger,
        renderModelMask: () => {
          ledger.tryReserve(1);
          throw hostile.value;
        },
      }),
    );
    expectInert(error, hostile.trapCalls, /renderModelMask changed the shared ledger/u);
  });

  it("discards hostile frontier hash and renderer thrown values", () => {
    const hostileHash = hostileThrownValue();
    const hashError = captureError(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput(),
        hashDocument: () => {
          throw hostileHash.value;
        },
      }),
    );
    expectInert(hashError, hostileHash.trapCalls, /hashDocument threw an untrusted value/u);

    const hostileRender = hostileThrownValue();
    const ledger = createRealBuildPanelCameraBranchBudgetLedger(25);
    const renderError = captureError(() =>
      resolveRealBuildPanelCameraFrontier({
        ...frontierInput({ ledger }),
        renderModelMask: () => {
          ledger.tryReserve(1);
          throw hostileRender.value;
        },
        builtMask: BUILT_MASK,
      }),
    );
    expectInert(
      renderError,
      hostileRender.trapCalls,
      /render callbacks changed the external branch ledger/u,
    );
  });
});

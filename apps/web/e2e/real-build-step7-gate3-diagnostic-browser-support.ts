import { createNarrowingRenderBudgetLedger } from "./real-build-deferral";
import { prepareRealBuildModules } from "./real-build-browser-preflight";
import { createCanonicalPrintedStepPlacer } from "./real-build-fixed-actions";
import { reconstructStep7Gate3Parents } from "./real-build-step7-gate3-parent-reconstruction";
import {
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  type RendererObservation,
  type ReservationObservation,
  type Step7Gate3BrowserInput,
  type Step7Gate3BrowserResult,
} from "./real-build-step7-gate3-diagnostic-browser-contract";
import { groupPlacementOperationsInPrintedStep } from "./real-build-safety";

export function instrumentRendering(
  rendering: ReturnType<typeof JSON.parse>,
  current: { value: RendererObservation | null },
): ReturnType<typeof JSON.parse> {
  const instrumented = Object.create(rendering) as Record<PropertyKey, unknown>;
  Object.defineProperty(instrumented, "createInstructionRenderer", {
    enumerable: true,
    value: (...arguments_: unknown[]) => {
      const owner = current.value;
      if (owner === null)
        throw new TypeError("Instruction renderer was created outside a parent attempt.");
      owner.created += 1;
      const renderer = Reflect.apply(
        rendering.createInstructionRenderer,
        rendering,
        arguments_,
      ) as object;
      return new Proxy(renderer, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (property === "render" && typeof value === "function") {
            return (...renderArguments: unknown[]) => {
              owner.renderCalls += 1;
              return Reflect.apply(value, target, renderArguments);
            };
          }
          if (property === "dispose" && typeof value === "function") {
            return (...disposeArguments: unknown[]) => {
              owner.disposeCalls += 1;
              return Reflect.apply(value, target, disposeArguments);
            };
          }
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  });
  return instrumented;
}

export function productionShadowRefusal(
  reservations: readonly ReservationObservation[],
): Step7Gate3BrowserResult["production8192ShadowRefusal"] {
  const ledger = createNarrowingRenderBudgetLedger(STEP7_GATE3_PRODUCTION_NARROWING_LIMIT);
  for (const reservation of reservations) {
    const reservedBefore = ledger.reserved;
    if (!ledger.tryReserve(reservation.requested)) {
      const failed = ledger.failedReservation;
      if (
        failed === null ||
        failed.reservedBefore !== reservedBefore ||
        failed.requested !== reservation.requested ||
        failed.budget !== STEP7_GATE3_PRODUCTION_NARROWING_LIMIT
      ) {
        throw new TypeError(
          `Production narrowing ledger returned an inconsistent refusal for ${reservation.requested} after ${reservedBefore}.`,
        );
      }
      return {
        sourceParentCandidateId: reservation.sourceParentCandidateId,
        parentCandidateId: reservation.parentCandidateId,
        reservedBefore: failed.reservedBefore,
        requested: failed.requested,
        budget: STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
      };
    }
    if (ledger.reserved !== reservedBefore + reservation.requested) {
      throw new TypeError(
        `Production narrowing ledger reserved ${ledger.reserved} after ${reservation.requested} from ${reservedBefore}.`,
      );
    }
  }
  return null;
}

export function reconstructParentsWithCurrentModules(
  input: Step7Gate3BrowserInput,
  modules: Awaited<ReturnType<typeof prepareRealBuildModules>>,
) {
  const createPlace = (
    applyOperations: (base: unknown, operations: readonly unknown[]) => unknown,
  ) =>
    createCanonicalPrintedStepPlacer<unknown>({
      createTransaction: (base, piece) => modules.commands.createPlacePartTransaction(base, piece),
      groupOperations: (operations, step) =>
        groupPlacementOperationsInPrintedStep(
          operations as Parameters<typeof groupPlacementOperationsInPrintedStep>[0],
          step,
        ),
      applyOperations,
    });
  const currentPlace = createPlace((base, operations) =>
    modules.kernel.applyBuildOperations(base, operations),
  );
  const reconstruction = reconstructStep7Gate3Parents({
    baseDocument: input.baseDocument,
    origins: input.origins,
  });
  return { reconstruction, currentPlace };
}

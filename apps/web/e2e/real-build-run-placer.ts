import { groupPlacementOperationsInPrintedStep } from "./real-build-safety";
import { createCanonicalPrintedStepPlacer } from "./real-build-fixed-actions";

type BrowserModule = ReturnType<typeof JSON.parse>;

/** Wires the imported command and kernel objects into the canonical printed-step placer. */
export function createRealBuildRunPlacer(commands: BrowserModule, kernel: BrowserModule) {
  return createCanonicalPrintedStepPlacer<unknown>({
    createTransaction: (base, piece) => commands.createPlacePartTransaction(base, piece),
    groupOperations: (operations, step) =>
      groupPlacementOperationsInPrintedStep(
        operations as Parameters<typeof groupPlacementOperationsInPrintedStep>[0],
        step,
      ),
    applyOperations: (base, operations) => kernel.applyBuildOperations(base, operations),
  });
}

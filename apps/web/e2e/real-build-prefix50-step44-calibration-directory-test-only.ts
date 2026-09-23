import {
  nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine,
  waitForRealBuildPrefix50Step44CalibrationDirectoryHelper,
} from "./real-build-prefix50-step44-calibration-directory-process.ts";
import type {
  RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  RealBuildPrefix50Step44CalibrationDirectoryTransactionState,
} from "./real-build-prefix50-step44-calibration-directory-state.ts";

export function createRealBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly(
  requireState: (
    transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  ) => RealBuildPrefix50Step44CalibrationDirectoryTransactionState,
) {
  if (import.meta.env?.MODE !== "test") return undefined;
  return Object.freeze({
    observeRootMutexWait(
      transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
      observer: () => void,
    ) {
      const state = requireState(transaction);
      if (state.phase !== "staging" || state.operation !== null || state.rootMutexWaitObserver)
        throw new TypeError("Test root-mutex observation requires one idle staging transaction.");
      state.rootMutexWaitObserver = observer;
    },
    async closeProtocolPipe(transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction) {
      const state = requireState(transaction);
      state.child.stdin!.end();
      await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(state);
    },
    async forceGuardRollback(transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction) {
      const state = requireState(transaction);
      if (state.phase !== "guarded" || state.operation !== null)
        throw new TypeError("Test guard rollback requires one idle guarded transaction.");
      state.operation = "reassert";
      try {
        state.child.stdin!.write("TEST_ROLLBACK_GUARD\n");
        const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
        if (line !== "TEST_GUARD_ROLLED_BACK")
          throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
        return state.child.exitCode === null && state.child.signalCode === null;
      } finally {
        state.operation = null;
      }
    },
    async injectProtectedCloseFailure(
      transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
    ) {
      const state = requireState(transaction);
      if (state.phase !== "guarded" || state.operation !== null)
        throw new TypeError("Test close failure requires one idle guarded transaction.");
      state.child.stdin!.write("TEST_FAIL_PROTECTED_CLOSE\n");
      const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
      if (line !== "TEST_PROTECTED_CLOSE_WILL_FAIL")
        throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
    },
  });
}

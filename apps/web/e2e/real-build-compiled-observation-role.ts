import { inspectRealBuildCompiledObservationPreflight } from "./real-build-compiled-observation-closure-preflight";
import type { RealBuildCompiledObservationClosureInspection } from "./real-build-compiled-observation-closure-types";
import { verifyRealBuildCompiledObservationRows } from "./real-build-compiled-observation-closure-verification";

export function verifyRealBuildCompiledObservationClosure(
  compiledLineageBytes: unknown,
  closureBytes: unknown,
  roleBytes: unknown | null,
  policyInspection: unknown,
): RealBuildCompiledObservationClosureInspection {
  const preflight = inspectRealBuildCompiledObservationPreflight(
    compiledLineageBytes,
    closureBytes,
    policyInspection,
  );
  return verifyRealBuildCompiledObservationRows(preflight, roleBytes);
}

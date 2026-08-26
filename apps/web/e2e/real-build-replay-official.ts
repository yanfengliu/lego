import {
  applyBuilderCanonicalCalibration,
  parseOfficialModelIndex,
  type OfficialModelIndex,
} from "./real-build-ledger";

/** Reconstructs calibrated official truth only from the exact retained raw replay roles. */
export function reconstructRealBuildOfficialReplay(input: {
  readonly roleBytes: ReadonlyMap<string, Buffer>;
  readonly roleDigests: Readonly<Record<string, string>>;
}): OfficialModelIndex {
  return applyBuilderCanonicalCalibration(
    parseOfficialModelIndex(input.roleBytes.get("official-model")!),
    input.roleBytes.get("builder-calibration")!,
    input.roleDigests["builder-calibration"]!,
    input.roleBytes.get("builder-geometry")!,
    input.roleDigests["builder-geometry"]!,
  );
}

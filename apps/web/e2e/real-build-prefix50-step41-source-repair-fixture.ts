import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step41-panel-face-fixture";
import {
  REAL_BUILD_PREFIX50_STEP41_CANONICAL_ORIENTATION,
  REAL_BUILD_PREFIX50_STEP41_EQUIVALENT_ORIENTATION,
  REAL_BUILD_PREFIX50_STEP41_PAIRS,
} from "./real-build-prefix50-step41-source-repair-contract";

const EXACT_KEYS = [
  "schemaVersion",
  "sourceSetId",
  "sourcePdfDigest",
  "pageNumber",
  "cropDigest",
  "calloutIdentity",
  "printedStepNumber",
  "quantity",
  "candidateCatalogPartId",
  "receiverCatalogPartId",
  "reviewedAttachment",
  "receiverCandidatePairs",
  "sourceLongAxisToPanelFaceQuarterTurn",
  "canonicalOrientationId",
  "equivalentOrientationId",
  "reviewDisposition",
] as const;

export function requireExactRealBuildPrefix50Step41PanelFaceFixture(
  value: unknown,
): typeof REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE {
  const fixture = value as typeof REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE;
  const keys =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value).sort()
      : [];
  if (
    fixture !== REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE ||
    keys.length !== EXACT_KEYS.length ||
    keys.some((key, index) => key !== [...EXACT_KEYS].sort()[index]) ||
    fixture.schemaVersion !== "lego.real-build-prefix50-step41-panel-face-fixture/1" ||
    fixture.sourceSetId !== "6651557" ||
    fixture.sourcePdfDigest !==
      "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" ||
    fixture.pageNumber !== 44 ||
    fixture.cropDigest !==
      "sha256:e9dbd7576685871145b9e6278d217fce619bd55d0def81f8438f401e65761072" ||
    fixture.calloutIdentity !== "p44|q4|x80.989|y495.535" ||
    fixture.printedStepNumber !== 41 ||
    fixture.quantity !== 4 ||
    fixture.candidateCatalogPartId !== "builtin:plate-1x2-round-end" ||
    fixture.receiverCatalogPartId !== "builtin:bracket-2x2-1x2-vertical-studs" ||
    fixture.reviewedAttachment !== "four-35480-undersides-on-four-41682-panel-face-stud-pairs" ||
    fixture.receiverCandidatePairs.length !== REAL_BUILD_PREFIX50_STEP41_PAIRS.length ||
    fixture.receiverCandidatePairs.some(
      ([receiver, candidate], index) =>
        receiver !== REAL_BUILD_PREFIX50_STEP41_PAIRS[index]!.receiverOrdinal ||
        candidate !== REAL_BUILD_PREFIX50_STEP41_PAIRS[index]!.candidateOrdinal,
    ) ||
    fixture.sourceLongAxisToPanelFaceQuarterTurn.join(",") !== "1,0,0,0,0,-1,0,1,0" ||
    fixture.canonicalOrientationId !== REAL_BUILD_PREFIX50_STEP41_CANONICAL_ORIENTATION ||
    fixture.equivalentOrientationId !== REAL_BUILD_PREFIX50_STEP41_EQUIVALENT_ORIENTATION ||
    fixture.reviewDisposition !== "reviewed-panel-face-attachment"
  ) {
    throw new TypeError(
      "Step-41 source repair requires the exact closed page-44 fixture fields, pair roster, part identities, orientation labels, and reviewed disposition.",
    );
  }
  return fixture;
}

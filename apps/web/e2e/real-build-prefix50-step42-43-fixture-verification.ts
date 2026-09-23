import { getProperOrientation } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50Step42ActionBinding,
  RealBuildPrefix50Step43ActionBinding,
} from "./real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } from "./real-build-prefix50-step42-43-panel-fixture";
import { REAL_BUILD_PREFIX50_STEP42_43_REPAIRS } from "./real-build-prefix50-step42-43-source-repair-contract";

function sameVector(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedCallouts(
  callouts: readonly { readonly identity: string; readonly cropDigest: string }[],
): string {
  return callouts
    .map(({ identity, cropDigest }) => `${identity}|${cropDigest}`)
    .sort()
    .join(",");
}

function composeMatrices(left: readonly number[], right: readonly number[]): readonly number[] {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, inner) => sum + left[row * 3 + inner]! * right[inner * 3 + column]!,
      0,
    );
  });
}

/** Causally binds every reviewed fixture field to the opaque actions and repairs it narrows. */
export function requireRealBuildPrefix50Step42_43PanelFixture(
  fixture: typeof REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE,
  step42: RealBuildPrefix50Step42ActionBinding,
  step43: RealBuildPrefix50Step43ActionBinding,
): void {
  const step42Repairs = REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.slice(0, 2);
  const step43Repairs = REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.slice(2);
  const repairedOrientationRoster = REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.map(
    ({ ordinal, repaired }) => `${ordinal}:${repaired.orientationId}`,
  ).join("|");
  const fixtureOrientationRoster = Object.entries(fixture.canonicalOrientationByOrdinal)
    .map(([ordinal, orientationId]) => `${ordinal}:${orientationId}`)
    .join("|");
  const quarterTurnReproducesRepairs = REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.every(
    ({ raw, repaired, equivalentOrientationId }) => {
      const rotated = composeMatrices(
        fixture.sourceToPanelFaceQuarterTurn,
        getProperOrientation(raw.orientationId).matrix,
      );
      return [repaired.orientationId, equivalentOrientationId].some((orientationId) =>
        sameVector(rotated, getProperOrientation(orientationId).matrix),
      );
    },
  );
  if (
    fixture !== REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE ||
    fixture.schemaVersion !== "lego.real-build-prefix50-step42-43-panel-fixture/1" ||
    fixture.sourceSetId !== "6651557" ||
    fixture.sourcePdfDigest !==
      "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" ||
    fixture.physicalPageNumber !== 44 ||
    fixture.lookaheadPhysicalPageNumber !== 45 ||
    !sameVector(fixture.sourceToPanelFaceQuarterTurn, [1, 0, 0, 0, 0, -1, 0, 1, 0]) ||
    !quarterTurnReproducesRepairs ||
    fixture.step42.printedStepNumber !== 42 ||
    fixture.step43.printedStepNumber !== 43 ||
    fixture.step42.occurrenceOrdinals.join(",") !==
      step42Repairs.map(({ ordinal }) => ordinal).join(",") ||
    fixture.step43.occurrenceOrdinals.join(",") !==
      step43Repairs.map(({ ordinal }) => ordinal).join(",") ||
    step42.members
      .slice(1)
      .map(({ occurrenceOrdinal }) => occurrenceOrdinal)
      .join(",") !== fixture.step42.occurrenceOrdinals.join(",") ||
    step43.phases
      .flatMap(({ members }) => members)
      .map(({ occurrenceOrdinal }) => occurrenceOrdinal)
      .join(",") !== fixture.step43.occurrenceOrdinals.join(",") ||
    sortedCallouts(step43.lateStep42.callouts) !== sortedCallouts(fixture.step42.callouts) ||
    sortedCallouts(step43.callouts) !== sortedCallouts(fixture.step43.callouts) ||
    fixtureOrientationRoster !== repairedOrientationRoster ||
    fixture.step42.reviewedDisposition !==
      "black-tile-1x2-and-plate-1x4-span-repaired-azure-studs" ||
    fixture.step43.reviewedDisposition !==
      "white-plate-base-two-inward-high-face-slopes-and-one-top-tile" ||
    step42Repairs.map(({ catalogPartId }) => catalogPartId).join(",") !==
      "builtin:tile-1x2,builtin:plate-1x4" ||
    step43Repairs.map(({ catalogPartId }) => catalogPartId).join(",") !==
      "builtin:plate-1x4,builtin:slope-1x2-45,builtin:slope-1x2-45,builtin:tile-1x2" ||
    fixture.lookaheadDisposition !==
      "step-44-rigid-return-shows-the-complete-step-43-child-with-opposed-slope-high-faces" ||
    step43Repairs[1]?.repaired.orientationId !== "proper-m-00n0n0n00" ||
    step43Repairs[2]?.repaired.orientationId !== "proper-m-00p0n0p00" ||
    fixture.authority !== "none"
  ) {
    throw new TypeError(
      `Late Step-42/43 repair requires the exact causally bound page-44/45 fixture, callouts, quarter-turn, occurrence roster, orientations, and reviewed dispositions; received quarter=${quarterTurnReproducesRepairs}, step42Callouts=${sortedCallouts(step43.lateStep42.callouts)}, fixture42=${sortedCallouts(fixture.step42.callouts)}, step43Callouts=${sortedCallouts(step43.callouts)}, fixture43=${sortedCallouts(fixture.step43.callouts)}, orientations=${fixtureOrientationRoster}.`,
    );
  }
}

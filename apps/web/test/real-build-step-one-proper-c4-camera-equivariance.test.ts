import { describe, expect, it } from "vitest";

import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "../e2e/real-build-panel-camera-resolver-boundary";
import {
  mapRealBuildStepOneProperC4MemberCameraToRepresentative,
  mapRealBuildStepOneProperC4RepresentativeCameraToMember,
} from "../e2e/real-build-step-one-proper-c4-camera-equivariance";

const turns = [0, 90, 180, 270] as const;
const key = (row: (typeof PANEL_CAMERA_ANGULAR_HYPOTHESES)[number]) =>
  `${row.latticeHand}/${row.latticeDeterminant}/${row.turnDegrees}`;

describe("step-one proper-C4 camera equivariance", () => {
  it("maps every member D4 camera bijectively and round-trips both determinants", () => {
    for (const memberTurn of turns) {
      const mapped = PANEL_CAMERA_ANGULAR_HYPOTHESES.map((hypothesis) =>
        mapRealBuildStepOneProperC4MemberCameraToRepresentative(hypothesis, memberTurn),
      );
      expect(new Set(mapped.map(key))).toHaveLength(8);
      for (const [index, representative] of mapped.entries()) {
        expect(
          mapRealBuildStepOneProperC4RepresentativeCameraToMember(representative, memberTurn),
        ).toEqual(PANEL_CAMERA_ANGULAR_HYPOTHESES[index]);
      }
    }
  });

  it("uses tRep = tMember - determinant*q without crossing lattice hands", () => {
    const fitted = PANEL_CAMERA_ANGULAR_HYPOTHESES[1]!;
    const reflected = PANEL_CAMERA_ANGULAR_HYPOTHESES[5]!;
    expect(mapRealBuildStepOneProperC4MemberCameraToRepresentative(fitted, 90)).toEqual({
      latticeHand: "as-fitted",
      latticeDeterminant: 1,
      turnDegrees: 0,
    });
    expect(mapRealBuildStepOneProperC4MemberCameraToRepresentative(reflected, 90)).toEqual({
      latticeHand: "x-reflected",
      latticeDeterminant: -1,
      turnDegrees: 180,
    });
  });

  it("rejects incoherent hypotheses and non-quarter-turn members", () => {
    expect(() =>
      mapRealBuildStepOneProperC4MemberCameraToRepresentative(
        { latticeHand: "as-fitted", latticeDeterminant: -1, turnDegrees: 0 },
        0,
      ),
    ).toThrow(/coherent exact D4/u);
    expect(() =>
      mapRealBuildStepOneProperC4MemberCameraToRepresentative(
        PANEL_CAMERA_ANGULAR_HYPOTHESES[0],
        45,
      ),
    ).toThrow(/exactly 0, 90, 180, or 270/u);
  });
});

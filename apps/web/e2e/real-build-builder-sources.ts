import type {
  BuilderCalibrationCasePin,
  BuilderDesignSourcePin,
} from "./real-build-builder-source-contract";
import { BUILDER_STEP1_DESIGN_SOURCES_A } from "./real-build-builder-source-pins-a";
import { BUILDER_STEP1_DESIGN_SOURCES_B } from "./real-build-builder-source-pins-b";
import { BUILDER_STEP1_DESIGN_SOURCES_C } from "./real-build-builder-source-pins-c";
import { BUILDER_PREFIX50_DESIGN_SOURCES_D } from "./real-build-builder-source-pins-d";
import { BUILDER_PREFIX50_DESIGN_SOURCES_E } from "./real-build-builder-source-pins-e";
import { BUILDER_PREFIX50_DESIGN_SOURCES_F } from "./real-build-builder-source-pins-f";
import { BUILDER_PREFIX50_DESIGN_SOURCES_G } from "./real-build-builder-source-pins-g";
import { BUILDER_PREFIX50_DESIGN_SOURCES_H } from "./real-build-builder-source-pins-h";
import { BUILDER_PREFIX50_DESIGN_SOURCES_I } from "./real-build-builder-source-pins-i";
import { BUILDER_PREFIX50_DESIGN_SOURCES_J } from "./real-build-builder-source-pins-j";
import { BUILDER_PREFIX50_DESIGN_SOURCES_K } from "./real-build-builder-source-pins-k";
import { BUILDER_PREFIX50_DESIGN_SOURCES_L } from "./real-build-builder-source-pins-l";
import { BUILDER_PREFIX50_DESIGN_SOURCES_M } from "./real-build-builder-source-pins-m";

export {
  BUILDER_STEP1_GEOMETRY_BUNDLE,
  BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
  BUILDER_STEP1_OFFICIAL_MODEL_DIGEST,
} from "./real-build-builder-source-contract";
export type {
  BuilderCalibrationCasePin,
  BuilderDesignSourcePin,
  BuilderFrameAnchorRole,
  BuilderFramePoint,
  BuilderTriangleSlicePin,
} from "./real-build-builder-source-contract";

/**
 * The exact first-50 design revisions whose Builder frame currently has a complete proof.
 *
 * A row is a *source* pin, not a result: the exact Builder bundle and decoded
 * Shell it came from, the two byte slices it owns in the geometry bundle, its
 * authored role-bound anchor surface (or the explicit no-anchor surface role),
 * and the catalog digests it was reviewed against. The catalog-to-Builder frame
 * is derived from these on every run and is deliberately absent here, so a
 * wrong frame cannot be pinned into existence.
 *
 * `ldrawToCatalogLocalTransform` is the one measured choice a row carries. It is
 * derived once from the LDraw-measured stud centres against the same catalog
 * stud connectors, and every run re-checks it: Builder's own Shell vertices must
 * land within 2 LDU of the LDraw surface it places, which a wrong quarter turn
 * misses by tens of LDU.
 *
 * The 42 retained rows cover 192 of the prefix's 320 pieces. Absence is a
 * measurement, not an implied frame: nine checksum-mismatched revisions, the
 * 10201;H identity contradiction, the unconsumed 2453;I identity route, ten
 * diagnostic-only frame exclusions, one surface-only row whose audited record
 * carries an authored underside lattice, and two rows whose audited type-23
 * families are not recognized studs remain outside this registry. Revision
 * 15573;L's recognized underside lattice also has three cells where its catalog
 * part has two clutches. These local frame diagnostics grant no world placement,
 * execution, mutation, acceptance, or completion authority.
 */
export const BUILDER_STEP1_DESIGN_SOURCES = [
  ...BUILDER_STEP1_DESIGN_SOURCES_A,
  ...BUILDER_STEP1_DESIGN_SOURCES_B,
  ...BUILDER_STEP1_DESIGN_SOURCES_C,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_D,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_E,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_F,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_G,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_H,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_I,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_J,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_K,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_L,
  ...BUILDER_PREFIX50_DESIGN_SOURCES_M,
] as const satisfies readonly BuilderDesignSourcePin[];

/**
 * Four reviewed Bone readings, one per quarter turn, at the corrected
 * `diag(1,-1,-1)` LXFML-to-LDraw basis. Every `positionLdu` z is the negation of
 * what this table held before, and the two quarter turns exchange: conjugating a
 * yaw by the extra z flip inverts it, so a Bone that read `upright-yaw-90` now
 * reads `upright-yaw-270` and vice versa, while `yaw-0` and `yaw-180` are fixed
 * points and cannot witness the change at all. Case 1 is therefore the position
 * witness and cases 2 and 4 are the rotation witnesses; a change that moved only
 * one half of the basis would leave one of them wrong.
 */
export const BUILDER_STEP1_CALIBRATION_CASES = [
  {
    brickRef: "a12d1753-e853-4589-bc67-e1cb4e784fa7",
    builderTransformationDigest:
      "sha256:ba9b5cb293247b9222b123c4d95b66e4ba7d6752fc60de74feb35d31aeef34ad",
    expectedTransform: { positionLdu: [270, -16, -244], orientationId: "upright-yaw-0" },
  },
  {
    brickRef: "da6a6d03-1c34-43ff-97e9-5939ccf26777",
    builderTransformationDigest:
      "sha256:6e6e61a4b108dde4eadc59ecff258a2c87658727a9117af2a9d8db1d2160c1d2",
    expectedTransform: { positionLdu: [270, -580, -104], orientationId: "upright-yaw-270" },
  },
  {
    brickRef: "d63813bf-f3b6-4059-b5de-6605e8baf320",
    builderTransformationDigest:
      "sha256:65d39c9641261db0a54ce361f501594ba6d0f1fc660be10ed5ed5869430d61ec",
    expectedTransform: { positionLdu: [390, -572, -104], orientationId: "upright-yaw-180" },
  },
  {
    brickRef: "55506c77-f293-40f5-8aa7-ea85501f07f1",
    builderTransformationDigest:
      "sha256:aa2a689c493fc4d244e55c72eb122791350195c40fc252a6adaf4d38138aa25b",
    expectedTransform: { positionLdu: [410, -580, -104], orientationId: "upright-yaw-90" },
  },
] as const satisfies readonly BuilderCalibrationCasePin[];

export const BUILDER_STEP1_ORIGIN_POLICY = {
  protocol: "first-ordered-direct-empty-enumeration/1",
  anchorBrickRef: "76092bf0-3d72-474a-baf3-06b837082f6a",
  anchorBuilderTransformationDigest:
    "sha256:b17eb49ceb81e036753fd1bc9a1a4d0cf60c945cf8a98311c589e6e981dd7f82",
  expectedComposedTransform: { positionLdu: [560, -4, -194], orientationId: "upright-yaw-0" },
  expectedEmptyEnumerationTransform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
} as const;

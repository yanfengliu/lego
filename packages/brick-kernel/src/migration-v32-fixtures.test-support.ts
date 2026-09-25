import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { plusV31, sortedEndpointDeltas } from "./migration-v31-fixtures.test-support.ts";

/**
 * Literal /32 fixtures, copied from `npm run migration-history:check -- --print`
 * rather than imported from the tables they check.
 *
 * /32 gives bracket 41682 (admitted at /19) the two clutch seats its LDCad root
 * authors in the wall's back recess, facing +Z. They are additions: every source
 * truth that has the part gains these two endpoints with no source digest, and
 * none of the part's existing endpoints changes.
 */
export const EXPECTED_V32_RECESS_CLUTCH_ADDITIONS = [
  {
    partId: "builtin:bracket-2x2-1x2-vertical-studs",
    portId: "undersideClutch:4",
    sourceDigest: null,
    targetDigest: "sha256:6e738abb3474d8e16ba540e2879d9c71107bc5f8205fe846c6f593ca48acf062",
  },
  {
    partId: "builtin:bracket-2x2-1x2-vertical-studs",
    portId: "undersideClutch:5",
    sourceDigest: null,
    targetDigest: "sha256:e61114115f67b819f73afbc35767055d78d00fb715620fe7593f533bbed40fe5",
  },
] as const;

export const V32_BRACKET_PART_ID = "builtin:bracket-2x2-1x2-vertical-studs";
const V32_BRACKET_ADMITTED_AT = 19;

/** A source row's deltas plus the two /32 additions when its roster has 41682. */
export function plusV32<T extends { partId: string; portId: string }>(
  base: readonly T[],
  sourceVersion: number,
) {
  return sortedEndpointDeltas<{ partId: string; portId: string }>(
    base,
    sourceVersion >= V32_BRACKET_ADMITTED_AT ? EXPECTED_V32_RECESS_CLUTCH_ADDITIONS : [],
  );
}

/** A source row's /31 deltas (`plusV31`) plus its /32 additions (`plusV32`). */
export function plusV31V32<T extends { partId: string; portId: string }>(
  base: readonly T[],
  sourceVersion: Parameters<typeof plusV31>[1],
) {
  return plusV32(plusV31(base, sourceVersion), sourceVersion);
}

/** The /31 -> /32 row a report crossing /32 carries. */
export const EXPECTED_V32_INTERPRETATION_CHANGE = {
  fromCatalogVersion: "builtin.basic-parts/31",
  toCatalogVersion: "builtin.basic-parts/32",
  affectedCatalogPartIds: [V32_BRACKET_PART_ID],
  changedFields: ["connector-semantics", "collision-semantics"],
} as const;

/** That row as a report from a source at `sourceVersion` carries it: absent before /19. */
export function expectedV32InterpretationChanges(sourceVersion: number) {
  return sourceVersion >= V32_BRACKET_ADMITTED_AT ? [EXPECTED_V32_INTERPRETATION_CHANGE] : [];
}

/** The complete truth source commit 1299598 emits at builtin.basic-parts/31. */
export const REVIEWED_TRUTH_V31 = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: {
    id: "builtin.basic-parts",
    version: "builtin.basic-parts/31",
    hash: "sha256:b0ec0baddbd165ef1c821097ad31388bd4515c233236f833a2364265578feaf2",
  },
  connectorTaxonomy: {
    id: "stud-tube",
    version: "stud-tube/2",
    hash: "sha256:73e50f5ea9f2ce529f241dae4e04dc99aeb2b57738c228d0844e5b30af66ceb2",
  },
  collisionModel: {
    id: "rectilinear-stud-clearance",
    version: "rectilinear-stud-clearance/4",
    hash: "sha256:878ed40921b671888228a13a747fa7836eaba50adab2319a2050130360e6211a",
  },
  transformPolicy: {
    id: "part-scoped-proper-orientations-negative-y-up",
    version: "part-scoped-proper-orientations-negative-y-up/1",
    hash: "sha256:44cf428cee1487a9441c609a75fbafefd6c3b4591512af30f8903e4508285f4c",
  },
  validatorSet: {
    id: "lego.kernel-validators",
    version: "lego.kernel-validators/5",
    hash: "sha256:44233e884c474210006e4e94b82e952fd7b446768396d5b53575eb7946cba4fe",
  },
} as const satisfies BrickDocumentV1["truth"];

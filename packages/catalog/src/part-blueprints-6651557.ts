import { ARC_SEGMENTS_PER_QUARTER } from "./arc-plan.ts";
import { LDRAW_91988_FRAME_PROVENANCE } from "./constants.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";

const PLATE_30565_CONNECTORS = [
  [-30, -30],
  [-30, -10],
  [-30, 10],
  [-30, 30],
  [-10, -10],
  [-10, 10],
  [-10, 30],
  [10, -10],
  [10, 10],
  [10, 30],
  [30, 30],
] as const;

const PLATE_80015_STUDS = [
  [-10, -70],
  [10, -70],
  [50, -50],
  [70, -10],
  [70, 10],
] as const;

// LEGO Builder's manifest-pinned revision E connectivity field exposes two
// additional underside tube seats straddling the outer curve. They
// have no matching studs above, so the two faces must not share one offset set.
const PLATE_80015_CLUTCHES = [
  [-10, -70],
  [10, -70],
  [30, -70],
  [50, -50],
  [70, -30],
  [70, -10],
  [70, 10],
] as const;

const PLATE_80015_PARTIAL_OVERHANG_EVIDENCE = {
  backingMode: "source-verified-partial-overhang",
  sourceId: "https://api.prod.dbix.i.lego.com/api/v1/Bricks/80015?Revision=E&Platform=Android",
  sourceRevision: "80015;revision-E;platform-Android",
  manifestSha256: "sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
  manifestMd5: "md5:bb72d5b5609e411392df36903c8c5daa",
  bundleSha256: "sha256:f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
  primitiveXmlSha256: "sha256:ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc",
  independentSourceId: "https://github.com/RolandMelkert/LDCadShadowLibrary",
  independentSourceRevision: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
  independentPartSha256: "sha256:c4dbcc5c5e2969e2b6e5c394519606a66b8483437503b8f4886cdf9262cd7170",
  independentSubpartSha256:
    "sha256:fa4324fccee90f9903c68c65a75bb4e747a76d429a94d648c10b9e24ceb4d879",
  extractorId: "lego-builder-custom2dfield-type22-centres/1",
  normalizedClutchOffsetsSha256:
    "sha256:0e77ae20bce268bcde610fa8d2b34fa2e91a0c3a0132e298e933433591e8f0d5",
  overrides: [
    {
      positionLdu: [30, -70],
      kind: "source-verified-partial-overhang",
      maximumOuterOverhangLdu: 2.2,
    },
    {
      positionLdu: [70, -30],
      kind: "source-verified-partial-overhang",
      maximumOuterOverhangLdu: 2.2,
    },
  ],
} as const;

const PLATE_30503_CONNECTORS = [
  [-30, -30],
  [-30, -10],
  [-30, 10],
  [-30, 30],
  [-10, -10],
  [-10, 10],
  [-10, 30],
  [10, 10],
  [10, 30],
  [30, 30],
] as const;

const PLATE_6106_CONNECTORS = [
  [-50, -50],
  [-50, -30],
  [-50, -10],
  [-50, 10],
  [-50, 30],
  [-50, 50],
  [-30, -50],
  [-30, -30],
  [-30, -10],
  [-30, 10],
  [-30, 30],
  [-30, 50],
  [-10, -30],
  [-10, -10],
  [-10, 10],
  [-10, 30],
  [-10, 50],
  [10, -10],
  [10, 10],
  [10, 30],
  [10, 50],
  [30, 10],
  [30, 30],
  [30, 50],
  [50, 30],
  [50, 50],
] as const;

const PLATE_54383_CONNECTORS = [
  [0, 10],
  [0, 30],
  [0, 50],
  [20, -50],
  [20, -30],
  [20, -10],
  [20, 10],
  [20, 30],
  [20, 50],
] as const;

export const SET_6651557_PART_BLUEPRINTS = [
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 14,
    ldrawId: "91988.dat",
    // LDraw's long axis is X; the catalog's width-first convention rotates this
    // symmetric rectangle so a 2 x 14 remains 40 by 280 LDU in catalog axes.
    ldrawFrame: {
      ldrawToCatalogOrientationId: "upright-yaw-90",
      provenance: LDRAW_91988_FRAME_PROVENANCE,
    },
    bodyBoundsLdu: { min: [-20, -4, -140], max: [20, 4, 140] },
    geometrySha256: "6dcc465b161c101e0395a4145b9250ba8110a33f7eb90997e36ea8e11b8af3e3",
  },
  {
    family: "wedge-plate",
    widthStuds: 4,
    lengthStuds: 4,
    variant: "cut-corner",
    ldrawId: "30503.dat",
    studOffsetsLdu: PLATE_30503_CONNECTORS,
    clutchOffsetsLdu: PLATE_30503_CONNECTORS,
    bodyBoundsLdu: { min: [-40, -4, -40], max: [40, 4, 40] },
    bodyWedge: { cutNormalXZ: [1, -1], cutOffsetLdu: 20 },
    geometrySha256: "faaf9bcaae41a64e2a638b10ad42b78d48e85506e1d60e05c1cec1d99c5cae40",
  },
  {
    family: "wedge-plate",
    widthStuds: 6,
    lengthStuds: 6,
    variant: "cut-corner",
    ldrawId: "6106.dat",
    studOffsetsLdu: PLATE_6106_CONNECTORS,
    clutchOffsetsLdu: PLATE_6106_CONNECTORS,
    bodyBoundsLdu: { min: [-60, -4, -60], max: [60, 4, 60] },
    bodyWedge: { cutNormalXZ: [1, -1], cutOffsetLdu: 40 },
    geometrySha256: "5e05ef717461ad34651cfeab1849185ab9a1e09b3930d315fa4467d5d436f1e1",
  },
  {
    family: "wedge-plate",
    widthStuds: 3,
    lengthStuds: 6,
    variant: "right",
    ldrawId: "54383.dat",
    studOffsetsLdu: PLATE_54383_CONNECTORS,
    clutchOffsetsLdu: PLATE_54383_CONNECTORS,
    bodyBoundsLdu: { min: [-29, -4, -60], max: [30, 4, 60] },
    bodyWedge: { cutNormalXZ: [-3, -1], cutOffsetLdu: 30 },
    geometrySha256: "830f4b04106079d0c66d43e178177ac16b47feaab927ffae790309d2a5969138",
  },
  {
    family: "corner-plate",
    widthStuds: 4,
    lengthStuds: 4,
    variant: "round",
    ldrawId: "30565.dat",
    studOffsetsLdu: PLATE_30565_CONNECTORS,
    clutchOffsetsLdu: PLATE_30565_CONNECTORS,
    bodyBoundsLdu: { min: [-40, -4, -40], max: [40, 4, 40] },
    bodyArc: {
      centerXZLdu: [-40, 40],
      innerRadiusLdu: 0,
      outerRadiusLdu: 80,
      startAngleDegrees: -90,
      endAngleDegrees: 0,
      segmentCount: ARC_SEGMENTS_PER_QUARTER,
    },
    geometrySha256: "fe0ced82a5e9d6310f153cc6b125cc88a0d2ea3d9341759e9a8135a3d45b1e4a",
  },
  {
    family: "corner-plate",
    widthStuds: 5,
    lengthStuds: 5,
    variant: "quarter-ring",
    ldrawId: "80015.dat",
    studOffsetsLdu: PLATE_80015_STUDS,
    clutchOffsetsLdu: PLATE_80015_CLUTCHES,
    partialOverhangClutchEvidence: PLATE_80015_PARTIAL_OVERHANG_EVIDENCE,
    // Keep the raw LDraw frame: recentering it would silently translate import
    // and export. The connector lattice is centred independently at (30, -30).
    connectorGridCenterLdu: [30, -30],
    bodyBoundsLdu: { min: [-20, -4, -80], max: [80, 4, 20] },
    bodyArc: {
      centerXZLdu: [0, 0],
      innerRadiusLdu: 60,
      outerRadiusLdu: 80,
      startAngleDegrees: -90,
      endAngleDegrees: 0,
      segmentCount: ARC_SEGMENTS_PER_QUARTER,
      capRectanglesLdu: [
        { minXZLdu: [-20, -80], maxXZLdu: [0, -60] },
        { minXZLdu: [60, 0], maxXZLdu: [80, 20] },
      ],
    },
    geometrySha256: "4811993c1176c7c0c315efa7bebb176025d384aac952edc5ae8af7146815a05d",
  },
] as const satisfies readonly PartBlueprint[];

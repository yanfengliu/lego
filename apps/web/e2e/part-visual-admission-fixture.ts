import {
  meshAssetContentHash,
  type PartDefinition,
  type PreloadedMeshAsset,
} from "@lego-studio/catalog";

export const SYNTHETIC_VISUAL_ADMISSION_ASSET = {
  assetId: "synthetic:asymmetric-admission-wedge",
  positionsLdu: [
    0, 0, 0, 30, 0, 0, 30, 0, 10, 0, 0, 20, 30, 12, 0, 30, 12.4, 10, 0, 12, 20, 0, 12, 0, 0, 0, 0,
    0, 12, 0, 30, 12, 0, 30, 0, 0, 30, 0, 0, 30, 12, 0, 30, 12.4, 10, 30, 0, 10, 0, 12, 20, 0, 0,
    20, 0, 12, 0, 0, 0, 0, 4, 16, 2, 12, 16, 2, 4, 20, 2, 4, 13, 4, 18, 16, 2, 26, 16, 2, 18, 20, 2,
    26, 16, 2, 18, 16, 2, 18, 13, 4,
  ],
  normalsAssetLocal: [
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0.026635905161536924, -0.9988464435576337,
    0.039953857742305386, 0.026635905161536924, -0.9988464435576337, 0.039953857742305386,
    0.026635905161536924, -0.9988464435576337, 0.039953857742305386, 0.026635905161536924,
    -0.9988464435576337, 0.039953857742305386, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 1, 0, 0, 1,
    0, 0, 0.8112421851755609, 0, 0.5847102846637648, 0.8112421851755609, 0, 0.5847102846637648,
    -0.5847102846637648, 0, 0.8112421851755608, -0.5847102846637648, 0, 0.8112421851755608, -1, 0,
    0, -1, 0, 0, 0, 0.2897841486884301, 0.9570920264890528, 0, 0.2897841486884301,
    0.9570920264890528, 0, 0, 1, 0, 0.5547001962252291, 0.8320502943378437, 0, 0, 1, 0, 0, 1, 0, 0,
    1, 0, 0.5547001962252291, 0.8320502943378437, 0, 0.5547001962252291, 0.8320502943378437, 0,
    0.5547001962252291, 0.8320502943378437,
  ],
  indices: [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 15, 14, 16, 15,
    16, 17, 17, 16, 18, 17, 18, 19, 20, 21, 22, 21, 20, 23, 24, 25, 26, 27, 28, 29,
  ],
  groups: [{ role: "body", triangleStart: 0, triangleCount: 16 }],
} as const satisfies PreloadedMeshAsset;

const PROVENANCE = {
  sourceId: "synthetic:asymmetric-admission-wedge",
  sourceType: "project-authored",
  sourceVersion: "fixture/2",
  licenseExpression: "LicenseRef-Project",
  attribution: "LEGO Studio synthetic asymmetric visual-admission fixture",
  runtimeRole: "render-mesh-asset",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
} as const;

export const SYNTHETIC_VISUAL_ADMISSION_DEFINITION = {
  id: "synthetic:asymmetric-admission-wedge",
  family: "wedge-plate",
  displayName: "Synthetic Asymmetric Admission Wedge",
  aliases: [],
  dimensions: {
    widthStuds: 1,
    lengthStuds: 1.5,
    widthLdu: 20,
    lengthLdu: 30,
    heightLdu: 20,
  },
  bodyBoundsLdu: { min: [11, -7, -25], max: [31, 13, 5] },
  boundsLdu: { min: [11, -7, -25], max: [31, 13, 5] },
  geometry: {
    generatorId: "builtin:preloaded-mesh-reference/1",
    assetId: SYNTHETIC_VISUAL_ADMISSION_ASSET.assetId,
    contentHash: meshAssetContentHash(SYNTHETIC_VISUAL_ADMISSION_ASSET),
    collisionMode: "preserved-catalog-recipe",
    bodyMode: "bundled-source-mesh",
    studMode: "none",
    undersideMode: "none",
    assetToCatalogFrame: {
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [11, -7, 5],
    },
    provenance: PROVENANCE,
  },
  connectors: [],
  legalOrientationIds: ["upright-yaw-0"],
  collision: {
    modelVersion: "synthetic-visual-admission/1",
    primitives: [],
    allowances: [],
  },
  availableColorIds: ["builtin:light-bluish-gray"],
  substitutionGroupId: "synthetic:asymmetric-admission-wedge",
  inventory: {
    availability: "builtin-unlimited",
    knownMassGrams: null,
    physicalAvailabilityClaimed: false,
  },
  provenance: PROVENANCE,
} as const satisfies PartDefinition;

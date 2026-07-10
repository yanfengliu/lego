import {
  BRICK_HEIGHT_LDU,
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  CONNECTOR_TAXONOMY_VERSION,
  LDRAW_IDENTIFIER_PROVENANCE,
  PLATE_HEIGHT_LDU,
  PROJECT_CATALOG_PROVENANCE,
  PROJECT_COLOR_PROVENANCE,
  PROJECT_GEOMETRY_PROVENANCE,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import type {
  CatalogAlias,
  CatalogSnapshotDigestInput,
  CollisionAllowance,
  CollisionPrimitive,
  ColorDefinition,
  ConnectorPortDefinition,
  LduBounds,
  PartDefinition,
  PartFamily,
} from "./types.ts";

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  Object.freeze(value);
  return value;
};

const makeColor = (
  id: string,
  displayName: string,
  displayHex: `#${string}`,
  ldrawCode: number,
): ColorDefinition =>
  deepFreeze({
    id,
    displayName,
    displayHex,
    ldrawCode,
    provenance: PROJECT_COLOR_PROVENANCE,
    ldrawCodeProvenance: LDRAW_IDENTIFIER_PROVENANCE,
  });

export const COLOR_DEFINITIONS: readonly ColorDefinition[] = deepFreeze([
  makeColor("builtin:black", "Black", "#05131D", 0),
  makeColor("builtin:blue", "Blue", "#0055BF", 1),
  makeColor("builtin:green", "Green", "#237841", 2),
  makeColor("builtin:red", "Red", "#C91A09", 4),
  makeColor("builtin:yellow", "Yellow", "#F2CD37", 14),
  makeColor("builtin:white", "White", "#FFFFFF", 15),
  makeColor("builtin:light-bluish-gray", "Light Bluish Gray", "#A0A5A9", 71),
  makeColor("builtin:dark-bluish-gray", "Dark Bluish Gray", "#6C6E68", 72),
]);

const AVAILABLE_COLOR_IDS: readonly string[] = deepFreeze(COLOR_DEFINITIONS.map(({ id }) => id));
const LEGAL_ORIENTATION_IDS: readonly string[] = deepFreeze(
  UPRIGHT_ORIENTATIONS.map(({ id }) => id),
);

interface PartBlueprint {
  readonly family: PartFamily;
  readonly widthStuds: 1 | 2;
  readonly lengthStuds: 1 | 2 | 3 | 4;
  readonly ldrawId: `${number}.dat`;
  readonly geometrySha256: string;
}

const PART_BLUEPRINTS = [
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 1,
    ldrawId: "3005.dat",
    geometrySha256: "b05add416070aa5b227455d20cc8c960c68beb85a8a14535779c82a834651edd",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3004.dat",
    geometrySha256: "25bb1403161897c65fabf8c75e88931e50ea228bb94f6aa30d893e74f0d75432",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "3622.dat",
    geometrySha256: "2155a22ab04c1d95fe2c882fd28f7fe3b2383a567ea806ad6a6f482268daa500",
  },
  {
    family: "brick",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "3010.dat",
    geometrySha256: "6ff5d750a9a04a2370e775a4b3f5c11a18be3debed0c20d9126527dee968c345",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "3003.dat",
    geometrySha256: "46e253c66bc6d5bf27e11f0a08ac5eff201af348bf740899d66932b3d6f8830f",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 3,
    ldrawId: "3002.dat",
    geometrySha256: "898d9dd1480a79fa31d7a0496914be617bb1403f120ed277157afdaa65aa0875",
  },
  {
    family: "brick",
    widthStuds: 2,
    lengthStuds: 4,
    ldrawId: "3001.dat",
    geometrySha256: "88746230fb2b29325e6f354de7e156518d06ff830c9b8aeb5e6924d57290d89f",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 1,
    ldrawId: "3024.dat",
    geometrySha256: "65dd02620be2ee764bfe73d70e534f153e3571277143ad79127ae5b02e7e3ec7",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3023.dat",
    geometrySha256: "d1eb6ba94059f974885b2018796fc50b21a8c235118bc30531c57677e4c7a1e7",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "3623.dat",
    geometrySha256: "42d926c8523caa697d4aca7d8c8d5683018684bd8e6b4e0c86596033eaa55a15",
  },
  {
    family: "plate",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "3710.dat",
    geometrySha256: "40f174c588b6526c124a22c5ebef957a61fb0d61e7cd0e3e17b48a48415682c8",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "3022.dat",
    geometrySha256: "8e1fb366cadda6fa313e55cb3a03f34f2beb9ec0f7cda93fcc1236d6f8b1369b",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 3,
    ldrawId: "3021.dat",
    geometrySha256: "7b8fc900f5fd3a5c50e3e9370c212268908886f45ae5e7102fd10d4ea26860bb",
  },
  {
    family: "plate",
    widthStuds: 2,
    lengthStuds: 4,
    ldrawId: "3020.dat",
    geometrySha256: "8441582d0bd475348b3abd48e282d412bea2fccee3a3317278af67022fa32714",
  },
] as const satisfies readonly PartBlueprint[];

const makeAliases = (displayName: string, ldrawId: `${number}.dat`): readonly CatalogAlias[] =>
  deepFreeze([
    {
      namespace: "human",
      value: displayName,
      qualifiedValue: `human:${displayName}`,
      provenance: PROJECT_CATALOG_PROVENANCE,
    },
    {
      namespace: "ldraw",
      value: ldrawId,
      qualifiedValue: `ldraw:${ldrawId}`,
      provenance: LDRAW_IDENTIFIER_PROVENANCE,
    },
  ]);

const makeGeometryDigestInput = (
  family: PartFamily,
  widthStuds: number,
  lengthStuds: number,
  heightLdu: number,
): string =>
  JSON.stringify({
    generatorId: "builtin:parametric-rectilinear-part/1",
    family,
    widthStuds,
    lengthStuds,
    heightLdu,
    studPitchLdu: STUD_PITCH_LDU,
    studRadiusLdu: STUD_RADIUS_LDU,
    studHeightLdu: STUD_HEIGHT_LDU,
    undersideMode: "semantic-tube-seat-grid",
  });

const makePart = (blueprint: PartBlueprint): PartDefinition => {
  const { family, widthStuds, lengthStuds } = blueprint;
  const heightLdu = family === "brick" ? BRICK_HEIGHT_LDU : PLATE_HEIGHT_LDU;
  const widthLdu = widthStuds * STUD_PITCH_LDU;
  const lengthLdu = lengthStuds * STUD_PITCH_LDU;
  const topY = -heightLdu / 2;
  const bottomY = heightLdu / 2;
  const displayName = `${family === "brick" ? "Brick" : "Plate"} ${widthStuds} x ${lengthStuds}`;
  const id = `builtin:${family}-${widthStuds}x${lengthStuds}`;
  const bodyBoundsLdu: LduBounds = {
    min: [-widthLdu / 2, topY, -lengthLdu / 2],
    max: [widthLdu / 2, bottomY, lengthLdu / 2],
  };
  const boundsLdu: LduBounds = {
    min: [-widthLdu / 2, topY - STUD_HEIGHT_LDU, -lengthLdu / 2],
    max: [widthLdu / 2, bottomY, lengthLdu / 2],
  };
  const connectors: ConnectorPortDefinition[] = [];
  const primitives: CollisionPrimitive[] = [
    {
      id: "body",
      kind: "box",
      tag: "body",
      minLdu: bodyBoundsLdu.min,
      maxLdu: bodyBoundsLdu.max,
    },
  ];
  const allowances: CollisionAllowance[] = [];

  for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
    for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
      const x = (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
      const z = (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;

      connectors.push(
        {
          id: `stud:${xIndex}:${zIndex}`,
          kind: "stud",
          geometryRole: "stud",
          profileId: CONNECTOR_TAXONOMY_VERSION,
          positionLdu: [x, topY, z],
          normal: [0, -1, 0],
          orientationId: "connector-up",
          capacity: 1,
          compatibleKinds: ["undersideClutch"],
        },
        {
          id: `undersideClutch:${xIndex}:${zIndex}`,
          kind: "undersideClutch",
          geometryRole: "tubeSeat",
          profileId: CONNECTOR_TAXONOMY_VERSION,
          positionLdu: [x, bottomY, z],
          normal: [0, 1, 0],
          orientationId: "connector-down",
          capacity: 1,
          compatibleKinds: ["stud"],
        },
      );
      primitives.push({
        id: `stud:${xIndex}:${zIndex}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [x, topY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        heightLdu: STUD_HEIGHT_LDU,
      });
      allowances.push({
        id: `tubeSeat:${xIndex}:${zIndex}`,
        portId: `undersideClutch:${xIndex}:${zIndex}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, bottomY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        maxInsertionDepthLdu: STUD_HEIGHT_LDU,
        requiresValidatedConnection: true,
      });
    }
  }

  return deepFreeze({
    id,
    family,
    displayName,
    aliases: makeAliases(displayName, blueprint.ldrawId),
    dimensions: { widthStuds, lengthStuds, widthLdu, lengthLdu, heightLdu },
    bodyBoundsLdu,
    boundsLdu,
    geometry: {
      generatorId: "builtin:parametric-rectilinear-part/1",
      digestInput: makeGeometryDigestInput(family, widthStuds, lengthStuds, heightLdu),
      contentHash: `sha256:${blueprint.geometrySha256}`,
      bodyMode: "rectangular-prism",
      studMode: "cylinder-grid",
      undersideMode: "semantic-tube-seat-grid",
      studRadiusLdu: STUD_RADIUS_LDU,
      studHeightLdu: STUD_HEIGHT_LDU,
      provenance: PROJECT_GEOMETRY_PROVENANCE,
    },
    connectors,
    legalOrientationIds: LEGAL_ORIENTATION_IDS,
    collision: { modelVersion: COLLISION_MODEL_VERSION, primitives, allowances },
    availableColorIds: AVAILABLE_COLOR_IDS,
    substitutionGroupId: `${family}:${widthStuds}x${lengthStuds}`,
    inventory: {
      availability: "builtin-unlimited",
      knownMassGrams: null,
      physicalAvailabilityClaimed: false,
    },
    provenance: PROJECT_CATALOG_PROVENANCE,
  });
};

export const PART_DEFINITIONS: readonly PartDefinition[] = deepFreeze(
  PART_BLUEPRINTS.map(makePart),
);

const normalizeLookupKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*x\s*/g, "x");

const partIdByLookupKey = new Map<string, string>();
for (const part of PART_DEFINITIONS) {
  partIdByLookupKey.set(normalizeLookupKey(part.id), part.id);
  for (const alias of part.aliases) {
    partIdByLookupKey.set(normalizeLookupKey(alias.value), part.id);
    partIdByLookupKey.set(normalizeLookupKey(alias.qualifiedValue), part.id);
  }
}

const partById = new Map(PART_DEFINITIONS.map((part) => [part.id, part] as const));

const colorById = new Map(COLOR_DEFINITIONS.map((color) => [color.id, color] as const));

export const resolvePartId = (idOrAlias: string): string | undefined =>
  partIdByLookupKey.get(normalizeLookupKey(idOrAlias));

export const getPartDefinition = (idOrAlias: string): PartDefinition | undefined => {
  const id = resolvePartId(idOrAlias);
  return id === undefined ? undefined : partById.get(id);
};

export const getColorDefinition = (id: string): ColorDefinition | undefined => colorById.get(id);

export const BUILTIN_CATALOG: CatalogSnapshotDigestInput = deepFreeze({
  schemaVersion: "catalog-digest-input/1",
  catalogVersion: BUILTIN_CATALOG_VERSION,
  connectorTaxonomyVersion: CONNECTOR_TAXONOMY_VERSION,
  collisionModelVersion: COLLISION_MODEL_VERSION,
  transformPolicyVersion: TRANSFORM_POLICY_VERSION,
  coordinateSystem: { upAxis: "-Y", unit: "LDU", studPitchLdu: STUD_PITCH_LDU },
  provenanceLayers: [
    PROJECT_CATALOG_PROVENANCE,
    PROJECT_GEOMETRY_PROVENANCE,
    PROJECT_COLOR_PROVENANCE,
    LDRAW_IDENTIFIER_PROVENANCE,
  ],
  orientations: UPRIGHT_ORIENTATIONS,
  colors: COLOR_DEFINITIONS,
  parts: PART_DEFINITIONS,
});

export const getCatalogSnapshotDigestInput = (): CatalogSnapshotDigestInput => BUILTIN_CATALOG;

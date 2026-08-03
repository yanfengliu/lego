import {
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  CONNECTOR_TAXONOMY_VERSION,
  LDRAW_IDENTIFIER_PROVENANCE,
  PROJECT_CATALOG_PROVENANCE,
  PROJECT_COLOR_PROVENANCE,
  PROJECT_GEOMETRY_PROVENANCE,
  PROJECT_PLAN_GEOMETRY_PROVENANCE,
  STUD_PITCH_LDU,
  TRANSFORM_POLICY_VERSION,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import type { CatalogSnapshotDigestInput, ColorDefinition, PartDefinition } from "./types.ts";

import { sampleBodyArcPlanBoundary } from "./arc-plan.ts";
import { COLOR_DEFINITIONS } from "./colors.ts";
import { deepFreeze } from "./freeze.ts";
import { PART_DEFINITIONS } from "./part-factory.ts";

export { sampleBodyArcPlanBoundary, COLOR_DEFINITIONS, PART_DEFINITIONS };

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
    PROJECT_PLAN_GEOMETRY_PROVENANCE,
    PROJECT_COLOR_PROVENANCE,
    LDRAW_IDENTIFIER_PROVENANCE,
  ],
  orientations: UPRIGHT_ORIENTATIONS,
  colors: COLOR_DEFINITIONS,
  parts: PART_DEFINITIONS,
});

export const getCatalogSnapshotDigestInput = (): CatalogSnapshotDigestInput => BUILTIN_CATALOG;

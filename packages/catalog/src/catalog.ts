import {
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  CONNECTOR_TAXONOMY_VERSION,
  LDCAD_SHADOW_CONNECTOR_PROVENANCE,
  LDRAW_BUNDLED_GEOMETRY_PROVENANCE,
  LDRAW_IDENTIFIER_PROVENANCE,
  MEASURED_PART_CATALOG_PROVENANCE,
  PROJECT_CATALOG_PROVENANCE,
  PROJECT_COLOR_PROVENANCE,
  PROJECT_GEOMETRY_PROVENANCE,
  PROJECT_PLAN_GEOMETRY_PROVENANCE,
  PROJECT_TRANSFORM_POLICY_PROVENANCE,
  PROPER_ORIENTATIONS,
  STUD_PITCH_LDU,
  TRANSFORM_POLICY_ID,
  TRANSFORM_POLICY_VERSION,
} from "./constants.ts";
import type {
  CatalogSnapshotDigestInput,
  ColorDefinition,
  PartDefinition,
  TransformPolicyManifest,
} from "./types.ts";

import { sampleBodyArcPlanBoundary } from "./arc-plan.ts";
import { COLOR_DEFINITIONS } from "./colors.ts";
import { deepFreeze } from "./freeze.ts";
import { validateMeshPartDefinitionAdmission } from "./mesh-admission.ts";
import { resolvePreloadedMeshAsset } from "./mesh-assets.ts";
import { PART_DEFINITIONS } from "./part-factory.ts";

export { sampleBodyArcPlanBoundary, COLOR_DEFINITIONS, PART_DEFINITIONS };

export class BuiltinCatalogMeshAdmissionError extends Error {
  readonly code = "BUILTIN_CATALOG_MESH_ADMISSION_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "BuiltinCatalogMeshAdmissionError";
  }
}

/**
 * Fail-closed production boundary. Tests may build synthetic resolvers, but a
 * part entering the built-in snapshot must resolve through the exact immutable
 * production registry and pass every mesh admission check during initialization.
 */
export function assertBuiltinCatalogMeshAdmissions(parts: readonly PartDefinition[]): void {
  for (const part of parts) {
    if (part.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") continue;
    const result = validateMeshPartDefinitionAdmission(part, resolvePreloadedMeshAsset);
    if (!result.accepted) {
      throw new BuiltinCatalogMeshAdmissionError(
        `Built-in catalog rejected mesh part ${part.id}: ${result.issues.map(({ code, message }) => `${code}: ${message}`).join("; ")}`,
      );
    }
  }
}

assertBuiltinCatalogMeshAdmissions(PART_DEFINITIONS);

const CATALOG_COORDINATE_SYSTEM = deepFreeze({
  upAxis: "-Y",
  unit: "LDU",
  studPitchLdu: STUD_PITCH_LDU,
} as const);

export const BUILTIN_TRANSFORM_POLICY_MANIFEST: TransformPolicyManifest = deepFreeze({
  schemaVersion: "lego.transform-policy-manifest/1",
  id: TRANSFORM_POLICY_ID,
  version: TRANSFORM_POLICY_VERSION,
  coordinateSystem: CATALOG_COORDINATE_SYSTEM,
  authority: "project-authored-catalog-truth",
  sourceAndProposalArtifactRole: "corroboration-only",
  provenance: PROJECT_TRANSFORM_POLICY_PROVENANCE,
  orientations: PROPER_ORIENTATIONS,
  parts: PART_DEFINITIONS.map(({ id, legalOrientationIds }) => ({ id, legalOrientationIds })),
});

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
  coordinateSystem: CATALOG_COORDINATE_SYSTEM,
  provenanceLayers: [
    PROJECT_CATALOG_PROVENANCE,
    PROJECT_GEOMETRY_PROVENANCE,
    PROJECT_PLAN_GEOMETRY_PROVENANCE,
    PROJECT_COLOR_PROVENANCE,
    LDRAW_IDENTIFIER_PROVENANCE,
    MEASURED_PART_CATALOG_PROVENANCE,
    LDRAW_BUNDLED_GEOMETRY_PROVENANCE,
    LDCAD_SHADOW_CONNECTOR_PROVENANCE,
    PROJECT_TRANSFORM_POLICY_PROVENANCE,
  ],
  orientations: PROPER_ORIENTATIONS,
  transformPolicy: BUILTIN_TRANSFORM_POLICY_MANIFEST,
  colors: COLOR_DEFINITIONS,
  parts: PART_DEFINITIONS,
});

export const getCatalogSnapshotDigestInput = (): CatalogSnapshotDigestInput => BUILTIN_CATALOG;

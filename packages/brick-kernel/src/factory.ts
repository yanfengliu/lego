import {
  BUILTIN_CATALOG_VERSION,
  COLLISION_MODEL_VERSION,
  COLOR_DEFINITIONS,
  CONNECTOR_TAXONOMY_VERSION,
  PART_DEFINITIONS,
  TRANSFORM_POLICY_VERSION,
  getCatalogSnapshotDigestInput,
} from "@lego-studio/catalog";
import type {
  BrickDocumentV1,
  PartInstance,
  RigidTransform,
  TruthSnapshot,
} from "@lego-studio/protocol";

import { canonicalDigest } from "./canonical.ts";
import { VALIDATOR_SET_DIGEST_INPUT, VALIDATOR_SET_VERSION } from "./truth-manifests.ts";

export const BRICK_DOCUMENT_SCHEMA_VERSION = "lego.brick-document/1" as const;
export const ROOT_SUBMODEL_ID = "root" as const;
export const INITIAL_STEP_ID = "step-1" as const;

export function getBuiltinTruthDigestInputs() {
  const catalog = getCatalogSnapshotDigestInput();
  return {
    catalog,
    connectorTaxonomy: {
      schemaVersion: "lego.connector-taxonomy-manifest/1",
      version: CONNECTOR_TAXONOMY_VERSION,
      coordinateSystem: catalog.coordinateSystem,
      parts: PART_DEFINITIONS.map(({ id, connectors }) => ({ id, connectors })),
    },
    collisionModel: {
      schemaVersion: "lego.collision-model-manifest/1",
      version: COLLISION_MODEL_VERSION,
      coordinateSystem: catalog.coordinateSystem,
      parts: PART_DEFINITIONS.map(({ id, collision }) => ({ id, collision })),
    },
    transformPolicy: {
      schemaVersion: "lego.transform-policy-manifest/1",
      version: TRANSFORM_POLICY_VERSION,
      coordinateSystem: catalog.coordinateSystem,
      orientations: catalog.orientations,
      parts: PART_DEFINITIONS.map(({ id, legalOrientationIds }) => ({ id, legalOrientationIds })),
    },
    validatorSet: VALIDATOR_SET_DIGEST_INPUT,
  } as const;
}

export function createBuiltinTruthSnapshot(): TruthSnapshot {
  const digestInputs = getBuiltinTruthDigestInputs();
  return {
    schemaVersion: "lego.truth-snapshot/1",
    catalog: {
      id: "builtin.basic-parts",
      version: BUILTIN_CATALOG_VERSION,
      hash: canonicalDigest(digestInputs.catalog),
    },
    connectorTaxonomy: {
      id: "stud-tube",
      version: CONNECTOR_TAXONOMY_VERSION,
      hash: canonicalDigest(digestInputs.connectorTaxonomy),
    },
    collisionModel: {
      id: "rectilinear-stud-clearance",
      version: COLLISION_MODEL_VERSION,
      hash: canonicalDigest(digestInputs.collisionModel),
    },
    transformPolicy: {
      id: "upright-quarter-turns-negative-y-up",
      version: TRANSFORM_POLICY_VERSION,
      hash: canonicalDigest(digestInputs.transformPolicy),
    },
    validatorSet: {
      id: "lego.kernel-validators",
      version: VALIDATOR_SET_VERSION,
      hash: canonicalDigest(digestInputs.validatorSet),
    },
  };
}

export interface CreateEmptyDocumentOptions {
  readonly id: string;
  readonly name: string;
  readonly revision?: string;
  readonly maxParts?: number;
}

export function createEmptyBrickDocument({
  id,
  name,
  revision = "revision-0",
  maxParts = 500,
}: CreateEmptyDocumentOptions): BrickDocumentV1 {
  return {
    schemaVersion: BRICK_DOCUMENT_SCHEMA_VERSION,
    id,
    revision,
    truth: createBuiltinTruthSnapshot(),
    name,
    parts: [],
    connections: [],
    submodels: [{ id: ROOT_SUBMODEL_ID, name: "Root", partIds: [] }],
    steps: [{ id: INITIAL_STEP_ID, index: 0, name: "Step 1", partIds: [] }],
    semanticRegions: [],
    constraints: {
      maxParts,
      allowedCatalogPartIds: PART_DEFINITIONS.map(({ id: partId }) => partId),
      allowedColorIds: COLOR_DEFINITIONS.map(({ id: colorId }) => colorId),
    },
    provenance: { origin: "manual" },
  };
}

export interface CreatePartInstanceOptions {
  readonly id: string;
  readonly catalogPartId?: string;
  readonly colorId?: string;
  readonly transform?: RigidTransform;
  readonly submodelId?: string;
  readonly stepId?: string;
  readonly semanticTags?: readonly string[];
  readonly source?: PartInstance["provenance"]["source"];
  readonly sourceId?: string;
}

export function createPartInstance({
  id,
  catalogPartId = "builtin:brick-1x1",
  colorId = "builtin:red",
  transform = { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
  submodelId = ROOT_SUBMODEL_ID,
  stepId = INITIAL_STEP_ID,
  semanticTags = [],
  source = "manual",
  sourceId,
}: CreatePartInstanceOptions): PartInstance {
  return {
    id,
    catalogPartId,
    colorId,
    transform,
    submodelId,
    stepId,
    semanticTags,
    provenance: sourceId === undefined ? { source } : { source, sourceId },
  };
}

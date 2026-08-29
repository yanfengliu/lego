import { CURRENT_PREFIX50_ACTION_PREPARATION_PINS } from "./part-identification-prefix50-action-preparation-source.mjs";

export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_SCHEMA =
  "lego.prefix50-official-world-reconciliation/2";
export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH =
  "output/real-build/prefix50-official-world-reconciliation.json";
export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY = Object.freeze({
  kind: "authority-absent-official-world-reconciliation",
  proposalOnly: true,
  exactOccurrenceIdentity: true,
  occurrenceScopedCatalogRebinding: true,
  occurrenceScopedIdentityMovedRoots: true,
  ldrawToCatalogFrameReconciled: true,
  firstEightConnectorTopologyMeasured: true,
  authenticated: false,
  sourceExecution: false,
  preparedRun: false,
  productionActionLedger: false,
  physicalFrameAuthority: false,
  assignmentAuthority: false,
  actionAuthority: false,
  documentLegality: false,
  connectionLegality: false,
  placement: false,
  documentMutation: false,
  replay: false,
  acceptedDocument: false,
  completion: false,
});

export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS = Object.freeze({
  proposal: Object.freeze({
    schemaVersion: "lego.prefix50-official-ldraw-world-proposal/2",
    bytes: 764_234,
    digest: "sha256:24c10640f118d2961dd297cff608b6978bd54eab85a37cf0c314f4711612f960",
  }),
  frameRegistry: Object.freeze({
    schemaVersion: "lego.prefix50-ldraw-catalog-frames/2",
    bytes: 330_415,
    digest: "sha256:bcf9702150b73cab1bd70d7ecd0bf33b3b3917522ce4f0ca892be56424b861a1",
  }),
  actionPreparation: Object.freeze({
    schemaVersion: "lego.real-build-action-preparation/1",
    ...CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact,
  }),
  catalogVersion: "builtin.basic-parts/29",
  expectedAccounting: Object.freeze({
    occurrenceRows: 320,
    reconciledRows: 320,
    quarantinedRows: 0,
    directRows: 309,
    multiBuildCopyRows: 11,
    reconciledDirectRows: 309,
    reconciledMultiBuildCopyRows: 11,
    quarantinedDirectRows: 0,
    uniqueBuilderBrickRefs: 320,
    uniqueXmlRows: 320,
    uniqueTopLevelLdrawRows: 320,
    halfLduRows: 3,
  }),
  expectedArtifact: Object.freeze({
    bytes: 651_618,
    digest: "sha256:4037ecb9cc60bc63bae38b963abeef8096d7405f2da80a40e79fe60fdff4092b",
  }),
});

export const PREFIX50_FIRST_EIGHT_EXPECTED_CONTACTS = Object.freeze([
  Object.freeze({ aOrdinal: 1, bOrdinal: 2, connectorPairs: 2 }),
  Object.freeze({ aOrdinal: 2, bOrdinal: 3, connectorPairs: 3 }),
  Object.freeze({ aOrdinal: 3, bOrdinal: 4, connectorPairs: 4 }),
  Object.freeze({ aOrdinal: 4, bOrdinal: 5, connectorPairs: 6 }),
  Object.freeze({ aOrdinal: 4, bOrdinal: 6, connectorPairs: 10 }),
  Object.freeze({ aOrdinal: 4, bOrdinal: 7, connectorPairs: 2 }),
  Object.freeze({ aOrdinal: 4, bOrdinal: 8, connectorPairs: 1 }),
]);

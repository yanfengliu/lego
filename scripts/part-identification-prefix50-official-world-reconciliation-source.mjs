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
    bytes: 765_179,
    digest: "sha256:1a1bf42979962969ae4389007680cc209e86addf6dc4e48b6ff7eb4fe699aaab",
  }),
  frameRegistry: Object.freeze({
    schemaVersion: "lego.prefix50-ldraw-catalog-frames/2",
    bytes: 330_074,
    digest: "sha256:c2722346da09a11623ccfb53d4b3341b874e150633876693d2a4347c3d14aa5f",
  }),
  actionPreparation: Object.freeze({
    schemaVersion: "lego.real-build-action-preparation/1",
    ...CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact,
  }),
  catalogVersion: "builtin.basic-parts/30",
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
    digest: "sha256:47d186212999081a715b8594d40f06fce31b5278d89a84cef8f364619073c756",
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

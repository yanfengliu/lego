import { CURRENT_PREFIX50_ACTION_PREPARATION_PINS } from "./part-identification-prefix50-action-preparation-source.mjs";

export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_SCHEMA =
  "lego.prefix50-official-world-reconciliation/1";
export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH =
  "output/real-build/prefix50-official-world-reconciliation.json";
export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export const PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY = Object.freeze({
  kind: "authority-absent-official-world-reconciliation",
  proposalOnly: true,
  exactOccurrenceIdentity: true,
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
    schemaVersion: "lego.prefix50-official-ldraw-world-proposal/1",
    bytes: 500_895,
    digest: "sha256:7b76ef27bbad99f9014fd6543b0fdb47c1fdcfd789d0d9629e16df54a4889da7",
  }),
  frameRegistry: Object.freeze({
    schemaVersion: "lego.prefix50-ldraw-catalog-frames/1",
    bytes: 98_383,
    digest: "sha256:16a76321d1cbd8bb1308dff9c58ee61507f67c0139b17aa50a5d8415c789e2f2",
  }),
  actionPreparation: Object.freeze({
    schemaVersion: "lego.real-build-action-preparation/1",
    ...CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact,
  }),
  catalogVersion: "builtin.basic-parts/28",
  expectedAccounting: Object.freeze({
    occurrenceRows: 320,
    reconciledRows: 309,
    quarantinedRows: 11,
    directRows: 309,
    multiBuildCopyRows: 11,
    reconciledDirectRows: 298,
    reconciledMultiBuildCopyRows: 11,
    quarantinedDirectRows: 11,
    uniqueBuilderBrickRefs: 320,
    uniqueXmlRows: 320,
    uniqueTopLevelLdrawRows: 320,
    halfLduRows: 3,
  }),
  expectedArtifact: Object.freeze({
    bytes: 408_269,
    digest: "sha256:63d5872f92d208755dae34ecab7bad31c23b9b4cdcfb4165bbbc3159d281156e",
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

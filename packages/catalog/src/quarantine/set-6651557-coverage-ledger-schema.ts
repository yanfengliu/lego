import { assertBoundedSet6651557CoverageMetadata } from "./set-6651557-coverage-ledger-bounds.ts";

const FORBIDDEN_AUTHORITY_OR_PAYLOAD_KEYS = new Set([
  "binaryBase64",
  "catalogDefinition",
  "collisionPrimitives",
  "connectivityPrimitives",
  "geometry",
  "mesh",
  "partDefinition",
  "payload",
  "rawBytes",
]);

const CONNECTOR_COUNT_KEYS = ["Axel", "Custom2DField", "Fixed", "Hinge", "Slider"];
const RECORD_BINDING_LITERALS = [
  ["sourceArtifactKey", "builderNativePack"],
  ["collection", "parts"],
  ["keyField", "id"],
  ["requireExactUniqueDesignIdSet", true],
  ["verifyWholeArtifactBeforeUse", true],
  ["recordDigestProtocol", "lego.builder-native-mesh-pack/1 recordSha256"],
  ["recomputeRecordDigest", true],
] as const;

const asRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
};

const asArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }
  return value;
};

const exactKeys = (
  value: unknown,
  expectedKeys: readonly string[],
  path: string,
): Record<string, unknown> => {
  const record = asRecord(value, path);
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    const unexpected = actual.filter((key) => !expected.includes(key));
    const missing = expected.filter((key) => !actual.includes(key));
    throw new Error(
      `${path} has a closed schema; unexpected keys [${unexpected.join(", ")}], missing keys [${missing.join(", ")}].`,
    );
  }
  return record;
};

const requireLiteral = (
  record: Readonly<Record<string, unknown>>,
  key: string,
  expected: string | boolean,
  path: string,
): void => {
  if (record[key] !== expected) {
    throw new Error(`${path}.${key} must be ${JSON.stringify(expected)}.`);
  }
};

const forbidAuthorityOrPayloadKeys = (value: unknown, path = "set6651557CoverageLedger"): void => {
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => forbidAuthorityOrPayloadKeys(child, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_AUTHORITY_OR_PAYLOAD_KEYS.has(key)) {
      throw new Error(`${path}.${key} is forbidden in source-inventory evidence.`);
    }
    forbidAuthorityOrPayloadKeys(child, `${path}.${key}`);
  }
};

const assertConnectorCounts = (value: unknown, path: string): void => {
  exactKeys(value, CONNECTOR_COUNT_KEYS, path);
};

const COMPONENT_LEAF_KEYS = [
  "designId",
  "revision",
  "itemId",
  "name",
  "manifestMd5",
  "bundleSha256",
  "bundleBytes",
  "primitiveXmlSha256",
  "shellCanonicalSha256",
  "shellVertexCount",
  "shellTriangleCount",
  "packedBinaryBytes",
  "collisionBoxCount",
  "connectorPrimitiveCounts",
  "state",
  "evidenceKind",
  "componentOnly",
  "catalogAdmissionAtBaseline",
  "sourceUrl",
];

const UNRESOLVED_LEAF_KEYS = [
  "designId",
  "revision",
  "expectedManifestMd5",
  "observedMd5",
  "observedBundleSha256",
  "observedBundleBytes",
  "state",
  "reason",
  "catalogAdmissionAtBaseline",
  "sourceUrl",
];

const assertComponentLeaf = (value: unknown, path: string): void => {
  const leaf = exactKeys(value, COMPONENT_LEAF_KEYS, path);
  requireLiteral(leaf, "state", "builder-source-integrity-verified", path);
  requireLiteral(leaf, "evidenceKind", "verified-component-bundle", path);
  requireLiteral(leaf, "componentOnly", true, path);
  requireLiteral(leaf, "catalogAdmissionAtBaseline", "unadmitted", path);
  assertConnectorCounts(leaf.connectorPrimitiveCounts, `${path}.connectorPrimitiveCounts`);
};

const assertUnresolvedLeaf = (value: unknown, path: string): void => {
  const leaf = exactKeys(value, UNRESOLVED_LEAF_KEYS, path);
  requireLiteral(leaf, "state", "unresolved-builder-integrity", path);
  requireLiteral(leaf, "reason", "manifest-checksum-mismatch", path);
  requireLiteral(leaf, "catalogAdmissionAtBaseline", "unadmitted", path);
};

const assertRequiredLeaf = (value: unknown, path: string): void => {
  const leaf = asRecord(value, path);
  if (leaf.state === "unresolved-builder-integrity") {
    assertUnresolvedLeaf(leaf, path);
    return;
  }
  if (leaf.evidenceKind === "verified-component-bundle") {
    assertComponentLeaf(leaf, path);
    return;
  }
  if (leaf.evidenceKind === "native-pack-record") {
    const nativeLeaf = exactKeys(
      leaf,
      [
        "designId",
        "state",
        "evidenceKind",
        "evidenceArtifactId",
        "recordKey",
        "recordSha256",
        "componentOnly",
        "catalogAdmissionAtBaseline",
      ],
      path,
    );
    requireLiteral(nativeLeaf, "state", "builder-source-integrity-verified", path);
    requireLiteral(nativeLeaf, "componentOnly", false, path);
    requireLiteral(nativeLeaf, "catalogAdmissionAtBaseline", "unadmitted", path);
    return;
  }
  throw new Error(`${path} must use a recognized closed leaf variant.`);
};

export const assertSet6651557CoverageLedgerShape = (value: unknown): void => {
  assertBoundedSet6651557CoverageMetadata(value);
  forbidAuthorityOrPayloadKeys(value);
  const root = exactKeys(
    value,
    [
      "schemaVersion",
      "authority",
      "set",
      "baselineCatalog",
      "sourceArtifacts",
      "nativePack",
      "compositeComponentLeaves",
      "unresolvedBuilderLeaves",
      "composites",
      "missingTopLevelRoutes",
      "requiredLeaves",
      "counts",
      "setDigests",
    ],
    "set6651557CoverageLedger",
  );
  requireLiteral(
    root,
    "schemaVersion",
    "lego.set-catalog-coverage-ledger/1",
    "set6651557CoverageLedger",
  );

  const authority = exactKeys(
    root.authority,
    [
      "kind",
      "catalogAdmitted",
      "structuralValidityClaimed",
      "physicalValidityClaimed",
      "compositeTransformsClaimed",
      "sourceIntegritySelfCertifiesCatalogTruth",
      "admissionRequirements",
      "rawPayloadPolicy",
    ],
    "set6651557CoverageLedger.authority",
  );
  requireLiteral(authority, "kind", "source-inventory-only", "set6651557CoverageLedger.authority");
  for (const key of [
    "catalogAdmitted",
    "structuralValidityClaimed",
    "physicalValidityClaimed",
    "compositeTransformsClaimed",
    "sourceIntegritySelfCertifiesCatalogTruth",
  ]) {
    requireLiteral(authority, key, false, "set6651557CoverageLedger.authority");
  }
  const rawPayloadPolicy = exactKeys(
    authority.rawPayloadPolicy,
    ["repository", "distributablePackage", "modelTraining", "runtimeFetch"],
    "set6651557CoverageLedger.authority.rawPayloadPolicy",
  );
  requireLiteral(
    rawPayloadPolicy,
    "repository",
    "excluded",
    "set6651557CoverageLedger.authority.rawPayloadPolicy",
  );
  requireLiteral(
    rawPayloadPolicy,
    "distributablePackage",
    "excluded",
    "set6651557CoverageLedger.authority.rawPayloadPolicy",
  );
  requireLiteral(
    rawPayloadPolicy,
    "modelTraining",
    "not-authorized",
    "set6651557CoverageLedger.authority.rawPayloadPolicy",
  );
  requireLiteral(
    rawPayloadPolicy,
    "runtimeFetch",
    "forbidden",
    "set6651557CoverageLedger.authority.rawPayloadPolicy",
  );
  const admissionRequirements = asArray(
    authority.admissionRequirements,
    "set6651557CoverageLedger.authority.admissionRequirements",
  );
  const expectedAdmissionRequirements = [
    "independent part identity and catalog-frame verification",
    "reviewed source-attributed geometry and project-owned catalog, connector, collision, and provenance declarations",
    "catalog version and migration report",
    "catalog digest/run-pin update and executable regression coverage",
  ];
  if (
    admissionRequirements.length !== expectedAdmissionRequirements.length ||
    admissionRequirements.some(
      (requirement, index) => requirement !== expectedAdmissionRequirements[index],
    )
  ) {
    throw new Error(
      "set6651557CoverageLedger.authority.admissionRequirements must equal the closed admission checklist.",
    );
  }

  exactKeys(
    root.set,
    [
      "instructionDocumentId",
      "modelSetId",
      "sourceTopLevelPieceCount",
      "separatorTopLevelPieceCount",
      "assembledTopLevelPieceCount",
      "sourceLeafPartInstanceCount",
      "assembledLeafPartInstanceCount",
      "topLevelDesignCount",
    ],
    "set6651557CoverageLedger.set",
  );
  exactKeys(
    root.baselineCatalog,
    [
      "version",
      "truthHash",
      "identityNormalization",
      "coveredTopLevelDesignCount",
      "coveredTopLevelDesignIds",
    ],
    "set6651557CoverageLedger.baselineCatalog",
  );

  const sourceArtifacts = exactKeys(
    root.sourceArtifacts,
    [
      "instructionBooklet",
      "officialModelXml",
      "officialModelLdr",
      "designDistribution",
      "elementResolution",
      "builderManifest",
      "builderCacheReport",
      "builderMissingAudit",
      "builderAllAudit",
      "builderNativePack",
    ],
    "set6651557CoverageLedger.sourceArtifacts",
  );
  for (const [key, artifact] of Object.entries(sourceArtifacts)) {
    exactKeys(
      artifact,
      ["logicalLocator", "bytes", "sha256", "role"],
      `set6651557CoverageLedger.sourceArtifacts.${key}`,
    );
  }

  const nativePack = exactKeys(
    root.nativePack,
    [
      "artifactId",
      "schemaVersion",
      "frameId",
      "sourceManifestSha256",
      "sourceAuditSha256",
      "sourceCacheReportSha256",
      "packDeclaredCoverageSha256",
      "packDeclaredCoverageBytesRetained",
      "partCount",
      "vertexCount",
      "triangleCount",
      "binaryBytes",
      "binarySha256",
      "collisionBoxCount",
      "connectorPrimitiveCounts",
      "recordBinding",
      "recordDigestManifestSha256",
      "recordDigests",
      "designIds",
    ],
    "set6651557CoverageLedger.nativePack",
  );
  assertConnectorCounts(
    nativePack.connectorPrimitiveCounts,
    "set6651557CoverageLedger.nativePack.connectorPrimitiveCounts",
  );
  const recordBinding = exactKeys(
    nativePack.recordBinding,
    [
      "sourceArtifactKey",
      "wholeArtifactSha256",
      "collection",
      "keyField",
      "requireExactUniqueDesignIdSet",
      "verifyWholeArtifactBeforeUse",
      "recordDigestProtocol",
      "recomputeRecordDigest",
    ],
    "set6651557CoverageLedger.nativePack.recordBinding",
  );
  for (const [key, expected] of RECORD_BINDING_LITERALS) {
    requireLiteral(
      recordBinding,
      key,
      expected,
      "set6651557CoverageLedger.nativePack.recordBinding",
    );
  }
  asArray(nativePack.recordDigests, "set6651557CoverageLedger.nativePack.recordDigests").forEach(
    (record, index) =>
      exactKeys(
        record,
        ["designId", "recordSha256"],
        `set6651557CoverageLedger.nativePack.recordDigests[${index}]`,
      ),
  );

  asArray(
    root.compositeComponentLeaves,
    "set6651557CoverageLedger.compositeComponentLeaves",
  ).forEach((leaf, index) =>
    assertComponentLeaf(leaf, `set6651557CoverageLedger.compositeComponentLeaves[${index}]`),
  );
  asArray(root.unresolvedBuilderLeaves, "set6651557CoverageLedger.unresolvedBuilderLeaves").forEach(
    (leaf, index) =>
      assertUnresolvedLeaf(leaf, `set6651557CoverageLedger.unresolvedBuilderLeaves[${index}]`),
  );

  asArray(root.composites, "set6651557CoverageLedger.composites").forEach((composite, index) => {
    const path = `set6651557CoverageLedger.composites[${index}]`;
    const record = exactKeys(
      composite,
      [
        "topLevelDesignId",
        "sourceDesignId",
        "topLevelOccurrenceCount",
        "sourceLeafInstanceCount",
        "elementId",
        "publishedPartNum",
        "publishedName",
        "state",
        "catalogAdmissionAtBaseline",
        "scope",
        "membershipEvidenceArtifactKey",
        "elementIdentityEvidenceArtifactKey",
        "sourceParentBrickUuid",
        "membershipSha256",
        "components",
      ],
      path,
    );
    requireLiteral(record, "state", "composite-source-identified", path);
    requireLiteral(record, "catalogAdmissionAtBaseline", "unadmitted", path);
    asArray(record.components, `${path}.components`).forEach((component, componentIndex) =>
      exactKeys(
        component,
        ["designId", "revision", "quantity"],
        `${path}.components[${componentIndex}]`,
      ),
    );
  });

  asArray(root.missingTopLevelRoutes, "set6651557CoverageLedger.missingTopLevelRoutes").forEach(
    (route, index) => {
      const path = `set6651557CoverageLedger.missingTopLevelRoutes[${index}]`;
      const record = asRecord(route, path);
      if (
        record.route !== "direct-native-pack-leaf" &&
        record.route !== "direct-unresolved-leaf" &&
        record.route !== "composite"
      ) {
        throw new Error(`${path}.route must be a recognized closed route variant.`);
      }
      exactKeys(
        record,
        record.route === "composite"
          ? ["designId", "route", "compositeId"]
          : ["designId", "route", "leafDesignId"],
        path,
      );
    },
  );
  asArray(root.requiredLeaves, "set6651557CoverageLedger.requiredLeaves").forEach((leaf, index) =>
    assertRequiredLeaf(leaf, `set6651557CoverageLedger.requiredLeaves[${index}]`),
  );

  const counts = exactKeys(
    root.counts,
    [
      "missingTopLevelDesigns",
      "directNativePackLeaves",
      "compositeComponentDesigns",
      "sourceIntegrityVerifiedLeaves",
      "unresolvedBuilderLeaves",
      "requiredNewLeafDesigns",
      "compositeComponentInstances",
      "sourceIntegrityBoundRawVertexCount",
      "sourceIntegrityBoundRawTriangleCount",
      "sourceIntegrityBoundPackedBinaryBytes",
      "sourceIntegrityBoundRawCollisionBoxCount",
      "sourceIntegrityBoundRawConnectorPrimitiveCounts",
    ],
    "set6651557CoverageLedger.counts",
  );
  assertConnectorCounts(
    counts.sourceIntegrityBoundRawConnectorPrimitiveCounts,
    "set6651557CoverageLedger.counts.sourceIntegrityBoundRawConnectorPrimitiveCounts",
  );
  exactKeys(
    root.setDigests,
    [
      "algorithm",
      "coveredTopLevel54",
      "topLevel172",
      "nativePack107",
      "unresolved10",
      "compositeComponents4",
      "missingTopLevel118",
      "requiredLeaves121",
    ],
    "set6651557CoverageLedger.setDigests",
  );
};

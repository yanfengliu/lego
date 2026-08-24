import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import * as publicCatalog from "../index.js";
import { SET_6651557_COVERAGE_LEDGER as ledger } from "./set-6651557-coverage-ledger.js";
import { assertSet6651557CoverageLedgerShape } from "./set-6651557-coverage-ledger-schema.js";

const sha256IdSet = (ids: readonly string[]): string =>
  `sha256:${bytesToHex(sha256(utf8ToBytes(JSON.stringify([...ids].sort()))))}`;

const sha256Json = (value: unknown): string =>
  `sha256:${bytesToHex(sha256(utf8ToBytes(JSON.stringify(value))))}`;

const unique = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;

const sortedNumerically = (ids: readonly string[]): readonly string[] =>
  [...ids].sort((left, right) => Number(left) - Number(right));

const expectDeepFrozen = (value: unknown, seen = new WeakSet<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeepFrozen(child, seen);
  }
};

const sumConnectorCounts = (
  entries: readonly {
    readonly connectorPrimitiveCounts: Readonly<Record<string, number>>;
  }[],
): Readonly<Record<string, number>> => {
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    for (const [kind, count] of Object.entries(entry.connectorPrimitiveCounts)) {
      totals[kind] = (totals[kind] ?? 0) + count;
    }
  }
  return totals;
};

describe("set 6651557 quarantined coverage ledger", () => {
  it("is a closed, immutable source-inventory contract outside the public catalog", () => {
    expect(Object.keys(ledger)).toEqual([
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
    ]);
    expect(ledger.schemaVersion).toBe("lego.set-catalog-coverage-ledger/1");
    expect(ledger.authority).toMatchObject({
      kind: "source-inventory-only",
      catalogAdmitted: false,
      structuralValidityClaimed: false,
      physicalValidityClaimed: false,
      compositeTransformsClaimed: false,
      sourceIntegritySelfCertifiesCatalogTruth: false,
    });
    expect(ledger.authority.rawPayloadPolicy).toEqual({
      repository: "excluded",
      distributablePackage: "excluded",
      modelTraining: "not-authorized",
      runtimeFetch: "forbidden",
    });
    expect("SET_6651557_COVERAGE_LEDGER" in publicCatalog).toBe(false);
    expectDeepFrozen(ledger);
  });

  it("pins the exact official inventory and baseline catalog boundary", () => {
    expect(ledger.set).toEqual({
      instructionDocumentId: "6651557",
      modelSetId: "21066",
      sourceTopLevelPieceCount: 1_465,
      separatorTopLevelPieceCount: 1,
      assembledTopLevelPieceCount: 1_464,
      sourceLeafPartInstanceCount: 1_469,
      assembledLeafPartInstanceCount: 1_468,
      topLevelDesignCount: 172,
    });
    expect(ledger.baselineCatalog.version).toBe("builtin.basic-parts/6");
    expect(ledger.baselineCatalog.truthHash).toBe(
      "sha256:590a94c9b9498faace4b29b74c4c9ba8352d644365585d9aeb96b4a7c53bdb7f",
    );
    expect(ledger.baselineCatalog.identityNormalization).toBe(
      "numeric LDraw design ID after removing the optional trailing variant letter before .dat",
    );
    const covered = ledger.baselineCatalog.coveredTopLevelDesignIds;
    const missing = ledger.missingTopLevelRoutes.map(({ designId }) => designId);
    expect(covered).toHaveLength(54);
    expect(missing).toHaveLength(118);
    expect(unique(covered)).toBe(true);
    expect(unique(missing)).toBe(true);
    expect(new Set([...covered, ...missing])).toHaveLength(172);
    expect(covered.filter((designId) => missing.includes(designId))).toEqual([]);
    expect(covered).toEqual(sortedNumerically(covered));
    expect(missing).toEqual(sortedNumerically(missing));
    expect(sha256IdSet(covered)).toBe(ledger.setDigests.coveredTopLevel54);
    expect(sha256IdSet(missing)).toBe(ledger.setDigests.missingTopLevel118);
    expect(sha256IdSet([...covered, ...missing])).toBe(ledger.setDigests.topLevel172);
  });

  it("partitions all 118 missing top-level designs without treating the composite as a leaf", () => {
    const nativeRoutes = ledger.missingTopLevelRoutes.filter(
      ({ route }) => route === "direct-native-pack-leaf",
    );
    const unresolvedRoutes = ledger.missingTopLevelRoutes.filter(
      ({ route }) => route === "direct-unresolved-leaf",
    );
    const compositeRoutes = ledger.missingTopLevelRoutes.filter(
      ({ route }) => route === "composite",
    );

    expect(nativeRoutes).toHaveLength(107);
    expect(unresolvedRoutes).toHaveLength(10);
    expect(compositeRoutes).toEqual([
      { designId: "76382", route: "composite", compositeId: "76382;AO" },
    ]);
    expect(nativeRoutes.map(({ designId }) => designId)).toEqual(ledger.nativePack.designIds);
    expect(unresolvedRoutes.map(({ designId }) => designId)).toEqual(
      ledger.unresolvedBuilderLeaves.map(({ designId }) => designId),
    );
    expect(ledger.requiredLeaves.some(({ designId }) => designId === "76382")).toBe(false);
  });

  it("pins exactly 121 distinct leaf designs with only source-integrity authority", () => {
    const leaves = ledger.requiredLeaves;
    const leafIds = leaves.map(({ designId }) => designId);
    const verified = leaves.filter(({ state }) => state === "builder-source-integrity-verified");
    const unresolved = leaves.filter(({ state }) => state === "unresolved-builder-integrity");
    const componentOnly = ledger.compositeComponentLeaves;

    expect(leaves).toHaveLength(121);
    expect(unique(leafIds)).toBe(true);
    expect(leafIds).toEqual(sortedNumerically(leafIds));
    expect(verified).toHaveLength(111);
    expect(unresolved).toHaveLength(10);
    expect(componentOnly.map(({ designId }) => designId)).toEqual(["3814", "3818", "3819", "3820"]);
    expect(
      leaves.every(({ catalogAdmissionAtBaseline }) => catalogAdmissionAtBaseline === "unadmitted"),
    ).toBe(true);
    expect(sha256IdSet(leafIds)).toBe(ledger.setDigests.requiredLeaves121);
    expect(sha256IdSet(ledger.nativePack.designIds)).toBe(ledger.setDigests.nativePack107);
    expect(sha256IdSet(unresolved.map(({ designId }) => designId))).toBe(
      ledger.setDigests.unresolved10,
    );
    expect(sha256IdSet(componentOnly.map(({ designId }) => designId))).toBe(
      ledger.setDigests.compositeComponents4,
    );
  });

  it("measures thirteen current catalog admissions without rewriting the frozen /6 baseline", () => {
    const requiredLeafIds = new Set(ledger.requiredLeaves.map(({ designId }) => designId));
    const currentCatalogDesignIds = new Set<string>();

    for (const part of publicCatalog.PART_DEFINITIONS) {
      for (const alias of part.aliases) {
        if (alias.namespace !== "ldraw") continue;
        const match = /^(\d+)[a-z]?\.dat$/iu.exec(alias.value);
        if (match?.[1] !== undefined) currentCatalogDesignIds.add(match[1]);
      }
    }

    const admittedRequiredLeafIds = sortedNumerically(
      [...currentCatalogDesignIds].filter((designId) => requiredLeafIds.has(designId)),
    );

    expect(ledger.baselineCatalog.version).toBe("builtin.basic-parts/6");
    expect(
      ledger.requiredLeaves.every(
        ({ catalogAdmissionAtBaseline }) => catalogAdmissionAtBaseline === "unadmitted",
      ),
    ).toBe(true);
    expect(ledger.requiredLeaves).toHaveLength(121);
    expect(admittedRequiredLeafIds).toHaveLength(13);
    expect(admittedRequiredLeafIds).toEqual([
      "2450",
      "5092",
      "11253",
      "15254",
      "25269",
      "30357",
      "35480",
      "35787",
      "41682",
      "51739",
      "77844",
      "79491",
      "93273",
    ]);
    expect(sha256IdSet(admittedRequiredLeafIds)).toBe(
      "sha256:e5f3931d7bc1908df68dcae51df9c044bef6e8a72a216abbe3df6aa087706452",
    );
  });

  it("retains the 76382 component multiset while refusing to claim relative transforms", () => {
    expect(ledger.composites).toEqual([
      {
        topLevelDesignId: "76382",
        sourceDesignId: "76382;AO",
        topLevelOccurrenceCount: 1,
        sourceLeafInstanceCount: 5,
        elementId: "6313021",
        publishedPartNum: "973c27h27",
        publishedName: "Torso, White Arms and Hands [Plain]",
        state: "composite-source-identified",
        catalogAdmissionAtBaseline: "unadmitted",
        scope: "coverage membership only; relative catalog transforms are not claimed",
        membershipEvidenceArtifactKey: "officialModelXml",
        elementIdentityEvidenceArtifactKey: "elementResolution",
        sourceParentBrickUuid: "2d36f089-87da-44d0-b2c6-85a3bcd459b8",
        membershipSha256: "sha256:4c4203739e250eaecca3b065885834bb155853f24a5da595a8eca9192fadb2fd",
        components: [
          { designId: "3814", revision: "X", quantity: 1 },
          { designId: "3818", revision: "P", quantity: 1 },
          { designId: "3819", revision: "R", quantity: 1 },
          { designId: "3820", revision: "G", quantity: 2 },
        ],
      },
    ]);
    expect(ledger.composites[0]?.components.reduce((sum, { quantity }) => sum + quantity, 0)).toBe(
      5,
    );
    expect(sha256Json(ledger.composites[0]?.components)).toBe(
      ledger.composites[0]?.membershipSha256,
    );
    expect(ledger.counts.compositeComponentInstances).toBe(5);
  });

  it("binds the external precursor pack and four separately verified component bundles", () => {
    expect(ledger.nativePack).toMatchObject({
      schemaVersion: "lego.builder-native-mesh-pack/1",
      frameId: "lego-builder-native-to-catalog-ldu/1",
      partCount: 107,
      vertexCount: 42_440,
      triangleCount: 38_549,
      binaryBytes: 971_868,
      binarySha256: "sha256:76830eb4832492e5416ad6920ab4f8167b6cf55725641cce162ac8f9f215b6c7",
      collisionBoxCount: 1_471,
      connectorPrimitiveCounts: {
        Axel: 80,
        Custom2DField: 239,
        Fixed: 19,
        Hinge: 9,
        Slider: 31,
      },
    });
    expect(ledger.nativePack.designIds).toHaveLength(ledger.nativePack.partCount);
    expect(ledger.nativePack.recordBinding).toEqual({
      sourceArtifactKey: "builderNativePack",
      wholeArtifactSha256:
        "sha256:e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d",
      collection: "parts",
      keyField: "id",
      requireExactUniqueDesignIdSet: true,
      verifyWholeArtifactBeforeUse: true,
      recordDigestProtocol: "lego.builder-native-mesh-pack/1 recordSha256",
      recomputeRecordDigest: true,
    });
    expect(ledger.nativePack.recordBinding.wholeArtifactSha256).toBe(
      ledger.sourceArtifacts[ledger.nativePack.recordBinding.sourceArtifactKey].sha256,
    );
    expect(ledger.nativePack.recordDigests.map(({ designId }) => designId)).toEqual(
      ledger.nativePack.designIds,
    );
    expect(sha256Json(ledger.nativePack.recordDigests)).toBe(
      ledger.nativePack.recordDigestManifestSha256,
    );
    const leafByDesignId = new Map(
      ledger.requiredLeaves.map((leaf) => [leaf.designId, leaf] as const),
    );
    for (const record of ledger.nativePack.recordDigests) {
      expect(record.recordSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(leafByDesignId.get(record.designId)).toMatchObject({
        designId: record.designId,
        evidenceArtifactId: ledger.nativePack.artifactId,
        recordKey: record.designId,
        recordSha256: record.recordSha256,
      });
    }
    expect(ledger.nativePack.vertexCount * 12 + ledger.nativePack.triangleCount * 12).toBe(
      ledger.nativePack.binaryBytes,
    );

    const components = ledger.compositeComponentLeaves;
    expect(components.reduce((sum, leaf) => sum + leaf.shellVertexCount, 0)).toBe(2_214);
    expect(components.reduce((sum, leaf) => sum + leaf.shellTriangleCount, 0)).toBe(2_380);
    expect(components.reduce((sum, leaf) => sum + leaf.packedBinaryBytes, 0)).toBe(55_128);
    expect(components.reduce((sum, leaf) => sum + leaf.collisionBoxCount, 0)).toBe(24);
    expect(sumConnectorCounts(components)).toEqual({
      Axel: 2,
      Custom2DField: 4,
      Fixed: 4,
      Hinge: 9,
      Slider: 1,
    });
    for (const component of components) {
      expect(component.sourceUrl).toBe(
        `https://api.prod.dbix.i.lego.com/api/v1/Bricks/${component.designId}?Revision=${component.revision}&Platform=Android`,
      );
      expect(component.manifestMd5).toMatch(/^[0-9a-f]{32}$/);
      expect(component.bundleSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(component.primitiveXmlSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(component.shellCanonicalSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("keeps every checksum mismatch unresolved and strips catalog claims from observed bytes", () => {
    expect(ledger.unresolvedBuilderLeaves.map(({ designId }) => designId)).toEqual([
      "2450",
      "3245",
      "4569",
      "7126",
      "30357",
      "41682",
      "44237",
      "79491",
      "93888",
      "99563",
    ]);
    for (const leaf of ledger.unresolvedBuilderLeaves) {
      expect(leaf.state).toBe("unresolved-builder-integrity");
      expect(leaf.reason).toBe("manifest-checksum-mismatch");
      expect(leaf.expectedManifestMd5).toMatch(/^[0-9a-f]{32}$/);
      expect(leaf.observedMd5).toMatch(/^[0-9a-f]{32}$/);
      expect(leaf.expectedManifestMd5).not.toBe(leaf.observedMd5);
      expect(leaf.observedBundleSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(leaf.observedBundleBytes).toBeGreaterThan(0);
      expect(leaf.sourceUrl).toBe(
        `https://api.prod.dbix.i.lego.com/api/v1/Bricks/${leaf.designId}?Revision=${leaf.revision}&Platform=Android`,
      );
      expect("recordSha256" in leaf).toBe(false);
      expect("geometry" in leaf).toBe(false);
      expect("partDefinition" in leaf).toBe(false);
    }
  });

  it("reconciles native and component aggregate measurements exactly", () => {
    const components = ledger.compositeComponentLeaves;
    const componentConnectors = sumConnectorCounts(components);
    const combinedConnectors = Object.fromEntries(
      Object.entries(ledger.nativePack.connectorPrimitiveCounts).map(([kind, count]) => [
        kind,
        count + (componentConnectors[kind] ?? 0),
      ]),
    );
    const componentInstances = ledger.composites[0]?.components.reduce(
      (sum, { quantity }) => sum + quantity,
      0,
    );
    const compositeExpansion = ledger.composites.reduce(
      (sum, composite) =>
        sum + composite.topLevelOccurrenceCount * (composite.sourceLeafInstanceCount - 1),
      0,
    );

    expect(ledger.counts.missingTopLevelDesigns).toBe(ledger.missingTopLevelRoutes.length);
    expect(ledger.counts.directNativePackLeaves).toBe(
      ledger.missingTopLevelRoutes.filter(({ route }) => route === "direct-native-pack-leaf")
        .length,
    );
    expect(ledger.counts.compositeComponentDesigns).toBe(components.length);
    expect(ledger.counts.sourceIntegrityVerifiedLeaves).toBe(
      ledger.requiredLeaves.filter(({ state }) => state === "builder-source-integrity-verified")
        .length,
    );
    expect(ledger.counts.unresolvedBuilderLeaves).toBe(ledger.unresolvedBuilderLeaves.length);
    expect(ledger.counts.requiredNewLeafDesigns).toBe(ledger.requiredLeaves.length);
    expect(ledger.counts.compositeComponentInstances).toBe(componentInstances);
    expect(ledger.counts.sourceIntegrityBoundRawVertexCount).toBe(
      ledger.nativePack.vertexCount +
        components.reduce((sum, leaf) => sum + leaf.shellVertexCount, 0),
    );
    expect(ledger.counts.sourceIntegrityBoundRawTriangleCount).toBe(
      ledger.nativePack.triangleCount +
        components.reduce((sum, leaf) => sum + leaf.shellTriangleCount, 0),
    );
    expect(ledger.counts.sourceIntegrityBoundPackedBinaryBytes).toBe(
      ledger.nativePack.binaryBytes +
        components.reduce((sum, leaf) => sum + leaf.packedBinaryBytes, 0),
    );
    expect(ledger.counts.sourceIntegrityBoundRawCollisionBoxCount).toBe(
      ledger.nativePack.collisionBoxCount +
        components.reduce((sum, leaf) => sum + leaf.collisionBoxCount, 0),
    );
    expect(ledger.counts.sourceIntegrityBoundRawConnectorPrimitiveCounts).toEqual(
      combinedConnectors,
    );
    expect(
      ledger.counts.sourceIntegrityBoundRawVertexCount * 12 +
        ledger.counts.sourceIntegrityBoundRawTriangleCount * 12,
    ).toBe(ledger.counts.sourceIntegrityBoundPackedBinaryBytes);
    expect(ledger.set.sourceTopLevelPieceCount + compositeExpansion).toBe(
      ledger.set.sourceLeafPartInstanceCount,
    );
    expect(ledger.set.assembledTopLevelPieceCount + compositeExpansion).toBe(
      ledger.set.assembledLeafPartInstanceCount,
    );
  });

  it("rejects unknown, raw-payload, and catalog-authority fields in every closed variant", () => {
    expect(() => assertSet6651557CoverageLedgerShape(ledger)).not.toThrow();

    const packInjection = structuredClone(ledger) as unknown as {
      nativePack: Record<string, unknown>;
    };
    packInjection.nativePack.payload = { bytes: "forbidden" };
    expect(() => assertSet6651557CoverageLedgerShape(packInjection)).toThrow(
      /payload is forbidden/,
    );

    const leafInjection = structuredClone(ledger) as unknown as {
      requiredLeaves: Record<string, unknown>[];
    };
    leafInjection.requiredLeaves[0]!.partDefinition = {};
    expect(() => assertSet6651557CoverageLedgerShape(leafInjection)).toThrow(
      /partDefinition is forbidden/,
    );

    const unresolvedInjection = structuredClone(ledger) as unknown as {
      unresolvedBuilderLeaves: Record<string, unknown>[];
    };
    unresolvedInjection.unresolvedBuilderLeaves[0]!.recordSha256 = `sha256:${"0".repeat(64)}`;
    expect(() => assertSet6651557CoverageLedgerShape(unresolvedInjection)).toThrow(/closed schema/);

    const routeInjection = structuredClone(ledger) as unknown as {
      missingTopLevelRoutes: Record<string, unknown>[];
    };
    routeInjection.missingTopLevelRoutes[0]!.catalogAdmitted = true;
    expect(() => assertSet6651557CoverageLedgerShape(routeInjection)).toThrow(/closed schema/);

    const authorityFlip = structuredClone(ledger) as unknown as {
      authority: Record<string, unknown>;
    };
    authorityFlip.authority.structuralValidityClaimed = true;
    expect(() => assertSet6651557CoverageLedgerShape(authorityFlip)).toThrow(
      /structuralValidityClaimed must be false/,
    );

    const routeFlip = structuredClone(ledger) as unknown as {
      missingTopLevelRoutes: Record<string, unknown>[];
    };
    routeFlip.missingTopLevelRoutes[0]!.route = "catalog-admitted";
    expect(() => assertSet6651557CoverageLedgerShape(routeFlip)).toThrow(
      /recognized closed route variant/,
    );

    const admissionFlip = structuredClone(ledger) as unknown as {
      authority: { admissionRequirements: string[] };
    };
    admissionFlip.authority.admissionRequirements[0] = "waive independent catalog review";
    expect(() => assertSet6651557CoverageLedgerShape(admissionFlip)).toThrow(
      /closed admission checklist/,
    );

    const recordBindingFlip = structuredClone(ledger) as unknown as {
      nativePack: { recordBinding: { collection: string } };
    };
    recordBindingFlip.nativePack.recordBinding.collection = "records";
    expect(() => assertSet6651557CoverageLedgerShape(recordBindingFlip)).toThrow(
      /collection must be "parts"/,
    );

    const chunkedPayloadInjection = structuredClone(ledger) as unknown as {
      authority: { admissionRequirements: string[] };
    };
    chunkedPayloadInjection.authority.admissionRequirements = ["A".repeat(200), "B".repeat(200)];
    expect(() => assertSet6651557CoverageLedgerShape(chunkedPayloadInjection)).toThrow(
      /encoded source payload/,
    );

    const oversizedStringInjection = structuredClone(ledger) as unknown as {
      sourceArtifacts: { instructionBooklet: { role: string } };
    };
    oversizedStringInjection.sourceArtifacts.instructionBooklet.role = "metadata ".repeat(300);
    expect(() => assertSet6651557CoverageLedgerShape(oversizedStringInjection)).toThrow(
      /metadata string limit/,
    );

    const multibyteStringInjection = structuredClone(ledger) as unknown as {
      sourceArtifacts: { instructionBooklet: { role: string } };
    };
    multibyteStringInjection.sourceArtifacts.instructionBooklet.role = "é".repeat(129);
    expect(() => assertSet6651557CoverageLedgerShape(multibyteStringInjection)).toThrow(
      /256 UTF-8 bytes/,
    );

    const oversizedContainerInjection = structuredClone(ledger) as unknown as {
      requiredLeaves: unknown[];
    };
    oversizedContainerInjection.requiredLeaves = Array.from({ length: 257 }, () => ({}));
    expect(() => assertSet6651557CoverageLedgerShape(oversizedContainerInjection)).toThrow(
      /metadata array limit/,
    );
  });

  it("commits only bounded metadata, never raw source payloads or machine-local paths", () => {
    const serialized = JSON.stringify(ledger);
    expect(utf8ToBytes(serialized).length).toBeLessThan(100_000);
    expect(serialized).not.toContain("C:\\\\tmp");
    expect(serialized).not.toContain(["binary", "Base64"].join(""));
    expect(serialized).not.toContain("collisionPrimitives");
    expect(serialized).not.toContain("connectivityPrimitives");
    expect(serialized).not.toContain(["<LX", "FML"].join(""));
    expect(serialized).not.toContain("data:application");
    for (const artifact of Object.values(ledger.sourceArtifacts)) {
      expect(artifact.bytes).toBeGreaterThan(0);
      expect(artifact.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });
});

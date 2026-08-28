import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  openExactLdrawArchive,
  expandExactLdrawPart,
} from "./part-identification-prefix50-ldraw-catalog-frames-archive.mjs";
import { deriveExactParametricLdrawCatalogFrame } from "./part-identification-prefix50-ldraw-catalog-frames-geometry.mjs";
import {
  assertNewExpectation,
  catalogLdrawFilename,
  exactAliasGroups,
  meshFrame,
} from "./part-identification-prefix50-ldraw-catalog-frames-catalog.mjs";
import {
  PREFIX50_LDRAW_CATALOG_FRAMES_AUTHORITY,
  PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS,
  PREFIX50_LDRAW_CATALOG_FRAMES_SCHEMA,
  PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS,
} from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";
import {
  bytesFromVerifiedPrefix50OfficialLdrawWorldProposal,
  inspectVerifiedPrefix50OfficialLdrawWorldProposal,
  isVerifiedPrefix50OfficialLdrawWorldProposal,
} from "./part-identification-prefix50-official-ldraw-world-proposal.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const COMPILE_KEYS = ["builderGeometryBytes", "officialArchiveBytes", "officialWorldProposal"];
const VERIFY_KEYS = [...COMPILE_KEYS, "artifactBytes"].sort();
const CATALOG_URL = new URL("../packages/catalog/src/index.ts", import.meta.url).href;
const CANONICAL_URL = new URL("../packages/brick-kernel/src/canonical.ts", import.meta.url).href;
const FACTORY_URL = new URL("../packages/brick-kernel/src/factory.ts", import.meta.url).href;
const SYMMETRY_URL = new URL(
  "../apps/web/e2e/real-build-builder-frame-geometry.ts",
  import.meta.url,
).href;
const BUILDER_SOURCES_URL = new URL(
  "../apps/web/e2e/real-build-builder-sources.ts",
  import.meta.url,
).href;
const BUILDER_FRAME_URL = new URL(
  "../apps/web/e2e/real-build-builder-ldraw-frame-contract.ts",
  import.meta.url,
).href;

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPrefix50OfficialLdrawWorldProposal(roles.officialWorldProposal)) {
    throw new TypeError(
      `${label}.officialWorldProposal must be the opaque current verifier result. Parsed JSON and caller-shaped tokens cannot publish catalog frames.`,
    );
  }
  return {
    officialWorldProposal: roles.officialWorldProposal,
    builderGeometryBytes: snapshotBoundedUint8Array(roles.builderGeometryBytes, {
      label: "Builder/LDraw geometry-proof bundle bytes",
      minimumBytes: 1,
      maximumBytes: 2 * 1024 * 1024,
    }),
    officialArchiveBytes: snapshotBoundedUint8Array(roles.officialArchiveBytes, {
      label: "Official LDraw archive bytes",
      minimumBytes: 1,
      maximumBytes: 150 * 1024 * 1024,
    }),
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: snapshotBoundedUint8Array(roles.artifactBytes, {
            label: "Prefix-50 LDraw/catalog frame artifact bytes",
            minimumBytes: 1,
            maximumBytes: PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
          }),
        }
      : {}),
  };
}

function requirePin(bytes, pin, label) {
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  return digest;
}

async function compileSnapshot(input) {
  const pins = PREFIX50_LDRAW_CATALOG_FRAMES_PINS;
  const proposalInspection = inspectVerifiedPrefix50OfficialLdrawWorldProposal(
    input.officialWorldProposal,
  );
  const proposalBytes = bytesFromVerifiedPrefix50OfficialLdrawWorldProposal(
    input.officialWorldProposal,
  );
  if (
    proposalInspection.digest !== pins.officialWorldProposal.digest ||
    proposalBytes.length !== pins.officialWorldProposal.bytes ||
    proposalInspection.artifact.schemaVersion !== pins.officialWorldProposal.schemaVersion ||
    proposalInspection.artifact.scope.lastPrintedStep !== 50 ||
    proposalInspection.artifact.scope.expectedPrintedSteps !== 359 ||
    proposalInspection.artifact.scope.suffixStepsReconstructed !== false
  ) {
    throw new TypeError(
      "Frame registry requires the exact current first-50 official-world proposal.",
    );
  }
  const archiveDigest = requirePin(
    input.officialArchiveBytes,
    pins.officialArchive,
    "Official LDraw archive",
  );
  const archive = openExactLdrawArchive(input.officialArchiveBytes);
  if (archive.entryCount !== pins.officialArchive.expectedEntries) {
    throw new TypeError(
      `Official LDraw archive exposes ${archive.entryCount} entries, not ${pins.officialArchive.expectedEntries}.`,
    );
  }
  const builderGeometryDigest = requirePin(
    input.builderGeometryBytes,
    pins.builderGeometry,
    "Builder/LDraw geometry-proof bundle",
  );
  const [catalog, canonical, factory, symmetry, builderSources, builderFrames] = await Promise.all([
    importRepositoryTypeScript(CATALOG_URL),
    importRepositoryTypeScript(CANONICAL_URL),
    importRepositoryTypeScript(FACTORY_URL),
    importRepositoryTypeScript(SYMMETRY_URL),
    importRepositoryTypeScript(BUILDER_SOURCES_URL),
    importRepositoryTypeScript(BUILDER_FRAME_URL),
  ]);
  if (catalog.BUILTIN_CATALOG_VERSION !== pins.catalogVersion) {
    throw new TypeError(
      `Frame registry requires catalog ${pins.catalogVersion}; received ${catalog.BUILTIN_CATALOG_VERSION}.`,
    );
  }
  const truth = factory.createBuiltinTruthSnapshot();
  const orientations = catalog.UPRIGHT_ORIENTATIONS.map(({ id, matrix, quarterTurns }) => ({
    id,
    matrix: [...matrix],
    quarterTurns,
  }));
  const proposalAliases = exactAliasGroups(proposalInspection.artifact);
  if (
    proposalAliases.some(
      ({ occurrenceCount, projectableOccurrenceCount, quarantinedOccurrenceCount }) =>
        projectableOccurrenceCount + quarantinedOccurrenceCount !== occurrenceCount ||
        (projectableOccurrenceCount > 0 && quarantinedOccurrenceCount > 0),
    )
  ) {
    throw new TypeError(
      "Prefix-50 proposal aliases must be wholly projectable or wholly quarantined before frame publication.",
    );
  }
  const aliases = proposalAliases.filter(
    ({ projectableOccurrenceCount }) => projectableOccurrenceCount > 0,
  );
  const newRevisions = new Set(
    PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS.map(({ designRevision }) => designRevision),
  );
  const existingSources = builderSources.BUILDER_STEP1_DESIGN_SOURCES.filter((source) =>
    aliases.some(
      ({ designRevision, catalogPartId }) =>
        designRevision === source.designRevision &&
        catalogPartId === source.catalogPartId &&
        !newRevisions.has(designRevision) &&
        catalog.getPartDefinition(catalogPartId)?.geometry.generatorId !==
          "builtin:preloaded-mesh-reference/1",
    ),
  );
  if (existingSources.length !== 30) {
    throw new TypeError(
      `Frame registry requires exactly 30 existing parametric geometry proofs; received ${existingSources.length}.`,
    );
  }
  builderFrames.assertDerivedLdrawToCatalogTransforms(existingSources, input.builderGeometryBytes);
  const existingSourceByRevision = new Map(
    existingSources.map((source) => [source.designRevision, source]),
  );
  const frames = [];
  for (const identity of aliases) {
    const definition = catalog.getPartDefinition(identity.catalogPartId);
    if (
      definition === undefined ||
      catalogLdrawFilename(definition) !== identity.catalogLdrawFilename
    ) {
      throw new TypeError(
        `${identity.designRevision} does not bind exact catalog part/filename ${identity.catalogPartId}/${identity.catalogLdrawFilename}.`,
      );
    }
    const digests = {
      definitionDigest: canonical.canonicalDigest(definition),
      geometryDigest: canonical.canonicalDigest(definition.geometry),
      connectorDigest: canonical.canonicalDigest(definition.connectors),
      collisionDigest: canonical.canonicalDigest(definition.collision),
    };
    let derived;
    if (definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
      derived = meshFrame(definition, identity);
    } else if (!newRevisions.has(identity.designRevision)) {
      const source = existingSourceByRevision.get(identity.designRevision);
      if (
        source === undefined ||
        source.sourceIdentity.ldrawOfficialArchiveSha256 !== archiveDigest
      ) {
        throw new TypeError(
          `${identity.designRevision} lacks its exact archive-bound existing geometry proof.`,
        );
      }
      const result = builderFrames.deriveLdrawToCatalogLocalTransform(
        source,
        input.builderGeometryBytes,
      );
      derived = {
        derivationKind: "builder-geometry-existing-parametric-frame",
        frame: {
          orientationId: result.orientationId,
          translationLdu: [...result.positionLdu],
        },
        evidence: {
          builderGeometryFormat: pins.builderGeometry.format,
          builderGeometryDigest,
          ldrawReferenceGeometry: source.ldrawReferenceGeometry,
          sourceOfficialArchiveDigest: source.sourceIdentity.ldrawOfficialArchiveSha256,
          sourceClosureDigest: source.sourceIdentity.ldrawClosureSha256,
          staticPinMatchedAfterDerivation: true,
        },
      };
    } else {
      const expanded = expandExactLdrawPart(archive, identity.ldrawFilename);
      const result = deriveExactParametricLdrawCatalogFrame({
        definition,
        expanded,
        isSelfSymmetry: symmetry.isCatalogPartSelfSymmetry,
        orientations,
      });
      const currentOrientation = definition.ldrawFrame?.ldrawToCatalogOrientationId ?? null;
      derived = {
        derivationKind: "archive-geometry-new-parametric-frame",
        frame: result.frame,
        evidence: {
          root: expanded.root,
          closureDigest: expanded.closureDigest,
          closureFileCount: expanded.closureFileCount,
          expandedTriangleCount: expanded.expandedTriangleCount,
          bounds: expanded.bounds,
          candidateCount: result.candidateCount,
          candidateSelfSymmetryClassCount: result.candidateSelfSymmetryClassCount,
          priorCatalogOrientationId: currentOrientation,
        },
      };
    }
    const row = {
      ...identity,
      derivationKind: derived.derivationKind,
      frame: derived.frame,
      frameDigest: canonical.canonicalDigest({ frameKey: identity.frameKey, frame: derived.frame }),
      catalogDigests: digests,
      evidence: derived.evidence,
      identityEquivalenceClaimed: false,
    };
    assertNewExpectation(row);
    frames.push(row);
  }
  const accounting = {
    proposalAliasGroups: proposalAliases.length,
    proposalOccurrences: proposalAliases.reduce((total, row) => total + row.occurrenceCount, 0),
    frameAliases: frames.length,
    framedProposalOccurrences: frames.reduce((total, row) => total + row.occurrenceCount, 0),
    excludedQuarantineAliases: proposalAliases.filter(
      ({ quarantinedOccurrenceCount }) => quarantinedOccurrenceCount > 0,
    ).length,
    excludedQuarantineOccurrences: proposalAliases.reduce(
      (total, row) => total + row.quarantinedOccurrenceCount,
      0,
    ),
    meshAssetFrames: frames.filter(
      ({ derivationKind }) => derivationKind === "catalog-mesh-asset-to-catalog-frame",
    ).length,
    archiveGeometryFrames: frames.filter(
      ({ derivationKind }) => derivationKind !== "catalog-mesh-asset-to-catalog-frame",
    ).length,
    existingParametricFrames: frames.filter(
      ({ derivationKind }) => derivationKind === "builder-geometry-existing-parametric-frame",
    ).length,
    newlyDerivedParametricFrames: frames.filter(
      ({ derivationKind }) => derivationKind === "archive-geometry-new-parametric-frame",
    ).length,
    newlyDerivedCandidateSelfSymmetryClasses: frames
      .filter(({ derivationKind }) => derivationKind === "archive-geometry-new-parametric-frame")
      .reduce((total, row) => total + row.evidence.candidateSelfSymmetryClassCount, 0),
  };
  if (!isDeepStrictEqual(accounting, pins.expectedAccounting)) {
    throw new TypeError(
      `Prefix-50 frame-registry accounting drifted: ${JSON.stringify(accounting)}.`,
    );
  }
  const frameKeys = frames.map(({ frameKey }) => frameKey);
  if (new Set(frameKeys).size !== 62) {
    throw new TypeError(
      "Prefix-50 frame registry must retain exactly 62 unique closed frame keys.",
    );
  }
  return {
    schemaVersion: PREFIX50_LDRAW_CATALOG_FRAMES_SCHEMA,
    authority: PREFIX50_LDRAW_CATALOG_FRAMES_AUTHORITY,
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixRowsIncluded: false,
    },
    inputs: {
      officialWorldProposal: {
        schemaVersion: proposalInspection.artifact.schemaVersion,
        bytes: proposalBytes.length,
        digest: proposalInspection.digest,
      },
      officialArchive: {
        logicalName: pins.officialArchive.logicalName,
        bytes: input.officialArchiveBytes.length,
        digest: archiveDigest,
        entryCount: archive.entryCount,
      },
      builderGeometry: {
        format: pins.builderGeometry.format,
        bytes: input.builderGeometryBytes.length,
        digest: builderGeometryDigest,
      },
      catalog: {
        version: catalog.BUILTIN_CATALOG_VERSION,
        digest: truth.catalog.hash,
        connectorTaxonomyDigest: truth.connectorTaxonomy.hash,
        collisionModelDigest: truth.collisionModel.hash,
        transformPolicyDigest: truth.transformPolicy.hash,
      },
      properOrientationRegistry: {
        count: catalog.PROPER_ORIENTATIONS.length,
        digest: canonical.canonicalDigest(catalog.PROPER_ORIENTATIONS),
      },
      uprightOrientationRegistry: {
        count: orientations.length,
        digest: canonical.canonicalDigest(orientations),
      },
    },
    accounting,
    frameTableDigest: canonical.canonicalDigest(
      frames.map(({ frameKey, frame, frameDigest, catalogDigests }) => ({
        frameKey,
        frame,
        frameDigest,
        catalogDigests,
      })),
    ),
    frames,
  };
}

export const encodePrefix50LdrawCatalogFrames = (artifact) =>
  Buffer.from(`${JSON.stringify(artifact, null, 1)}\n`);

export async function compilePrefix50LdrawCatalogFrames(input) {
  const snapshot = snapshotInput(
    input,
    COMPILE_KEYS,
    "Prefix-50 LDraw/catalog frame compiler input",
  );
  await Promise.resolve();
  return compileSnapshot(snapshot);
}

const verifiedArtifacts = new WeakMap();
const deepFreeze = (value) => {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export async function verifyPrefix50LdrawCatalogFrames(input) {
  const snapshot = snapshotInput(
    input,
    VERIFY_KEYS,
    "Prefix-50 LDraw/catalog frame verifier input",
  );
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(snapshot.artifactBytes, "Prefix-50 LDraw/catalog frames");
  const expected = await compileSnapshot(snapshot);
  const expectedBytes = encodePrefix50LdrawCatalogFrames(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  const pin = PREFIX50_LDRAW_CATALOG_FRAMES_PINS.expectedArtifact;
  if (pin === null) {
    throw new TypeError(
      `Prefix-50 frame registry reproduced ${expectedBytes.length} bytes at ${expectedDigest}, but no reviewed artifact pin is installed.`,
    );
  }
  if (pin.bytes !== expectedBytes.length || pin.digest !== expectedDigest) {
    throw new TypeError(
      `Prefix-50 frame registry reproduced ${expectedBytes.length} bytes at ${expectedDigest}, not its reviewed ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  if (!supplied.bytes.equals(expectedBytes)) {
    throw new TypeError(
      "Prefix-50 frame-registry bytes do not exactly reproduce from current inputs.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest: expectedDigest,
  });
  return verified;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new TypeError("Prefix-50 frame-registry inspection requires its opaque verifier result.");
  }
  return record;
}

export const isVerifiedPrefix50LdrawCatalogFrames = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);
export const inspectVerifiedPrefix50LdrawCatalogFrames = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};
export const bytesFromVerifiedPrefix50LdrawCatalogFrames = (value) =>
  Buffer.from(verifiedRecord(value).bytes);

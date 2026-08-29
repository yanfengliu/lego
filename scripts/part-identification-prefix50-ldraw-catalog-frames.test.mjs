import { existsSync, readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  bytesFromVerifiedPrefix50LdrawCatalogFrames,
  compilePrefix50LdrawCatalogFrames,
  encodePrefix50LdrawCatalogFrames,
  inspectVerifiedPrefix50LdrawCatalogFrames,
  isVerifiedPrefix50LdrawCatalogFrames,
  verifyPrefix50LdrawCatalogFrames,
} from "./part-identification-prefix50-ldraw-catalog-frames.mjs";
import { deriveExactParametricLdrawCatalogFrame } from "./part-identification-prefix50-ldraw-catalog-frames-geometry.mjs";
import { exactAliasGroups } from "./part-identification-prefix50-ldraw-catalog-frames-catalog.mjs";
import { reproduceCurrentPrefix50LdrawCatalogFrames } from "./part-identification-prefix50-ldraw-catalog-frames-current.mjs";
import {
  PREFIX50_LDRAW_CATALOG_FRAMES_AUTHORITY,
  PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS,
  PREFIX50_LDRAW_CATALOG_FRAMES_SCHEMA,
  PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS,
  PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS,
} from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;
const inputsPresent = [
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS.officialArchive.path,
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS.builderGeometry.path,
  PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
].every(existsSync);

const uprightOrientations = [
  { id: "yaw-0", matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], quarterTurns: 0 },
  { id: "yaw-90", matrix: [0, 0, 1, 0, 1, 0, -1, 0, 0], quarterTurns: 1 },
  { id: "yaw-180", matrix: [-1, 0, 0, 0, 1, 0, 0, 0, -1], quarterTurns: 2 },
  { id: "yaw-270", matrix: [0, 0, -1, 0, 1, 0, 1, 0, 0], quarterTurns: 3 },
];

const syntheticFrameInput = {
  definition: {
    id: "synthetic:square-frame",
    geometry: { generatorId: "synthetic:box/1" },
    boundsLdu: { min: [-10, -4, -10], max: [10, 4, 10] },
  },
  expanded: { bounds: { min: [-10, -4, -10], max: [10, 4, 10] } },
  orientations: uprightOrientations,
};

const proposalRow = (overrides = {}) => ({
  stepNumber: 1,
  phaseSequence: 1,
  sourceBuilderIdentityOrdinal: 1,
  builderBrickRef: "synthetic-brick",
  calloutIdentity: "synthetic-callout",
  designRevision: "3001;A",
  publishedCatalogPartId: "synthetic:brick-2x4",
  catalogPartId: "synthetic:brick-2x4",
  ldrawFilename: "3001.dat",
  catalogFrame: { catalogLdrawFilename: "3001.dat" },
  catalogBinding: {
    bindingKind: "published-catalog-part",
    occurrenceScoped: false,
    identityBasis: "published-catalog-part-with-closed-identity-relation",
    priorQuarantineBasis: null,
    movedRootProofId: null,
  },
  identityRelation: { state: "projectable" },
  ...overrides,
});

describe("prefix-50 frame algebra without private inputs", () => {
  it("refuses bounds-equivalent orientations that are not one catalog self-symmetry class", () => {
    expect(() =>
      deriveExactParametricLdrawCatalogFrame({
        ...syntheticFrameInput,
        isSelfSymmetry: () => false,
      }),
    ).toThrow(/4 exact bounds candidates in 4 catalog self-symmetry classes/);

    expect(
      deriveExactParametricLdrawCatalogFrame({
        ...syntheticFrameInput,
        isSelfSymmetry: () => true,
      }),
    ).toEqual({
      candidateCount: 4,
      candidateSelfSymmetryClassCount: 1,
      frame: { orientationId: "yaw-0", translationLdu: [0, 0, 0] },
    });
  });

  it("refuses a design-revision alias whose occurrences disagree on exact identity", () => {
    expect(() =>
      exactAliasGroups({
        rows: [proposalRow(), proposalRow({ catalogPartId: "synthetic:lookalike" })],
      }),
    ).toThrow(/does not retain one exact proposal identity tuple/);
    expect(() => exactAliasGroups({ rows: [proposalRow({ stepNumber: 51 })] })).toThrow(
      /outside printed steps 1\.\.50/,
    );
  });
});

describe.runIf(inputsPresent)("prefix-50 exact LDraw/catalog frame registry", () => {
  let artifact;
  let bytes;
  let input;
  let verified;
  let catalog;
  let symmetry;

  beforeAll(async () => {
    const reproduced = await reproduceCurrentPrefix50LdrawCatalogFrames();
    ({ artifact, bytes, input } = reproduced);
    const diskBytes = readFileSync(PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH);
    expect(diskBytes).toEqual(bytes);
    verified = await verifyPrefix50LdrawCatalogFrames({ ...input, artifactBytes: diskBytes });
    [catalog, symmetry] = await Promise.all([
      importRepositoryTypeScript(moduleUrl("../packages/catalog/src/index.ts")),
      importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-builder-frame-geometry.ts")),
    ]);
  }, 180_000);

  it("reproduces the reviewed 66-frame artifact and closes all prior quarantines", () => {
    const pin = PREFIX50_LDRAW_CATALOG_FRAMES_PINS.expectedArtifact;
    const inspection = inspectVerifiedPrefix50LdrawCatalogFrames(verified);
    expect(isVerifiedPrefix50LdrawCatalogFrames(verified)).toBe(true);
    expect(bytesFromVerifiedPrefix50LdrawCatalogFrames(verified)).toEqual(bytes);
    expect(artifact.schemaVersion).toBe(PREFIX50_LDRAW_CATALOG_FRAMES_SCHEMA);
    expect(artifact.authority).toEqual(PREFIX50_LDRAW_CATALOG_FRAMES_AUTHORITY);
    expect(artifact.accounting).toEqual(PREFIX50_LDRAW_CATALOG_FRAMES_PINS.expectedAccounting);
    expect(artifact.frames).toHaveLength(66);
    expect(new Set(artifact.frames.map(({ frameKey }) => frameKey)).size).toBe(66);
    expect(artifact.frames.reduce((total, row) => total + row.occurrenceCount, 0)).toBe(320);
    expect(
      artifact.frames.filter(({ designRevision }) =>
        ["10201;H", "3245;M", "41769;G", "41770;H"].includes(designRevision),
      ),
    ).toHaveLength(4);
    expect(artifact.scope).toEqual({
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixRowsIncluded: false,
    });
    expect(bytes).toHaveLength(pin.bytes);
    expect(inspection.digest).toBe(pin.digest);
  });

  it("binds the two moved roots to exact occurrences without publishing global aliases", () => {
    const rows = artifact.frames
      .filter(({ identityProof }) => identityProof !== null)
      .map(({ designRevision, occurrences, identityProof }) => ({
        designRevision,
        ordinal: occurrences[0].sourceBuilderIdentityOrdinal,
        proofId: identityProof.proofId,
        sourceTriangles: identityProof.source.expandedTriangleCount,
        targetTriangles: identityProof.target.expandedTriangleCount,
        sameExpandedGeometry: identityProof.sameExpandedGeometry,
        globalAliasClaimed: identityProof.globalAliasClaimed,
      }));
    expect(rows).toEqual(
      PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS.map((expected) => ({
        designRevision: expected.designRevision,
        ordinal: expected.sourceBuilderIdentityOrdinal,
        proofId: expected.proofId,
        sourceTriangles: 521,
        targetTriangles: 521,
        sameExpandedGeometry: true,
        globalAliasClaimed: false,
      })),
    );
  });

  it("derives the five new archive frames with exact counts, bounds, and one symmetry class", () => {
    const rows = PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS.map((expected) => {
      const row = artifact.frames.find(
        ({ designRevision }) => designRevision === expected.designRevision,
      );
      return {
        designRevision: row.designRevision,
        catalogPartId: row.catalogPartId,
        ldrawFilename: row.ldrawFilename,
        catalogLdrawFilename: row.catalogLdrawFilename,
        occurrenceCount: row.occurrenceCount,
        frame: row.frame,
        archive: {
          closureFileCount: row.evidence.closureFileCount,
          expandedTriangleCount: row.evidence.expandedTriangleCount,
          bounds: row.evidence.bounds,
        },
        candidateCount: row.evidence.candidateCount,
        candidateSelfSymmetryClassCount: row.evidence.candidateSelfSymmetryClassCount,
      };
    });
    expect(rows).toEqual(PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS);
    expect(rows.map(({ candidateCount }) => candidateCount)).toEqual([2, 4, 4, 2, 2]);
  });

  it("binds every catalog definition layer and preserves 15573's exact narrow connector truth", async () => {
    const canonical = await importRepositoryTypeScript(
      moduleUrl("../packages/brick-kernel/src/canonical.ts"),
    );
    for (const row of artifact.frames) {
      const definition = catalog.getPartDefinition(row.catalogPartId);
      expect(row.catalogDigests).toEqual({
        definitionDigest: canonical.canonicalDigest(definition),
        geometryDigest: canonical.canonicalDigest(definition.geometry),
        connectorDigest: canonical.canonicalDigest(definition.connectors),
        collisionDigest: canonical.canonicalDigest(definition.collision),
      });
    }
    const jumper = catalog.getPartDefinition("builtin:jumper-plate-1x2");
    expect(jumper.connectors.map(({ kind, positionLdu }) => ({ kind, positionLdu }))).toEqual([
      { kind: "undersideClutch", positionLdu: [0, 4, -10] },
      { kind: "undersideClutch", positionLdu: [0, 4, 10] },
      { kind: "stud", positionLdu: [0, -4, 0] },
    ]);
    expect(jumper.collision.allowances).toHaveLength(2);
  });

  it("rejects forged tokens and any archive mutation before frame publication", async () => {
    await expect(
      compilePrefix50LdrawCatalogFrames({ ...input, officialWorldProposal: {} }),
    ).rejects.toThrow(/opaque current verifier result/);
    const changedArchive = Buffer.from(input.officialArchiveBytes);
    changedArchive[123_456] ^= 1;
    await expect(
      compilePrefix50LdrawCatalogFrames({ ...input, officialArchiveBytes: changedArchive }),
    ).rejects.toThrow(/must be the exact pinned/);
  });

  it("rejects alias substitution and a missing source-frame translation", async () => {
    const aliasChanged = structuredClone(artifact);
    aliasChanged.frames[0].catalogLdrawFilename = "99999.dat";
    await expect(
      verifyPrefix50LdrawCatalogFrames({
        ...input,
        artifactBytes: encodePrefix50LdrawCatalogFrames(aliasChanged),
      }),
    ).rejects.toThrow(/do not exactly reproduce/);

    const translationMissing = structuredClone(artifact);
    translationMissing.frames.find(
      ({ designRevision }) => designRevision === "15573;L",
    ).frame.translationLdu = [0, 0, 0];
    await expect(
      verifyPrefix50LdrawCatalogFrames({
        ...input,
        artifactBytes: encodePrefix50LdrawCatalogFrames(translationMissing),
      }),
    ).rejects.toThrow(/do not exactly reproduce/);
  }, 60_000);

  it("refuses an asymmetric quarter-turn instead of choosing by candidate order", () => {
    const source = artifact.frames.find(({ designRevision }) => designRevision === "15573;L");
    const definition = structuredClone(catalog.getPartDefinition(source.catalogPartId));
    definition.connectors.push({
      ...definition.connectors[0],
      id: "hostile-asymmetric-seat",
      positionLdu: [7, 4, 3],
    });
    const orientations = catalog.UPRIGHT_ORIENTATIONS.map(({ id, matrix, quarterTurns }) => ({
      id,
      matrix: [...matrix],
      quarterTurns,
    }));
    expect(() =>
      deriveExactParametricLdrawCatalogFrame({
        definition,
        expanded: { bounds: source.evidence.bounds },
        isSelfSymmetry: symmetry.isCatalogPartSelfSymmetry,
        orientations,
      }),
    ).toThrow(/self-symmetry classes/);
  });

  it("keeps inspected frames immutable and the verified bytes detached", () => {
    const inspection = inspectVerifiedPrefix50LdrawCatalogFrames(verified);
    const frame = inspection.artifact.frames[0].frame;
    expect(Object.isFrozen(inspection.artifact.frames)).toBe(true);
    expect(Object.isFrozen(frame.translationLdu)).toBe(true);
    expect(() => {
      frame.translationLdu[0] = 777;
    }).toThrow(TypeError);
    const detached = bytesFromVerifiedPrefix50LdrawCatalogFrames(verified);
    detached[0] ^= 1;
    expect(bytesFromVerifiedPrefix50LdrawCatalogFrames(verified)).toEqual(bytes);
  });
});

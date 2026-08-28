import { existsSync, readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  bytesFromVerifiedPrefix50OfficialLdrawWorldProposal,
  compilePrefix50OfficialLdrawWorldProposal,
  encodePrefix50OfficialLdrawWorldProposal,
  inspectVerifiedPrefix50OfficialLdrawWorldProposal,
  isVerifiedPrefix50OfficialLdrawWorldProposal,
  verifyPrefix50OfficialLdrawWorldProposal,
} from "./part-identification-prefix50-official-ldraw-world-proposal.mjs";
import { reproduceCurrentPrefix50OfficialLdrawWorldProposal } from "./part-identification-prefix50-official-ldraw-world-proposal-current.mjs";
import {
  snapPrefix50HalfLduPosition,
  snapPrefix50ProperWorldOrientation,
} from "./part-identification-prefix50-official-ldraw-world-proposal-math.mjs";
import {
  parsePrefix50OfficialLdraw,
  parsePrefix50OfficialXml,
  reconcilePrefix50OfficialXmlLdraw,
} from "./part-identification-prefix50-official-ldraw-world-proposal-parser.mjs";
import {
  PREFIX50_OFFICIAL_LDRAW_QUARANTINES,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_AUTHORITY,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_SCHEMA,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;
const inputsPresent = [
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialXml.path,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialLdraw.path,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH,
].every(existsSync);

function changedLdrawRow(bytes, predicate, change) {
  const lines = Buffer.from(bytes).toString("utf8").split("\r\n");
  const lineIndex = lines.findIndex((line) => {
    if (!line.startsWith("1 ")) return false;
    return predicate(line.split(/\s+/u));
  });
  if (lineIndex < 0) throw new TypeError("Hostile-test LDraw row was not found.");
  const tokens = lines[lineIndex].split(/\s+/u);
  change(tokens);
  lines[lineIndex] = tokens.join(" ");
  return Buffer.from(lines.join("\r\n"));
}

function rotatedZ(radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, -sine, 0, sine, cosine, 0, 0, 0, 1];
}

describe.runIf(inputsPresent)("prefix-50 official XML/LDraw world proposal", () => {
  let artifact;
  let bytes;
  let input;
  let verified;
  let orientations;

  beforeAll(async () => {
    const reproduced = await reproduceCurrentPrefix50OfficialLdrawWorldProposal();
    artifact = reproduced.artifact;
    bytes = reproduced.bytes;
    input = reproduced.input;
    const diskBytes = readFileSync(PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH);
    expect(diskBytes).toEqual(bytes);
    verified = await verifyPrefix50OfficialLdrawWorldProposal({
      ...input,
      artifactBytes: diskBytes,
    });
    const catalog = await importRepositoryTypeScript(moduleUrl("../packages/catalog/src/index.ts"));
    orientations = catalog.PROPER_ORIENTATIONS.map(({ id, matrix }) => ({
      id,
      matrix: [...matrix],
    }));
  }, 120_000);

  it("reproduces the exact ignored artifact, pins, accounting, and retained source scope", () => {
    const inspection = inspectVerifiedPrefix50OfficialLdrawWorldProposal(verified);
    expect(isVerifiedPrefix50OfficialLdrawWorldProposal(verified)).toBe(true);
    expect(bytesFromVerifiedPrefix50OfficialLdrawWorldProposal(verified)).toEqual(bytes);
    expect(inspection.digest).toBe(
      PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.expectedArtifact.digest,
    );
    expect(bytes).toHaveLength(PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.expectedArtifact.bytes);
    expect(artifact.schemaVersion).toBe(PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_SCHEMA);
    expect(artifact.inputs).toMatchObject({
      actionPreparation: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.actionPreparation,
      officialXml: {
        bytes: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialXml.bytes,
        digest: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialXml.digest,
      },
      officialLdraw: {
        bytes: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialLdraw.bytes,
        digest: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.officialLdraw.digest,
      },
    });
    expect(artifact.accounting).toEqual(
      PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.expectedAccounting,
    );
    expect(artifact.scope).toEqual({
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixStepsReconstructed: false,
    });
    expect(artifact.sourceIndex).toMatchObject({
      expectedPrintedSteps: 359,
      prefixLastStep: 50,
      prefixPartArtPieces: 320,
      suffixPartArtRows: 672,
      suffixStepsReconstructed: false,
    });
    expect(artifact.permutation).toEqual({
      identityXmlRows: [1, 1_439],
      compositeXmlRow: 1_440,
      compositeTopLevelLdrawRow: 1_465,
      shiftedXmlRows: [1_441, 1_465],
      shiftedTopLevelLdrawRows: [1_440, 1_464],
    });
  });

  it("keeps every inspected transform immutable and byte-identical to the verified artifact", () => {
    const inspection = inspectVerifiedPrefix50OfficialLdrawWorldProposal(verified);
    const translation = inspection.artifact.rows[0].catalogFrame.translationLdu;
    const original = [...translation];

    expect(Object.isFrozen(inspection.artifact.rows[0].catalogFrame)).toBe(true);
    expect(Object.isFrozen(translation)).toBe(true);
    expect(() => {
      translation[0] = 777;
    }).toThrow(TypeError);
    expect(translation).toEqual(original);
    expect(bytesFromVerifiedPrefix50OfficialLdrawWorldProposal(verified)).toEqual(bytes);
    expect(encodePrefix50OfficialLdrawWorldProposal(inspection.artifact)).toEqual(bytes);
  });

  it("retains only proposal authority, all 320 semantic rows, and the exact quarantines", () => {
    expect(artifact.authority).toEqual(PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_AUTHORITY);
    expect(artifact.quarantines).toEqual(PREFIX50_OFFICIAL_LDRAW_QUARANTINES);
    expect(artifact.rows).toHaveLength(320);
    expect(
      artifact.rows.every(
        (row) =>
          row.catalogPartId.startsWith("builtin:") &&
          row.catalogColorId.startsWith("builtin:") &&
          typeof row.sourceWorldProposal.orientationId === "string" &&
          row.documentLegalityClaimed === false,
      ),
    ).toBe(true);
    expect(
      artifact.rows.filter(({ catalogWorldProposal }) => catalogWorldProposal !== null),
    ).toHaveLength(309);
    expect(
      artifact.rows.filter(({ catalogWorldProposal }) => catalogWorldProposal === null),
    ).toHaveLength(11);
    expect(
      artifact.rows.filter(({ semanticColorMatchesLdraw }) => semanticColorMatchesLdraw === null),
    ).toHaveLength(29);
    for (const designRevision of ["41769;G", "41770;H"]) {
      expect(artifact.rows.find((row) => row.designRevision === designRevision)).toMatchObject({
        identityRelation: { state: "quarantined" },
        catalogWorldProposal: null,
      });
    }
    expect(artifact.rows.filter((row) => row.designRevision === "3245;M")).toHaveLength(7);
    expect(
      artifact.rows
        .filter((row) => row.designRevision === "3245;M")
        .every(
          (row) =>
            row.ldrawFilename === "3245b.dat" &&
            row.catalogFrame.catalogLdrawFilename === "3245c.dat" &&
            row.catalogWorldProposal === null,
        ),
    ).toBe(true);
  });

  it("records the three exact half-LDU 4519 origins and connector-seat deltas without snapping", () => {
    const rows = artifact.rows.filter(({ sourceBuilderIdentityOrdinal }) =>
      [281, 282, 283].includes(sourceBuilderIdentityOrdinal),
    );
    expect(
      rows.map(({ sourceBuilderIdentityOrdinal, catalogWorldProposal }) => ({
        sourceBuilderIdentityOrdinal,
        orientationId: catalogWorldProposal.orientationId,
        positionLdu: catalogWorldProposal.positionLdu,
      })),
    ).toEqual([
      {
        sourceBuilderIdentityOrdinal: 281,
        orientationId: "proper-m-00pp000p0",
        positionLdu: [410, -118, -96.5],
      },
      {
        sourceBuilderIdentityOrdinal: 282,
        orientationId: "proper-m-00pp000p0",
        positionLdu: [270, -118, -96.5],
      },
      {
        sourceBuilderIdentityOrdinal: 283,
        orientationId: "proper-m-00pp000p0",
        positionLdu: [340, -118, -96.5],
      },
    ]);
    for (const row of rows) {
      expect(row.catalogConnectorSeatProposals.map(({ originDeltaLdu }) => originDeltaLdu)).toEqual(
        [
          [0, -20, 0],
          [0, 0, 0],
          [0, 20, 0],
        ],
      );
      expect(
        row.catalogConnectorSeatProposals.map(({ worldPositionLdu }) => worldPositionLdu),
      ).toEqual([
        [row.catalogWorldProposal.positionLdu[0], -138, -96.5],
        [row.catalogWorldProposal.positionLdu[0], -118, -96.5],
        [row.catalogWorldProposal.positionLdu[0], -98, -96.5],
      ]);
    }
  });

  it("rejects caller-shaped tokens, artifact drift, row reordering, and alias widening", async () => {
    await expect(
      compilePrefix50OfficialLdrawWorldProposal({
        ...input,
        actionPreparation: {},
      }),
    ).rejects.toThrow(/opaque current action-preparation verifier result/);

    const changedArtifact = structuredClone(artifact);
    changedArtifact.rows[0].catalogPartId = "builtin:caller-shaped";
    await expect(
      verifyPrefix50OfficialLdrawWorldProposal({
        ...input,
        artifactBytes: encodePrefix50OfficialLdrawWorldProposal(changedArtifact),
      }),
    ).rejects.toThrow(/does not exactly reproduce/);

    const xml = parsePrefix50OfficialXml(input.officialXmlBytes);
    const ldraw = parsePrefix50OfficialLdraw(input.officialLdrawBytes);
    const reorderedTop = [...ldraw.top];
    [reorderedTop[0], reorderedTop[1]] = [reorderedTop[1], reorderedTop[0]];
    expect(() => reconcilePrefix50OfficialXmlLdraw(xml, { ...ldraw, top: reorderedTop })).toThrow(
      /color bindings|exact identity aliases|not invariant/,
    );

    const aliasIndex = ldraw.top.findIndex(({ filename }) => filename === "2453b.dat");
    const widenedAliasTop = ldraw.top.map((row, index) =>
      index === aliasIndex ? { ...row, filename: "2453.dat" } : row,
    );
    expect(() =>
      reconcilePrefix50OfficialXmlLdraw(xml, { ...ldraw, top: widenedAliasTop }),
    ).toThrow(/exact identity aliases/);
  });

  it("rejects local-transform tolerance drift, reflections, malformed matrices, and bounds", () => {
    const xml = parsePrefix50OfficialXml(input.officialXmlBytes);
    const ldraw = parsePrefix50OfficialLdraw(input.officialLdrawBytes);
    const reconciled = reconcilePrefix50OfficialXmlLdraw(xml, ldraw);
    const repeated = reconciled.localTransformGroups.find(({ occurrences }) => occurrences > 1);
    const leaf = reconciled.leaves.find(
      (candidate) =>
        candidate.xmlRow !== 1_440 &&
        candidate.designRevision === repeated.designRevision &&
        candidate.ldrawFilename === repeated.ldrawFilename,
    );
    const driftedTop = ldraw.top.map((row, index) =>
      index === leaf.topLevelLdrawRow - 1
        ? { ...row, position: [row.position[0] + 2e-8, ...row.position.slice(1)] }
        : row,
    );
    expect(() => reconcilePrefix50OfficialXmlLdraw(xml, { ...ldraw, top: driftedTop })).toThrow(
      /not invariant within 1e-9/,
    );

    const reflected = changedLdrawRow(
      input.officialLdrawBytes,
      () => true,
      (tokens) => {
        for (const index of [5, 8, 11]) tokens[index] = String(-Number(tokens[index]));
      },
    );
    expect(() => parsePrefix50OfficialLdraw(reflected)).toThrow(
      /determinant-positive rigid matrix/,
    );

    const outOfBounds = changedLdrawRow(
      input.officialLdrawBytes,
      () => true,
      (tokens) => {
        tokens[2] = "10001";
      },
    );
    expect(() => parsePrefix50OfficialLdraw(outOfBounds)).toThrow(/out-of-bounds transform/);
  });

  it("enforces the fixed proper-orientation and half-LDU tolerances", () => {
    expect(
      snapPrefix50ProperWorldOrientation(rotatedZ(5e-7), orientations).residual,
    ).toBeLessThanOrEqual(1e-6);
    expect(() => snapPrefix50ProperWorldOrientation(rotatedZ(2e-6), orientations)).toThrow(
      /not uniquely within 0.000001/,
    );
    expect(() =>
      snapPrefix50ProperWorldOrientation([-1, 0, 0, 0, 1, 0, 0, 0, 1], orientations),
    ).toThrow(/determinant-positive rigid matrix/);
    expect(snapPrefix50HalfLduPosition([410, -118, -96.5]).positionLdu).toEqual([410, -118, -96.5]);
    expect(() => snapPrefix50HalfLduPosition([0, 0, 0.001])).toThrow(
      /off the half-LDU proposal lattice/,
    );
    expect(() => snapPrefix50HalfLduPosition([10_001, 0, 0])).toThrow(/finite bounded/);
  });
});

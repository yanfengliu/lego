import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { encodePng } from "./part-identification-card-test-fixture.mjs";
import { summarizeLegacyRecutCliWorkflow } from "./part-identification-legacy-recut-cli.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  __testOnly,
  bytesFromVerifiedPartIdentificationLegacyRecut,
  compilePartIdentificationLegacyRecut,
  encodePartIdentificationLegacyRecut,
  inspectVerifiedPartIdentificationLegacyRecut,
  isVerifiedPartIdentificationLegacyRecut,
  verifyPartIdentificationLegacyRecut,
} from "./part-identification-legacy-recut.mjs";

const OUTPUT_ROOT = resolve("output");
const SOURCE_HASH = `sha256:${"a".repeat(64)}`;
const tempRoots = [];
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const ABSENT_AUTHORITY = {
  kind: "local-diagnostic",
  authenticated: false,
  answerArtifactsConsumed: false,
  legacyAnswerV4Accepted: false,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  semanticIdentity: false,
  coverageTrust: false,
  coveragePublication: false,
  catalogAdmission: false,
  assignmentAuthority: false,
  documentMutation: false,
  placement: false,
  acceptedDocument: false,
  completion: false,
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function raster(width, height, colour, extra = []) {
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgba.set([140, 148, 148, 255], pixel * 4);
  }
  for (const { x, y, rgba: value } of [{ x: 1, y: 1, rgba: [...colour, 255] }, ...extra]) {
    rgba.set(value, (y * width + x) * 4);
  }
  return encodePng(width, height, rgba);
}

function pin(path, schemaVersion, bytes, extra = {}) {
  return {
    path,
    schemaVersion,
    digest: digest(bytes),
    bytes: bytes.length,
    ...extra,
  };
}

function buildFixture(modify = () => {}) {
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  const root = mkdtempSync(join(OUTPUT_ROOT, "legacy-recut-test-"));
  tempRoots.push(root);
  const legacyRunId = "legacy-test-run";
  const currentRunId = "current-test-run";
  const legacyImages = [
    raster(4, 3, [10, 20, 31]),
    raster(4, 4, [20, 30, 41]),
    raster(4, 4, [30, 40, 51]),
    raster(4, 4, [40, 50, 61], [{ x: 1, y: 3, rgba: [80, 90, 100, 255] }]),
    raster(4, 3, [50, 60, 71]),
    raster(4, 3, [60, 70, 81]),
    raster(4, 3, [70, 80, 91]),
    raster(4, 3, [80, 90, 101]),
  ];
  const currentImages = [
    legacyImages[0],
    raster(4, 3, [20, 30, 41]),
    raster(4, 3, [30, 40, 52]),
    raster(4, 3, [40, 50, 61]),
    raster(3, 3, [50, 60, 71]),
    legacyImages[5],
    legacyImages[6],
    legacyImages[7],
  ];
  const identities = Array.from(
    { length: legacyImages.length },
    (_, index) => `p${index + 1}|q1|x${index + 1}d000|y${index + 2}d000`,
  );
  const rowFor = (identity, image, runId, index) => ({
    identity,
    pageNumber: index + 1,
    stepNumber: index + 1,
    quantity: 1,
    xPt: index + 1,
    yPt: index + 2,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: { minXPt: 0, minYPt: 1, maxXPt: 10, maxYPt: 11 },
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    sha256: digest(image),
    byteLength: image.length,
    widthPx: image.readUInt32BE(16),
    heightPx: image.readUInt32BE(20),
    file: `runs/${runId}/${identity.replaceAll("|", "-").replaceAll(".", "d")}.png`,
  });
  const legacyRows = identities.map((identity, index) =>
    rowFor(identity, legacyImages[index], legacyRunId, index),
  );
  const currentRows = identities.map((identity, index) =>
    rowFor(identity, currentImages[index], currentRunId, index),
  );
  legacyRows[7].stepNumber = 51;
  currentRows[7].stepNumber = 51;
  legacyImages[6] = Buffer.from("unread legacy first-50 decoy");
  currentImages[6] = Buffer.from("unread current first-50 decoy");
  legacyImages[7] = Buffer.from("unread legacy suffix decoy");
  currentImages[7] = Buffer.from("unread current suffix decoy");
  const truth = {
    schemaVersion: "lego.part-identification-truth/3",
    lastStep: 50,
    pairsJudged: 5,
    pairsUnjudgeable: 1,
    verdicts: legacyRows.slice(0, 5).map((row, index) => ({
      n: index + 1,
      judgedCropSha256: row.sha256,
      elementId: `${100 + index}`,
      same: [true, false, true, true, false][index],
    })),
    unjudgeable: [
      {
        n: 6,
        judgedCropSha256: legacyRows[5].sha256,
        elementId: null,
        reason: "Synthetic blank claim",
        callouts: 1,
        pieces: 1,
      },
    ],
  };
  const state = { currentImages, currentRows, identities, legacyImages, legacyRows, truth };
  modify(state);

  for (const [runId, rows, images] of [
    [legacyRunId, state.legacyRows, state.legacyImages],
    [currentRunId, state.currentRows, state.currentImages],
  ]) {
    const directory = join(root, "runs", runId);
    mkdirSync(directory, { recursive: true });
    for (const [index, row] of rows.entries()) {
      const filename = row.file.split("/").at(-1);
      writeFileSync(join(directory, filename), images[index]);
    }
  }

  const manifestFor = (schemaVersion, rows) => ({
    schemaVersion,
    sourceHash: SOURCE_HASH,
    pageSelection: "full booklet",
    pagesCropped: 8,
    calloutCount: rows.length,
    callouts: rows,
  });
  const legacyManifestBytes = jsonBytes(manifestFor("lego.callout-thumbnails/5", state.legacyRows));
  const currentManifestBytes = jsonBytes(
    manifestFor("lego.callout-thumbnails/6", state.currentRows),
  );
  const truthBytes = jsonBytes(state.truth);
  const pins = {
    kind: "synthetic-unverified",
    sourceHash: SOURCE_HASH,
    lastStep: 50,
    legacyManifest: pin("legacy.json", "lego.callout-thumbnails/5", legacyManifestBytes, {
      runId: legacyRunId,
      pagesCropped: 8,
      calloutCount: state.legacyRows.length,
    }),
    currentManifest: pin("current.json", "lego.callout-thumbnails/6", currentManifestBytes, {
      runId: currentRunId,
      pagesCropped: 8,
      calloutCount: state.currentRows.length,
    }),
    truth: pin("truth.json", "lego.part-identification-truth/3", truthBytes),
    expectedSourceIndex: null,
    expectedRelationCommitment: null,
    expectedArtifact: null,
    expectedAccounting: null,
  };
  return {
    input: { calloutRoot: root, currentManifestBytes, legacyManifestBytes, truthBytes },
    pins,
    root,
    state,
  };
}

describe("legacy /5 to current /6 exact recut bridge", () => {
  it("separates verdicts, crop equivalence, refusals, and absent authority", () => {
    const fixture = buildFixture();
    const artifact = __testOnly.compileWithPins(fixture.input, fixture.pins);
    expect(artifact.inputTrust).toBe("caller-supplied-unverified");
    expect(artifact.authority).toEqual(ABSENT_AUTHORITY);
    expect(artifact.scope).toEqual({
      lastStep: 50,
      expectedPrintedSteps: 359,
      suffixStepsReconstructed: false,
    });
    expect(artifact.sourceIndex).toMatchObject({
      calloutRows: 8,
      prefixPartArtRows: 7,
      suffixStepsReconstructed: false,
      cropBytesAuthenticated: "truth-linked-first-50-only",
    });
    expect(artifact.accounting).toMatchObject({
      retainedSameRelations: 3,
      retainedDifferentRelations: 2,
      acceptedSameRelations: 1,
      acceptedDifferentRelations: 1,
      refusedSameRelations: 2,
      refusedDifferentRelations: 1,
      unjudgeableRelations: 1,
      perCompileSelectedCropImages: 12,
    });
    expect(summarizeLegacyRecutCliWorkflow(artifact.accounting)).toEqual({
      compilePasses: 3,
      cropImages: 36,
      decodePixels: artifact.accounting.perCompileDecodePixels * 3,
      decodePixelLimit: artifact.accounting.perCompileDecodePixelLimit * 3,
    });
    expect(artifact.relationCommitment.rows).toBe(6);
    for (const index of [6, 7]) {
      for (const [rows, runRoot] of [
        [fixture.state.legacyRows, fixture.root],
        [fixture.state.currentRows, fixture.root],
      ]) {
        const row = rows[index];
        expect(digest(readFileSync(join(runRoot, ...row.file.split("/"))))).not.toBe(row.sha256);
      }
    }
    expect(artifact.relations.map((row) => row.comparison.method)).toEqual([
      "exact-png-bytes",
      "exact-bottom-background-recut",
      "refused",
      "refused",
      "refused",
    ]);
    expect(artifact.relations[2].comparison).toMatchObject({
      reason: "retained-rgba-changed",
      retainedDifferingPixels: 1,
      maximumChannelDelta: 1,
    });
    expect(artifact.relations[3].comparison.reason).toBe("removed-suffix-is-not-exact-background");
    expect(artifact.relations[4].comparison.reason).toBe("not-a-shorter-same-width-bottom-recut");
    expect(artifact.unjudgeable[0]).toMatchObject({
      verdict: "unjudgeable",
      comparisonDisposition: "accepted",
      unjudgeableReason: "Synthetic blank claim",
    });
  });

  it("keeps synthetic verification unbranded and rejects edited output or answer roles", () => {
    const fixture = buildFixture();
    const artifact = __testOnly.compileWithPins(fixture.input, fixture.pins);
    const artifactBytes = encodePartIdentificationLegacyRecut(artifact);
    const verified = __testOnly.verifyUnbranded({ ...fixture.input, artifactBytes }, fixture.pins);
    expect(verified.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(isVerifiedPartIdentificationLegacyRecut(verified)).toBe(false);
    expect(isVerifiedPartIdentificationLegacyRecut(Object.freeze({ verified: true }))).toBe(false);
    expect(() =>
      __testOnly.verifyUnbranded(
        { ...fixture.input, artifactBytes: Buffer.concat([artifactBytes, Buffer.from(" ")]) },
        fixture.pins,
      ),
    ).toThrow(/does not exactly reproduce/);

    const edited = structuredClone(artifact);
    edited.authority.semanticIdentity = true;
    expect(() =>
      __testOnly.verifyUnbranded(
        { ...fixture.input, artifactBytes: encodePartIdentificationLegacyRecut(edited) },
        fixture.pins,
      ),
    ).toThrow(/does not exactly reproduce/);
    expect(() =>
      __testOnly.compileWithPins(
        { ...fixture.input, answersBytes: Buffer.from("legacy answer /4") },
        fixture.pins,
      ),
    ).toThrow(/Extra evidence roles/);
  });

  it("rejects pin drift, roster drift, cross-run splicing, missing truth, and duplicates", () => {
    const fixture = buildFixture();
    expect(() =>
      __testOnly.compileWithPins(
        {
          ...fixture.input,
          truthBytes: Buffer.concat([fixture.input.truthBytes, Buffer.from(" ")]),
        },
        fixture.pins,
      ),
    ).toThrow(/exact pinned/);

    const rosterDrift = buildFixture(({ currentRows }) => {
      currentRows[0].xPt += 0.5;
    });
    expect(() => __testOnly.compileWithPins(rosterDrift.input, rosterDrift.pins)).toThrow(
      /same ordered full-booklet/,
    );

    const reordered = buildFixture(({ currentRows }) => {
      currentRows.reverse();
    });
    expect(() => __testOnly.compileWithPins(reordered.input, reordered.pins)).toThrow(
      /same ordered full-booklet/,
    );

    const crossRun = buildFixture(({ currentRows }) => {
      currentRows[0].file = currentRows[0].file.replace("current-test-run", "legacy-test-run");
    });
    expect(() => __testOnly.compileWithPins(crossRun.input, crossRun.pins)).toThrow(
      /Cross-run crop splicing/,
    );

    const missing = buildFixture(({ truth }) => {
      truth.verdicts[0].judgedCropSha256 = `sha256:${"b".repeat(64)}`;
    });
    expect(() => __testOnly.compileWithPins(missing.input, missing.pins)).toThrow(
      /contains no such crop/,
    );

    const duplicate = buildFixture(({ currentRows, legacyRows }) => {
      currentRows[1].identity = currentRows[0].identity;
      legacyRows[1].identity = legacyRows[0].identity;
    });
    expect(() => __testOnly.compileWithPins(duplicate.input, duplicate.pins)).toThrow(
      /one unique identity/,
    );

    const truthV2 = buildFixture(({ truth }) => {
      truth.schemaVersion = "lego.part-identification-truth/2";
    });
    truthV2.pins.truth.schemaVersion = "lego.part-identification-truth/2";
    expect(() => __testOnly.compileWithPins(truthV2.input, truthV2.pins)).toThrow(
      /only lego\.part-identification-truth\/3/,
    );
  });

  it("refuses aggregate decode work before trusting declared image dimensions", () => {
    const oversized = buildFixture(({ currentRows, legacyRows }) => {
      for (const row of [...legacyRows, ...currentRows]) {
        row.widthPx = 4_096;
        row.heightPx = 4_096;
      }
    });
    expect(() => __testOnly.compileWithPins(oversized.input, oversized.pins)).toThrow(
      /aggregate decode pixels.*fixed/u,
    );
  });

  it("rejects corrupt crop bytes after manifest authentication", () => {
    const corrupt = buildFixture(({ currentImages, currentRows }) => {
      currentImages[0] = Buffer.from(currentImages[0]);
      currentImages[0][currentImages[0].length - 13] ^= 0xff;
      currentRows[0].sha256 = digest(currentImages[0]);
      currentRows[0].byteLength = currentImages[0].length;
    });
    expect(() => __testOnly.compileWithPins(corrupt.input, corrupt.pins)).toThrow(
      /PNG|CRC|decode/u,
    );
  });
});

const realEvidencePresent = [
  CURRENT_LEGACY_RECUT_PINS.legacyManifest.path,
  CURRENT_LEGACY_RECUT_PINS.currentManifest.path,
  CURRENT_LEGACY_RECUT_PINS.truth.path,
].every(existsSync);

it.runIf(realEvidencePresent)(
  "reproduces and privately closes the retained first-50 census",
  () => {
    const input = {
      legacyManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path),
      currentManifestBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.currentManifest.path),
      truthBytes: readFileSync(CURRENT_LEGACY_RECUT_PINS.truth.path),
      calloutRoot: "output/callout-thumbnails",
    };
    const compiled = compilePartIdentificationLegacyRecut(input);
    expect(compiled.accounting).toEqual(CURRENT_LEGACY_RECUT_PINS.expectedAccounting);
    expect(compiled.sourceIndex).toEqual(CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex);
    expect(compiled.relationCommitment).toEqual(
      CURRENT_LEGACY_RECUT_PINS.expectedRelationCommitment,
    );
    expect(
      compiled.relations
        .filter((row) => row.comparisonDisposition === "refused")
        .map((row) => ({
          n: row.n,
          stepNumber: row.stepNumber,
          quantity: row.quantity,
          verdict: row.verdict,
          identity: row.identity,
          reason: row.comparison.reason,
          retainedDifferingPixels: row.comparison.retainedDifferingPixels,
          maximumChannelDelta: row.comparison.maximumChannelDelta,
        })),
    ).toEqual([
      {
        n: 25,
        stepNumber: 19,
        quantity: 1,
        verdict: "different",
        identity: "p23|q1|x85.937|y467.756",
        reason: "not-a-shorter-same-width-bottom-recut",
        retainedDifferingPixels: 5_038,
        maximumChannelDelta: 147,
      },
      {
        n: 38,
        stepNumber: 24,
        quantity: 2,
        verdict: "same",
        identity: "p28|q2|x142.740|y433.406",
        reason: "retained-rgba-changed",
        retainedDifferingPixels: 144,
        maximumChannelDelta: 81,
      },
    ]);
    const handle = verifyPartIdentificationLegacyRecut({
      ...input,
      artifactBytes: encodePartIdentificationLegacyRecut(compiled),
    });
    expect(isVerifiedPartIdentificationLegacyRecut(handle)).toBe(true);
    const firstCopy = bytesFromVerifiedPartIdentificationLegacyRecut(handle);
    const firstByte = firstCopy[0];
    firstCopy[0] ^= 0xff;
    expect(bytesFromVerifiedPartIdentificationLegacyRecut(handle)[0]).toBe(firstByte);
    const inspection = inspectVerifiedPartIdentificationLegacyRecut(handle);
    expect(inspection.digest).toBe(CURRENT_LEGACY_RECUT_PINS.expectedArtifact.digest);
    expect(bytesFromVerifiedPartIdentificationLegacyRecut(handle)).toHaveLength(
      CURRENT_LEGACY_RECUT_PINS.expectedArtifact.bytes,
    );
    expect(Object.isFrozen(inspection.artifact)).toBe(true);
    expect(Object.isFrozen(inspection.artifact.relations)).toBe(true);
    expect(Object.isFrozen(inspection.artifact.relations[0].comparison)).toBe(true);
    expect(inspection.artifact.authority).toEqual(ABSENT_AUTHORITY);
  },
);

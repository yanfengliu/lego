import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";
import { afterEach, describe, expect, it } from "vitest";

import { createRealBuildSourceParityCalibrationCaptureArtifact } from "./real-build-observation-source-parity-calibration-capture";
import {
  createCalibrationCaptureTestFullPreparedPanelsManifestBytes,
  createCalibrationCaptureTestFullPanels,
  createCalibrationCaptureTestWire,
  createCalibrationCaptureTestWireForFullPreparedPanelsDigest,
} from "./real-build-observation-source-parity-calibration-capture-test-fixture";
import {
  parsePublishedRealBuildSourceParityCalibration,
  publishRealBuildSourceParityCalibration,
} from "./real-build-observation-source-parity-calibration-publication";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_EXECUTION_IDENTITY_SCHEMA,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
  type RealBuildSourceParityCalibrationPublicationSummary,
} from "./real-build-observation-source-parity-calibration-publication-types";
import { createRealBuildSourceParityCalibrationTestSourceClosure } from "./real-build-observation-source-parity-calibration-publication-test-fixture";
import { SOURCE_PARITY_TEST_PDF_DIGEST } from "./real-build-observation-source-parity-test-fixture";

const roots: string[] = [];
type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "lego-source-calibration-publication-"));
  roots.push(value);
  return value;
}

function fixture(repoRoot: string) {
  const pdfDigest = SOURCE_PARITY_TEST_PDF_DIGEST as Sha256Digest;
  const wire = createCalibrationCaptureTestWire(pdfDigest);
  const capture = createRealBuildSourceParityCalibrationCaptureArtifact({ browserCapture: wire });
  const fullPreparedPanelsManifestBytes =
    createCalibrationCaptureTestFullPreparedPanelsManifestBytes(pdfDigest);
  const closure = createRealBuildSourceParityCalibrationTestSourceClosure(repoRoot, {
    browserResultDigest: capture.manifest.browserCaptureDigest,
    browserResultBytes: capture.manifest.browserCaptureBytes,
    preparedPanelsDigest: capture.manifest.fullPreparedPanelsDigest,
  });
  return { capture, fullPreparedPanelsManifestBytes, ...closure };
}

function input(repoRoot: string) {
  return { repoRoot, ...fixture(repoRoot) };
}

function mutateFile(path: string): void {
  const bytes = readFileSync(path);
  bytes[Math.floor(bytes.length / 2)]! ^= 1;
  writeFileSync(path, bytes);
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("source-bound exact-five calibration publication", () => {
  it("publishes, reparses, and exposes fresh bytes without authority", () => {
    const repoRoot = root();
    const artifact = publishRealBuildSourceParityCalibration(input(repoRoot));
    expect(artifact.summary).toMatchObject({
      authority: { status: "absent", authorized: false, reason: "pending-human-review/1" },
      reviewState: "pending-unreviewed",
    });
    expect(Object.isFrozen(artifact.summary)).toBe(true);
    expect(Object.isFrozen(artifact.summary.roles)).toBe(true);
    expect(Object.isFrozen(artifact.summary.roles[0])).toBe(true);
    const first = artifact.readRole("calibration-high-rgba8");
    first[0]! ^= 1;
    expect(artifact.readRole("calibration-high-rgba8")[0]).not.toBe(first[0]);
    const parsed = parsePublishedRealBuildSourceParityCalibration({
      repoRoot,
      summaryPath: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
    });
    expect(parsed.executionIdentityDigest).toBe(artifact.executionIdentityDigest);
    expect(() =>
      parsePublishedRealBuildSourceParityCalibration({
        repoRoot,
        summaryPath: `${REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH}.other`,
      }),
    ).toThrow(/exact summary path/u);
    expect(() =>
      parsePublishedRealBuildSourceParityCalibration({
        repoRoot: ".",
        summaryPath: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
      }),
    ).toThrow(/resolved absolute path/u);
  });

  it("derives a canonical execution identity independent of caller provenance order", () => {
    const repoRoot = root();
    const leftInput = input(repoRoot);
    const rightInput = input(repoRoot);
    rightInput.provenance = [...rightInput.provenance].reverse();
    const left = publishRealBuildSourceParityCalibration(leftInput);
    const right = publishRealBuildSourceParityCalibration(rightInput);
    expect(left.executionIdentityDigest).toBe(right.executionIdentityDigest);
    const independent = canonicalDigest({
      schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_EXECUTION_IDENTITY_SCHEMA,
      captureManifestDigest: left.summary.captureManifest.digest,
      captureManifestBytes: left.summary.captureManifest.byteLength,
      sourceSnapshot: left.summary.sourceSnapshot,
      provenance: left.summary.provenance.map(({ role, digest, byteLength }) => ({
        role,
        digest,
        byteLength,
      })),
      fullPreparedPanelsManifestDigest: left.summary.fullPreparedPanelsManifest.digest,
      fullPreparedPanelsManifestBytes: left.summary.fullPreparedPanelsManifest.byteLength,
      roles: left.summary.roles.map((role) => ({
        role: role.role,
        contentEncoding: role.contentEncoding,
        byteLength: role.byteLength,
        digest: role.digest,
      })),
      pngs: left.summary.pngs.map((png) => ({
        stepNumber: png.stepNumber,
        scale: png.scale,
        mediaType: png.mediaType,
        byteLength: png.byteLength,
        digest: png.digest,
        width: png.width,
        height: png.height,
        rgbaDigest: png.rgbaDigest,
      })),
    });
    expect(left.executionIdentityDigest).toBe(independent);
  });

  it("rejects hostile outer input and caller identity before creating output", () => {
    const repoRoot = root();
    const valid = input(repoRoot);
    let traps = 0;
    const hostile = new Proxy(valid.provenance, {
      get: () => {
        traps += 1;
        throw new Error("provenance accessed");
      },
      getOwnPropertyDescriptor: () => {
        traps += 1;
        throw new Error("provenance descriptor accessed");
      },
    });
    const accessor = { ...valid };
    Object.defineProperty(accessor, "sourceSnapshot", {
      enumerable: true,
      get: () => {
        traps += 1;
        throw new Error("source snapshot getter invoked");
      },
    });
    for (const candidate of [
      { ...valid, provenance: hostile },
      accessor,
      { ...valid, executionIdentityDigest: `sha256:${"0".repeat(64)}` },
      { ...valid, fullPreparedPanelsManifestBytes: new Uint8Array(new SharedArrayBuffer(4)) },
      {
        ...valid,
        fullPreparedPanelsManifestBytes: new Uint8Array(4 * 1024 * 1024 + 1),
      },
    ]) {
      expect(() => publishRealBuildSourceParityCalibration(candidate)).toThrow();
      expect(existsSync(join(repoRoot, "output"))).toBe(false);
    }
    expect(traps).toBe(0);
  });

  it("rejects malformed and inconsistent full manifests before creating output", () => {
    for (const mutate of [
      (value: Mutable<Record<string, unknown>>) => {
        (value.panels as unknown[]).pop();
      },
      (value: Mutable<Record<string, unknown>>) => {
        const rows = value.panels as Mutable<Record<string, unknown>>[];
        rows[89]!.pageNumber = 80;
      },
    ]) {
      const repoRoot = root();
      const valid = input(repoRoot);
      const parsed = JSON.parse(
        new TextDecoder().decode(valid.fullPreparedPanelsManifestBytes),
      ) as Mutable<Record<string, unknown>>;
      mutate(parsed);
      valid.fullPreparedPanelsManifestBytes = new TextEncoder().encode(JSON.stringify(parsed));
      expect(() => publishRealBuildSourceParityCalibration(valid)).toThrow();
      expect(existsSync(join(repoRoot, "output"))).toBe(false);
    }
    const repoRoot = root();
    const valid = input(repoRoot);
    const deep = `{"schemaVersion":"x","authority":"absent","pdfDigest":"sha256:${"0".repeat(64)}","panels":${"[".repeat(10_000)}0${"]".repeat(10_000)}}`;
    valid.fullPreparedPanelsManifestBytes = new TextEncoder().encode(deep);
    expect(() => publishRealBuildSourceParityCalibration(valid)).toThrow();
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
    for (const bytes of [
      new Uint8Array([0xef, 0xbb, 0xbf, ...valid.fullPreparedPanelsManifestBytes]),
      new Uint8Array(new SharedArrayBuffer(4)),
    ]) {
      valid.fullPreparedPanelsManifestBytes = bytes;
      expect(() => publishRealBuildSourceParityCalibration(valid)).toThrow();
      expect(existsSync(join(repoRoot, "output"))).toBe(false);
    }
    const semanticallyWrong = createCalibrationCaptureTestFullPanels(
      SOURCE_PARITY_TEST_PDF_DIGEST as Sha256Digest,
    ).map((panel) => ({ ...panel }));
    semanticallyWrong[89]!.pageNumber = 78;
    const semanticallyWrongBytes = new TextEncoder().encode(
      JSON.stringify({
        schemaVersion: "lego.real-build-observation-source-parity-prepared-panels/1",
        authority: "absent",
        pdfDigest: SOURCE_PARITY_TEST_PDF_DIGEST,
        panels: semanticallyWrong.map(
          ({ stepNumber, pageNumber, calloutBoxes, panelEvidenceDigest, ...bounds }) => ({
            stepNumber,
            pageNumber,
            bounds,
            calloutBoxes,
            panelEvidenceDigest,
          }),
        ),
      }),
    );
    const semanticRepoRoot = root();
    const fullPreparedPanelsDigest = sourceDigest(semanticallyWrongBytes);
    const semanticCapture = createRealBuildSourceParityCalibrationCaptureArtifact({
      browserCapture: createCalibrationCaptureTestWireForFullPreparedPanelsDigest(
        SOURCE_PARITY_TEST_PDF_DIGEST as Sha256Digest,
        fullPreparedPanelsDigest,
      ),
    });
    const semanticClosure = createRealBuildSourceParityCalibrationTestSourceClosure(
      semanticRepoRoot,
      {
        browserResultDigest: semanticCapture.manifest.browserCaptureDigest,
        browserResultBytes: semanticCapture.manifest.browserCaptureBytes,
        preparedPanelsDigest: fullPreparedPanelsDigest,
      },
    );
    expect(() =>
      publishRealBuildSourceParityCalibration({
        repoRoot: semanticRepoRoot,
        capture: semanticCapture,
        fullPreparedPanelsManifestBytes: semanticallyWrongBytes,
        ...semanticClosure,
      }),
    ).toThrow(/printed step 90 to booklet page 79/u);
    expect(existsSync(join(semanticRepoRoot, "output"))).toBe(false);
  });

  it("rejects a coherently rebound source snapshot and environment that name other browser bytes", () => {
    const repoRoot = root();
    const valid = input(repoRoot);
    const falseDigest = `sha256:${"0".repeat(64)}`;
    const forged = createRealBuildSourceParityCalibrationTestSourceClosure(repoRoot, {
      browserResultDigest: falseDigest,
      browserResultBytes: valid.sourceSnapshot.browserResultBytes,
      preparedPanelsDigest: valid.sourceSnapshot.preparedPanelsDigest,
    });
    valid.sourceSnapshot = forged.sourceSnapshot;
    valid.provenance = forged.provenance;
    expect(() => publishRealBuildSourceParityCalibration(valid)).toThrow(
      /must match exact capture/u,
    );
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("rejects a late provenance semantic failure before creating output", () => {
    const repoRoot = root();
    const valid = input(repoRoot);
    const provenance = valid.provenance.map(({ role, digest, bytes }) => ({
      role,
      digest,
      bytes: new Uint8Array(bytes),
    }));
    const last = provenance.at(-1)!;
    last.bytes[0]! ^= 1;
    valid.provenance = provenance;
    expect(() => publishRealBuildSourceParityCalibration(valid)).toThrow(/bytes do not reproduce/u);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses forged summary identity, authority, and content-addressed path", () => {
    for (const { mutate, expected } of [
      {
        mutate: (summary: Mutable<Record<string, unknown>>) => {
          summary.executionIdentityDigest = `sha256:${"0".repeat(64)}`;
        },
        expected: /runDirectory/u,
      },
      {
        mutate: (summary: Mutable<Record<string, unknown>>) => {
          summary.authority = { status: "present", authorized: true, reason: "forged" };
        },
        expected: /authority/u,
      },
      {
        mutate: (summary: Mutable<Record<string, unknown>>) => {
          summary.runDirectory = "output/playwright/real-build-source-calibration/runs/forged";
        },
        expected: /runDirectory/u,
      },
    ]) {
      const repoRoot = root();
      publishRealBuildSourceParityCalibration(input(repoRoot));
      const summaryPath = join(
        repoRoot,
        REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
      );
      const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as Mutable<
        Record<string, unknown>
      >;
      mutate(summary);
      writeFileSync(summaryPath, canonicalStringify(summary));
      const sentinel = artifactContentPath(repoRoot, summary);
      rmSync(sentinel);
      expect(() =>
        parsePublishedRealBuildSourceParityCalibration({
          repoRoot,
          summaryPath: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
        }),
      ).toThrow(expected);
    }
  });

  it("re-reads and rejects tampering in every retained byte class", () => {
    for (const select of [
      (summary: RealBuildSourceParityCalibrationPublicationSummary) => summary.captureManifest.file,
      (summary: RealBuildSourceParityCalibrationPublicationSummary) =>
        summary.fullPreparedPanelsManifest.file,
      (summary: RealBuildSourceParityCalibrationPublicationSummary) => summary.roles[0]!.file,
      (summary: RealBuildSourceParityCalibrationPublicationSummary) => summary.pngs[0]!.file,
      (summary: RealBuildSourceParityCalibrationPublicationSummary) => summary.provenance[0]!.file,
    ] as const) {
      const repoRoot = root();
      const artifact = publishRealBuildSourceParityCalibration(input(repoRoot));
      mutateFile(join(repoRoot, select(artifact.summary)));
      expect(() =>
        parsePublishedRealBuildSourceParityCalibration({
          repoRoot,
          summaryPath: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
        }),
      ).toThrow(/hashes to|CONTENT_DIGEST_MISMATCH|digest/iu);
    }
  });
});

function artifactContentPath(repoRoot: string, summary: Mutable<Record<string, unknown>>): string {
  const capture = summary.captureManifest as { readonly file: string };
  return join(repoRoot, capture.file);
}

const sourceDigest = (bytes: Uint8Array): Sha256Digest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

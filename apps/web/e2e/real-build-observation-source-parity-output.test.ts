import { Buffer } from "node:buffer";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { realBuildSourceParityBrowserResultEvidence } from "./real-build-observation-source-parity-browser-result";
import { publishRealBuildObservationSourceParity } from "./real-build-observation-source-parity-output";
import {
  createRealBuildSourceParityTestFixture,
  createRealBuildSourceParityTestProvenance,
  SOURCE_PARITY_TEST_PNG,
  sourceParityTestDigest,
} from "./real-build-observation-source-parity-test-fixture";
import type {
  RealBuildSourceParityBrowserResult,
  RealBuildSourceParityProbeResult,
} from "./real-build-observation-source-parity-types";
import { stepPanelEvidenceDigest } from "./real-build-ledger";

const roots: string[] = [];
const root = (): string => {
  const created = mkdtempSync(join(tmpdir(), "lego-source-parity-publication-"));
  roots.push(created);
  return created;
};
type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const mutable = (
  value: RealBuildSourceParityProbeResult,
): Mutable<RealBuildSourceParityProbeResult> =>
  structuredClone(value) as Mutable<RealBuildSourceParityProbeResult>;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

const rewriteChunkCrc = (png: Buffer, offset: number): void => {
  const length = png.readUInt32BE(offset);
  let crc = 0xffffffff;
  for (const byte of png.subarray(offset + 4, offset + 8 + length)) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  png.writeUInt32BE((crc ^ 0xffffffff) >>> 0, offset + 8 + length);
};

const replaceCapture = (result: Mutable<RealBuildSourceParityProbeResult>, png: Buffer): void => {
  result.captures[0]!.digest = sourceParityTestDigest(png);
  result.captures[0]!.png = `data:image/png;base64,${png.toString("base64")}`;
};

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("source-parity publication", () => {
  it("publishes content-addressed roles before one bounded authority-absent summary", () => {
    const repoRoot = root();
    const published = publishRealBuildObservationSourceParity({
      repoRoot,
      result: createRealBuildSourceParityTestFixture(repoRoot),
      provenance: createRealBuildSourceParityTestProvenance(repoRoot),
    });
    const summary = JSON.parse(readFileSync(join(repoRoot, published.summaryPath), "utf8")) as {
      readonly schemaVersion: string;
      readonly authority: string;
      readonly panelCount: number;
      readonly captures: readonly { readonly file: string }[];
      readonly packedEvidence: readonly { readonly file: string }[];
      readonly provenance: readonly { readonly file: string }[];
    };
    expect(summary).toMatchObject({
      schemaVersion: "lego.real-build-observation-source-parity/4",
      authority: "absent",
      panelCount: 359,
    });
    expect(published.captureBytes).toBe(SOURCE_PARITY_TEST_PNG.length);
    expect(summary.captures).toHaveLength(1);
    expect(summary.packedEvidence).toHaveLength(2);
    expect(summary.provenance).toHaveLength(7);
    for (const role of [...summary.captures, ...summary.packedEvidence, ...summary.provenance]) {
      expect(existsSync(join(repoRoot, role.file))).toBe(true);
    }
  });

  it("refuses duplicate step/class keys before creating the output tree", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    result.steps[0]!.comparisons[1]!.sourceClass = "assembly";
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow("Duplicate source-parity comparison 1:assembly");
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses decreasing printed pages before creating the output tree", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    result.steps[0]!.pageNumber = 2;
    result.steps[1]!.pageNumber = 1;
    result.steps[0]!.panelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest: result.pdfDigest,
      stepNumber: 1,
      pageNumber: 2,
      bounds: {
        minXPt: result.steps[0]!.minXPt,
        maxXPt: result.steps[0]!.maxXPt,
        minYPt: result.steps[0]!.minYPt,
        maxYPt: result.steps[0]!.maxYPt,
      },
      calloutBoxes: result.steps[0]!.calloutBoxes,
    });
    result.steps[1]!.panelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest: result.pdfDigest,
      stepNumber: 2,
      pageNumber: 1,
      bounds: {
        minXPt: result.steps[1]!.minXPt,
        maxXPt: result.steps[1]!.maxXPt,
        minYPt: result.steps[1]!.minYPt,
        maxYPt: result.steps[1]!.maxYPt,
      },
      calloutBoxes: result.steps[1]!.calloutBoxes,
    });
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/precedes prior page/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses dimensions that do not reproduce the shared prepared-bounds geometry", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    result.steps[0]!.width = 499;
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/exact prepared bounds require 500x1/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses a declared diagnostic size that disagrees with PNG IHDR before writing", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    result.captures[0]!.width = 2;
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/IHDR is 512x1, not 2x1/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses a PNG with a corrupt chunk CRC before writing", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    const corrupt = Buffer.from(SOURCE_PARITY_TEST_PNG);
    corrupt[41] = corrupt[41]! ^ 1;
    replaceCapture(result, corrupt);
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/invalid CRC/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses an illegal IHDR color-type and bit-depth combination", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    const malformed = Buffer.from(SOURCE_PARITY_TEST_PNG);
    malformed[24] = 1;
    rewriteChunkCrc(malformed, 8);
    replaceCapture(result, malformed);
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/must be bounded RGBA8/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses CRC-valid PNG bytes whose IDAT stream cannot decode", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    const malformed = Buffer.from(SOURCE_PARITY_TEST_PNG);
    malformed[41] = 0;
    rewriteChunkCrc(malformed, 33);
    replaceCapture(result, malformed);
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/not a bounded decodable RGBA8 zlib stream/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses custom array prototypes before inherited methods can bypass validation", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    Object.setPrototypeOf(result.captures, { map: () => [] });
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/ordinary dense Array/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses NaN lowered limits instead of disabling the hard cap", () => {
    const repoRoot = root();
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result: createRealBuildSourceParityTestFixture(repoRoot),
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
        __testLimits: { maximumAggregateCaptureBytes: Number.NaN },
      }),
    ).toThrow(/must be a safe integer/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses proxied test limits before reading their hostile traps", () => {
    const repoRoot = root();
    let read = false;
    const limits = new Proxy(
      { maximumCaptureBytes: 1 },
      {
        ownKeys: () => {
          read = true;
          return [];
        },
      },
    );
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result: createRealBuildSourceParityTestFixture(repoRoot),
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
        __testLimits: limits,
      }),
    ).toThrow(/non-proxy plain data record/);
    expect(read).toBe(false);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses a comparison whose production mask reference is absent", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    result.steps[89]!.comparisons[0]!.productionEvidencePackedDigest =
      sourceParityTestDigest("missing-production");
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/production mask is missing or mis-sized/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("refuses aggregate capture bytes before creating an output directory", () => {
    const repoRoot = root();
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result: createRealBuildSourceParityTestFixture(repoRoot),
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
        __testLimits: { maximumAggregateCaptureBytes: SOURCE_PARITY_TEST_PNG.length - 1 },
      }),
    ).toThrow(/exceed bounded byte budgets/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("canonicalizes role order and record property insertion before measurement hashing", () => {
    const repoRoot = root();
    const first = createRealBuildSourceParityTestFixture(repoRoot);
    const second = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    second.sourceSnapshot = Object.fromEntries(
      Object.entries(second.sourceSnapshot).reverse(),
    ) as Mutable<RealBuildSourceParityProbeResult>["sourceSnapshot"];
    const measurement = (rootPath: string): string =>
      (
        JSON.parse(
          readFileSync(
            join(rootPath, "output/playwright/real-build-source-parity/summary.json"),
            "utf8",
          ),
        ) as { readonly measurementDigest: string }
      ).measurementDigest;
    publishRealBuildObservationSourceParity({
      repoRoot,
      result: first,
      provenance: createRealBuildSourceParityTestProvenance(repoRoot),
    });
    const firstMeasurement = measurement(repoRoot);
    publishRealBuildObservationSourceParity({
      repoRoot,
      result: second,
      provenance: createRealBuildSourceParityTestProvenance(repoRoot).reverse(),
    });
    expect(measurement(repoRoot)).toBe(firstMeasurement);
  });

  it("refuses mutated served-source bytes before creating the output tree", () => {
    const repoRoot = root();
    const provenance = createRealBuildSourceParityTestProvenance(repoRoot);
    const bundle = provenance.find(({ role }) => role === "served-source-bundle")!;
    bundle.bytes[0] = bundle.bytes[0]! ^ 1;
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result: createRealBuildSourceParityTestFixture(repoRoot),
        provenance,
      }),
    ).toThrow(/bytes do not reproduce/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("recomputes the exact detached browser-result digest before publication", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    const provenance = createRealBuildSourceParityTestProvenance(repoRoot);
    const environment = provenance.find(({ role }) => role === "execution-environment")! as {
      role: string;
      digest: string;
      bytes: Uint8Array;
    };
    const parsed = JSON.parse(Buffer.from(environment.bytes).toString("utf8")) as Record<
      string,
      unknown
    >;
    const falseDigest = sourceParityTestDigest("false-browser-result");
    result.sourceSnapshot.browserResultDigest = falseDigest;
    parsed.browserResultDigest = falseDigest;
    const rebound = Buffer.from(`${JSON.stringify(parsed)}\n`);
    environment.bytes = rebound;
    environment.digest = sourceParityTestDigest(rebound);
    result.sourceSnapshot.environmentDigest = environment.digest;
    expect(() => publishRealBuildObservationSourceParity({ repoRoot, result, provenance })).toThrow(
      /Detached source-parity browser result does not reproduce/,
    );
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("labels forged syntax-valid browser commitments as opaque, not reproduced derivation", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    result.steps[0]!.candidateDerivationBrowserCommitmentDigest = sourceParityTestDigest(
      "forged-browser-derivation-commitment",
    );
    const browserResult = Object.fromEntries(
      Object.entries(result).filter(([key]) => key !== "sourceSnapshot"),
    ) as unknown as RealBuildSourceParityBrowserResult;
    const evidence = realBuildSourceParityBrowserResultEvidence(browserResult);
    result.sourceSnapshot.browserResultDigest = evidence.digest;
    result.sourceSnapshot.browserResultBytes = evidence.bytes;
    const provenance = createRealBuildSourceParityTestProvenance(repoRoot);
    const environment = provenance.find(({ role }) => role === "execution-environment")! as {
      role: string;
      digest: string;
      bytes: Uint8Array;
    };
    const parsedEnvironment = JSON.parse(Buffer.from(environment.bytes).toString("utf8")) as Record<
      string,
      unknown
    >;
    parsedEnvironment.browserResultDigest = evidence.digest;
    parsedEnvironment.browserResultBytes = evidence.bytes;
    environment.bytes = Buffer.from(`${JSON.stringify(parsedEnvironment)}\n`);
    environment.digest = sourceParityTestDigest(environment.bytes);
    result.sourceSnapshot.environmentDigest = environment.digest;
    const published = publishRealBuildObservationSourceParity({ repoRoot, result, provenance });
    const summary = JSON.parse(readFileSync(join(repoRoot, published.summaryPath), "utf8")) as {
      readonly schemaVersion: string;
      readonly browserCommitments: {
        readonly schemaVersion: string;
        readonly status: string;
        readonly fields: readonly string[];
      };
      readonly browserAssertedDerivationStages: unknown;
      readonly derivationStages?: unknown;
    };
    expect(summary).toMatchObject({
      schemaVersion: "lego.real-build-observation-source-parity/4",
      browserCommitments: {
        schemaVersion: "lego.real-build-observation-source-parity-browser-commitments/1",
        status: "opaque-browser-assertions-not-independently-reproduced",
      },
    });
    expect(summary.browserCommitments.fields).toContain(
      "steps[].candidateDerivationBrowserCommitmentDigest",
    );
    expect(summary.browserAssertedDerivationStages).toBeDefined();
    expect(summary.derivationStages).toBeUndefined();
  });

  it("rejects the prior /3 step commitment field names instead of reinterpreting them", () => {
    const repoRoot = root();
    const result = mutable(createRealBuildSourceParityTestFixture(repoRoot));
    const step = result.steps[0]! as unknown as Record<string, unknown>;
    step.workRgbaDigest = step.workRgbaBrowserCommitmentDigest;
    delete step.workRgbaBrowserCommitmentDigest;
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result,
        provenance: createRealBuildSourceParityTestProvenance(repoRoot),
      }),
    ).toThrow(/Source-parity step 1 must contain exactly/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });

  it("uses intrinsic provenance byte bounds instead of shadow properties", () => {
    const repoRoot = root();
    const provenance = createRealBuildSourceParityTestProvenance(repoRoot);
    const role = provenance.find(({ role }) => role === "bootstrap-source-manifest")! as {
      role: string;
      digest: string;
      bytes: Uint8Array;
    };
    const bytes = Uint8Array.from(role.bytes);
    Object.defineProperties(bytes, {
      buffer: { value: new SharedArrayBuffer(1) },
      byteLength: { value: 1 },
      byteOffset: { value: Number.MAX_SAFE_INTEGER },
    });
    role.bytes = bytes;
    expect(
      publishRealBuildObservationSourceParity({
        repoRoot,
        result: createRealBuildSourceParityTestFixture(repoRoot),
        provenance,
      }).summaryPath,
    ).toBe("output/playwright/real-build-source-parity/summary.json");
  });

  it("refuses SharedArrayBuffer-backed provenance bytes before copying or writing", () => {
    const repoRoot = root();
    const provenance = createRealBuildSourceParityTestProvenance(repoRoot);
    const role = provenance.find(({ role }) => role === "bootstrap-source-manifest")! as {
      role: string;
      digest: string;
      bytes: Uint8Array;
    };
    const shared = new Uint8Array(new SharedArrayBuffer(role.bytes.byteLength));
    shared.set(role.bytes);
    role.bytes = shared;
    expect(() =>
      publishRealBuildObservationSourceParity({
        repoRoot,
        result: createRealBuildSourceParityTestFixture(repoRoot),
        provenance,
      }),
    ).toThrow(/bootstrap-source-manifest bytes may not use SharedArrayBuffer backing/);
    expect(existsSync(join(repoRoot, "output"))).toBe(false);
  });
});

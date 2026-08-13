import { canonicalStringify, sha256Hex } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { derivePanelArtStages } from "../src/assembly/panel-art-stages";
import { parseRealBuildObservationSourceStageTrace } from "./real-build-observation-source-stage-trace-parser";
import { createRealBuildObservationSourceStageTrace } from "./real-build-observation-source-stage-trace-trace";
import { MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES } from "./real-build-observation-source-stage-trace-types";

const PAGE = 0x899093;
const HASH = `sha256:${"1".repeat(64)}` as const;

function rgba(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    pixels[pixel * 4] = 0x89;
    pixels[pixel * 4 + 1] = 0x90;
    pixels[pixel * 4 + 2] = 0x93;
    pixels[pixel * 4 + 3] = 255;
  }
  return pixels;
}

function paint(pixels: Uint8ClampedArray, width: number, x: number, y: number): void {
  const at = (y * width + x) * 4;
  pixels[at] = 0x20;
  pixels[at + 1] = 0x20;
  pixels[at + 2] = 0x20;
}

function panelInput() {
  const width = 7;
  const height = 3;
  const pixels = rgba(width, height);
  for (let x = 0; x < 5; x += 1) paint(pixels, width, x, 1);
  for (let y = 0; y < 3; y += 1) paint(pixels, width, 6, y);
  const stages = derivePanelArtStages({
    raster: { width, height, pixels },
    workFactor: 2,
    backgroundHex: PAGE,
  });
  return {
    stepNumber: 90,
    pageNumber: 44,
    source: {
      schemaVersion: "lego.real-build-observation-source-stage-opaque-provenance/1" as const,
      reproduction: "not-claimed" as const,
      pdfDigest: HASH,
      panelEvidenceDigest: HASH,
      cropDescriptorDigest: HASH,
      policyDescriptorDigest: HASH,
      workPixelsDigest: HASH,
    },
    stages,
  };
}

function artifact() {
  return createRealBuildObservationSourceStageTrace([panelInput()]);
}

function parsedManifest(bytes: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

function manifestBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalStringify(value));
}

function digest(bytes: Uint8Array): string {
  return `sha256:${sha256Hex(bytes)}`;
}

function panel(manifest: Record<string, unknown>): Record<string, unknown> {
  return (manifest.panels as Record<string, unknown>[])[0]!;
}

function references(manifest: Record<string, unknown>): Record<string, unknown>[] {
  return panel(manifest).stages as Record<string, unknown>[];
}

function unpack(packed: Uint8Array, pixels: number): Uint8Array {
  const result = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    result[pixel] = (packed[pixel >>> 3]! >>> (7 - (pixel & 7))) & 1;
  }
  return result;
}

function rebindMutatedStage(
  manifest: Record<string, unknown>,
  role: Uint8Array,
  stageIndex: number,
): void {
  const reference = references(manifest)[stageIndex]!;
  const offset = reference.offset as number;
  const bytes = reference.bytes as number;
  const packed = role.subarray(offset, offset + bytes);
  reference.packedDigest = digest(packed);
  reference.unpackedDigest = digest(unpack(packed, reference.pixelCount as number));
  (manifest.role as Record<string, unknown>).digest = digest(role);
}

function expectManifestMutation(
  mutate: (manifest: Record<string, unknown>) => void,
  expected: RegExp,
): void {
  const retained = artifact();
  const manifest = parsedManifest(retained.readManifestBytes());
  mutate(manifest);
  expect(() =>
    parseRealBuildObservationSourceStageTrace(manifestBytes(manifest), retained.readRoleBytes()),
  ).toThrow(expected);
}

describe("observation source stage trace", () => {
  it("round-trips exact external bytes without authority, base64, or mutable aliases", () => {
    const retained = artifact();
    const firstManifest = retained.readManifestBytes();
    const firstRole = retained.readRoleBytes();
    const originalManifestByte = firstManifest[0]!;
    const originalRoleByte = firstRole[0]!;
    firstManifest[0] = firstManifest[0]! ^ 0xff;
    firstRole[0] = firstRole[0]! ^ 0xff;

    expect(retained.readManifestBytes()[0]).toBe(originalManifestByte);
    expect(retained.readRoleBytes()[0]).toBe(originalRoleByte);
    expect(new TextDecoder().decode(retained.readManifestBytes())).not.toContain("base64");

    const parsed = parseRealBuildObservationSourceStageTrace(
      retained.readManifestBytes(),
      retained.readRoleBytes(),
    );
    expect(parsed.authority).toStrictEqual({
      status: "absent",
      authorized: false,
      reason: "observation-source-stage-trace-is-inspection-only/1",
    });
    expect(parsed.panels[0]!.workOnlyStage.status).toBe("missing");
    expect(parsed.panels[0]!.source.reproduction).toBe("not-claimed");
  });

  it("rejects a UTF-8 byte-order mark even when the decoded JSON is canonical", () => {
    const retained = artifact();
    const manifest = retained.readManifestBytes();
    const withBom = new Uint8Array(manifest.length + 3);
    withBom.set([0xef, 0xbb, 0xbf]);
    withBom.set(manifest, 3);

    expect(() =>
      parseRealBuildObservationSourceStageTrace(withBom, retained.readRoleBytes()),
    ).toThrow(/do not round-trip byte-for-byte.*without a byte-order mark/su);
  });

  it("names role-stage authority, factor, and work-dimension mismatches", () => {
    const input = panelInput();
    expect(() =>
      createRealBuildObservationSourceStageTrace([
        { ...input, stages: { ...input.stages, authority: "present" } as never },
      ]),
    ).toThrow(/stages\.authority observed present; expected absent/su);
    expect(() =>
      createRealBuildObservationSourceStageTrace([
        { ...input, stages: { ...input.stages, workFactor: 0 } },
      ]),
    ).toThrow(/stages\.workFactor observed 0; expected a safe integer from 1 through 4/su);
    expect(() =>
      createRealBuildObservationSourceStageTrace([
        { ...input, stages: { ...input.stages, workWidth: input.stages.workWidth + 1 } },
      ]),
    ).toThrow(/stages\.workWidth observed 5; expected 4 from ceil\(7\/2\)/su);
  });

  it("names source and uncoupled work-only leaves separately", () => {
    expectManifestMutation((manifest) => {
      const source = panel(manifest).source as Record<string, unknown>;
      source.schemaVersion = "hostile-source-schema";
    }, /stageTrace\.panels\[0\]\.source\.schemaVersion observed "hostile-source-schema"; expected "lego\.real-build-observation-source-stage-opaque-provenance\/1"/su);
    expectManifestMutation((manifest) => {
      const source = panel(manifest).source as Record<string, unknown>;
      source.reproduction = "claimed";
    }, /stageTrace\.panels\[0\]\.source\.reproduction observed "claimed"; expected "not-claimed"/su);
    expectManifestMutation((manifest) => {
      const workOnly = panel(manifest).workOnlyStage as Record<string, unknown>;
      workOnly.status = "present";
    }, /stageTrace\.panels\[0\]\.workOnlyStage\.status observed "present"; expected "missing"/su);
    expectManifestMutation((manifest) => {
      const workOnly = panel(manifest).workOnlyStage as Record<string, unknown>;
      workOnly.reason = "hostile-reason";
    }, /stageTrace\.panels\[0\]\.workOnlyStage\.reason observed "hostile-reason"; expected "work-raster-candidate-is-not-coupled-to-panel-art-stages\/1"/su);
  });

  it("names authority and coverage leaves separately", () => {
    expectManifestMutation((manifest) => {
      (manifest.authority as Record<string, unknown>).status = "present";
    }, /stageTrace\.authority\.status observed "present"; expected "absent"/su);
    expectManifestMutation((manifest) => {
      (manifest.authority as Record<string, unknown>).authorized = true;
    }, /stageTrace\.authority\.authorized observed true; expected false/su);
    expectManifestMutation((manifest) => {
      (manifest.authority as Record<string, unknown>).reason = "hostile-reason";
    }, /stageTrace\.authority\.reason observed "hostile-reason"; expected "observation-source-stage-trace-is-inspection-only\/1"/su);
    expectManifestMutation((manifest) => {
      (manifest.coverage as Record<string, unknown>).expectedPanelCount = 358;
    }, /stageTrace\.coverage\.expectedPanelCount observed 358; expected 359/su);
    expectManifestMutation((manifest) => {
      (manifest.coverage as Record<string, unknown>).retainedPanelCount = 2;
    }, /stageTrace\.coverage\.retainedPanelCount observed 2; expected 1/su);
    expectManifestMutation((manifest) => {
      (manifest.coverage as Record<string, unknown>).status = "complete";
    }, /stageTrace\.coverage\.status observed "complete"; expected "partial"/su);
  });

  it("rejects packed tamper, non-zero padding, reordered stages, and authority claims", () => {
    const retained = artifact();
    const packedTamper = retained.readRoleBytes();
    packedTamper[0] = packedTamper[0]! ^ 0x80;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(retained.readManifestBytes(), packedTamper),
    ).toThrow(
      /stageTrace\.role does not bind external digest: observed sha256:.*expected sha256:/su,
    );

    const sliceDigestManifest = parsedManifest(retained.readManifestBytes());
    const sliceDigestRole = retained.readRoleBytes();
    sliceDigestRole[0] = sliceDigestRole[0]! ^ 0x80;
    (sliceDigestManifest.role as Record<string, unknown>).digest = digest(sliceDigestRole);
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(sliceDigestManifest),
        sliceDigestRole,
      ),
    ).toThrow(
      /stageTrace\.panels\[0\]\.stages\[0\]\.packedDigest observed sha256:.*; expected sha256:/su,
    );

    const logicalDigestManifest = parsedManifest(retained.readManifestBytes());
    references(logicalDigestManifest)[0]!.unpackedDigest = `sha256:${"f".repeat(64)}`;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(logicalDigestManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(
      /stageTrace\.panels\[0\]\.stages\[0\]\.unpackedDigest observed sha256:.*; expected sha256:ffff/su,
    );

    const shortRole = retained.readRoleBytes().subarray(0, retained.readRoleBytes().length - 1);
    expect(() =>
      parseRealBuildObservationSourceStageTrace(retained.readManifestBytes(), shortRole),
    ).toThrow(/stageTrace\.role does not bind external byte length: observed 8; expected 9/su);

    const paddingManifest = parsedManifest(retained.readManifestBytes());
    const paddingRole = retained.readRoleBytes();
    const high = references(paddingManifest)[0]!;
    const paddingByte = (high.offset as number) + (high.bytes as number) - 1;
    paddingRole[paddingByte] = paddingRole[paddingByte]! | 1;
    rebindMutatedStage(paddingManifest, paddingRole, 0);
    expect(() =>
      parseRealBuildObservationSourceStageTrace(manifestBytes(paddingManifest), paddingRole),
    ).toThrow(
      /stageTrace\.panels\[0\]\.stages\[0\]\.packedBytes observed non-zero low MSB padding bits/su,
    );

    const orderManifest = parsedManifest(retained.readManifestBytes());
    const ordered = references(orderManifest);
    [ordered[1], ordered[2]] = [ordered[2]!, ordered[1]!];
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(orderManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(
      /stageTrace\.panels\[0\]\.stages\[1\]\.stage observed "high-printed-furniture-downsampled"; expected "high-art-key-downsampled"/su,
    );
  });

  it("names fixed references and exact bounded high/work dimensions", () => {
    const retained = artifact();
    const referenceManifest = parsedManifest(retained.readManifestBytes());
    references(referenceManifest)[0]!.scale = "work";
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(referenceManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(/stageTrace\.panels\[0\]\.stages\[0\]\.scale observed "work"; expected "high"/su);

    const relationshipManifest = parsedManifest(retained.readManifestBytes());
    const dimensions = panel(relationshipManifest).dimensions as Record<string, unknown>;
    dimensions.workWidth = 5;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(relationshipManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(
      /stageTrace\.panels\[0\]\.dimensions\.workWidth observed 5; expected 4 from ceil\(7\/2\)/su,
    );

    const capManifest = parsedManifest(retained.readManifestBytes());
    const cappedDimensions = panel(capManifest).dimensions as Record<string, unknown>;
    cappedDimensions.highWidth = 4_194_304;
    cappedDimensions.highHeight = 2;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(capManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(/high raster observed 4194304x2 = 8388608 pixels; expected at most 4194304/su);
  });

  it("names each derived component and topology mismatch separately", () => {
    const retained = artifact();
    const highManifest = parsedManifest(retained.readManifestBytes());
    const highComponents = panel(highManifest).highComponents as Record<string, unknown>;
    highComponents.componentCount = (highComponents.componentCount as number) + 1;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(highManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(/stageTrace\.panels\[0\]\.highComponents observed .*; expected /su);

    const topologyManifest = parsedManifest(retained.readManifestBytes());
    const topology = panel(topologyManifest).topology as Record<string, unknown>;
    topology.differingPixels = (topology.differingPixels as number) + 1;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(
        manifestBytes(topologyManifest),
        retained.readRoleBytes(),
      ),
    ).toThrow(/stageTrace\.panels\[0\]\.topology observed .*; expected /su);
  });

  it("rejects self-consistent digests when a derived stage no longer follows H/P/D", () => {
    const retained = artifact();
    const manifest = parsedManifest(retained.readManifestBytes());
    const role = retained.readRoleBytes();
    const cleaned = references(manifest)[4]!;
    const cleanedOffset = cleaned.offset as number;
    role[cleanedOffset] = role[cleanedOffset]! ^ 0x80;
    rebindMutatedStage(manifest, role, 4);

    expect(() => parseRealBuildObservationSourceStageTrace(manifestBytes(manifest), role)).toThrow(
      /cleaned stages do not reproduce exact point-downsampling/su,
    );
  });

  it("refuses declared role work beyond the 128 MiB budget before copying role bytes", () => {
    const retained = artifact();
    const manifest = parsedManifest(retained.readManifestBytes());
    (manifest.role as Record<string, unknown>).bytes =
      MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES + 1;
    expect(() =>
      parseRealBuildObservationSourceStageTrace(manifestBytes(manifest), new Uint8Array(0)),
    ).toThrow(/role\.bytes.*1.*134217728/su);
  });
});

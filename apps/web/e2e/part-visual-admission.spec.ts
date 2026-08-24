import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { getPartDefinition } from "@lego-studio/catalog";
import { PART_VISUAL_ADMISSION_VIEW_NAMES } from "@lego-studio/rendering";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

import type {
  PartVisualAdmissionCaptureInput,
  PartVisualAdmissionCaptureResult,
} from "../src/part-visual-admission-renderer.ts";
import { publishPartVisualAdmissionPacket } from "./part-visual-admission-artifacts.ts";
import { readVerifiedMaterializedLDrawClosure } from "./part-visual-admission-source.ts";
import {
  SYNTHETIC_VISUAL_ADMISSION_ASSET,
  SYNTHETIC_VISUAL_ADMISSION_DEFINITION,
} from "./part-visual-admission-fixture.ts";

function runMaterializer(arguments_: readonly string[], output: string): string {
  mkdirSync(dirname(output), { recursive: true });
  const result = spawnSync(
    process.env.PYTHON ?? "python",
    ["-B", "scripts/materialize-ldraw-visual-admission.py", ...arguments_, "--output", output],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `LDraw visual-admission materializer failed with status ${String(result.status)}: ${result.error?.message ?? ""}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }
  return join(output, "manifest.json");
}

function libraryUrl(libraryPath: string): string {
  return `/@fs/${libraryPath.replaceAll("\\", "/")}/`;
}

async function capture(page: Page, input: PartVisualAdmissionCaptureInput) {
  await page.goto("/visual-admission.html");
  await page.waitForFunction(() => typeof window.run_part_visual_admission === "function");
  return page.evaluate(
    (captureInput) => window.run_part_visual_admission!(captureInput),
    input,
  ) as Promise<PartVisualAdmissionCaptureResult>;
}

async function routeMaterializedClosure(
  page: Page,
  source: ReturnType<typeof readVerifiedMaterializedLDrawClosure>,
): Promise<void> {
  const prefix = libraryUrl(source.libraryPath);
  const records = new Map(
    source.closure.map((record) => [record.materializedPath.slice("library/".length), record]),
  );
  await page.route(`**${prefix}**`, async (route) => {
    const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
    const offset = requestPath.indexOf(prefix);
    const relativePath = offset === -1 ? "" : requestPath.slice(offset + prefix.length);
    const record = records.get(relativePath);
    if (record === undefined) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "not in exact closure" });
      return;
    }
    const path = join(dirname(source.manifestPath), ...record.materializedPath.split("/"));
    const info = lstatSync(path);
    const bytes = readFileSync(path);
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (
      info.isSymbolicLink() ||
      !info.isFile() ||
      bytes.length !== record.bytes ||
      digest !== record.sha256
    ) {
      throw new Error(
        `Materialized visual-admission route ${record.fileId} changed before LDrawLoader read it: ${bytes.length} bytes/${digest}, expected ${record.bytes} bytes/${record.sha256}.`,
      );
    }
    await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: bytes });
  });
}

function expectCleanCapture(result: PartVisualAdmissionCaptureResult): void {
  expect(result.captures.map(({ side, viewName }) => `${side}:${viewName}`)).toEqual(
    (["source", "candidate"] as const).flatMap((side) =>
      PART_VISUAL_ADMISSION_VIEW_NAMES.map((viewName) => `${side}:${viewName}`),
    ),
  );
  expect(result.captures.map(({ projection }) => projection)).toEqual([
    ...Array(6).fill("orthographic"),
    "perspective",
    "perspective",
    ...Array(6).fill("orthographic"),
    "perspective",
    "perspective",
  ]);
  expect(result.sceneAudit).toMatchObject({
    gridHelpers: 0,
    shadowCasters: 0,
    shadowReceivers: 0,
    selectionObjects: 0,
    sharedMaterialInstances: 1,
    primaryMaterialSide: "FrontSide",
  });
  expect(result.cleanup).toMatchObject({
    rendererDisposed: true,
    contextLossRequested: true,
    canvasRemoved: true,
    canvasesRemaining: 0,
  });
}

function publish(
  result: PartVisualAdmissionCaptureResult,
  manifestPath: string,
  browser: Browser,
  outputRoot: string,
  timestamp?: string,
) {
  const source = readVerifiedMaterializedLDrawClosure(manifestPath);
  return publishPartVisualAdmissionPacket({
    outputRoot,
    source,
    capture: result,
    browserVersion: browser.version(),
    ...(timestamp === undefined ? {} : { timestamp }),
  });
}

test("synthetic asymmetric source and production candidate emit one clean immutable 8-view packet", async ({
  page,
  browser,
}, testInfo: TestInfo) => {
  test.setTimeout(120_000);
  const materialized = testInfo.outputPath("materialized-source");
  const manifestPath = runMaterializer(["--synthetic-fixture"], materialized);
  const source = readVerifiedMaterializedLDrawClosure(manifestPath);
  await routeMaterializedClosure(page, source);
  const result = await capture(page, {
    source: {
      libraryUrl: libraryUrl(source.libraryPath),
      rootPath: source.root.path,
      materializedClosureDigest: source.manifestDigest,
    },
    candidate: {
      kind: "synthetic",
      catalogId: SYNTHETIC_VISUAL_ADMISSION_DEFINITION.id,
      definition: SYNTHETIC_VISUAL_ADMISSION_DEFINITION,
      meshAsset: SYNTHETIC_VISUAL_ADMISSION_ASSET,
    },
  });
  for (const timestamp of ["2026-02-30T00:00:00.000Z", "2026-01-01T24:00:00.000Z"]) {
    expect(() =>
      publish(
        result,
        manifestPath,
        browser,
        testInfo.outputPath(`invalid-timestamp-${timestamp.slice(0, 10)}`),
        timestamp,
      ),
    ).toThrow(/canonical UTC/u);
  }
  const publication = publish(result, manifestPath, browser, testInfo.outputPath("packet-output"));
  await testInfo.attach("part-visual-admission-packet", {
    path: publication.packetPath,
    contentType: "application/json",
  });

  expectCleanCapture(result);
  [0.55, -0.65, -1.25].forEach((value, axis) =>
    expect(result.sourceBounds.min[axis]).toBeCloseTo(value, 6),
  );
  [1.55, 0.35, 0.25].forEach((value, axis) =>
    expect(result.sourceBounds.max[axis]).toBeCloseTo(value, 6),
  );
  result.sourceBounds.min.forEach((value, axis) =>
    expect(result.candidateBounds.min[axis]).toBeCloseTo(value, 6),
  );
  result.sourceBounds.max.forEach((value, axis) =>
    expect(result.candidateBounds.max[axis]).toBeCloseTo(value, 6),
  );
  expect(result.cameraPacket.sourceBounds).toEqual(result.sourceBounds);
  expect(result.cameraPacket.candidateBounds).toEqual(result.candidateBounds);
  expect(result.metrics).toEqual(
    PART_VISUAL_ADMISSION_VIEW_NAMES.map((viewName) => ({
      viewName,
      differingPixelCount: 0,
      meanAbsoluteRgbDelta: 0,
      maximumChannelDelta: 0,
      foregroundIntersectionOverUnion: 1,
      sourceForegroundPixels: expect.any(Number),
      candidateForegroundPixels: expect.any(Number),
    })),
  );
  const sourceCaptures = result.captures.slice(0, PART_VISUAL_ADMISSION_VIEW_NAMES.length);
  const candidateCaptures = result.captures.slice(PART_VISUAL_ADMISSION_VIEW_NAMES.length);
  expect(candidateCaptures.map(({ rgbaSha256 }) => rgbaSha256)).toEqual(
    sourceCaptures.map(({ rgbaSha256 }) => rgbaSha256),
  );
  expect(new Set(sourceCaptures.map(({ rgbaSha256 }) => rgbaSha256)).size).toBeGreaterThan(4);
  expect(sourceCaptures[2]!.rgbaSha256).not.toBe(sourceCaptures[3]!.rgbaSha256);
  expect(sourceCaptures[4]!.rgbaSha256).not.toBe(sourceCaptures[5]!.rgbaSha256);

  expect(publication.packet.reviewState).toBe("pending");
  expect(publication.packet.images).toHaveLength(16);
  expect(publication.packet.images.map(({ viewName }) => viewName)).toEqual([
    ...PART_VISUAL_ADMISSION_VIEW_NAMES,
    ...PART_VISUAL_ADMISSION_VIEW_NAMES,
  ]);
});

const realArchiveRequested = process.env.LEGO_PART_VISUAL_ADMISSION_REQUIRED === "1";

const ALL_SOURCE_NORMAL_MESH_PART_IDS = [
  "builtin:wedge-plate-2x4-left",
  "builtin:wedge-plate-2x4-right",
  "builtin:wedge-plate-2x3-left",
  "builtin:wedge-plate-2x3-right",
  "builtin:arch-1x4",
  "builtin:arch-1x6",
  "builtin:curved-slope-1x2",
  "builtin:curved-slope-1x3",
  "builtin:curved-slope-1x4",
  "builtin:cheese-slope-1x1",
  "builtin:cheese-slope-2x1",
  "builtin:wedge-plate-3x6-right",
  "builtin:wedge-plate-4x4-cut-corner",
  "builtin:wedge-plate-6x6-cut-corner",
  "builtin:corner-plate-4x4-round",
  "builtin:corner-plate-5x5-quarter-ring",
  "builtin:tile-1x2-cut-right-45",
  "builtin:plate-1x2-round-end",
  "builtin:wedge-plate-2x4-wing",
  "builtin:corner-plate-3x3",
  "builtin:curved-slope-1x4-double",
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:tile-2x2-triangular",
  "builtin:roller-skate",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:brick-1x2-grille",
  "builtin:slope-1x2-45",
  "builtin:axle-1x3",
  "builtin:technic-brick-1x2-axle-hole",
  "builtin:plate-3x3",
] as const;

function requiredRealPartIds(): readonly string[] {
  const encoded = process.env.LEGO_PART_VISUAL_ADMISSION_PART_IDS;
  if (encoded === undefined) {
    throw new Error(
      "Required real visual admission has no LEGO_PART_VISUAL_ADMISSION_PART_IDS selection; invoke npm run parts:visual-capture with explicit archives and output.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch (error) {
    throw new Error(
      `Required real visual-admission part selection is not JSON: ${String(error)}.`,
      {
        cause: error,
      },
    );
  }
  const allowed = new Set<string>(ALL_SOURCE_NORMAL_MESH_PART_IDS);
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some((part) => typeof part !== "string" || !allowed.has(part)) ||
    new Set(parsed).size !== parsed.length
  ) {
    throw new Error(
      `Required real visual-admission part selection must contain unique admitted ids from ${JSON.stringify(ALL_SOURCE_NORMAL_MESH_PART_IDS)}; received ${encoded}.`,
    );
  }
  return parsed as string[];
}

test("opt-in real archive source and builtin candidate emit a retained packet", async ({
  page,
  browser,
}, testInfo: TestInfo) => {
  test.skip(
    !realArchiveRequested,
    "Set LEGO_PART_VISUAL_ADMISSION_REQUIRED=1 to require real pinned-archive visual admission.",
  );
  test.setTimeout(900_000);
  const officialArchive = process.env.LEGO_PART_VISUAL_ADMISSION_OFFICIAL_ARCHIVE;
  const unofficialArchive = process.env.LEGO_PART_VISUAL_ADMISSION_UNOFFICIAL_ARCHIVE;
  const outputRoot = process.env.LEGO_PART_VISUAL_ADMISSION_OUTPUT_ROOT;
  if (
    officialArchive === undefined ||
    unofficialArchive === undefined ||
    outputRoot === undefined
  ) {
    throw new Error(
      "Required real visual admission needs explicit official/unofficial archive paths and an ignored output root; invoke npm run parts:visual-capture.",
    );
  }
  const requiredPartIds = requiredRealPartIds();
  const packets: Array<{
    readonly catalogPartId: string;
    readonly packetPath: string;
    readonly packetHash: `sha256:${string}`;
  }> = [];
  for (const catalogPartId of requiredPartIds) {
    const definition = getPartDefinition(catalogPartId);
    if (definition === undefined) {
      throw new Error(`Required real visual-admission part does not exist: ${catalogPartId}.`);
    }
    if (definition.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error(
        `Required real visual-admission part ${catalogPartId} uses ${definition.geometry.generatorId}, not the exact mesh-reference route.`,
      );
    }
    const sourceMatch = /^ldraw:(official|unofficial):([a-z0-9._-]+)$/u.exec(
      definition.geometry.provenance.sourceId,
    );
    if (sourceMatch === null) {
      throw new Error(
        `Required real visual-admission part ${catalogPartId} has no exact LDraw archive/root source id: ${definition.geometry.provenance.sourceId}.`,
      );
    }
    const slug = catalogPartId.replace("builtin:", "");
    const materialized = testInfo.outputPath(`materialized-real-source-${slug}`);
    const manifestPath = runMaterializer(
      [
        "--official",
        officialArchive,
        "--unofficial",
        unofficialArchive,
        "--root-archive",
        sourceMatch[1]!,
        "--root",
        `parts/${sourceMatch[2]}`,
      ],
      materialized,
    );
    const source = readVerifiedMaterializedLDrawClosure(manifestPath);
    await page.unrouteAll({ behavior: "wait" });
    await routeMaterializedClosure(page, source);
    const result = await capture(page, {
      source: {
        libraryUrl: libraryUrl(source.libraryPath),
        rootPath: source.root.path,
        materializedClosureDigest: source.manifestDigest,
      },
      candidate: { kind: "builtin", catalogPartId },
    });
    expectCleanCapture(result);
    const publication = publish(result, manifestPath, browser, outputRoot);
    expect(publication.packet.candidate.catalogId).toBe(definition.id);
    expect(publication.packet.source.root.fileId).toBe(source.root.fileId);
    packets.push({
      catalogPartId,
      packetPath: publication.packetPath,
      packetHash: publication.packet.packetHash,
    });
    await testInfo.attach(`part-visual-admission-${slug}`, {
      path: publication.packetPath,
      contentType: "application/json",
    });
  }
  expect(packets).toHaveLength(requiredPartIds.length);
  expect(packets.map(({ catalogPartId }) => catalogPartId)).toEqual(requiredPartIds);
  const createdAt = new Date().toISOString();
  const batchBase = {
    schemaVersion: "lego.part-visual-admission-capture-batch/1",
    createdAt,
    requestedPartIds: requiredPartIds,
    packets: packets.map(({ catalogPartId, packetPath, packetHash }) => ({
      catalogPartId,
      packetPath: relative(outputRoot, packetPath).replaceAll("\\", "/"),
      packetHash,
    })),
  } as const;
  const batch = { ...batchBase, batchHash: canonicalDigest(batchBase) };
  const batches = join(outputRoot, "batches");
  mkdirSync(batches, { recursive: true });
  const batchPath = join(batches, `${createdAt.replaceAll(/[:.]/gu, "-")}-${randomUUID()}.json`);
  writeFileSync(batchPath, `${canonicalStringify(batch)}\n`, { flag: "wx" });
  process.stdout.write(`VISUAL_ADMISSION_BATCH ${batchPath} ${batch.batchHash}\n`);
});

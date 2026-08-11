import { chromium } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createServer } from "vite";

import { assertOrdinaryDirectoryPath } from "./part-identification-contained-path.mjs";
import { readContainedFile } from "./part-identification-io.mjs";
import { createAndVerifyPair } from "./part-visual-admission-pair-browser.mjs";
import {
  cleanupExpectedDirectory,
  directoryIdentity,
  exactFile,
  publishExpectedDirectory,
  verifyCaptureBatch,
  verifyCaptureEntry,
  verifyPacketBinding,
  verifyPacketPngBinding,
} from "./part-visual-admission-pair-files.mjs";

const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_PNG_BYTES = 4 * 1024 * 1024;
const MAX_PAIR_PNG_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_PAIR_BYTES = 512 * 1024 * 1024;
const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 640;
const HEADER_HEIGHT = 40;
const GUTTER_WIDTH = 16;
const PAIR_WIDTH = PANEL_WIDTH * 2 + GUTTER_WIDTH;
const PAIR_HEIGHT = PANEL_HEIGHT + HEADER_HEIGHT;
const VIEW_NAMES = [
  "top",
  "bottom",
  "front",
  "back",
  "left",
  "right",
  "isometric",
  "underside-oblique",
];
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
  return null;
}

function argumentsFrom(values) {
  if (values.length !== 4) {
    return fail(
      "Native visual-admission pairs require exactly --batch <capture-batch.json> --output <ignored-directory>.",
    );
  }
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (
      !["--batch", "--output"].includes(flag) ||
      value === undefined ||
      value.startsWith("--") ||
      parsed[flag.slice(2)] !== undefined
    ) {
      return fail(
        "Native visual-admission pairs require exactly --batch <capture-batch.json> --output <ignored-directory>.",
      );
    }
    parsed[flag.slice(2)] = value;
  }
  return parsed;
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function supportFunctions() {
  const server = await createServer({
    root: process.cwd(),
    configFile: resolve("apps/web/vite.config.ts"),
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const [canonical, directories, atomicWrite] = await Promise.all([
      server.ssrLoadModule("/packages/brick-kernel/src/canonical.ts"),
      server.ssrLoadModule("/apps/web/e2e/contained-directory.ts"),
      server.ssrLoadModule("/apps/web/e2e/contained-atomic-write.ts"),
    ]);
    return { ...canonical, ...directories, ...atomicWrite };
  } finally {
    await server.close();
  }
}

const parsed = argumentsFrom(process.argv.slice(2));
if (parsed === null) process.exit();
const repository = assertOrdinaryDirectoryPath(process.cwd(), {
  label: "Native visual-admission repository root",
});
const captureBatchPath = resolve(parsed.batch);
const output = resolve(parsed.output);
const relativeBatch = relative(repository, captureBatchPath).replaceAll("\\", "/");
const relativeOutput = relative(repository, output).replaceAll("\\", "/");
if (!/^(?:output|test-results)\/.+\/batches\/[^/]+\.json$/u.test(relativeBatch)) {
  fail(
    `Native visual-admission batch resolves to ${JSON.stringify(relativeBatch)}; required output/<run>/batches/<capture>.json or test-results/<run>/batches/<capture>.json below ${repository}.`,
  );
  process.exit();
}
if (!/^(?:output|test-results)(?:\/[A-Za-z0-9._@-]+)+$/u.test(relativeOutput)) {
  fail(
    `Native visual-admission output resolves to ${JSON.stringify(relativeOutput)}; required a child directory below output/ or test-results/ using only letters, digits, dot, underscore, at-sign, and hyphen in each segment.`,
  );
  process.exit();
}
if (existsSync(output)) {
  fail(
    `Native visual-admission output already exists and is immutable: ${output}. Choose a new directory.`,
  );
  process.exit();
}

let browser;
let staging;
let stagingIdentity;
let removeContainedDirectoryTree;
try {
  const support = await supportFunctions();
  const {
    canonicalDigest,
    canonicalStringify,
    ensureContainedDirectoryTree,
    renameContainedDirectoryAtomic,
    writeContainedRegularFileAtomic,
  } = support;
  removeContainedDirectoryTree = support.removeContainedDirectoryTree;
  const relativeOutputParent = relative(repository, dirname(output)).replaceAll("\\", "/");
  ensureContainedDirectoryTree(
    repository,
    relativeOutputParent,
    "Native visual-admission output parent",
  );
  const captureBatchValue = JSON.parse(
    new TextDecoder("utf8", { fatal: true }).decode(
      readContainedFile(repository, relativeBatch, {
        maxBytes: MAX_JSON_BYTES,
        label: "visual-admission capture batch",
        pathLabel: "visual-admission capture-batch path",
      }),
    ),
  );
  const { batch: captureBatch, batchHash } = verifyCaptureBatch(captureBatchValue, canonicalDigest);
  const batchRoot = assertOrdinaryDirectoryPath(dirname(dirname(captureBatchPath)), {
    label: "Native visual-admission capture-batch root",
  });
  staging = `${output}.tmp-${randomUUID()}`;
  const relativeStaging = relative(repository, staging).replaceAll("\\", "/");
  ensureContainedDirectoryTree(
    repository,
    relativeStaging,
    "Native visual-admission staging directory",
  );
  stagingIdentity = directoryIdentity(staging, "Native visual-admission staging directory");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: PAIR_WIDTH, height: PAIR_HEIGHT } });
  await page.route("http://localhost/native-visual-admission-pairs", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>native pairs</title>" }),
  );
  await page.goto("http://localhost/native-visual-admission-pairs");
  if (!(await page.evaluate(() => globalThis.isSecureContext && crypto.subtle !== undefined))) {
    throw new Error(`Native-pair verifier requires browser Web Crypto in a secure context.`);
  }
  const pairs = [];
  let totalBytes = 0;
  const seen = new Set();
  for (const [partIndex, entryValue] of captureBatch.packets.entries()) {
    const entry = verifyCaptureEntry(
      entryValue,
      partIndex,
      captureBatch.requestedPartIds[partIndex],
      seen,
    );
    const catalogPartId = entry.catalogPartId;
    const slug = catalogPartId.replace(/^builtin:/u, "");
    if (!/^[a-z0-9][a-z0-9-]+$/u.test(slug)) {
      throw new TypeError(
        `Native-pair catalog id has no safe deterministic slug: ${catalogPartId}.`,
      );
    }
    const packetPath = resolve(batchRoot, entry.packetPath);
    const packetValue = JSON.parse(
      readContainedFile(batchRoot, entry.packetPath, {
        maxBytes: MAX_JSON_BYTES,
        label: `native-pair packet ${catalogPartId}`,
        pathLabel: `native-pair packet path for ${catalogPartId}`,
      }).toString("utf8"),
    );
    const { packet, packetHash } = verifyPacketBinding(packetValue, {
      canonicalDigest,
      catalogPartId,
      expectedImageCount: VIEW_NAMES.length * 2,
      expectedPacketHash: entry.packetHash,
    });
    const partDirectory = join(staging, slug);
    ensureContainedDirectoryTree(
      repository,
      relative(repository, partDirectory).replaceAll("\\", "/"),
      `Native-pair output directory for ${catalogPartId}`,
    );
    for (const [viewIndex, viewName] of VIEW_NAMES.entries()) {
      const source = packet.images.find(
        (image) => image.side === "source" && image.viewName === viewName,
      );
      const candidate = packet.images.find(
        (image) => image.side === "candidate" && image.viewName === viewName,
      );
      if (source === undefined) {
        throw new Error(
          `Native-pair packet ${catalogPartId} has no source image for ${viewName}; every policy view requires exactly one source image.`,
        );
      }
      if (candidate === undefined) {
        throw new Error(
          `Native-pair packet ${catalogPartId} has no candidate image for ${viewName}; every policy view requires exactly one candidate image.`,
        );
      }
      const runDirectory = assertOrdinaryDirectoryPath(dirname(packetPath), {
        label: `Native-pair run directory for ${catalogPartId}`,
      });
      const sourceBytes = readContainedFile(runDirectory, source.path, {
        maxBytes: MAX_SOURCE_PNG_BYTES,
        label: `native-pair ${catalogPartId}/${viewName} source`,
        pathLabel: `native-pair ${catalogPartId}/${viewName} source path`,
      });
      const candidateBytes = readContainedFile(runDirectory, candidate.path, {
        maxBytes: MAX_SOURCE_PNG_BYTES,
        label: `native-pair ${catalogPartId}/${viewName} candidate`,
        pathLabel: `native-pair ${catalogPartId}/${viewName} candidate path`,
      });
      verifyPacketPngBinding({
        candidate,
        candidateBytes,
        label: `${catalogPartId}/${viewName}`,
        requiredHeight: PANEL_HEIGHT,
        requiredWidth: PANEL_WIDTH,
        sha256,
        source,
        sourceBytes,
      });
      const composed = await createAndVerifyPair(
        page,
        sourceBytes,
        candidateBytes,
        `${catalogPartId}/${viewName}`,
        {
          panelWidth: PANEL_WIDTH,
          panelHeight: PANEL_HEIGHT,
          headerHeight: HEADER_HEIGHT,
          gutterWidth: GUTTER_WIDTH,
        },
      );
      const prefix = "data:image/png;base64,";
      if (!composed.pairUrl.startsWith(prefix)) {
        throw new TypeError(`Native-pair ${catalogPartId}/${viewName} is not a PNG data URL.`);
      }
      const bytes = Buffer.from(composed.pairUrl.slice(prefix.length), "base64");
      if (bytes.length <= 0 || bytes.length > MAX_PAIR_PNG_BYTES) {
        throw new RangeError(
          `Native-pair ${catalogPartId}/${viewName} encodes to ${bytes.length} bytes; required 1..${MAX_PAIR_PNG_BYTES}.`,
        );
      }
      if (composed.width !== PAIR_WIDTH || composed.height !== PAIR_HEIGHT) {
        throw new RangeError(
          `Native-pair ${catalogPartId}/${viewName} decodes to ${composed.width}x${composed.height}; required ${PAIR_WIDTH}x${PAIR_HEIGHT}.`,
        );
      }
      const nextTotalBytes = totalBytes + bytes.length;
      if (nextTotalBytes > MAX_TOTAL_PAIR_BYTES) {
        throw new RangeError(
          `Native-pair output would total ${nextTotalBytes} bytes after ${catalogPartId}/${viewName}; maximum is ${MAX_TOTAL_PAIR_BYTES}.`,
        );
      }
      totalBytes = nextTotalBytes;
      const filename = `${String(viewIndex + 1).padStart(2, "0")}-${viewName}.png`;
      const path = join(partDirectory, filename);
      writeContainedRegularFileAtomic(
        repository,
        relative(repository, path).replaceAll("\\", "/"),
        bytes,
        { label: `native-pair ${catalogPartId}/${viewName}` },
      );
      const retained = exactFile(path, MAX_PAIR_PNG_BYTES, `${catalogPartId}/${viewName} pair`);
      const retainedHash = sha256(retained);
      const expectedRetainedHash = sha256(bytes);
      if (retainedHash !== expectedRetainedHash) {
        throw new Error(
          `Native-pair ${catalogPartId}/${viewName} retained file hashes to ${retainedHash}, but the bytes written hash to ${expectedRetainedHash}. Refusing publication.`,
        );
      }
      pairs.push({
        catalogPartId,
        viewName,
        packetHash,
        source: {
          pngSha256: source.sha256,
          decodedRgbaSha256: composed.sourceDecodedRgbaSha256,
        },
        candidate: {
          pngSha256: candidate.sha256,
          decodedRgbaSha256: composed.candidateDecodedRgbaSha256,
        },
        pair: {
          path: `${slug}/${filename}`,
          sha256: expectedRetainedHash,
          bytes: bytes.length,
          width: composed.width,
          height: composed.height,
          sourceRegionDecodedRgbaSha256: composed.sourceDecodedRgbaSha256,
          candidateRegionDecodedRgbaSha256: composed.candidateDecodedRgbaSha256,
        },
      });
    }
  }
  await page.close();
  await browser.close();
  browser = undefined;
  const createdAt = new Date().toISOString();
  const manifestBase = {
    schemaVersion: "lego.part-visual-admission-native-pairs/1",
    createdAt,
    captureBatchPath: relative(repository, captureBatchPath).replaceAll("\\", "/"),
    captureBatchHash: batchHash,
    layout: {
      width: PAIR_WIDTH,
      height: PAIR_HEIGHT,
      sourcePanel: { x: 0, y: HEADER_HEIGHT, width: PANEL_WIDTH, height: PANEL_HEIGHT },
      candidatePanel: {
        x: PANEL_WIDTH + GUTTER_WIDTH,
        y: HEADER_HEIGHT,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      },
      resampling: "none",
      labelsOutsidePanels: true,
    },
    requestedPartIds: captureBatch.requestedPartIds,
    pairCount: pairs.length,
    totalBytes,
    pairs,
  };
  const manifest = { ...manifestBase, manifestHash: canonicalDigest(manifestBase) };
  const manifestPath = join(staging, "manifest.json");
  writeContainedRegularFileAtomic(
    repository,
    relative(repository, manifestPath).replaceAll("\\", "/"),
    Buffer.from(`${canonicalStringify(manifest)}\n`),
    { label: "native-pair manifest" },
  );
  const retainedManifest = JSON.parse(
    exactFile(manifestPath, MAX_JSON_BYTES, "native-pair manifest").toString("utf8"),
  );
  const { manifestHash, ...retainedBase } = retainedManifest;
  const retainedManifestHash = canonicalDigest(retainedBase);
  if (manifestHash !== retainedManifestHash) {
    throw new Error(
      `Native-pair retained manifest hashes to ${retainedManifestHash}, but declares ${JSON.stringify(manifestHash)}. Refusing publication.`,
    );
  }
  if (manifestHash !== manifest.manifestHash) {
    throw new Error(
      `Native-pair retained manifest declares ${JSON.stringify(manifestHash)}, but the manifest written declares ${manifest.manifestHash}. Refusing publication.`,
    );
  }
  publishExpectedDirectory({
    destination: output,
    expectedIdentity: stagingIdentity,
    label: "Native visual-admission pair directory",
    renameContainedDirectoryAtomic,
    staging,
  });
  staging = undefined;
  stagingIdentity = undefined;
  process.stdout.write(
    `${JSON.stringify({
      pairDirectory: output,
      manifestPath: join(output, "manifest.json"),
      pairCount: pairs.length,
      manifestHash: manifest.manifestHash,
    })}\n`,
  );
} catch (error) {
  process.stderr.write(
    `Native visual-admission pairs failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (stagingIdentity !== undefined && removeContainedDirectoryTree !== undefined) {
    try {
      cleanupExpectedDirectory({
        candidates: [staging, output].filter((candidate) => candidate !== undefined),
        expectedIdentity: stagingIdentity,
        label: "Native visual-admission failed-output cleanup",
        removeContainedDirectoryTree,
      });
    } catch (error) {
      process.stderr.write(
        `Native visual-admission cleanup refused an unverified replacement: ${error instanceof Error ? error.stack : String(error)}\n`,
      );
      process.exitCode = 1;
    }
  }
}

import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { delimiter, isAbsolute, join, relative, resolve } from "node:path";

import {
  resolveRealBuildPrefix50Step44ReviewArtifact,
  sha256RealBuildPrefix50Step44ReviewBytes,
} from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const WIDTH = 720;
const HEIGHT = 470;
const MAXIMUM_BYTES = 8 * 1024 * 1024;
const POPPLER_VERSION = /pdftoppm version ([0-9]+(?:\.[0-9]+)+)/u;

function executableCandidates(): readonly string[] {
  const executable = process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm";
  return [
    ...(process.env.PATH ?? "")
      .split(delimiter)
      .filter((entry) => entry.length > 0)
      .map((entry) => resolve(entry, executable)),
    executable,
  ];
}

function requirePoppler(): Readonly<{ path: string; version: string }> {
  for (const candidate of executableCandidates()) {
    if (isAbsolute(candidate)) {
      try {
        if (!lstatSync(candidate).isFile()) continue;
      } catch {
        continue;
      }
    }
    const run = spawnSync(candidate, ["-v"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 256 * 1024,
    });
    const version = POPPLER_VERSION.exec(`${run.stdout}\n${run.stderr}`)?.[1];
    if (run.error === undefined && run.status === 0 && version !== undefined)
      return { path: candidate, version };
  }
  throw new TypeError("Step-42 source raster requires Poppler pdftoppm on PATH.");
}

function temporaryDirectory(repositoryRoot: string): string {
  const root = resolve(
    repositoryRoot,
    "output/playwright/real-build-prefix50-step44-return-review",
  );
  mkdirSync(root, { recursive: true });
  const realRoot = realpathSync(root);
  const created = realpathSync(mkdtempSync(join(realRoot, ".step42-source-raster-")));
  const local = relative(realRoot, created);
  if (local.length === 0 || local.startsWith("..")) {
    rmSync(created, { recursive: true, force: true });
    throw new TypeError("Step-42 source raster temporary directory escaped its ignored root.");
  }
  return created;
}

export function rerenderRealBuildPrefix50Step42SourceCrop(input: {
  readonly repositoryRoot: string;
  readonly sourcePdfArtifactPath: "recipes/6651557.pdf";
}) {
  const source = resolveRealBuildPrefix50Step44ReviewArtifact(
    input.repositoryRoot,
    input.sourcePdfArtifactPath,
    80 * 1024 * 1024,
    "Step-42 source PDF",
  );
  const poppler = requirePoppler();
  const directory = temporaryDirectory(input.repositoryRoot);
  try {
    const outputPrefix = join(directory, "physical-page44-step42-crop");
    const run = spawnSync(
      poppler.path,
      [
        "-f",
        "44",
        "-l",
        "44",
        "-r",
        "180",
        "-x",
        "120",
        "-y",
        "810",
        "-W",
        String(WIDTH),
        "-H",
        String(HEIGHT),
        "-png",
        "-singlefile",
        source.path,
        outputPrefix,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (run.error !== undefined || run.status !== 0)
      throw new TypeError(
        `Step-42 source-only Poppler crop failed with status ${String(run.status)}: ${`${run.stderr}`.slice(0, 2_048)}.`,
      );
    const outputPath = `${outputPrefix}.png`;
    const stats = lstatSync(outputPath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 1 || stats.size > MAXIMUM_BYTES)
      throw new RangeError(
        `Step-42 source-only Poppler output must be a regular 1..${MAXIMUM_BYTES}-byte PNG.`,
      );
    const pngBytes = readFileSync(outputPath);
    const decoded = decodeRealBuildPrefix50Step44ReviewPng(
      pngBytes,
      WIDTH * HEIGHT,
      "Step-42 source-only Poppler crop",
    );
    if (decoded.width !== WIDTH || decoded.height !== HEIGHT)
      throw new TypeError(
        `Step-42 source-only Poppler crop is ${decoded.width}x${decoded.height}, not ${WIDTH}x${HEIGHT}.`,
      );
    return Object.freeze({
      rendererVersion: poppler.version,
      width: decoded.width,
      height: decoded.height,
      pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(pngBytes),
      pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(decoded.rgba),
      rgba: decoded.rgba,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

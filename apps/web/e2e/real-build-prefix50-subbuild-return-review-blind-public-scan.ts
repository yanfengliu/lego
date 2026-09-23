import { createHash } from "node:crypto";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import type { RealBuildPrefix50Step44BlindReviewPacket } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
  REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE,
} from "./real-build-prefix50-subbuild-return-review-blind-success.ts";
import { decodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const MAXIMUM_PUBLIC_FILE_BYTES = 16 * 1024 * 1024;

function normalizedRelative(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function listFiles(root: string): readonly string[] {
  const realRoot = realpathSync(resolve(root));
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const stats = lstatSync(path);
      if (stats.isSymbolicLink())
        throw new TypeError("Step-44 public packet may not contain symbolic links.");
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(normalizedRelative(realRoot, path));
      else throw new TypeError("Step-44 public packet may contain only regular files/directories.");
    }
  };
  visit(realRoot);
  return files.sort();
}

function expectedFiles(
  packet: RealBuildPrefix50Step44BlindReviewPacket,
  packetArtifactFile: string,
): readonly string[] {
  const files = new Set<string>([
    packetArtifactFile,
    packet.reviewIsolationInstructionFile,
    packet.reference.artifactFile,
    packet.fixedCameraBaseline.artifactPath,
    REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
    REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE,
  ]);
  for (const page of packet.pages) {
    files.add(page.artifactFile);
    for (const row of page.rows) {
      for (const cell of row.cells) files.add(cell.artifactPath);
      files.add(row.fixedCameraEvidence.deltaArtifactPath);
    }
  }
  return [...files].sort();
}

function requireSafePngChunks(bytes: Uint8Array, label: string): void {
  decodeCanonicalRealBuildPrefix50Step44ReviewPng(bytes, 4_000_000, label);
}

export function scanRealBuildPrefix50Step44BlindPublicArtifacts(input: {
  readonly publicRoot: string;
  readonly packet: RealBuildPrefix50Step44BlindReviewPacket;
  readonly packetArtifactFile: string;
}): void {
  const actual = listFiles(input.publicRoot);
  const expected = expectedFiles(input.packet, input.packetArtifactFile);
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index]))
    throw new TypeError(
      "Step-44 public packet tree must contain only its exact committed blind-safe artifacts.",
    );
  const validatedPngDigests = new Set<string>();
  for (const path of actual) {
    if (!path.endsWith(".png")) continue;
    const bytes = readRealBuildPrefix50Step44ReviewArtifact(
      input.publicRoot,
      path,
      MAXIMUM_PUBLIC_FILE_BYTES,
      `Step-44 public PNG ${path}`,
    );
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (validatedPngDigests.has(digest)) continue;
    requireSafePngChunks(bytes, `Step-44 public PNG ${path}`);
    validatedPngDigests.add(digest);
  }
}

export const realBuildPrefix50Step44BlindPublicScanTestOnly = Object.freeze({
  requireSafePngChunks(bytes: Uint8Array, label = "Step-44 test PNG"): void {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Step-44 PNG metadata inspection is available only to tests.");
    requireSafePngChunks(bytes, label);
  },
});

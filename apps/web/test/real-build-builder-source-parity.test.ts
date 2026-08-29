import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BUILDER_STEP1_DESIGN_SOURCES,
  BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
} from "../e2e/real-build-builder-sources";
import { LDRAW_OFFICIAL_ARCHIVE } from "../e2e/real-build-builder-source-contract";

interface PythonBuilderSourcePins {
  readonly designs: readonly Record<string, unknown>[];
  readonly ldrawClosureDigest: string;
  readonly ldrawFiles: readonly (readonly [string, string, string, string, string])[];
  readonly shells: readonly Record<string, unknown>[];
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pythonProbe = [
  "import json, sys",
  "sys.path.insert(0, 'scripts')",
  "from builder_calibration_sources import DESIGNS, LDRAW_CLOSURE_DIGEST, LDRAW_CLOSURE_FILES",
  "from builder_calibration_shell_pins import SUPPORTED_SHELLS",
  "print(json.dumps({'designs': DESIGNS, 'ldrawClosureDigest': LDRAW_CLOSURE_DIGEST, 'ldrawFiles': LDRAW_CLOSURE_FILES, 'shells': SUPPORTED_SHELLS}, separators=(',', ':')))",
].join("\n");

const loadPythonPins = (): PythonBuilderSourcePins => {
  const result = spawnSync("python", ["-B", "-c", pythonProbe], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 || result.stderr !== "") {
    throw new Error(
      `Committed Builder Python pin import failed with status ${String(result.status)}: ${result.stderr || result.stdout}`,
    );
  }
  return JSON.parse(result.stdout) as PythonBuilderSourcePins;
};

const designId = (designRevision: string): string => designRevision.split(";", 1)[0]!;
const withoutSha256 = (digest: string): string => digest.replace(/^sha256:/u, "");
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const pythonCanonicalJson = (value: unknown): string =>
  JSON.stringify(value)
    .split("")
    .map((character) => {
      const codeUnit = character.charCodeAt(0);
      return codeUnit <= 0x7f ? character : `\\u${codeUnit.toString(16).padStart(4, "0")}`;
    })
    .join("");

const canonicalTypeScriptDesign = (source: (typeof BUILDER_STEP1_DESIGN_SOURCES)[number]) => ({
  designRevision: source.designRevision,
  designId: designId(source.designRevision),
  ...(!("opaqueIdentityRoute" in source) || source.opaqueIdentityRoute === undefined
    ? {}
    : { ldrawDesignId: source.opaqueIdentityRoute.exactLdrawId.replace(/\.dat$/u, "") }),
  bundleSha256: source.sourceIdentity.bundleSha256,
  primitiveXmlSha256: source.sourceIdentity.primitiveXmlSha256,
  shellPathId: source.sourceIdentity.shellPathId,
  shellCanonicalSha256: source.sourceIdentity.shellCanonicalSha256,
  shellVertexCount: source.sourceIdentity.shellVertexCount,
  shellTriangleCount: source.sourceIdentity.shellTriangleCount,
  builderGeometry: {
    byteOffset: source.builderGeometry.byteOffset,
    byteLength: source.builderGeometry.byteLength,
    digest: source.builderGeometry.digest,
    triangleCount: source.builderGeometry.triangleCount,
  },
  ldrawReferenceGeometry: {
    byteOffset: source.ldrawReferenceGeometry.byteOffset,
    byteLength: source.ldrawReferenceGeometry.byteLength,
    digest: source.ldrawReferenceGeometry.digest,
    triangleCount: source.ldrawReferenceGeometry.triangleCount,
  },
});

describe("committed Builder TypeScript/Python source parity", () => {
  const python = loadPythonPins();

  it("keeps all 43 Builder design source tuples equal", () => {
    expect(BUILDER_STEP1_DESIGN_SOURCES).toHaveLength(43);
    expect(
      new Set(BUILDER_STEP1_DESIGN_SOURCES.map(({ designRevision }) => designRevision)).size,
    ).toBe(43);
    expect(python.designs).toEqual(BUILDER_STEP1_DESIGN_SOURCES.map(canonicalTypeScriptDesign));
  });

  it("keeps every decoded shell identity equal to its TypeScript source row", () => {
    const sourcesByRevision = new Map<string, (typeof BUILDER_STEP1_DESIGN_SOURCES)[number]>(
      BUILDER_STEP1_DESIGN_SOURCES.map((source) => [source.designRevision, source]),
    );
    expect(python.shells.map((shell) => shell.designRevision)).toEqual(
      BUILDER_STEP1_DESIGN_SOURCES.map(({ designRevision }) => designRevision),
    );
    for (const shell of python.shells) {
      expect(Object.keys(shell).sort(), String(shell.designRevision)).toEqual([
        "bundleSha256",
        "designRevision",
        "indexBufferBytes",
        "serializedBytes",
        "shellCanonicalSha256",
        "shellPathId",
        "triangles",
        "vertexDataBytes",
        "vertices",
      ]);
    }
    expect(sha256(JSON.stringify(python.shells))).toBe(
      "ce023de75e9c5214cd49ebc381e1842cdeb4bd75c6da39b055a11124f5dcd136",
    );
    for (const shell of python.shells) {
      const source = sourcesByRevision.get(String(shell.designRevision));
      expect(source, String(shell.designRevision)).toBeDefined();
      expect(
        {
          bundleSha256: shell.bundleSha256,
          shellPathId: shell.shellPathId,
          shellCanonicalSha256: shell.shellCanonicalSha256,
          vertices: shell.vertices,
          triangles: shell.triangles,
        },
        String(shell.designRevision),
      ).toEqual({
        bundleSha256: withoutSha256(source!.sourceIdentity.bundleSha256),
        shellPathId: source!.sourceIdentity.shellPathId,
        shellCanonicalSha256: withoutSha256(source!.sourceIdentity.shellCanonicalSha256),
        vertices: source!.sourceIdentity.shellVertexCount,
        triangles: source!.sourceIdentity.shellTriangleCount,
      });
    }
  });

  it("keeps the canonical 184-file Builder closure equal to its TypeScript authority", () => {
    expect(python.ldrawClosureDigest).toBe(withoutSha256(BUILDER_STEP1_LDRAW_CLOSURE_DIGEST));
    expect(python.ldrawFiles).toHaveLength(184);
    expect(new Set(python.ldrawFiles.map(([file]) => file)).size).toBe(184);
    const manifest = {
      schemaVersion: "lego.builder-ldraw-closure/2",
      archiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      roots: python.designs
        .map((design) => `${String(design.ldrawDesignId ?? design.designId)}.dat`)
        .sort(),
      files: python.ldrawFiles,
    };
    expect(sha256(pythonCanonicalJson(manifest))).toBe(python.ldrawClosureDigest);
  });
});

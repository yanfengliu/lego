import { readFileSync } from "node:fs";

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import * as publicCatalog from "../index.js";
import { SET_6651557_COVERAGE_LEDGER as coverageLedger } from "./set-6651557-coverage-ledger.js";

interface AuditHeader {
  readonly recordType: "source-audit-header";
  readonly schemaVersion: string;
  readonly admissionState: "blocked-unresolved-parts";
  readonly authority: Readonly<Record<string, boolean | string>>;
  readonly archives: readonly {
    readonly archiveId: string;
    readonly licenseDocuments: readonly {
      readonly path: string;
      readonly bytes: number;
      readonly sha256: string;
    }[];
  }[];
  readonly requiredLeafSetSha256: string;
  readonly partRecordsSha256: string;
  readonly fileRecordsSha256: string;
  readonly summary: Readonly<Record<string, number>>;
}

interface SourceFile {
  readonly fileId: string;
  readonly archiveId: "official" | "unofficial";
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly title: string;
  readonly declaredName: string;
  readonly author: string;
  readonly ldrawOrg: string;
  readonly licenseExpression: string;
  readonly directReferences: readonly string[];
}

interface PartRoute {
  readonly recordType: "leaf-route";
  readonly designId: string;
  readonly state: "ldraw-root-and-closure-resolved-not-admitted" | "unresolved-source-route";
  readonly catalogAdmitted: false;
  readonly frame: {
    readonly status: string;
    readonly catalogFrameClaimed: false;
    readonly reason?: string;
  };
  readonly rootFileId?: string;
  readonly identity?: {
    readonly kind: string;
    readonly rootPresenceByArchivePrecedence: readonly string[];
    readonly evidenceLine?: string;
    readonly evidenceLineSha256?: string;
  };
  readonly reviewedCandidates?: readonly Readonly<Record<string, unknown>>[];
}

interface SourceAudit {
  readonly files: readonly SourceFile[];
  readonly header: AuditHeader;
  readonly parts: readonly PartRoute[];
}

const sourceAuditBytes = readFileSync(
  new URL("./set-6651557-ldraw-source-audit.generated.json", import.meta.url),
);
const sourceAuditText = sourceAuditBytes.toString("utf8");
const sourceAudit = JSON.parse(sourceAuditText) as SourceAudit;
const { files, header, parts } = sourceAudit;

const sha256Json = (value: unknown): string =>
  `sha256:${bytesToHex(sha256(utf8ToBytes(JSON.stringify(value))))}`;

const keys = (value: object): string[] => Object.keys(value).sort();
const uniqueSorted = <T>(values: readonly T[]): T[] => [...new Set(values)].sort();
const fileById = new Map(files.map((file) => [file.fileId, file] as const));

const closure = (rootFileId: string): SourceFile[] => {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const visit = (fileId: string): void => {
    if (stack.has(fileId)) throw new Error(`Source-audit reference cycle at ${fileId}`);
    if (visited.has(fileId)) return;
    const file = fileById.get(fileId);
    if (!file) throw new Error(`Source-audit reference is missing ${fileId}`);
    stack.add(fileId);
    for (const reference of file.directReferences) visit(reference);
    stack.delete(fileId);
    visited.add(fileId);
  };
  visit(rootFileId);
  return [...visited].sort().map((fileId) => fileById.get(fileId)!);
};

describe("set 6651557 quarantined LDraw source audit", () => {
  it("is canonical, closed-schema, resolution-only evidence outside the public catalog", () => {
    expect(sourceAuditBytes.byteLength).toBeLessThan(256 * 1024);
    expect(sourceAuditText).toBe(`${JSON.stringify(sourceAudit)}\n`);
    expect(keys(sourceAudit)).toEqual(["files", "header", "parts"]);
    expect(keys(header)).toEqual([
      "admissionState",
      "archives",
      "authority",
      "fileRecordsSha256",
      "partRecordsSha256",
      "recordType",
      "referenceLayerPolicy",
      "requiredLeafSetSha256",
      "schemaVersion",
      "serialization",
      "summary",
    ]);
    expect(header).toMatchObject({
      recordType: "source-audit-header",
      schemaVersion: "lego.set-6651557-ldraw-source-audit/1",
      admissionState: "blocked-unresolved-parts",
      authority: {
        kind: "ldraw-source-resolution-only",
        catalogAdmitted: false,
        runtimeExposed: false,
        identitySelfCertified: false,
        geometrySelfCertified: false,
        partDefinitionsEmitted: false,
        publicCatalogExported: false,
        runtimeFetchAllowed: false,
        connectorTruthClaimed: false,
        collisionTruthClaimed: false,
        catalogFramesClaimed: false,
      },
    });
    expect(keys(header.authority)).toEqual([
      "catalogAdmitted",
      "catalogFramesClaimed",
      "collisionTruthClaimed",
      "connectorTruthClaimed",
      "geometrySelfCertified",
      "identitySelfCertified",
      "kind",
      "partDefinitionsEmitted",
      "publicCatalogExported",
      "runtimeExposed",
      "runtimeFetchAllowed",
    ]);
    for (const archive of header.archives) {
      expect(archive.licenseDocuments).toEqual([
        {
          bytes: 12_698,
          path: "calicense.txt",
          sha256: "sha256:487265d3a122b2e54e460954cd2eca34ac2e545bcb1b2ac23cbda2a27e49a6c2",
        },
        {
          bytes: 18_657,
          path: "calicense4.txt",
          sha256: "sha256:9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411",
        },
        {
          bytes: 4_151,
          path: "careadme.txt",
          sha256: "sha256:c67a824bdab18e646337b5b26f7f039c84b0be71273c0c878e2749e648820497",
        },
      ]);
    }
    expect(header.requiredLeafSetSha256).toBe(coverageLedger.setDigests.requiredLeaves121);
    expect(header.partRecordsSha256).toBe(sha256Json(parts));
    expect(header.fileRecordsSha256).toBe(sha256Json(files));
    expect("SET_6651557_LDRAW_SOURCE_AUDIT" in publicCatalog).toBe(false);
    const forbiddenKeys = new Set(["partDefinition", "geometry", "connectors", "collision"]);
    const serializedKeys = sourceAuditText.match(/"([A-Za-z][A-Za-z0-9]*)":/g) ?? [];
    expect(serializedKeys.filter((key) => forbiddenKeys.has(key.slice(1, -2)))).toEqual([]);
  });

  it("recomputes the exact 439-file acyclic graph and every resolved closure", () => {
    expect(files.map(({ fileId }) => fileId)).toEqual(
      uniqueSorted(files.map(({ fileId }) => fileId)),
    );
    expect(files).toHaveLength(439);
    expect(files.filter(({ archiveId }) => archiveId === "official")).toHaveLength(428);
    expect(files.filter(({ archiveId }) => archiveId === "unofficial")).toHaveLength(11);
    expect(files.reduce((total, { bytes }) => total + bytes, 0)).toBe(896_002);
    expect(files.filter(({ licenseExpression }) => licenseExpression === "CC-BY-4.0")).toHaveLength(
      427,
    );
    expect(
      files.filter(({ licenseExpression }) => licenseExpression === "CC-BY-2.0 OR CC-BY-4.0"),
    ).toHaveLength(12);
    for (const file of files) {
      expect(keys(file)).toEqual([
        "archiveId",
        "author",
        "bytes",
        "declaredName",
        "directReferences",
        "fileId",
        "ldrawOrg",
        "licenseExpression",
        "path",
        "sha256",
        "title",
      ]);
      expect(file.fileId).toBe(`${file.archiveId}:${file.path}`);
      expect(file.path).toMatch(/^(?:parts|p)\/[\x21-\x7e]+$/);
      expect(file.path).not.toMatch(/(?:^|\/)\.{1,2}(?:\/|$)|\/\//);
      expect(file.declaredName.toLowerCase()).toBe(
        file.path.replace(/^(?:parts|p)\//, "").toLowerCase(),
      );
      expect(file.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(file.bytes).toBeGreaterThan(0);
      expect(file.author).not.toBe("");
      expect(file.directReferences).toEqual(uniqueSorted(file.directReferences));
      for (const reference of file.directReferences) {
        expect(fileById.has(reference)).toBe(true);
        if (file.archiveId === "official") expect(reference.startsWith("official:")).toBe(true);
      }
    }

    const reached = new Set<string>();
    const resolved = parts.filter(
      ({ state }) => state === "ldraw-root-and-closure-resolved-not-admitted",
    );
    for (const part of resolved) {
      const closedFiles = closure(part.rootFileId!);
      for (const file of closedFiles) reached.add(file.fileId);
      expect(closedFiles.length).toBeGreaterThan(0);
    }
    expect([...reached].sort()).toEqual(files.map(({ fileId }) => fileId));
  });

  it("covers 121 leaves while refusing exactly four identities and every catalog frame", () => {
    expect(parts.map(({ designId }) => designId)).toEqual(
      coverageLedger.requiredLeaves.map(({ designId }) => designId),
    );
    expect(parts.every(({ catalogAdmitted }) => catalogAdmitted === false)).toBe(true);
    expect(parts.every(({ frame }) => frame.catalogFrameClaimed === false)).toBe(true);
    for (const part of parts) {
      expect(part.recordType).toBe("leaf-route");
      if (part.state === "unresolved-source-route") {
        expect(keys(part)).toEqual([
          "catalogAdmitted",
          "designId",
          "evidence",
          "frame",
          "reason",
          "recordType",
          "reviewedCandidates",
          "state",
        ]);
      } else {
        expect(keys(part)).toEqual([
          "catalogAdmitted",
          "designId",
          "frame",
          "identity",
          "recordType",
          "rootFileId",
          "state",
        ]);
        if (part.identity?.kind === "exact-design-filename") {
          expect(part.rootFileId).toMatch(
            new RegExp(`^(?:official|unofficial):parts/${part.designId}\\.dat$`),
          );
        }
      }
    }
    const unresolved = parts.filter(({ state }) => state === "unresolved-source-route");
    expect(unresolved.map(({ designId }) => designId)).toEqual(["3245", "7562", "8172", "89680"]);
    expect(unresolved.every(({ rootFileId }) => !rootFileId)).toBe(true);
    expect(header.summary).toEqual({
      officialExactRoots: 113,
      officialKeywordMappings: 1,
      requiredLeaves: 121,
      resolvedRoutes: 117,
      uniqueClosureSourceBytes: 896_002,
      uniqueClosureSourceFiles: 439,
      unofficialExactRoots: 3,
      unresolvedRoutes: 4,
    });
  });

  it("retains only the reviewed non-exact and unofficial root routes", () => {
    const byId = new Map(parts.map((part) => [part.designId, part] as const));
    expect(byId.get("3814")).toMatchObject({
      rootFileId: "official:parts/973.dat",
      identity: {
        kind: "header-keyword-cross-catalog",
        evidenceLine: "0 !KEYWORDS Rebrickable 3814",
      },
    });
    for (const designId of ["6801", "7236", "7302"]) {
      expect(byId.get(designId)?.rootFileId).toBe(`unofficial:parts/${designId}.dat`);
    }
  });
});

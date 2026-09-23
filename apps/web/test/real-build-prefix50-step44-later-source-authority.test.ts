import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as artifactIo from "../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts } from "../e2e/real-build-prefix50-subbuild-return-review-artifacts.ts";
import { readRealBuildPrefix50Step44PersistedPromotionEvidence } from "../e2e/real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import type { RealBuildPrefix50Step44BlindReviewOutputLayout } from "../e2e/real-build-prefix50-subbuild-return-review-blind-persisted.ts";
import { createRealBuildPrefix50Step44BlindPromotionReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion.ts";
import { rerenderRealBuildPrefix50Step44PdfPage } from "../e2e/real-build-prefix50-subbuild-return-review-pdf.ts";
import { deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence } from "../e2e/real-build-prefix50-step44-panel-face-prefix.ts";
import {
  assertExactStep44IoRoster,
  auditExactStep44ThreeRootClosure,
  findExtensionlessRuntimeLocalEdges,
  step44ManifestCommitment,
  step44ModuleCalls,
  step44ModuleCallsAny,
} from "./real-build-prefix50-step44-source-reader-closure-gate.ts";
import {
  EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER,
  EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER_COMMITMENT,
  step44ExecutionRosterCommitment,
} from "./real-build-prefix50-step44-source-reader-closure-execution-roster.ts";
import {
  EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST,
  EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST_COMMITMENT,
} from "./real-build-prefix50-step44-source-reader-closure-manifest.ts";
import {
  assertStep44DigestRosterRejectsSameCallDataflowDrift,
  assertStep44ExecutionFamiliesFailClosed,
  assertStep44FiniteBootstrapRejectsFallthrough,
  assertStep44FiniteOwnedProcessContract,
  assertStep44HostileProcessCallsFailClosed,
  assertStep44LiteralProcessTargetsEnterClosure,
  assertStep44ParserDiagnosticsFailClosed,
} from "./real-build-prefix50-step44-source-reader-closure-process-assertions.ts";
import { EXACT_STEP44_THREE_ROOT_IO_ROSTER } from "./real-build-prefix50-step44-source-reader-closure-roster.ts";

const E2E = resolve("apps/web/e2e");
const AUTHORITY = resolve(E2E, "real-build-prefix50-step44-later-source-authority.ts");
const DERIVED_RASTER = resolve(E2E, "real-build-prefix50-step44-later-source-derived-raster.ts");
const DERIVED_VECTOR = resolve(E2E, "real-build-prefix50-step44-later-source-derived-vector.ts");
const RENDERER = resolve(E2E, "real-build-prefix50-subbuild-return-review-pdf.ts");
const PANEL_VECTOR = resolve(E2E, "real-build-prefix50-step44-panel-face-prefix.ts");
const BOUNDED_CROP = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts",
);
const POPPLER = resolve(E2E, "real-build-prefix50-subbuild-return-review-poppler.ts");
const BYTE_ONLY_BOOKLET = resolve(E2E, "booklet-fixture.ts");
const LEGACY_FILE_SOURCE = resolve(E2E, "booklet-file-source.ts");
const LEGACY_ACTION_LEDGER = resolve(E2E, "real-build-action-ledger-compile.ts");
const LEGACY_ACTION_LEDGER_SPEC = resolve(E2E, "real-build-action-ledger.spec.ts");
const TEST_AUTHORITY = resolve(
  "apps/web/test/real-build-prefix50-step44-later-source-authority-test-seam.ts",
);
const ALIAS_GATE_FIXTURE = resolve(
  "apps/web/test/real-build-prefix50-step44-source-reader-closure-alias.fixture.ts",
);
const CHILD_GATE_FIXTURE = resolve(
  "apps/web/test/real-build-prefix50-step44-source-reader-closure-child.fixture.ts",
);
const HOSTILE_GATE_FIXTURE = resolve(
  "apps/web/test/real-build-prefix50-step44-source-reader-closure-hostile.fixture.ts",
);
const PRODUCTION_ROOTS = [
  resolve(E2E, "real-build-prefix50-subbuild-return-review-harness.ts"),
  resolve(E2E, "real-build-prefix50-step44-camera-only.spec.ts"),
  resolve(E2E, "real-build-prefix50-step44-real-domain-calibration.spec.ts"),
] as const;
const SOURCE_LOCK = "../e2e/real-build-prefix50-step44-camera-only-source-lock.ts" as const;
const GATE_EVIDENCE =
  "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts" as const;
const AUTHORITY_IMPORT = "../e2e/real-build-prefix50-step44-later-source-authority.ts" as const;
const RENDERER_IMPORT = "../e2e/real-build-prefix50-subbuild-return-review-pdf.ts" as const;
const ARTIFACT_IO_IMPORT =
  "../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts" as const;
const TEST_AUTHORITY_IMPORT =
  "./real-build-prefix50-step44-later-source-authority-test-seam.ts" as const;
const PDF_HASH = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const;
const closureAudit = auditExactStep44ThreeRootClosure(PRODUCTION_ROOTS, {
  repositoryRoot: resolve("."),
  executionRoster: EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER,
  expectedManifest: EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST,
});
const VALID_BATCH_NATIVE_NODE_COUNTEREVIDENCE = Object.freeze({
  probedModules: 389,
  extensionlessLocalEdges: 280,
  verdict: "unproved-and-not-natively-runnable",
});

function functionText(file: string, name: string): string {
  const parsed = closureAudit.modules.get(file);
  if (parsed === undefined) throw new TypeError(`Missing ${file} from exact Step-44 closure.`);
  const declaration = parsed.source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.body !== undefined,
  );
  if (declaration === undefined) throw new TypeError(`Missing ${name} in ${file}.`);
  return declaration.getText(parsed.source);
}

afterEach(() => {
  vi.doUnmock("node:fs");
  vi.doUnmock("node:child_process");
  vi.doUnmock(SOURCE_LOCK);
  vi.doUnmock(GATE_EVIDENCE);
  vi.doUnmock(AUTHORITY_IMPORT);
  vi.doUnmock(ARTIFACT_IO_IMPORT);
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("post-Step-43 later-source authority", () => {
  it("rejects caller-shaped authority before any filesystem or source-lock read", async () => {
    const realpathRead = vi.fn(() => process.cwd());
    const sourceLockRead = vi.fn();
    vi.doMock("node:fs", async (importOriginal) => ({
      ...(await importOriginal<typeof import("node:fs")>()),
      realpathSync: realpathRead,
    }));
    vi.doMock(SOURCE_LOCK, () => ({
      captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock: sourceLockRead,
      requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock: vi.fn(),
      assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock: vi.fn(),
    }));
    vi.doMock(GATE_EVIDENCE, () => ({
      requireRealBuildPrefix50Step44RealDomainQualificationBinding: () => {
        throw new TypeError(
          "Step-44 page-45 camera execution requires a runtime-branded persisted Steps-41/42-qualified and Step-43-validated real-domain binding.",
        );
      },
    }));
    const authority = await import(AUTHORITY_IMPORT);
    expect(() =>
      authority.issueRealBuildPrefix50Step44LaterSourceReadCapability({
        repositoryRoot: process.cwd(),
        qualification: Object.freeze({}) as never,
        purpose: "page45-camera-raster",
        physicalPageNumber: 45,
      }),
    ).toThrow(/runtime-branded persisted Steps-41\/42-qualified and Step-43-validated/u);
    expect(realpathRead).not.toHaveBeenCalled();
    expect(sourceLockRead).not.toHaveBeenCalled();
  });

  it("burns the public renderer capability before density validation without reading or spawning", async () => {
    const artifactRead = vi.fn(() => {
      throw new Error("invalid density reached source bytes");
    });
    const spawn = vi.fn(() => {
      throw new Error("invalid density spawned Poppler");
    });
    vi.doMock(AUTHORITY_IMPORT, () => import(TEST_AUTHORITY_IMPORT));
    vi.doMock("node:child_process", async (importOriginal) => ({
      ...(await importOriginal<typeof import("node:child_process")>()),
      spawnSync: spawn,
    }));
    vi.doMock(ARTIFACT_IO_IMPORT, async (importOriginal) => ({
      ...(await importOriginal<
        typeof import("../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts")
      >()),
      readRealBuildPrefix50Step44ReviewArtifact: artifactRead,
    }));
    const authority = await import(TEST_AUTHORITY_IMPORT);
    const renderer = await import(RENDERER_IMPORT);
    const capability = authority.issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
      repositoryRoot: process.cwd(),
      sourcePdfArtifactPath: "output/unread-invalid-density.pdf",
      sourcePdfDigest: PDF_HASH,
      maximumSourceBytes: 1,
      purpose: "page45-camera-raster",
      physicalPageNumber: 45,
    });
    await expect(
      renderer.rerenderRealBuildPrefix50Step44PdfPage({
        capability,
        purpose: "page45-camera-raster",
        densityDpi: 0,
        retainDecodedBytes: false,
      }),
    ).rejects.toThrow(/1\.\.600 integer DPI/u);
    expect(artifactRead).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
    await expect(
      renderer.rerenderRealBuildPrefix50Step44PdfPage({
        capability,
        purpose: "page45-camera-raster",
        densityDpi: 180,
        retainDecodedBytes: false,
      }),
    ).rejects.toThrow(/already been consumed/u);
    expect(artifactRead).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("refuses forged capabilities and invalid persisted authority before artifact reads", async () => {
    const readSpy = vi.spyOn(artifactIo, "readRealBuildPrefix50Step44ReviewArtifact");
    await expect(
      deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(Object.freeze({}) as never),
    ).rejects.toThrow(/exact opaque post-Step-43 qualification capability/u);
    await expect(
      rerenderRealBuildPrefix50Step44PdfPage({
        capability: Object.freeze({}) as never,
        purpose: "page45-camera-raster",
        densityDpi: 180,
        retainDecodedBytes: false,
      }),
    ).rejects.toThrow(/exact opaque post-Step-43 qualification capability/u);
    await expect(
      verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts(
        {
          source: { digest: PDF_HASH },
          sourcePageRaster: { densityDpi: 180 },
        } as never,
        Object.freeze({}) as never,
        { laterSourceReadCapability: Object.freeze({}) as never },
      ),
    ).rejects.toThrow(/exact opaque post-Step-43 qualification capability/u);

    let layoutReads = 0;
    const layout = new Proxy({} as RealBuildPrefix50Step44BlindReviewOutputLayout, {
      get() {
        layoutReads += 1;
        throw new Error("persisted layout was touched before qualification");
      },
    });
    await expect(
      readRealBuildPrefix50Step44PersistedPromotionEvidence(
        layout,
        process.cwd(),
        Object.freeze({ commitment: canonicalDigest({ invalid: "batch" }) }) as never,
        Object.freeze({}) as never,
      ),
    ).rejects.toThrow(/runtime-branded persisted Steps-41\/42-qualified and Step-43-validated/u);
    await expect(
      createRealBuildPrefix50Step44BlindPromotionReceipt({
        layout,
        withheldRoot: "unread-withheld",
        rawInputRoot: "unread-input",
        repositoryRoot: process.cwd(),
        batch: Object.freeze({ commitment: canonicalDigest({ invalid: "batch" }) }) as never,
        result: Object.freeze({}) as never,
        capability: Object.freeze({}) as never,
        realDomainQualification: Object.freeze({}) as never,
      }),
    ).rejects.toThrow(/runtime-branded persisted Steps-41\/42-qualified and Step-43-validated/u);
    expect(layoutReads).toBe(0);
    expect(readSpy).not.toHaveBeenCalled();
  });
});

describe("exact Step-44 three-root production source-reader closure", () => {
  it("fails closed over runtime local imports, loaders, child scripts, and an explicit I/O roster", () => {
    const closure = closureAudit.modules;
    expect(closure.size).toBe(EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST.length);
    for (const root of PRODUCTION_ROOTS) expect(closure.has(root), root).toBe(true);
    for (const guarded of [AUTHORITY, RENDERER, PANEL_VECTOR, BOUNDED_CROP])
      expect(closure.has(guarded), guarded).toBe(true);
    for (const unreachable of [LEGACY_FILE_SOURCE, LEGACY_ACTION_LEDGER, LEGACY_ACTION_LEDGER_SPEC])
      expect(closure.has(unreachable), unreachable).toBe(false);
    expect(closure.has(TEST_AUTHORITY)).toBe(false);
    expect(() =>
      assertExactStep44IoRoster(closureAudit, resolve("."), EXACT_STEP44_THREE_ROOT_IO_ROSTER),
    ).not.toThrow();
    expect(step44ExecutionRosterCommitment(EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER)).toBe(
      EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER_COMMITMENT,
    );
    expect(closureAudit.executionRosterIds).toEqual(
      EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER.map(({ id }) => id).sort(),
    );
    const [firstAllowance, ...remainingAllowances] =
      EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER;
    expect(
      step44ExecutionRosterCommitment([
        { ...firstAllowance!, reason: `${firstAllowance!.reason} deliberate drift` },
        ...remainingAllowances,
      ]),
    ).not.toBe(EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER_COMMITMENT);
    expect(closureAudit.manifest).toEqual(EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST);
    expect(step44ManifestCommitment(EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST)).toBe(
      EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST_COMMITMENT,
    );
    const [firstManifestRow, ...remainingManifest] = EXACT_STEP44_THREE_ROOT_CLOSURE_MANIFEST;
    const driftedManifest = [
      { ...firstManifestRow!, bytes: firstManifestRow!.bytes + 1 },
      ...remainingManifest,
    ];
    const driftedAudit = auditExactStep44ThreeRootClosure(PRODUCTION_ROOTS, {
      repositoryRoot: resolve("."),
      executionRoster: EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER,
      expectedManifest: driftedManifest,
    });
    expect(driftedAudit.violations.join("\n")).toMatch(
      /manifest-pinned module changed without reviewed repin/u,
    );
    expect(() => assertStep44FiniteOwnedProcessContract(closureAudit, resolve("."))).not.toThrow();
    expect(() => assertStep44FiniteBootstrapRejectsFallthrough(resolve("."))).not.toThrow();
    for (const file of [AUTHORITY, BOUNDED_CROP, DERIVED_RASTER])
      expect(
        closureAudit.uses.some(
          (use) => use.file === file && use.category === "bounded-source-read",
        ),
        file,
      ).toBe(true);
    for (const file of [PANEL_VECTOR, RENDERER])
      expect(
        closureAudit.uses.some(
          (use) => use.file === file && use.category === "bounded-source-read",
        ),
        file,
      ).toBe(false);
    expect(
      closureAudit.uses.some(
        (use) =>
          use.file === POPPLER && use.category === "child-process" && use.primitive === "spawnSync",
      ),
    ).toBe(true);

    const booklet = closure.get(BYTE_ONLY_BOOKLET)!;
    expect(booklet.specifiers.some(({ value }) => value.includes("pdfjs-dist"))).toBe(true);
    expect(
      step44ModuleCallsAny(
        booklet,
        new Set([
          "readFile",
          "readFileSync",
          "readBoundedRegularFile",
          "readContainedBoundedRegularFile",
        ]),
      ),
    ).toBe(false);
    expect(booklet.source.getText()).not.toContain("readSampleBookletBytes");
  });

  it("admits only direct literal child targets and rejects aliases, loaders, and adapters", () => {
    const aliased = auditExactStep44ThreeRootClosure([ALIAS_GATE_FIXTURE]);
    expect(aliased.modules.has(CHILD_GATE_FIXTURE)).toBe(true);
    expect(aliased.violations.join("\n")).toMatch(/aliased sensitive import/u);
    expect(aliased.violations.join("\n")).toMatch(/aliased bounded-reader import/u);
    expect(aliased.violations.join("\n")).toMatch(/process\.getBuiltinModule loader is forbidden/u);
    expect(aliased.violations.join("\n")).toMatch(/module\.require loader is forbidden/u);

    expect(() => assertStep44LiteralProcessTargetsEnterClosure(resolve("."))).not.toThrow();

    const hostile = auditExactStep44ThreeRootClosure([HOSTILE_GATE_FIXTURE]);
    expect(hostile.violations.join("\n")).toMatch(/uncategorized node:fs primitive watch/u);
    expect(hostile.violations.join("\n")).toMatch(/unresolved computed import call/u);
    expect(hostile.violations.join("\n")).toMatch(/module\.require loader is forbidden/u);
    expect(hostile.violations.join("\n")).toMatch(/computed global\/module\/process access/u);
    expect(hostile.violations.join("\n")).toMatch(/Function constructor is forbidden/u);
    expect(hostile.violations.join("\n")).toMatch(/literal local import must resolve/u);
    expect(() => assertStep44HostileProcessCallsFailClosed(hostile.violations)).not.toThrow();
    expect(() => assertStep44DigestRosterRejectsSameCallDataflowDrift(resolve("."))).not.toThrow();
    expect(() => assertStep44ExecutionFamiliesFailClosed(resolve("."))).not.toThrow();
    expect(() => assertStep44ParserDiagnosticsFailClosed(resolve("."))).not.toThrow();
  });

  it("retains only the invalid-schema direct-Node smoke and explicit valid-batch counterevidence", () => {
    const harness = PRODUCTION_ROOTS[0];
    const invalidSchemaPreflight = auditExactStep44ThreeRootClosure([harness], {
      includeDynamic: false,
    });
    expect(findExtensionlessRuntimeLocalEdges(invalidSchemaPreflight)).toEqual([]);
    const text = readFileSync(harness, "utf8");
    expect(text.indexOf("input.schemaVersion")).toBeLessThan(
      text.indexOf(
        'await import("./real-build-prefix50-subbuild-return-review-camera-qualified-production.ts")',
      ),
    );
    expect(findExtensionlessRuntimeLocalEdges(closureAudit).length).toBeGreaterThan(0);
    expect(VALID_BATCH_NATIVE_NODE_COUNTEREVIDENCE).toEqual({
      probedModules: 389,
      extensionlessLocalEdges: 280,
      verdict: "unproved-and-not-natively-runnable",
    });
  });

  it("burns before the sole internal read and dispatches verified bytes through the fixed leaf", () => {
    const authority = functionText(
      AUTHORITY,
      "executeRealBuildPrefix50Step44LaterSourceDerivation",
    );
    expect(authority).not.toContain("input.request");
    expect(
      authority.indexOf("prepareRealBuildPrefix50Step44LaterSourceDerivedOperation"),
    ).toBeLessThan(authority.indexOf("beginRealBuildPrefix50Step44LaterSourceInternalTransaction"));
    expect(
      authority.indexOf("beginRealBuildPrefix50Step44LaterSourceInternalTransaction"),
    ).toBeLessThan(authority.indexOf("readRealBuildPrefix50Step44ReviewArtifact"));
    expect(authority.indexOf("readRealBuildPrefix50Step44ReviewArtifact")).toBeLessThan(
      authority.indexOf("executeRealBuildPrefix50Step44LaterSourceDerivedOperation"),
    );
    expect(
      authority.indexOf("executeRealBuildPrefix50Step44LaterSourceDerivedOperation"),
    ).toBeLessThan(
      authority.indexOf("completeRealBuildPrefix50Step44LaterSourceInternalTransaction"),
    );
    expect(authority).toContain("bytes?.fill(0)");
    const invocationSnapshot = functionText(AUTHORITY, "snapshotInvocation");
    expect(invocationSnapshot).toContain("Object.getOwnPropertyDescriptors");
    expect(invocationSnapshot).not.toContain("value.request");

    const renderer = functionText(RENDERER, "rerenderRealBuildPrefix50Step44PdfPage");
    expect(renderer).toContain("executeRealBuildPrefix50Step44LaterSourceDerivation");
    expect(renderer).not.toContain("readRealBuildPrefix50Step44ReviewArtifact");
    expect(renderer).not.toContain("runRealBuildPrefix50Step44Poppler");

    const panel = functionText(PANEL_VECTOR, "deriveRepositoryFaceRows");
    expect(panel).toContain("executeRealBuildPrefix50Step44LaterSourceDerivation");
    expect(panel).not.toContain("readContainedBoundedRegularFile");

    const raster = functionText(DERIVED_RASTER, "renderRealBuildPrefix50Step44LaterSourceRaster");
    expect(raster.indexOf("sourceBytes")).toBeLessThan(
      raster.indexOf("runRealBuildPrefix50Step44Poppler"),
    );
    expect(raster).toContain('"-",\n        outputPrefix');
    const vector = functionText(
      DERIVED_VECTOR,
      "deriveRealBuildPrefix50Step44LaterSourcePanelPrefix",
    );
    expect(vector).toContain("ingestPdfPrefix(sourceBytes");
    expect(vector).toContain("sampleBookletPageShapes(sourceBytes");

    const crop = functionText(BOUNDED_CROP, "rerenderRealBuildPrefix50Step44PdfCrop");
    expect(crop.indexOf("await requireReadAuthorization")).toBeLessThan(
      crop.indexOf("readRealBuildPrefix50Step44ReviewArtifact"),
    );
    expect(crop.indexOf("readRealBuildPrefix50Step44ReviewArtifact")).toBeLessThan(
      crop.indexOf("runRealBuildPrefix50Step44Poppler"),
    );
    expect(crop).toContain("sourceBytes,");
    expect(crop).not.toContain("input.sourcePdfArtifactPath,\n        outputPrefix");
  });

  it("requires capability fields at every three-root full-page call and exports no test issuer", () => {
    const closure = closureAudit.modules;
    const callers = [...closure.values()].flatMap((parsed) =>
      step44ModuleCalls(parsed, "rerenderRealBuildPrefix50Step44PdfPage").map((call) => ({
        call,
        parsed,
      })),
    );
    expect(callers.length).toBeGreaterThan(0);
    for (const { call, parsed } of callers) {
      const argument = call.arguments[0];
      expect(argument !== undefined && ts.isObjectLiteralExpression(argument), parsed.file).toBe(
        true,
      );
      const text = argument!.getText(parsed.source);
      expect(text, parsed.file).toContain("capability:");
      expect(text, parsed.file).toContain("purpose:");
      expect(text, parsed.file).toContain("densityDpi:");
      expect(text, parsed.file).toContain("retainDecodedBytes:");
      expect(text, parsed.file).not.toContain("sourcePdfArtifactPath:");
    }
    const authority = closure.get(AUTHORITY)!.source;
    const exportedNames = authority.statements.flatMap((statement) => {
      if (
        !ts.isFunctionDeclaration(statement) ||
        statement.name === undefined ||
        !statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)
      )
        return [];
      return [statement.name.text];
    });
    expect(exportedNames).toEqual([
      "issueRealBuildPrefix50Step44LaterSourceReadCapability",
      "executeRealBuildPrefix50Step44LaterSourceDerivation",
    ]);
    expect(authority.getText()).not.toContain("NODE_ENV");
    expect(authority.getText()).not.toContain("TestOnly");
  });
});

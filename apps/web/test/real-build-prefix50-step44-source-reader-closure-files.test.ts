import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { snapshotStep44ClosureFile } from "./real-build-prefix50-step44-source-reader-closure-files.ts";
import { auditExactStep44ThreeRootClosure } from "./real-build-prefix50-step44-source-reader-closure-gate.ts";
import { assertStep44LaterSourceImportExclusivity } from "./real-build-prefix50-step44-later-source-closure-assertions.ts";
import { EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER } from "./real-build-prefix50-step44-source-reader-closure-execution-roster.ts";
import {
  assertStep44ExecutionFamiliesFailClosed,
  assertStep44LiteralProcessTargetsEnterClosure,
  assertStep44ParserDiagnosticsFailClosed,
} from "./real-build-prefix50-step44-source-reader-closure-process-assertions.ts";

const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const ignored = resolve("output/step44-source-closure-controls");
  mkdirSync(ignored, { recursive: true });
  const root = realpathSync.native(mkdtempSync(join(ignored, "control-")));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
});

describe("exact Step-44 closure file authority", () => {
  it("rejects a junction or symlink alias instead of auditing its target path", () => {
    const root = temporaryRoot();
    const realDirectory = join(root, "real");
    const aliasDirectory = join(root, "alias");
    mkdirSync(realDirectory);
    const target = join(realDirectory, "fixture.ts");
    writeFileSync(target, "export const value = 1;\n", "utf8");
    symlinkSync(realDirectory, aliasDirectory, "junction");
    expect(() =>
      snapshotStep44ClosureFile({
        candidate: join(aliasDirectory, "fixture.ts"),
        repositoryRoot: resolve("."),
        kind: "typescript-source",
      }),
    ).toThrow(/path aliases, case drift, links, or reparses/u);
  });

  it("rejects a regular file with another hardlink name", () => {
    const root = temporaryRoot();
    const target = join(root, "fixture.ts");
    const alias = join(root, "fixture-alias.ts");
    writeFileSync(target, "export const value = 1;\n", "utf8");
    linkSync(target, alias);
    expect(() =>
      snapshotStep44ClosureFile({
        candidate: target,
        repositoryRoot: resolve("."),
        kind: "typescript-source",
      }),
    ).toThrow(/single-name file/u);
  });

  it("rejects full-manifest digest, byte-count, kind, and path drift", () => {
    const root = temporaryRoot();
    const file = join(root, "manifest.fixture.ts");
    writeFileSync(file, "export const value = 1;\n", "utf8");
    const audit = auditExactStep44ThreeRootClosure([file], {
      repositoryRoot: resolve("."),
      executionRoster: [],
    });
    expect(audit.violations).toEqual([]);
    const row = audit.manifest[0]!;
    const mutations = [
      { ...row, digest: `sha256:${"0".repeat(64)}` as `sha256:${string}` },
      { ...row, bytes: row.bytes + 1 },
      { ...row, kind: "external-immutable-helper" as const },
      { ...row, kind: "external-immutable-binary" as const },
      { ...row, path: `${row.path}.alias` },
    ];
    for (const expected of mutations) {
      const drift = auditExactStep44ThreeRootClosure([file], {
        repositoryRoot: resolve("."),
        executionRoster: [],
        expectedManifest: [expected],
      });
      expect(drift.violations.join("\n")).toMatch(
        /manifest-pinned module changed|unreachable|absent from manifest/u,
      );
    }
  });

  it("rejects parser recovery and every omitted execution family", () => {
    expect(() => assertStep44ParserDiagnosticsFailClosed(resolve("."))).not.toThrow();
    expect(() => assertStep44ExecutionFamiliesFailClosed(resolve("."))).not.toThrow();
  });

  it("inventories hostile PowerShell only as exact external bytes", () => {
    expect(() => assertStep44LiteralProcessTargetsEnterClosure(resolve("."))).not.toThrow();
  });

  it("follows exact runtime workspace package exports and rejects unrostered packages", () => {
    const repositoryRoot = resolve(".");
    const fixture = resolve(
      "apps/web/test/real-build-prefix50-step44-source-reader-closure-workspace-export.fixture.ts",
    );
    const audit = auditExactStep44ThreeRootClosure([fixture], {
      repositoryRoot,
      executionRoster: [],
    });
    expect(audit.violations).toEqual([]);
    for (const path of [
      "packages/brick-kernel/package.json",
      "packages/brick-kernel/src/index.ts",
      "packages/brick-kernel/src/canonical.ts",
    ])
      expect(audit.modules.has(resolve(path)), path).toBe(true);

    const root = temporaryRoot();
    const hostile = join(root, "unrostered-workspace.ts");
    writeFileSync(hostile, 'import "@lego-studio/not-a-package";\n', "utf8");
    expect(
      auditExactStep44ThreeRootClosure([hostile], {
        repositoryRoot,
        executionRoster: [],
      }).violations.join("\n"),
    ).toMatch(/workspace package is outside its exact roster/u);
  });

  it("keeps the prepared dispatcher, internal ledger, and provisioner importers exclusive", () => {
    const repositoryRoot = resolve(".");
    const roots = [
      resolve("apps/web/e2e/real-build-prefix50-subbuild-return-review-harness.ts"),
      resolve("apps/web/e2e/real-build-prefix50-step44-camera-only.spec.ts"),
      resolve("apps/web/e2e/real-build-prefix50-step44-real-domain-calibration.spec.ts"),
    ];
    const audit = auditExactStep44ThreeRootClosure(roots, {
      repositoryRoot,
      executionRoster: EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER,
    });
    expect(audit.violations).toEqual([]);
    expect(() => assertStep44LaterSourceImportExclusivity(audit, repositoryRoot)).not.toThrow();
  }, 30_000);
});

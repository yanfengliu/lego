import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { posix } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { snapshotRealBuildCodeRoots } from "../e2e/real-build-artifacts";
import { preflightRealBuildOptions } from "../e2e/real-build-contract";
import { deriveMeasuredFartherOriginSourceAttestation } from "../e2e/real-build-farther-origin-source-attestation";
import {
  MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS,
  MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
  MEASURED_FARTHER_ORIGIN_SOURCE_MANIFEST_PATH,
  MEASURED_FARTHER_ORIGIN_ENTRY_SOURCE_PATHS,
  MEASURED_FARTHER_ORIGIN_RUNTIME_SOURCE_PATHS,
  isMeasuredFartherOriginSourcePath,
} from "../e2e/real-build-farther-origin-source-manifest";
import {
  createRealBuildRunContract,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  REAL_BUILD_PANEL_SOURCE_ROLE,
  realBuildRunBudgets,
  realBuildRunThresholds,
  verifyRealBuildRunContract,
} from "../e2e/real-build-run-contract";
import type { RealBuildSourceSnapshot } from "../e2e/real-build-replay-files";
import type { RealBuildOptions } from "../e2e/real-build-safety";
import { REAL_BUILD_SOURCE_ROOTS } from "../e2e/real-build-source-roots";
import { REAL_BUILD_TEST_DIGEST, completeRealBuildTestOptions } from "./real-build-test-options";

const DIFFERENT_DIGEST = `sha256:${"b".repeat(64)}`;
const codeUnitCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function runtimeSourceSpecifiersFromText(path: string, text: string): readonly string[] {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : path.endsWith(".jsx")
        ? ts.ScriptKind.JSX
        : /\.[cm]?ts$/u.test(path)
          ? ts.ScriptKind.TS
          : ts.ScriptKind.JS,
  );
  const specifiers: string[] = [];
  const literalModuleSpecifier = (expression: ts.Expression): string | null =>
    ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
      ? expression.text
      : null;
  const isImportMetaUrl = (expression: ts.Expression): boolean =>
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "url" &&
    ts.isMetaProperty(expression.expression) &&
    expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    expression.expression.name.text === "meta";
  const importClauseRuns = (clause: ts.ImportClause | undefined): boolean => {
    if (clause === undefined) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name !== undefined || clause.namedBindings === undefined) return true;
    if (ts.isNamespaceImport(clause.namedBindings)) return true;
    if (clause.namedBindings.elements.length === 0) return true;
    return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
  };
  const exportClauseRuns = (declaration: ts.ExportDeclaration): boolean => {
    if (declaration.isTypeOnly) return false;
    if (declaration.exportClause === undefined) return true;
    if (ts.isNamespaceExport(declaration.exportClause)) return true;
    if (declaration.exportClause.elements.length === 0) return true;
    return declaration.exportClause.elements.some((element) => !element.isTypeOnly);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      importClauseRuns(node.importClause)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      exportClauseRuns(node)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments.length === 1 ? node.arguments[0] : undefined;
      const specifier = argument === undefined ? null : literalModuleSpecifier(argument);
      if (specifier === null) {
        throw new TypeError(
          `Verifier module ${path} contains a computed dynamic import; source attestation requires a literal module path.`,
        );
      }
      specifiers.push(specifier);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      const argument = node.arguments.length === 1 ? node.arguments[0] : undefined;
      const specifier = argument === undefined ? null : literalModuleSpecifier(argument);
      if (specifier === null) {
        throw new TypeError(
          `Verifier module ${path} contains a computed CommonJS require; source attestation requires a literal module path.`,
        );
      }
      specifiers.push(specifier);
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL" &&
      node.arguments?.length === 2 &&
      isImportMetaUrl(node.arguments[1]!)
    ) {
      const specifier = literalModuleSpecifier(node.arguments[0]!);
      if (specifier === null) {
        throw new TypeError(
          `Verifier module ${path} contains a computed import-relative file URL; source attestation requires a literal path.`,
        );
      }
      if (posix.extname(specifier) !== "") specifiers.push(specifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function runtimeSourceSpecifiers(path: string): readonly string[] {
  return runtimeSourceSpecifiersFromText(path, readFileSync(path, "utf8"));
}

function powershellRuntimeSourceSpecifiersFromText(text: string): readonly string[] {
  return [...text.matchAll(/^\s*"([^"\r\n]+\.(?:cs|ps1))",?\s*$/gmu)].map((match) =>
    match[1]!.startsWith(".") ? match[1]! : `./${match[1]!}`,
  );
}

function resolveRuntimeSource(importer: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = posix.normalize(posix.join(posix.dirname(importer), specifier));
  if (base.startsWith("../") || posix.isAbsolute(base)) {
    throw new TypeError(
      `Verifier import ${JSON.stringify(specifier)} from ${importer} escapes the repository.`,
    );
  }
  const candidates =
    posix.extname(base) !== ""
      ? [base]
      : [
          `${base}.ts`,
          `${base}.tsx`,
          `${base}.mts`,
          `${base}.cts`,
          `${base}.mjs`,
          `${base}.cjs`,
          `${base}.js`,
          `${base}.jsx`,
          `${base}.json`,
          `${base}/index.ts`,
          `${base}/index.tsx`,
          `${base}/index.mts`,
          `${base}/index.cts`,
          `${base}/index.mjs`,
          `${base}/index.cjs`,
          `${base}/index.js`,
          `${base}/index.jsx`,
        ];
  const resolved = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (resolved === undefined) {
    throw new TypeError(
      `Verifier import ${JSON.stringify(specifier)} from ${importer} does not resolve to a retained first-party module.`,
    );
  }
  return resolved;
}

function measuredRuntimeSourceClosure(): readonly string[] {
  const pending = [...MEASURED_FARTHER_ORIGIN_ENTRY_SOURCE_PATHS];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const specifiers = /\.[cm]?[jt]sx?$/u.test(path)
      ? runtimeSourceSpecifiers(path)
      : path.endsWith(".ps1")
        ? powershellRuntimeSourceSpecifiersFromText(readFileSync(path, "utf8"))
        : [];
    for (const specifier of specifiers) {
      const resolved = resolveRuntimeSource(path, specifier);
      if (resolved === null || visited.has(resolved)) continue;
      if (/\.[cm]?[jt]sx?$|\.ps1$/u.test(resolved)) pending.push(resolved);
      else visited.add(resolved);
    }
  }
  return [...visited].sort(codeUnitCompare);
}

const canonicalFixtureSnapshots = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS.map((path) => [path, REAL_BUILD_TEST_DIGEST]),
  );

function executionSnapshots(
  canonical: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const rows: [string, string][] = [];
  for (const [path, digest] of Object.entries(canonical)) {
    rows.push([path, digest]);
    const packageMatch = /^packages\/([^/]+)\/(.+)$/u.exec(path);
    if (packageMatch !== null) {
      rows.push([`node_modules/@lego-studio/${packageMatch[1]!}/${packageMatch[2]!}`, digest]);
    }
  }
  rows.push(["inputs/booklet.pdf", REAL_BUILD_TEST_DIGEST]);
  return Object.fromEntries(rows.sort(([left], [right]) => codeUnitCompare(left, right)));
}

const retainedSources = (
  snapshots: Readonly<Record<string, string>>,
): readonly RealBuildSourceSnapshot[] =>
  Object.entries(snapshots).map(([path, digest]) => ({ path, digest, bytes: 1 }));

const identificationClosure = {
  source: "deterministic" as const,
  features: REAL_BUILD_TEST_DIGEST,
  match: REAL_BUILD_TEST_DIGEST,
  distances: REAL_BUILD_TEST_DIGEST,
  elements: REAL_BUILD_TEST_DIGEST,
  cards: null,
  cardImages: null,
  answers: null,
  pairJudged: REAL_BUILD_TEST_DIGEST,
};

const roleDigests = Object.fromEntries(
  [
    ...Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST),
    REAL_BUILD_PANEL_SOURCE_ROLE,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged,
  ].map((role) => [role, REAL_BUILD_TEST_DIGEST]),
);

function contractFor(options: RealBuildOptions, codeSnapshots: Readonly<Record<string, string>>) {
  return createRealBuildRunContract({
    inputDigests: options.inputDigests,
    identificationClosure,
    panelSourceDigest: REAL_BUILD_TEST_DIGEST,
    panels: options.panels,
    passivePanels: options.passivePanels,
    budgets: realBuildRunBudgets(options),
    thresholds: realBuildRunThresholds(options),
    codeSnapshots,
  });
}

function attestedFixture() {
  const codeSnapshots = executionSnapshots(canonicalFixtureSnapshots());
  const options: RealBuildOptions = {
    ...completeRealBuildTestOptions(1),
    measuredFartherOriginSourceAttestation:
      deriveMeasuredFartherOriginSourceAttestation(codeSnapshots),
  };
  return {
    codeSnapshots,
    options,
    contract: contractFor(options, codeSnapshots),
    sourceFiles: retainedSources(codeSnapshots),
  };
}

describe("measured farther-origin source attestation", () => {
  it("tracks literal dynamic, CommonJS, and import-relative file dependencies and refuses computed paths", () => {
    expect(
      runtimeSourceSpecifiersFromText(
        "scripts/entry.mjs",
        'import(`./dynamic.mjs`); require("./common.cjs");',
      ),
    ).toEqual(["./dynamic.mjs", "./common.cjs"]);

    expect(() =>
      runtimeSourceSpecifiersFromText(
        "scripts/computed-dynamic.mjs",
        "const suffix = 'child'; import(`./${suffix}.mjs`);",
      ),
    ).toThrow(/computed dynamic import.*literal module path/u);
    expect(() =>
      runtimeSourceSpecifiersFromText(
        "scripts/computed-require.cjs",
        "const child = './child.cjs'; require(child);",
      ),
    ).toThrow(/computed CommonJS require.*literal module path/u);
    expect(
      runtimeSourceSpecifiersFromText(
        "scripts/entry.mjs",
        'new URL("./launcher.ps1", import.meta.url);',
      ),
    ).toEqual(["./launcher.ps1"]);
    expect(() =>
      runtimeSourceSpecifiersFromText(
        "scripts/computed-file.mjs",
        "const name = './launcher.ps1'; new URL(name, import.meta.url);",
      ),
    ).toThrow(/computed import-relative file URL.*literal path/u);
  });

  it("imports its pure manifest and Node derivation directly without a Vite transform", () => {
    const moduleUrls = [
      new URL("../e2e/real-build-farther-origin-source-manifest.ts", import.meta.url).href,
      new URL("../e2e/real-build-farther-origin-source-attestation.ts", import.meta.url).href,
    ];
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `await Promise.all(${JSON.stringify(moduleUrls)}.map((url) => import(url)));`,
      ],
      { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
    );
    expect(
      result.status,
      [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n"),
    ).toBe(0);
  });

  it("derives an order-independent canonical closure and ignores aliases and Vite cache", () => {
    const canonical = canonicalFixtureSnapshots();
    const reversed = Object.fromEntries(Object.entries(canonical).reverse());
    const baseline = deriveMeasuredFartherOriginSourceAttestation(canonical);
    const ignoredInputs = {
      ...canonical,
      "node_modules/@lego-studio/catalog/src/index.ts": DIFFERENT_DIGEST,
      "apps/web/node_modules/.vite/deps/three.js": DIFFERENT_DIGEST,
      "inputs/booklet.pdf": DIFFERENT_DIGEST,
    };

    expect(deriveMeasuredFartherOriginSourceAttestation(reversed)).toEqual(baseline);
    expect(deriveMeasuredFartherOriginSourceAttestation(ignoredInputs)).toEqual(baseline);
    expect(baseline.fileCount).toBe(MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS.length);
    expect(isMeasuredFartherOriginSourcePath(MEASURED_FARTHER_ORIGIN_SOURCE_MANIFEST_PATH)).toBe(
      false,
    );
    expect(
      deriveMeasuredFartherOriginSourceAttestation({
        ...canonical,
        "apps/web/e2e/additional-runtime.ts": DIFFERENT_DIGEST,
      }),
    ).not.toEqual(baseline);
  });

  it("attests the exact verifier and production-evidence runtime-source closure without a broad scripts root", () => {
    const scriptClosure = measuredRuntimeSourceClosure().filter((path) =>
      path.startsWith("scripts/"),
    );
    const declaredScriptRoots = REAL_BUILD_SOURCE_ROOTS.filter(
      (path) =>
        path.startsWith("scripts/") && path !== "scripts/windows-lock-real-build-snapshot.ps1",
    );

    expect(scriptClosure).toEqual(MEASURED_FARTHER_ORIGIN_RUNTIME_SOURCE_PATHS);
    expect(declaredScriptRoots).toEqual(MEASURED_FARTHER_ORIGIN_RUNTIME_SOURCE_PATHS);
    expect(REAL_BUILD_SOURCE_ROOTS).not.toContain("scripts");
    expect(
      MEASURED_FARTHER_ORIGIN_RUNTIME_SOURCE_PATHS.every((path) =>
        isMeasuredFartherOriginSourcePath(path),
      ),
    ).toBe(true);
  });

  it("refuses missing anchors, non-canonical paths, and malformed digests", () => {
    const canonical = { ...canonicalFixtureSnapshots() };
    delete canonical["apps/web/e2e/real-build-farther-origin-attempt.ts"];
    expect(() => deriveMeasuredFartherOriginSourceAttestation(canonical)).toThrow(
      /missing 1 required canonical path/u,
    );
    expect(() =>
      deriveMeasuredFartherOriginSourceAttestation({
        ...canonicalFixtureSnapshots(),
        "apps/web/e2e/../escape.ts": REAL_BUILD_TEST_DIGEST,
      }),
    ).toThrow(/non-canonical path/u);
    expect(() =>
      deriveMeasuredFartherOriginSourceAttestation({
        ...canonicalFixtureSnapshots(),
        "apps/web/e2e/extra.ts": "sha256:not-a-digest",
      }),
    ).toThrow(/malformed digest/u);

    const missingRuntimeSource = { ...canonicalFixtureSnapshots() };
    delete missingRuntimeSource["scripts/part-identification-score-truth.mjs"];
    expect(() => deriveMeasuredFartherOriginSourceAttestation(missingRuntimeSource)).toThrow(
      /missing 1 result-determining runtime source path/u,
    );
  });

  it("accepts omitted legacy preflight state but refuses a malformed claimed attestation", () => {
    const legacy = { ...completeRealBuildTestOptions(1) } as Partial<RealBuildOptions> &
      Record<string, unknown>;
    delete (legacy as Record<string, unknown>).measuredFartherOriginSourceAttestation;
    expect(preflightRealBuildOptions(legacy as RealBuildOptions)).toEqual([]);

    const malformed = {
      ...completeRealBuildTestOptions(1),
      measuredFartherOriginSourceAttestation: {
        schemaVersion: "lego.real-build-source-attestation/1",
        fileCount: 0,
        digest: REAL_BUILD_TEST_DIGEST,
      },
    } as unknown as RealBuildOptions;
    expect(preflightRealBuildOptions(malformed)).toContainEqual(
      expect.objectContaining({
        code: "benchmark-policy-mismatch",
        inputKey: "measuredFartherOriginSourceAttestation",
      }),
    );
  });

  it("pins the expected manifest to the exact captured canonical source closure", () => {
    const active = deriveMeasuredFartherOriginSourceAttestation(
      snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS),
    );
    expect(active).toEqual(MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION);
  }, 30_000);

  it("independently rejects forged, missing, contract-mutated, and retained-mutated closure", () => {
    const fixture = attestedFixture();
    const verify = (
      input: {
        readonly contract?: typeof fixture.contract;
        readonly options?: RealBuildOptions;
        readonly sourceFiles?: readonly RealBuildSourceSnapshot[];
      } = {},
    ) =>
      verifyRealBuildRunContract({
        contract: input.contract ?? fixture.contract,
        options: input.options ?? fixture.options,
        roleDigests,
        sourceFiles: input.sourceFiles ?? fixture.sourceFiles,
      });

    expect(verify).not.toThrow();
    expect(() =>
      verify({
        options: {
          ...fixture.options,
          measuredFartherOriginSourceAttestation: {
            ...fixture.options.measuredFartherOriginSourceAttestation!,
            digest: DIFFERENT_DIGEST,
          },
        },
      }),
    ).toThrow(/does not reproduce from both/u);

    const contractMutation = {
      ...fixture.codeSnapshots,
      "apps/web/e2e/real-build-farther-origin-attempt.ts": DIFFERENT_DIGEST,
    };
    expect(() => verify({ contract: contractFor(fixture.options, contractMutation) })).toThrow(
      /does not reproduce from both/u,
    );

    const retainedMutation = fixture.sourceFiles.map((source) =>
      source.path === "apps/web/e2e/real-build-farther-origin-attempt.ts"
        ? { ...source, digest: DIFFERENT_DIGEST }
        : source,
    );
    expect(() => verify({ sourceFiles: retainedMutation })).toThrow(
      /does not reproduce from both/u,
    );

    const missingCanonical = { ...canonicalFixtureSnapshots() };
    delete missingCanonical["apps/web/e2e/real-build-farther-origin-attempt.ts"];
    const missingSnapshots = executionSnapshots(missingCanonical);
    expect(() =>
      verify({
        contract: contractFor(fixture.options, missingSnapshots),
        sourceFiles: retainedSources(missingSnapshots),
      }),
    ).toThrow(/missing 1 required canonical path/u);

    const legacyOptions = { ...fixture.options } as Partial<RealBuildOptions> &
      Record<string, unknown>;
    delete (legacyOptions as Record<string, unknown>).measuredFartherOriginSourceAttestation;
    expect(() => verify({ options: legacyOptions as RealBuildOptions })).not.toThrow();
  });
});

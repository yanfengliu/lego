import { existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  createRealBuildPlaywrightConfig,
  selectRealBuildPlaywrightLifecycleHooks,
  selectRealBuildPlaywrightOperation,
} from "../e2e/playwright-config-support.ts";

const E2E = resolve("apps/web/e2e");
const ENTRY = resolve(E2E, "real-build-prefix50-subbuild-return-review-camera-real-domain-gate.ts");
const CAMERA_ONLY_ENTRY = resolve(E2E, "real-build-prefix50-step44-camera-only.spec.ts");
const CALIBRATION_ENTRY = resolve(
  E2E,
  "real-build-prefix50-step44-real-domain-calibration.spec.ts",
);
const RUNTIME_MATERIALS_ENTRY = resolve(E2E, "real-build-prefix50-step44-runtime-materials.ts");
const PLAYWRIGHT_CONFIG_ENTRY = resolve("playwright.config.ts");
const SOURCE_PIXELS_IMPLEMENTATION = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-source-pixels.ts",
);
const SOURCE_PIXELS_DEDICATED_TEST = resolve(
  "apps/web/test/real-build-prefix50-subbuild-return-review-camera-real-domain-source-pixels.test.ts",
);
const TEST_ONLY_MASK_DERIVER = [
  "deriveUnsealedRealBuildPrefix50Step44",
  "SourcePixelsForTest",
].join("");
const REPOSITORY_SOURCE_ROOTS = [resolve("apps"), resolve("packages"), resolve("scripts")];
const FORBIDDEN = new Set([
  "real-build-prefix50-subbuild-return-review-camera.ts",
  "real-build-prefix50-subbuild-return-review-camera-source.ts",
  "real-build-prefix50-subbuild-return-review-camera-source-commitments.ts",
  "real-build-prefix50-subbuild-return-review-camera-real-domain-heldout.ts",
  "real-build-prefix50-step45-relational-compilation.ts",
]);
const ALLOWED_NON_LITERAL_RUNTIME_IMPORTS = new Set([
  resolve("scripts", "part-identification-typescript-runtime.mjs"),
]);
const ALLOWED_POST_UNLOCK_DYNAMIC_IMPORTS = new Map<string, ReadonlySet<string>>([
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts",
    new Set(["./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts"]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts",
    new Set(["./real-build-prefix50-subbuild-return-review-camera-real-domain-heldout-raster.ts"]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts",
    new Set([
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-heldout.ts",
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts",
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts",
    ]),
  ],
  [
    "real-build-prefix50-step44-camera-only-gate-support.ts",
    new Set([
      "./real-build-prefix50-step44-camera-only-gate-artifacts.ts",
      "./real-build-prefix50-step44-camera-only-gate-contract.ts",
      "./real-build-prefix50-step44-camera-only-gate-probe.ts",
      "./real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts",
      "./real-build-prefix50-subbuild-return-review-camera-attempt.ts",
      "./real-build-prefix50-subbuild-return-review-camera-calibration.ts",
      "./real-build-prefix50-subbuild-return-review-camera-search.ts",
      "./real-build-prefix50-subbuild-return-review-camera-semantic.ts",
      "./real-build-prefix50-subbuild-return-review-camera-source.ts",
      "./real-build-prefix50-subbuild-return-review-camera.ts",
    ]),
  ],
]);
const REQUIRED_PRE_UNLOCK_DYNAMIC_IMPORTS = new Map<string, ReadonlySet<string>>([
  [
    "part-identification-2453-builder-identity.mjs",
    new Set([
      "../apps/web/e2e/real-build-official.ts",
      "../packages/catalog/src/catalog.ts",
      "../packages/catalog/src/constants.ts",
      "../packages/catalog/src/part-blueprints-6651557-measured-h.ts",
      "../packages/catalog/src/mesh-assets-6651557-measured-h.ts",
      "../packages/catalog/src/ldraw-bundled-sources-6651557.ts",
      "../packages/catalog/src/mesh-assets.ts",
    ]),
  ],
  [
    "part-identification-2453-builder-registry-route.mjs",
    new Set(["../apps/web/e2e/real-build-builder-source-pins-m.ts"]),
  ],
  [
    "part-identification-legacy-recut-semantic-source.mjs",
    new Set([
      "../apps/web/e2e/real-build-action-ledger.ts",
      "../apps/web/e2e/real-build-official.ts",
    ]),
  ],
  [
    "part-identification-prefix50-semantic-closure-evidence.mjs",
    new Set(["../apps/web/e2e/real-build-official.ts"]),
  ],
  [
    "part-identification-prefix50-official-world-reconciliation.mjs",
    new Set([
      "./part-identification-prefix50-official-world-reconciliation-occurrence.mjs",
      "./part-identification-prefix50-official-world-reconciliation-topology.mjs",
      "../packages/catalog/src/index.ts",
    ]),
  ],
  [
    "part-identification-prefix50-official-ldraw-world-proposal.mjs",
    new Set(["../packages/catalog/src/index.ts"]),
  ],
  [
    "part-identification-prefix50-ldraw-catalog-frames.mjs",
    new Set([
      "../packages/catalog/src/index.ts",
      "../packages/brick-kernel/src/canonical.ts",
      "../packages/brick-kernel/src/factory.ts",
      "../apps/web/e2e/real-build-builder-frame-geometry.ts",
      "../apps/web/e2e/real-build-builder-sources.ts",
      "../apps/web/e2e/real-build-builder-ldraw-frame-contract.ts",
    ]),
  ],
  [
    "part-identification-prefix50-structural-events.mjs",
    new Set(["../apps/web/e2e/real-build-transition-classification.ts"]),
  ],
  [
    "part-identification-step31-32-order-reconciliation-source.mjs",
    new Set(["../apps/web/e2e/real-build-official.ts"]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-app.ts",
    new Set(["../src/persistence/indexeddb-project-repository.ts", "../src/editor-state.ts"]),
  ],
  [
    "real-build-prefix50-step44-calibration-publication-proof-loader.ts",
    new Set(["./real-build-prefix50-step44-calibration-publication-proof.ts"]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts",
    new Set([
      "./real-build-prefix50-step44-calibration-persisted-binding.ts",
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    ]),
  ],
  [
    "real-build-prefix50-step44-calibration-persisted-binding.ts",
    new Set([
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    ]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    new Set(["./real-build-prefix50-subbuild-return.ts"]),
  ],
]);

interface RuntimeImport {
  readonly specifier: string;
  readonly kind: "static" | "dynamic";
}

function runtimeImports(file: string): readonly RuntimeImport[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports: RuntimeImport[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings;
      const onlyTypeSpecifiers =
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every(({ isTypeOnly }) => isTypeOnly);
      if (clause?.isTypeOnly || (clause?.name === undefined && onlyTypeSpecifiers)) continue;
      imports.push({
        specifier: (statement.moduleSpecifier as ts.StringLiteral).text,
        kind: "static",
      });
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (
        clause !== undefined &&
        ts.isNamedExports(clause) &&
        clause.elements.length > 0 &&
        clause.elements.every(({ isTypeOnly }) => isTypeOnly)
      )
        continue;
      imports.push({
        specifier: (statement.moduleSpecifier as ts.StringLiteral).text,
        kind: "static",
      });
    }
    if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      ts.isStringLiteral(statement.moduleReference.expression)
    )
      imports.push({ specifier: statement.moduleReference.expression.text, kind: "static" });
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      const isRequireResolve =
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "require" &&
        node.expression.name.text === "resolve";
      if (isDynamicImport || isRequire || isRequireResolve) {
        const argument = node.arguments[0];
        if (argument === undefined || !ts.isStringLiteralLike(argument)) {
          if (ALLOWED_NON_LITERAL_RUNTIME_IMPORTS.has(file)) return;
          throw new TypeError(`Import-closure gate found a non-literal runtime import in ${file}.`);
        }
        imports.push({
          specifier: argument.text,
          kind: isDynamicImport ? "dynamic" : "static",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return imports;
}

function resolveLocal(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const direct = resolve(dirname(from), specifier);
  for (const candidate of [direct, `${direct}.ts`, direct.replace(/\.js$/u, ".ts")])
    if (existsSync(candidate)) return candidate;
  throw new TypeError(`Import-closure gate could not resolve ${specifier} from ${from}.`);
}

function isForbiddenRuntimePath(file: string): boolean {
  return FORBIDDEN.has(basename(file)) || /(?:page45|step45|heldout)/iu.test(basename(file));
}

function localRuntimeImport(input: {
  readonly edge: RuntimeImport;
  readonly file: string;
}): Readonly<{ imported: string | null; terminal: boolean }> {
  if (input.edge.kind !== "dynamic")
    return { imported: resolveLocal(input.file, input.edge.specifier), terminal: false };
  if (!input.edge.specifier.startsWith(".")) return { imported: null, terminal: true };
  const required = REQUIRED_PRE_UNLOCK_DYNAMIC_IMPORTS.get(basename(input.file));
  if (required?.has(input.edge.specifier) === true)
    return { imported: resolveLocal(input.file, input.edge.specifier), terminal: false };
  const allowed = ALLOWED_POST_UNLOCK_DYNAMIC_IMPORTS.get(basename(input.file));
  expect(
    allowed?.has(input.edge.specifier) === true,
    `unregistered dynamic runtime import ${input.edge.specifier} from ${input.file}`,
  ).toBe(true);
  return { imported: null, terminal: true };
}

function configuredPlaywrightLifecycleHooks(): readonly string[] {
  const operation = selectRealBuildPlaywrightOperation({
    LEGO_REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_REQUIRED: "1",
  });
  expect(operation.mode).toBe("real-domain-calibration");
  const { globalSetup, globalTeardown } = createRealBuildPlaywrightConfig({
    port: 5267,
    operation,
    // Inert static configuration data; production source closure never fabricates ownership.
    calibrationOutputDir: resolve(tmpdir(), "lego-calibration-import-closure-test", "playwright"),
  });
  expect(selectRealBuildPlaywrightLifecycleHooks(operation)).toEqual({
    globalSetup: "./apps/web/e2e/real-build-step44-calibration-global-setup.ts",
    globalTeardown: "./apps/web/e2e/real-build-global-teardown.ts",
  });
  if (typeof globalSetup !== "string" || typeof globalTeardown !== "string")
    throw new TypeError(
      "Import-closure gate requires one selected calibration setup and teardown.",
    );
  expect(globalSetup).toBe("./apps/web/e2e/real-build-step44-calibration-global-setup.ts");
  expect(globalSetup).not.toBe("./apps/web/e2e/global-setup.ts");
  expect(globalTeardown).toBe("./apps/web/e2e/real-build-global-teardown.ts");
  return [resolve(globalSetup), resolve(globalTeardown)];
}

function repositorySourceFiles(): readonly string[] {
  const files: string[] = [];
  const pending = [...REPOSITORY_SOURCE_ROOTS];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!["coverage", "dist", "node_modules", "output", "var"].includes(entry.name))
          pending.push(path);
        continue;
      }
      if (entry.isFile() && /\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) files.push(path);
    }
  }
  return files.sort();
}

function identifierLines(file: string, identifier: string): readonly number[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines: number[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && node.text === identifier)
      lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

function exportedConstDeclarations(file: string, identifier: string): number {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let declarations = 0;
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
      statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) !== true
    )
      continue;
    declarations += statement.declarationList.declarations.filter(
      ({ name }) => ts.isIdentifier(name) && name.text === identifier,
    ).length;
  }
  return declarations;
}

describe("real-domain pre-unlock runtime import closure", () => {
  it("keeps the unsealed source-pixel derivation behind its one dedicated test", () => {
    const occurrences = repositorySourceFiles().flatMap((file) =>
      identifierLines(file, TEST_ONLY_MASK_DERIVER).map((line) => ({ file, line })),
    );
    const allowedFiles = [SOURCE_PIXELS_DEDICATED_TEST, SOURCE_PIXELS_IMPLEMENTATION].sort();
    expect([...new Set(occurrences.map(({ file }) => file))].sort()).toEqual(allowedFiles);
    expect(occurrences.filter(({ file }) => file === SOURCE_PIXELS_IMPLEMENTATION)).toHaveLength(1);
    expect(
      occurrences.filter(({ file }) => file === SOURCE_PIXELS_DEDICATED_TEST).length,
    ).toBeGreaterThan(1);
    expect(exportedConstDeclarations(SOURCE_PIXELS_IMPLEMENTATION, TEST_ONLY_MASK_DERIVER)).toBe(1);
  });

  it("cannot reach page-45 camera source/law or the held-out module", () => {
    const pending = [ENTRY];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(isForbiddenRuntimePath(file), `forbidden runtime import ${file}`).toBe(false);
      for (const edge of runtimeImports(file)) {
        const { imported, terminal } = localRuntimeImport({ edge, file });
        if (!terminal && imported !== null) pending.push(imported);
      }
    }
    expect([...visited].some((file) => basename(file).includes("real-domain-session"))).toBe(true);
  });

  it("keeps camera-only v4 page45 modules behind persisted qualification", () => {
    const pending = [{ file: CAMERA_ONLY_ENTRY, via: [] as string[] }];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const { file, via } = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(
        isForbiddenRuntimePath(file),
        `forbidden runtime import ${file} via ${[...via, file].join(" -> ")}`,
      ).toBe(false);
      for (const edge of runtimeImports(file)) {
        const { imported, terminal } = localRuntimeImport({ edge, file });
        if (!terminal && imported !== null) pending.push({ file: imported, via: [...via, file] });
      }
    }
    expect([...visited].some((file) => basename(file).includes("runtime-materials"))).toBe(true);
    expect([...visited].some((file) => basename(file).includes("gate-evidence"))).toBe(true);
    expect([...visited].some((file) => basename(file).includes("gate-support"))).toBe(true);
  });

  it("roots the actual calibration spec, runtime materials, and Playwright config without page45", () => {
    const lifecycleHooks = configuredPlaywrightLifecycleHooks();
    const pending = [
      CALIBRATION_ENTRY,
      RUNTIME_MATERIALS_ENTRY,
      PLAYWRIGHT_CONFIG_ENTRY,
      ...lifecycleHooks,
    ];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(isForbiddenRuntimePath(file), `forbidden runtime import ${file}`).toBe(false);
      for (const edge of runtimeImports(file)) {
        const { imported, terminal } = localRuntimeImport({ edge, file });
        if (!terminal && imported !== null) pending.push(imported);
      }
    }
    expect(visited.has(CALIBRATION_ENTRY)).toBe(true);
    expect(visited.has(RUNTIME_MATERIALS_ENTRY)).toBe(true);
    expect(visited.has(PLAYWRIGHT_CONFIG_ENTRY)).toBe(true);
    expect(lifecycleHooks.every((file) => visited.has(file))).toBe(true);
    expect([...visited].some((file) => basename(file) === "playwright-config-support.ts")).toBe(
      true,
    );
    expect(
      [...visited].some(
        (file) => basename(file) === "real-build-step44-playwright-source-closure.ts",
      ),
    ).toBe(true);
  });

  it("mentions the held-out module only through the post-consumption dynamic import", () => {
    const session = readFileSync(
      resolve(E2E, "real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts"),
      "utf8",
    );
    expect(session.match(/camera-real-domain-heldout\.ts/gu)).toHaveLength(1);
    expect(session).toMatch(/const heldOut\s*=\s*await import\(/u);
  });

  it("verifies persisted qualification before the v4 page45 module expansion", () => {
    const support = readFileSync(
      resolve(E2E, "real-build-prefix50-step44-camera-only-gate-support.ts"),
      "utf8",
    );
    const verified = support.indexOf(
      "await readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification",
    );
    const expanded = support.indexOf("await Promise.all([");
    expect(verified).toBeGreaterThan(0);
    expect(expanded).toBeGreaterThan(verified);
    expect(support.slice(0, expanded)).not.toMatch(
      /camera-source\.ts|camera\.ts|camera-search\.ts|camera-calibration\.ts/iu,
    );
  });
});

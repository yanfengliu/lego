import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD } from "../apps/web/e2e/callout-field-names.ts";
import { TRANSITION_CLASSIFICATIONS_DIGEST_FIELD } from "../apps/web/e2e/real-build-action-ledger-field-names.ts";
import { OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD as MJS_OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD } from "./callout-manifest-shape.mjs";
import {
  bindingReferences,
  canonicalImports,
  createInMemoryProgram,
  exactReferenceInventory,
  referenceMatchesProductionPath,
  transparentExpressionChild,
  unwrapTransparentExpression,
  variableInitializer,
  variableInitializers,
} from "./field-name-consolidation-program.mjs";
import { TRANSITION_CLASSIFICATIONS_DIGEST_FIELD as MJS_TRANSITION_CLASSIFICATIONS_DIGEST_FIELD } from "./part-identification-action-ledger-field-names.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativeFile) => readFileSync(path.join(repositoryRoot, relativeFile), "utf8");
const normalizePath = (value) => value.replaceAll("\\", "/");
const transitionFieldIdentifier = "TRANSITION_CLASSIFICATIONS_DIGEST_FIELD";
const calloutFieldIdentifier = "OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD";

const transitionConsumerUsages = new Map([
  [
    "apps/web/e2e/real-build-action-ledger-legacy-v3.ts",
    [
      {
        kind: "consumed-key-array",
        owner: "TOP_KEYS",
        callee: "record",
        functionName: "admitCanonicalLegacyRealBuildActionLedgerV3Bytes",
      },
      {
        kind: "validation-loop-key",
        functionName: "admitCanonicalLegacyRealBuildActionLedgerV3Bytes",
      },
    ],
  ],
  [
    "apps/web/e2e/real-build-ledger-bounds.ts",
    [
      {
        kind: "consumed-key-array",
        owner: "TOP_LEVEL_KEYS",
        callee: "exactRecord",
        functionName: "preflightRealBuildActionLedger",
      },
      { kind: "digest-label", functionName: "preflightRealBuildActionLedger" },
    ],
  ],
  [
    "scripts/part-identification-action-ledger-prefix.mjs",
    [
      {
        kind: "consumed-key-array",
        owner: "TOP_LEVEL_KEYS",
        callee: "exactRecord",
        functionName: "inspectCurrentActionLedgerPrefix",
      },
      { kind: "validation-loop-key", functionName: "inspectCurrentActionLedgerPrefix" },
    ],
  ],
]);
const transitionPythonConsumerUsages = new Map([
  [
    "scripts/part_action_ledger_report_contract.py",
    [
      "action-ledger-exact-fields-set-key",
      "action-ledger-bindings-dict-key",
      "action-ledger-bindings-value-subscript-key",
    ],
  ],
  ["scripts/part_action_ledger_report_contract_test.py", ["action-ledger-digest-edge-loop-tuple"]],
]);
const calloutConsumerUsages = new Map([
  [
    "apps/web/e2e/callout-publication-schema-snapshot.ts",
    [
      { kind: "returned-field-pair-key", owner: "recoveryBenchmark", callee: "exactRecord" },
      { kind: "returned-field-pair-own-data", owner: "recoveryBenchmark", callee: "exactRecord" },
      { kind: "returned-field-pair-label", owner: "recoveryBenchmark", callee: "exactRecord" },
    ],
  ],
  [
    "apps/web/e2e/callout-run-id.ts",
    [{ kind: "returned-field-pair-key", owner: "recoveryBenchmark", callee: "record" }],
  ],
]);
const transitionOwners = new Set([
  "apps/web/e2e/real-build-action-ledger-field-names.ts",
  "scripts/part-identification-action-ledger-field-names.mjs",
]);
const calloutOwners = new Set([
  "apps/web/e2e/callout-field-names.ts",
  "scripts/callout-manifest-shape.mjs",
]);

const parseExecutable = (relativeFile, text) =>
  ts.createSourceFile(
    relativeFile,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativeFile.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );

const compilerOptions = {
  allowImportingTsExtensions: true,
  allowJs: true,
  checkJs: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.Latest,
};

const repositorySourcePaths = (() => {
  const git = spawnSync(
    "git",
    [
      "-c",
      `safe.directory=${normalizePath(repositoryRoot)}`,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps",
      "packages",
      "scripts",
    ],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true },
  );
  if (git.status !== 0) {
    throw new Error(`Could not discover repository field-name consumers: ${git.stderr.trim()}`);
  }
  return [...new Set(git.stdout.split(/\r?\n/u).filter(Boolean).map(normalizePath))]
    .filter((relativeFile) => existsSync(path.join(repositoryRoot, relativeFile)))
    .sort();
})();

const executableFieldCandidatePaths = repositorySourcePaths.filter(
  (relativeFile) =>
    /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(relativeFile) &&
    relativeFile !== "scripts/field-name-consolidation.test.mjs",
);

const fieldProgram = ts.createProgram({
  rootNames: executableFieldCandidatePaths.map((relativeFile) =>
    path.join(repositoryRoot, relativeFile),
  ),
  options: compilerOptions,
});
const fieldChecker = fieldProgram.getTypeChecker();
const fieldSourceByAbsolutePath = new Map(
  fieldProgram
    .getSourceFiles()
    .map((sourceFile) => [
      normalizePath(path.resolve(sourceFile.fileName)).toLowerCase(),
      sourceFile,
    ]),
);
const programSource = (relativeFile, program = fieldProgram) => {
  const absoluteFile = normalizePath(path.resolve(repositoryRoot, relativeFile)).toLowerCase();
  const sourceFile =
    program === fieldProgram
      ? fieldSourceByAbsolutePath.get(absoluteFile)
      : program
          .getSourceFiles()
          .find(
            (candidate) =>
              normalizePath(path.resolve(candidate.fileName)).toLowerCase() === absoluteFile,
          );
  expect(
    sourceFile,
    `${relativeFile} must be loaded into the binding-aware TypeScript program`,
  ).toBeDefined();
  return sourceFile;
};

const discoveredCanonicalConsumers = (field, owners) => {
  const ownerSourceFiles = [...owners].map((relativeFile) => programSource(relativeFile));
  return executableFieldCandidatePaths
    .filter((relativeFile) => !owners.has(relativeFile))
    .map((relativeFile) => {
      const sourceFile = programSource(relativeFile);
      return {
        relativeFile,
        imports: canonicalImports(sourceFile, fieldChecker, field, ownerSourceFiles),
      };
    })
    .filter(({ imports }) => imports.length > 0);
};

const constantStringValue = (node) => {
  const transparentChild = transparentExpressionChild(node);
  if (transparentChild !== undefined) return constantStringValue(transparentChild);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantStringValue(node.left);
    const right = constantStringValue(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
};

const executableLiteralTextsFromText = (relativeFile, text) => {
  const sourceFile = parseExecutable(relativeFile, text);
  expect(sourceFile.parseDiagnostics, relativeFile).toEqual([]);
  const literals = [];
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const value = constantStringValue(node);
      if (value !== undefined) literals.push(value);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      literals.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return literals;
};

const executableLiteralTexts = (relativeFile) =>
  executableLiteralTextsFromText(relativeFile, source(relativeFile));

const expectEveryDiscoveredConsumerWired = (field, owners, expectedUsages) => {
  const discovered = discoveredCanonicalConsumers(field, owners);
  expect(
    discovered.map(({ relativeFile }) => relativeFile),
    `every repository consumer importing canonical ${field} must have an explicit wire-position contract`,
  ).toEqual([...expectedUsages.keys()].sort());
  for (const { relativeFile, imports } of discovered) {
    expect(
      imports,
      `${relativeFile} must have one unambiguous canonical ${field} import`,
    ).toHaveLength(1);
    const sourceFile = programSource(relativeFile);
    const [{ localSymbol }] = imports;
    const expected = expectedUsages.get(relativeFile) ?? [];
    expect(
      exactReferenceInventory(sourceFile, fieldChecker, localSymbol, expected),
      `${relativeFile} must account for exactly ${expected.length} canonical ${field} references at their production ancestries`,
    ).toBe(true);
  }
};

const expectOwnerBindingWired = (relativeFile, identifier, usage) => {
  const sourceFile = programSource(relativeFile);
  const initializer = variableInitializer(sourceFile, identifier);
  expect(initializer, `${relativeFile} must declare ${identifier}`).toBeDefined();
  const declaration = initializer?.parent;
  expect(declaration !== undefined && ts.isVariableDeclaration(declaration)).toBe(true);
  const bindingSymbol =
    declaration !== undefined && ts.isVariableDeclaration(declaration)
      ? fieldChecker.getSymbolAtLocation(declaration.name)
      : undefined;
  expect(bindingSymbol, `${relativeFile} must bind ${identifier} as a real symbol`).toBeDefined();
  const references =
    bindingSymbol === undefined
      ? []
      : bindingReferences(sourceFile, fieldChecker, bindingSymbol, true);
  expect(references, `${relativeFile} must have one non-export production reference`).toHaveLength(
    1,
  );
  expect(
    references[0] !== undefined &&
      referenceMatchesProductionPath(references[0], sourceFile, fieldChecker, bindingSymbol, usage),
    `${relativeFile} must wire its own ${identifier} through ${usage.owner} into ${usage.callee}`,
  ).toBe(true);
};

const inMemoryProgram = (sources) =>
  createInMemoryProgram(sources, repositoryRoot, compilerOptions);

const pythonAnalysisProgram = source("scripts/field_name_consolidation_analysis.py");

const analyzePythonText = (text) => {
  const python = spawnSync("python", ["-B", "-c", pythonAnalysisProgram], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input: JSON.stringify({
      sourceText: text,
      targetField: transitionFieldIdentifier,
      targetModule: "part_action_ledger_field_names",
    }),
  });
  expect(python.stderr).toBe("");
  expect(python.status).toBe(0);
  return JSON.parse(python.stdout);
};

const pythonAnalysis = (relativeFile) => analyzePythonText(source(relativeFile));

const discoveredPythonConsumers = () =>
  repositorySourcePaths
    .filter(
      (relativeFile) =>
        relativeFile.endsWith(".py") &&
        source(relativeFile).includes("part_action_ledger_field_names"),
    )
    .map((relativeFile) => ({ relativeFile, analysis: pythonAnalysis(relativeFile) }))
    .filter(({ analysis }) => analysis.ownerImports.length > 0);

const expectCanonicalPythonImport = (relativeFile, field, expectedUsages) => {
  const analysis = pythonAnalysis(relativeFile);
  expect(
    analysis.canonicalImports,
    `${relativeFile} must have one module-scope import of ${field} from its canonical module`,
  ).toHaveLength(1);
  const [canonicalImport] = analysis.canonicalImports;
  expect(
    analysis.moduleRebindings,
    `${relativeFile} must never rebind or delete its canonical ${field} import`,
  ).toEqual([]);
  expect(
    analysis.ambiguousScopes,
    `${relativeFile} must have an unambiguous symtable-to-AST scope map`,
  ).toEqual([]);
  expect(
    analysis.canonicalReferences,
    `${relativeFile} must account for exactly ${expectedUsages.length} references to its canonical ${canonicalImport.asname ?? canonicalImport.name} binding`,
  ).toHaveLength(expectedUsages.length);
  expect(
    analysis.canonicalReferences.every(
      ({ afterImport, resolvesCanonical }) => afterImport && resolvesCanonical,
    ),
    `${relativeFile} must use the imported binding only after import and without rebinding or shadowing`,
  ).toBe(true);
  expect(
    analysis.canonicalReferences.map(({ productionPath }) => productionPath).sort(),
    `${relativeFile} must use every canonical ${field} reference in one exact production role`,
  ).toEqual([...expectedUsages].sort());
};

const expectEveryDiscoveredPythonConsumerWired = (field, expectedUsages) => {
  const discovered = discoveredPythonConsumers();
  expect(
    discovered.map(({ relativeFile }) => relativeFile),
    `every repository Python consumer importing canonical ${field} must have an explicit wire-position contract`,
  ).toEqual([...expectedUsages.keys()].sort());
  for (const { relativeFile } of discovered) {
    expectCanonicalPythonImport(relativeFile, field, expectedUsages.get(relativeFile) ?? []);
  }
};

const expectNoExecutableLiteral = (relativeFiles, field) => {
  for (const relativeFile of relativeFiles) {
    expect(
      executableLiteralTexts(relativeFile).some((literal) => literal.includes(field)),
      relativeFile,
    ).toBe(false);
  }
};

const expectCanonicalExecutableLiteral = (relativeFile, identifier, field) => {
  const sourceFile = parseExecutable(relativeFile, source(relativeFile));
  const initializers = variableInitializers(sourceFile, identifier);
  expect(
    initializers,
    `${relativeFile} must declare exactly one canonical ${identifier} owner`,
  ).toHaveLength(1);
  const initializer = initializers[0];
  const expression =
    initializer === undefined ? undefined : unwrapTransparentExpression(initializer);
  expect(
    expression !== undefined &&
      (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)),
    `${relativeFile} must initialize ${identifier} with one direct string literal, not a folded composition`,
  ).toBe(true);
  if (
    expression !== undefined &&
    (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
  ) {
    expect(expression.text).toBe(field);
  }
  expect(
    executableLiteralTexts(relativeFile).filter((literal) => literal === field),
    `${relativeFile} must contain exactly one executable spelling of canonical ${field}`,
  ).toHaveLength(1);
};

const expectCanonicalPythonLiteral = (relativeFile, identifier, field) => {
  const exact = pythonAnalysis(relativeFile).directAssignments.filter(
    ({ name }) => name === identifier,
  );
  expect(exact, `${relativeFile} must own one canonical direct ${identifier} literal`).toEqual([
    { name: identifier, directString: true, value: field },
  ]);
  expect(
    pythonAnalysis(relativeFile).literalTexts.filter((literal) => literal === field),
    `${relativeFile} must contain exactly one executable spelling of canonical ${field}`,
  ).toHaveLength(1);
};

describe("shared wire field names", () => {
  it("exports the exact wire strings", () => {
    expect(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD).toBe("transitionClassificationsDigest");
    expect(OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD).toBe("observedLegacyFailureIdentities");
  });

  it("keeps TS, MJS, and Python transition keys equal", () => {
    expect(MJS_TRANSITION_CLASSIFICATIONS_DIGEST_FIELD).toBe(
      TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
    );
    const python = spawnSync(
      "python",
      [
        "-B",
        "-c",
        "import sys; sys.path.insert(0, 'scripts'); from part_action_ledger_field_names import TRANSITION_CLASSIFICATIONS_DIGEST_FIELD; print(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD)",
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    expect(python.stderr).toBe("");
    expect(python.status).toBe(0);
    expect(python.stdout.trim()).toBe(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD);
  });

  it("keeps TS and MJS callout keys equal while preserving the JSON wire key", () => {
    expect(MJS_OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD).toBe(
      OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD,
    );
    const manifest = JSON.parse(
      source("apps/web/test/fixtures/real-build-identification-golden/manifest.json"),
    );
    expect(
      Object.hasOwn(manifest.recoveryBenchmark, OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD),
    ).toBe(true);
  });

  it("removes duplicate literals from every exact executable consumer", () => {
    expectNoExecutableLiteral(
      [...transitionConsumerUsages.keys()],
      TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
    );
    expectNoExecutableLiteral(
      [...calloutConsumerUsages.keys()],
      OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD,
    );
    for (const relativeFile of transitionPythonConsumerUsages.keys()) {
      expect(
        pythonAnalysis(relativeFile).literalTexts.some((literal) =>
          literal.includes(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD),
        ),
        relativeFile,
      ).toBe(false);
    }
  });

  it("constant-folds hostile split spellings without folding dynamic composition", () => {
    expect(
      executableLiteralTextsFromText(
        "hostile.ts",
        'const field = "transitionClassifications" + "Digest";',
      ),
    ).toContain(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD);
    expect(
      executableLiteralTextsFromText(
        "dynamic.ts",
        'const field = "transitionClassifications" + suffix;',
      ),
    ).not.toContain(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD);
    expect(
      analyzePythonText('field = "transitionClassifications" + "Digest"').literalTexts,
    ).toContain(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD);
    expect(
      analyzePythonText('field = "transitionClassifications" + suffix').literalTexts,
    ).not.toContain(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD);
  });

  it("does not mistake folded owners or unrelated identifier references for canonical wiring", () => {
    const foldedOwner = parseExecutable(
      "folded-owner.ts",
      'export const TRANSITION_CLASSIFICATIONS_DIGEST_FIELD = "transitionClassifications" + "Digest";',
    );
    const foldedInitializer = variableInitializer(foldedOwner, transitionFieldIdentifier);
    expect(foldedInitializer).toBeDefined();
    expect(
      foldedInitializer !== undefined &&
        ts.isStringLiteral(unwrapTransparentExpression(foldedInitializer)),
    ).toBe(false);

    const unrelatedPythonUse = analyzePythonText(
      "from part_action_ledger_field_names import TRANSITION_CLASSIFICATIONS_DIGEST_FIELD\nprint(TRANSITION_CLASSIFICATIONS_DIGEST_FIELD)",
    );
    expect(unrelatedPythonUse.loadedNames).toContain(transitionFieldIdentifier);
    expect(unrelatedPythonUse.wireUses).toEqual([]);
    expect(
      analyzePythonText(
        'TRANSITION_CLASSIFICATIONS_DIGEST_FIELD = "transitionClassifications" + "Digest"',
      ).directAssignments,
    ).toEqual([
      {
        name: transitionFieldIdentifier,
        directString: false,
        value: null,
      },
    ]);
    expect(
      analyzePythonText(
        'TRANSITION_CLASSIFICATIONS_DIGEST_FIELD = "transitionClassifications" "Digest"',
      ).directAssignments,
    ).toEqual([
      {
        name: transitionFieldIdentifier,
        directString: false,
        value: TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
      },
    ]);
  });

  it("resolves barrel aliases and rejects unconsumed TypeScript reference roles", () => {
    const ownerBase = `export const ${calloutFieldIdentifier} = "observedLegacyFailureIdentities"; const BENCHMARK_KEYS = [${calloutFieldIdentifier}]; function exactKeys(...args: unknown[]) { return args; }`;
    const virtual = inMemoryProgram({
      "field.ts": `export const ${calloutFieldIdentifier} = "observedLegacyFailureIdentities";`,
      "barrel.ts": `export { ${calloutFieldIdentifier} } from "./field.ts";`,
      "renamed-barrel.ts": `export { ${calloutFieldIdentifier} as RENAMED } from "./field.ts";`,
      "good.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; function record(fields: unknown) { return fields; } function recoveryBenchmark() { return record([[${calloutFieldIdentifier}, 1]]); }`,
      "renamed-good.ts": `import { RENAMED as localField } from "./renamed-barrel.ts"; function record(fields: unknown) { return fields; } function recoveryBenchmark() { return record([[localField, 1]]); }`,
      "named-array-decoy.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; const TOP_KEYS = [${calloutFieldIdentifier}]; function exactRecord(...args: unknown[]) { return args; } function inspect() { return exactRecord({}, ["x"], "x"); } void TOP_KEYS;`,
      "call-argument-decoy.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; function ownData(...args: unknown[]) { return args; } function exactRecord(fields: unknown) { return fields; } function recoveryBenchmark() { return exactRecord([["decoy", ownData({}, ${calloutFieldIdentifier}, "x")]]); }`,
      "field-pair-decoy.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; function record(fields: unknown) { return fields; } function recoveryBenchmark() { const decoy = [[${calloutFieldIdentifier}, 1]]; return record([]); }`,
      "callee-shadow-decoy.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; function record(fields: unknown) { return fields; } function recoveryBenchmark(record: (fields: unknown) => unknown) { return record([[${calloutFieldIdentifier}, 1]]); }`,
      "shadowed.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; function record(fields: unknown) { return fields; } function recoveryBenchmark(${calloutFieldIdentifier}: string) { return record([[${calloutFieldIdentifier}, 1]]); } void ${calloutFieldIdentifier};`,
      "extra-reference.ts": `import { ${calloutFieldIdentifier} } from "./barrel.ts"; function record(fields: unknown) { return fields; } function recoveryBenchmark() { return record([[${calloutFieldIdentifier}, 1]]); } void ${calloutFieldIdentifier};`,
      "owner-decoy.ts": `export const ${calloutFieldIdentifier} = "observedLegacyFailureIdentities"; const BENCHMARK_KEYS = [${calloutFieldIdentifier}]; const OTHER_KEYS: string[] = []; function exactKeys(...args: unknown[]) { return args; } export function assertCalloutManifestExactShape(value: unknown) { exactKeys(value, OTHER_KEYS, "x"); } void BENCHMARK_KEYS;`,
      "owner-dead-branch.ts": `export const ${calloutFieldIdentifier} = "observedLegacyFailureIdentities"; const BENCHMARK_KEYS = [${calloutFieldIdentifier}]; const OTHER_KEYS: string[] = []; function exactKeys(...args: unknown[]) { return args; } export function assertCalloutManifestExactShape(value: unknown) { if (false) exactKeys(value, BENCHMARK_KEYS, "dead"); exactKeys(value, OTHER_KEYS, "live"); }`,
      "owner-after-return.ts": `export const ${calloutFieldIdentifier} = "observedLegacyFailureIdentities"; const BENCHMARK_KEYS = [${calloutFieldIdentifier}]; function exactKeys(...args: unknown[]) { return args; } export function assertCalloutManifestExactShape(value: unknown) { return value; exactKeys(value, BENCHMARK_KEYS, "dead"); }`,
      "owner-after-throw.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown) { throw new Error("stop"); exactKeys(value, BENCHMARK_KEYS, "dead"); }`,
      "owner-nested-false.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown) { if (true) { if (false) exactKeys(value, BENCHMARK_KEYS, "dead"); } }`,
      "owner-after-break.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown) { for (;;) { break; exactKeys(value, BENCHMARK_KEYS, "dead"); } }`,
      "owner-short-circuit.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown, flag: boolean) { flag && exactKeys(value, BENCHMARK_KEYS, "conditional"); }`,
      "owner-conditional.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown, flag: boolean) { flag ? exactKeys(value, BENCHMARK_KEYS, "conditional") : undefined; }`,
      "owner-module-rebind.ts": `${ownerBase} function fake(...args: unknown[]) { return args; } export function assertCalloutManifestExactShape(value: unknown, flag: boolean) { if (flag) exactKeys = fake; exactKeys(value, BENCHMARK_KEYS, "unstable"); }`,
      "owner-local-rebind.ts": `${ownerBase} function fake(...args: unknown[]) { return args; } export function assertCalloutManifestExactShape(value: unknown, flag: boolean) { let exactKeys; if (flag) exactKeys = fake; exactKeys(value, BENCHMARK_KEYS, "unstable"); }`,
      "owner-after-conditional-return.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown) { if (true) return value; exactKeys(value, BENCHMARK_KEYS, "dead"); }`,
      "owner-swallowed-try.ts": `${ownerBase} const OTHER_KEYS: string[] = []; export function assertCalloutManifestExactShape(value: unknown) { try { exactKeys(value, BENCHMARK_KEYS, "swallowed"); } catch {} exactKeys(value, OTHER_KEYS, "live"); }`,
      "owner-after-infinite-for.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown) { for (;;) {} exactKeys(value, BENCHMARK_KEYS, "dead"); }`,
      "owner-consumed-after-return.ts": `${ownerBase} export function assertCalloutManifestExactShape(value: unknown) { try { const admitted = exactKeys(value, BENCHMARK_KEYS, "x"); return value; void admitted; } catch (error) { throw error; } }`,
    });
    const ownerSourceFiles = [virtual.sourceFile("field.ts")];
    const importedBinding = (relativeFile) => {
      const sourceFile = virtual.sourceFile(relativeFile);
      const imports = canonicalImports(
        sourceFile,
        virtual.checker,
        calloutFieldIdentifier,
        ownerSourceFiles,
      );
      expect(imports, `${relativeFile} must resolve through the barrel to the owner`).toHaveLength(
        1,
      );
      return { sourceFile, bindingSymbol: imports[0].localSymbol };
    };
    const expectedPair = [
      { kind: "returned-field-pair-key", owner: "recoveryBenchmark", callee: "record" },
    ];
    const good = importedBinding("good.ts");
    expect(
      exactReferenceInventory(good.sourceFile, virtual.checker, good.bindingSymbol, expectedPair),
    ).toBe(true);
    const renamed = importedBinding("renamed-good.ts");
    expect(
      exactReferenceInventory(
        renamed.sourceFile,
        virtual.checker,
        renamed.bindingSymbol,
        expectedPair,
      ),
    ).toBe(true);
    for (const relativeFile of [
      "named-array-decoy.ts",
      "call-argument-decoy.ts",
      "field-pair-decoy.ts",
      "callee-shadow-decoy.ts",
      "shadowed.ts",
      "extra-reference.ts",
    ]) {
      const decoy = importedBinding(relativeFile);
      expect(
        exactReferenceInventory(
          decoy.sourceFile,
          virtual.checker,
          decoy.bindingSymbol,
          expectedPair,
        ),
        relativeFile,
      ).toBe(false);
    }
    const ownerDecoy = virtual.sourceFile("owner-decoy.ts");
    const ownerInitializer = variableInitializer(ownerDecoy, calloutFieldIdentifier);
    const ownerSymbol = virtual.checker.getSymbolAtLocation(ownerInitializer.parent.name);
    const ownerReferences = bindingReferences(ownerDecoy, virtual.checker, ownerSymbol, true);
    expect(ownerReferences).toHaveLength(1);
    expect(
      referenceMatchesProductionPath(ownerReferences[0], ownerDecoy, virtual.checker, ownerSymbol, {
        kind: "consumed-key-array",
        owner: "BENCHMARK_KEYS",
        callee: "exactKeys",
        functionName: "assertCalloutManifestExactShape",
        directExecution: true,
      }),
    ).toBe(false);
    for (const relativeFile of [
      "owner-dead-branch.ts",
      "owner-after-return.ts",
      "owner-after-throw.ts",
      "owner-nested-false.ts",
      "owner-after-break.ts",
      "owner-short-circuit.ts",
      "owner-conditional.ts",
      "owner-module-rebind.ts",
      "owner-local-rebind.ts",
      "owner-after-conditional-return.ts",
      "owner-swallowed-try.ts",
      "owner-after-infinite-for.ts",
    ]) {
      const deadOwner = virtual.sourceFile(relativeFile);
      const deadInitializer = variableInitializer(deadOwner, calloutFieldIdentifier);
      const deadSymbol = virtual.checker.getSymbolAtLocation(deadInitializer.parent.name);
      const [deadReference] = bindingReferences(deadOwner, virtual.checker, deadSymbol, true);
      expect(
        referenceMatchesProductionPath(deadReference, deadOwner, virtual.checker, deadSymbol, {
          kind: "consumed-key-array",
          owner: "BENCHMARK_KEYS",
          callee: "exactKeys",
          functionName: "assertCalloutManifestExactShape",
          directExecution: true,
        }),
        relativeFile,
      ).toBe(false);
    }
    const consumedAfterReturn = virtual.sourceFile("owner-consumed-after-return.ts");
    const consumedInitializer = variableInitializer(consumedAfterReturn, calloutFieldIdentifier);
    const consumedSymbol = virtual.checker.getSymbolAtLocation(consumedInitializer.parent.name);
    const [consumedReference] = bindingReferences(
      consumedAfterReturn,
      virtual.checker,
      consumedSymbol,
      true,
    );
    expect(
      referenceMatchesProductionPath(
        consumedReference,
        consumedAfterReturn,
        virtual.checker,
        consumedSymbol,
        {
          kind: "consumed-key-array",
          owner: "BENCHMARK_KEYS",
          callee: "exactKeys",
          functionName: "assertCalloutManifestExactShape",
        },
      ),
    ).toBe(false);
  });

  it("rejects Python global and comprehension rebinding and exact-role decoys", () => {
    const imported = `from part_action_ledger_field_names import ${transitionFieldIdentifier}`;
    const nestedGlobal = analyzePythonText(
      `${imported}\ndef poison():\n    global ${transitionFieldIdentifier}\n    ${transitionFieldIdentifier} = "spoof"\nrecord = {${transitionFieldIdentifier}: 1}`,
    );
    expect(nestedGlobal.moduleRebindings).toEqual([
      expect.objectContaining({ kind: "Store", line: 4 }),
    ]);
    const nestedGlobalImport = analyzePythonText(
      `${imported}\ndef poison():\n    global ${transitionFieldIdentifier}\n    import os as ${transitionFieldIdentifier}`,
    );
    expect(nestedGlobalImport.moduleRebindings).toEqual([
      expect.objectContaining({ kind: "Import", line: 4 }),
    ]);
    for (const [binding, kind] of [
      [`def ${transitionFieldIdentifier}():\n        pass`, "FunctionDef"],
      [`class ${transitionFieldIdentifier}:\n        pass`, "ClassDef"],
      [
        `try:\n        pass\n    except Exception as ${transitionFieldIdentifier}:\n        pass`,
        "ExceptHandler",
      ],
      [`match value:\n        case ${transitionFieldIdentifier}:\n            pass`, "MatchAs"],
    ]) {
      const rebound = analyzePythonText(
        `${imported}\ndef poison(value=None):\n    global ${transitionFieldIdentifier}\n    ${binding}`,
      );
      expect(rebound.moduleRebindings, kind).toEqual([expect.objectContaining({ kind })]);
    }
    const moduleWalrus = analyzePythonText(
      `${imported}\nvalues = [(${transitionFieldIdentifier} := "spoof") for item in range(1)]\nrecord = {${transitionFieldIdentifier}: 1}`,
    );
    expect(moduleWalrus.moduleRebindings).toEqual([
      expect.objectContaining({ kind: "Store", line: 2 }),
    ]);
    const functionWalrus = analyzePythonText(
      `${imported}\ndef wire():\n    values = [(${transitionFieldIdentifier} := "spoof") for item in range(1)]\n    return {${transitionFieldIdentifier}: 1}`,
    );
    expect(functionWalrus.canonicalReferences.filter(({ kind }) => kind === "dict-key")).toEqual([
      expect.objectContaining({ resolvesCanonical: false }),
    ]);

    const direct = analyzePythonText(
      `${imported}\ndef wire():\n    return {${transitionFieldIdentifier}: 1}`,
    );
    expect(direct.moduleRebindings).toEqual([]);
    expect(direct.canonicalReferences).toEqual([
      expect.objectContaining({ kind: "dict-key", resolvesCanonical: true }),
    ]);
    const unrelatedLambdas = analyzePythonText(
      `${imported}\nleft = lambda: 0; right = lambda: 1; record = {${transitionFieldIdentifier}: 1}`,
    );
    expect(unrelatedLambdas.ambiguousScopes).toEqual([]);
    expect(unrelatedLambdas.canonicalReferences[0].resolvesCanonical).toBe(true);
    const relevantLambdas = analyzePythonText(
      `${imported}\nleft = lambda: {${transitionFieldIdentifier}: 1}; right = lambda: 0`,
    );
    expect(relevantLambdas.ambiguousScopes).not.toEqual([]);
    expect(relevantLambdas.canonicalReferences[0].resolvesCanonical).toBe(false);

    const genuine = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef _digest(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n    bindings = {${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}\n    for field, (declared, actual) in bindings.items():\n        _digest(declared, f"Action ledger {field}")\n        _digest(actual, f"Action ledger exact {field} input")\n        if declared != actual:\n            raise ArtifactContractError("mismatch")`,
    );
    expect(genuine.canonicalReferences.every(({ resolvesCanonical }) => resolvesCanonical)).toBe(
      true,
    );
    expect(genuine.canonicalReferences.map(({ productionPath }) => productionPath).sort()).toEqual(
      [...transitionPythonConsumerUsages.values()][0].slice().sort(),
    );
    const fakeCallable = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    fake._exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")`,
    );
    expect(fakeCallable.canonicalReferences[0].productionPath).toBe(null);
    const unreachable = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    if False:\n        _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n        bindings = {${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}`,
    );
    expect(
      unreachable.canonicalReferences.every(({ productionPath }) => productionPath === null),
    ).toBe(true);
    const reboundCallable = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    _exact_fields = fake._exact_fields\n    _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n    bindings = {${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}`,
    );
    expect(
      reboundCallable.canonicalReferences.some(({ productionPath }) => productionPath === null),
    ).toBe(true);
    const setRolePath = (body) =>
      analyzePythonText(
        `${imported}\ndef _exact_fields(*args):\n    pass\n${body}`,
      ).canonicalReferences.find(({ kind }) => kind === "set-element")?.productionPath;
    for (const [label, body] of [
      [
        "nested false",
        `def require_action_ledger_report_chain(value):\n    if True:\n        if False:\n            _exact_fields(value, {${transitionFieldIdentifier}}, "dead")`,
      ],
      [
        "after raise",
        `def require_action_ledger_report_chain(value):\n    raise RuntimeError("stop")\n    _exact_fields(value, {${transitionFieldIdentifier}}, "dead")`,
      ],
      [
        "after break",
        `def require_action_ledger_report_chain(value):\n    while True:\n        break\n        _exact_fields(value, {${transitionFieldIdentifier}}, "dead")`,
      ],
      [
        "short circuit",
        `def require_action_ledger_report_chain(value, flag):\n    flag and _exact_fields(value, {${transitionFieldIdentifier}}, "conditional")`,
      ],
      [
        "conditional expression",
        `def require_action_ledger_report_chain(value, flag):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "conditional") if flag else None`,
      ],
      [
        "local helper rebind",
        `def require_action_ledger_report_chain(value, flag):\n    if flag:\n        _exact_fields = fake._exact_fields\n    _exact_fields(value, {${transitionFieldIdentifier}}, "unstable")`,
      ],
      [
        "global helper rebind",
        `def poison(flag):\n    global _exact_fields\n    if flag:\n        _exact_fields = fake._exact_fields\ndef require_action_ledger_report_chain(value):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "unstable")`,
      ],
      [
        "after conditional return",
        `def require_action_ledger_report_chain(value):\n    if True:\n        return value\n    _exact_fields(value, {${transitionFieldIdentifier}}, "dead")`,
      ],
    ]) {
      expect(setRolePath(body), label).toBe(null);
    }
    const unusedBindings = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n    bindings = {${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}\n    return value`,
    );
    expect(
      unusedBindings.canonicalReferences
        .filter(({ kind }) => kind === "dict-key" || kind === "subscript-key")
        .every(({ productionPath }) => productionPath === null),
    ).toBe(true);
    const skippedBindings = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef _digest(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n    bindings = {${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}\n    for field, (declared, actual) in bindings.items():\n        continue\n        _digest(declared, f"Action ledger {field}")\n        _digest(actual, f"Action ledger exact {field} input")\n        if declared != actual:\n            raise ArtifactContractError("mismatch")`,
    );
    expect(
      skippedBindings.canonicalReferences
        .filter(({ kind }) => kind === "dict-key" || kind === "subscript-key")
        .every(({ productionPath }) => productionPath === null),
    ).toBe(true);
    const earlyBreakBindings = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef _digest(*args):\n    pass\ndef require_action_ledger_report_chain(value):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n    bindings = {"other": (value["other"], value["other"]), ${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}\n    for field, (declared, actual) in bindings.items():\n        _digest(declared, f"Action ledger {field}")\n        _digest(actual, f"Action ledger exact {field} input")\n        if declared != actual:\n            raise ArtifactContractError("mismatch")\n        break`,
    );
    expect(
      earlyBreakBindings.canonicalReferences
        .filter(({ kind }) => kind === "dict-key" || kind === "subscript-key")
        .every(({ productionPath }) => productionPath === null),
    ).toBe(true);
    const asyncBindings = analyzePythonText(
      `${imported}\ndef _exact_fields(*args):\n    pass\ndef _digest(*args):\n    pass\nasync def require_action_ledger_report_chain(value):\n    _exact_fields(value, {${transitionFieldIdentifier}}, "Action ledger")\n    bindings = {${transitionFieldIdentifier}: (value[${transitionFieldIdentifier}], None)}\n    async for field, (declared, actual) in bindings.items():\n        _digest(declared, f"Action ledger {field}")\n        _digest(actual, f"Action ledger exact {field} input")\n        if declared != actual:\n            raise ArtifactContractError("mismatch")`,
    );
    expect(
      asyncBindings.canonicalReferences
        .filter(({ kind }) => kind === "dict-key" || kind === "subscript-key")
        .every(({ productionPath }) => productionPath === null),
    ).toBe(true);
    const decoys = analyzePythonText(
      `${imported}\ndef unrelated(value):\n    return ({${transitionFieldIdentifier}}, {${transitionFieldIdentifier}: value[${transitionFieldIdentifier}]})`,
    );
    expect(decoys.canonicalReferences.map(({ productionPath }) => productionPath)).toEqual([
      null,
      null,
      null,
    ]);
    const loop = analyzePythonText(
      `${imported}\ndef test_every_consumed_digest_edge_is_required():\n    for field, declared in (("transition_classifications_digest", ${transitionFieldIdentifier}),):\n        pass`,
    );
    expect(loop.canonicalReferences).toEqual([
      expect.objectContaining({
        productionPath: "action-ledger-digest-edge-loop-tuple",
        resolvesCanonical: true,
      }),
    ]);
  });

  it("keeps one direct canonical literal and requires every consumer to import and use it", () => {
    for (const relativeFile of [
      "apps/web/e2e/real-build-action-ledger-field-names.ts",
      "scripts/part-identification-action-ledger-field-names.mjs",
    ]) {
      expectCanonicalExecutableLiteral(
        relativeFile,
        transitionFieldIdentifier,
        TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
      );
    }
    for (const relativeFile of [
      "apps/web/e2e/callout-field-names.ts",
      "scripts/callout-manifest-shape.mjs",
    ]) {
      expectCanonicalExecutableLiteral(
        relativeFile,
        calloutFieldIdentifier,
        OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD,
      );
    }
    expectCanonicalPythonLiteral(
      "scripts/part_action_ledger_field_names.py",
      transitionFieldIdentifier,
      TRANSITION_CLASSIFICATIONS_DIGEST_FIELD,
    );
    expectEveryDiscoveredConsumerWired(
      transitionFieldIdentifier,
      transitionOwners,
      transitionConsumerUsages,
    );
    expectEveryDiscoveredConsumerWired(
      calloutFieldIdentifier,
      calloutOwners,
      calloutConsumerUsages,
    );
    expectOwnerBindingWired("scripts/callout-manifest-shape.mjs", calloutFieldIdentifier, {
      kind: "consumed-key-array",
      owner: "BENCHMARK_KEYS",
      callee: "exactKeys",
      functionName: "assertCalloutManifestExactShape",
      directExecution: true,
    });
    expectEveryDiscoveredPythonConsumerWired(
      transitionFieldIdentifier,
      transitionPythonConsumerUsages,
    );
  });
});

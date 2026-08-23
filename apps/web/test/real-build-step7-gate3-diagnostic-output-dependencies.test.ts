import { existsSync, readFileSync, statSync } from "node:fs";
import { posix } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { staticString } from "./real-build-step7-gate3-static-string";

const ENTRY = "apps/web/e2e/real-build-step7-gate3-diagnostic-output.ts";
const NO_DELETE_FILESYSTEM = "apps/web/e2e/real-build-step7-gate3-no-delete-filesystem.ts";
const DIAGNOSTIC_READBACK = "apps/web/e2e/real-build-step7-gate3-diagnostic-readback.ts";
const DIAGNOSTIC_JSON = "apps/web/e2e/real-build-step7-gate3-diagnostic-json.ts";
const SAFE_JSON_BYTES = "apps/web/e2e/real-build-safe-json-bytes.ts";
const OWNERSHIP_FAILURE = "apps/web/e2e/real-build-step7-gate3-diagnostic-ownership-failure.ts";
const NON_PROBING_ERROR = "apps/web/e2e/non-probing-error.ts";
const FORBIDDEN_RUNTIME_MODULES = [
  "apps/web/e2e/contained-atomic-write.ts",
  "apps/web/e2e/contained-directory.ts",
  "apps/web/e2e/contained-directory-final-rename.ts",
  "apps/web/e2e/contained-directory-removal.ts",
] as const;
const FILESYSTEM_SPECIFIERS = new Set(["node:fs", "fs", "node:fs/promises", "fs/promises"]);
const MODULE_LOADER_SPECIFIERS = new Set(["node:module", "module"]);
const BANNED_RUNTIME_IDENTIFIERS = new Set([
  "module",
  "require",
  "createRequire",
  "getBuiltinModule",
  "eval",
  "Function",
]);
const FORBIDDEN_DELETION_IMPORT = /^(?:ftruncate|rm|rmdir|truncate|unlink)(?:Sync)?$/u;
const NO_DELETE_FILESYSTEM_IMPORTS = new Set([
  "closeSync",
  "existsSync",
  "fstatSync",
  "fsyncSync",
  "lstatSync",
  "mkdirSync",
  "openSync",
  "readSync",
  "realpathSync",
  "renameSync",
  "writeSync",
]);
const EXTERNAL_MODULE_ALLOWLIST = new Map<string, ReadonlySet<string>>([
  [ENTRY, new Set(["node:crypto"])],
  [NO_DELETE_FILESYSTEM, new Set(["node:crypto", "node:fs", "node:path"])],
  [DIAGNOSTIC_READBACK, new Set(["node:crypto", "node:fs"])],
  [NON_PROBING_ERROR, new Set(["node:util"])],
  [DIAGNOSTIC_JSON, new Set()],
  [SAFE_JSON_BYTES, new Set()],
  [OWNERSHIP_FAILURE, new Set()],
]);

function filesystemImportAllowed(file: string, importedName: string): boolean {
  return (
    (file === NO_DELETE_FILESYSTEM && NO_DELETE_FILESYSTEM_IMPORTS.has(importedName)) ||
    (file === DIAGNOSTIC_READBACK && importedName === "opendirSync")
  );
}

interface SourceAnalysis {
  readonly relativeRuntimeSpecifiers: readonly string[];
  readonly filesystemImports: readonly string[];
  readonly externalRuntimeSpecifiers: readonly string[];
}

function importClauseRuns(clause: ts.ImportClause | undefined): boolean {
  if (clause === undefined) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name !== undefined || clause.namedBindings === undefined) return true;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function exportDeclarationRuns(declaration: ts.ExportDeclaration): boolean {
  if (declaration.isTypeOnly) return false;
  if (declaration.exportClause === undefined || ts.isNamespaceExport(declaration.exportClause)) {
    return true;
  }
  return declaration.exportClause.elements.some((element) => !element.isTypeOnly);
}

function exactProcessUseAllowed(file: string, identifier: ts.Identifier): boolean {
  const access = identifier.parent;
  if (
    file !== ENTRY ||
    !ts.isPropertyAccessExpression(access) ||
    access.expression !== identifier ||
    access.name.text !== "cwd" ||
    access.questionDotToken !== undefined
  ) {
    return false;
  }
  const call = access.parent;
  return (
    ts.isCallExpression(call) &&
    call.expression === access &&
    call.questionDotToken === undefined &&
    call.arguments.length === 0
  );
}

function exactReflectCaptureAllowed(file: string, identifier: ts.Identifier): boolean {
  const access = identifier.parent;
  if (
    !ts.isPropertyAccessExpression(access) ||
    access.expression !== identifier ||
    access.questionDotToken !== undefined ||
    !ts.isVariableDeclaration(access.parent) ||
    access.parent.initializer !== access ||
    !ts.isIdentifier(access.parent.name) ||
    !ts.isVariableDeclarationList(access.parent.parent) ||
    !(access.parent.parent.flags & ts.NodeFlags.Const)
  ) {
    return false;
  }
  const capture = `${access.parent.name.text}:${access.name.text}`;
  return (
    (file === NO_DELETE_FILESYSTEM && capture === "SAFE_REFLECT_APPLY:apply") ||
    (file === NON_PROBING_ERROR &&
      (capture === "SAFE_REFLECT_APPLY:apply" ||
        capture === "SAFE_REFLECT_DEFINE_PROPERTY:defineProperty")) ||
    (file === DIAGNOSTIC_JSON && capture === "SAFE_REFLECT_OWN_KEYS:ownKeys") ||
    (file === SAFE_JSON_BYTES && capture === "SAFE_REFLECT_APPLY:apply")
  );
}

function analyzeStaticRuntimeSource(file: string, text: string): SourceAnalysis {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relativeRuntimeSpecifiers: string[] = [];
  const filesystemImports: string[] = [];
  const externalRuntimeSpecifiers: string[] = [];

  const recordSpecifier = (
    specifier: string,
    route: "import" | "export" | "import-equals" | "dynamic" | "require",
    importClause?: ts.ImportClause,
  ): void => {
    if (specifier.startsWith(".")) {
      relativeRuntimeSpecifiers.push(specifier);
      return;
    }
    externalRuntimeSpecifiers.push(specifier);
    if (MODULE_LOADER_SPECIFIERS.has(specifier)) {
      throw new TypeError(`${file} reaches the Node module-loader through ${route} ${specifier}.`);
    }
    if (!FILESYSTEM_SPECIFIERS.has(specifier)) return;
    if (route !== "import") {
      throw new TypeError(
        `${file} reaches the filesystem through forbidden ${route} ${specifier}.`,
      );
    }
    if (importClause === undefined) {
      throw new TypeError(`${file} uses a side-effect filesystem import from ${specifier}.`);
    }
    if (importClause.name !== undefined) {
      throw new TypeError(`${file} uses a default filesystem import from ${specifier}.`);
    }
    if (
      importClause.namedBindings === undefined ||
      ts.isNamespaceImport(importClause.namedBindings)
    ) {
      throw new TypeError(`${file} uses a namespace filesystem import from ${specifier}.`);
    }
    for (const element of importClause.namedBindings.elements) {
      if (!element.isTypeOnly) filesystemImports.push((element.propertyName ?? element.name).text);
    }
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isIdentifier(node) &&
      (BANNED_RUNTIME_IDENTIFIERS.has(node.text) ||
        (node.text === "process" && !exactProcessUseAllowed(file, node)) ||
        (node.text === "Reflect" && !exactReflectCaptureAllowed(file, node)) ||
        node.text === "globalThis" ||
        node.text === "global")
    ) {
      throw new TypeError(`${file} uses forbidden runtime authority identifier ${node.text}.`);
    } else if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      importClauseRuns(node.importClause)
    ) {
      recordSpecifier(node.moduleSpecifier.text, "import", node.importClause);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      exportDeclarationRuns(node)
    ) {
      recordSpecifier(node.moduleSpecifier.text, "export");
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const specifier = staticString(node.moduleReference.expression);
      if (specifier === null) {
        throw new TypeError(`${file} has a computed import-equals outside static analysis.`);
      }
      recordSpecifier(specifier, "import-equals");
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const specifier = staticString(node.arguments.length === 1 ? node.arguments[0] : undefined);
      if (specifier === null) {
        throw new TypeError(`${file} has a computed runtime module load outside static analysis.`);
      }
      recordSpecifier(
        specifier,
        node.expression.kind === ts.SyntaxKind.ImportKeyword ? "dynamic" : "require",
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { relativeRuntimeSpecifiers, filesystemImports, externalRuntimeSpecifiers };
}

function resolveRelativeImport(importer: string, specifier: string): string {
  const base = posix.normalize(posix.join(posix.dirname(importer), specifier));
  if (base.startsWith("../") || posix.isAbsolute(base)) {
    throw new TypeError(`Runtime import ${specifier} from ${importer} escapes the repository.`);
  }
  const candidates = posix.extname(base) === "" ? [`${base}.ts`, `${base}.tsx`] : [base];
  const resolved = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  if (resolved === undefined) {
    throw new TypeError(`Runtime import ${specifier} from ${importer} does not resolve.`);
  }
  return resolved;
}

function assertStaticNoDeleteClosure(input: {
  readonly entry: string;
  readonly readSource: (file: string) => string;
  readonly resolveRelative: (importer: string, specifier: string) => string;
}): readonly string[] {
  // This gate covers only the statically reachable TypeScript source and bounded syntax analyzed
  // above. It makes no claim about runtime code generation or allowed filesystem-call behavior.
  const pending = [input.entry];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const analysis = analyzeStaticRuntimeSource(file, input.readSource(file));
    for (const importedName of analysis.filesystemImports) {
      if (
        FORBIDDEN_DELETION_IMPORT.test(importedName) ||
        importedName === "promises" ||
        importedName === "default"
      ) {
        throw new TypeError(`${file} imports forbidden filesystem capability ${importedName}.`);
      }
      if (!filesystemImportAllowed(file, importedName)) {
        throw new TypeError(
          `${file} imports filesystem capability ${importedName} not permitted here.`,
        );
      }
      if (importedName === "renameSync" && file !== NO_DELETE_FILESYSTEM) {
        throw new TypeError(`${file} imports renameSync outside the no-delete filesystem module.`);
      }
    }
    const permittedExternalSpecifiers = EXTERNAL_MODULE_ALLOWLIST.get(file) ?? new Set<string>();
    for (const specifier of analysis.externalRuntimeSpecifiers) {
      if (!permittedExternalSpecifiers.has(specifier)) {
        throw new TypeError(`${file} reaches unreviewed external module ${specifier}.`);
      }
    }
    for (const specifier of analysis.relativeRuntimeSpecifiers) {
      const resolved = input.resolveRelative(file, specifier);
      if (!visited.has(resolved)) pending.push(resolved);
    }
  }
  return [...visited].sort((left, right) => left.localeCompare(right));
}

function assertVirtualMutation(sources: Readonly<Record<string, string>>): void {
  assertStaticNoDeleteClosure({
    entry: "entry.ts",
    readSource: (file) => {
      const source = sources[file];
      if (source === undefined) throw new TypeError(`Missing virtual source ${file}.`);
      return source;
    },
    resolveRelative: (importer, specifier) => {
      const base = posix.normalize(posix.join(posix.dirname(importer), specifier));
      return posix.extname(base) === "" ? `${base}.ts` : base;
    },
  });
}

describe("step-7 Gate-3 statically reachable no-delete dependency boundary", () => {
  it("keeps cleanup-capable source outside the reviewed static runtime closure", () => {
    const closure = assertStaticNoDeleteClosure({
      entry: ENTRY,
      readSource: (file) => readFileSync(file, "utf8"),
      resolveRelative: resolveRelativeImport,
    });

    expect(closure).toEqual(
      [...EXTERNAL_MODULE_ALLOWLIST.keys()].sort((a, b) => a.localeCompare(b)),
    );
    for (const forbidden of FORBIDDEN_RUNTIME_MODULES) expect(closure).not.toContain(forbidden);
  });

  it("traverses a relative export-from before rejecting its filesystem mutation", () => {
    expect(() =>
      assertVirtualMutation({
        "entry.ts": 'export * from "./child";',
        "child.ts": 'import { unlinkSync } from "node:fs";',
      }),
    ).toThrow(/unlinkSync/u);
  });

  it.each([
    ['export { unlinkSync } from "node:fs";', /forbidden export/u],
    ['export * from "fs/promises";', /forbidden export/u],
    ['import fs = require("node:fs");', /import-equals/u],
    ['void import("node:fs/promises");', /forbidden dynamic/u],
    ['const fs = require("fs");', /forbidden require/u],
    ['import "fs";', /side-effect filesystem import/u],
    ['import fs from "node:fs";', /default filesystem import/u],
    ['import * as fs from "fs";', /namespace filesystem import/u],
    ['import { promises } from "node:fs";', /filesystem capability promises/u],
    ['import { default as fs } from "node:fs";', /filesystem capability default/u],
    ['import { unlinkSync as keep } from "node:fs";', /filesystem capability unlinkSync/u],
    ['import { writeFileSync } from "node:fs";', /writeFileSync not permitted/u],
    ['import { rm } from "fs/promises";', /forbidden filesystem capability rm/u],
    ['process.getBuiltinModule("node:fs");', /forbidden runtime authority/u],
    ['process["getBuiltinModule"]("fs");', /forbidden runtime authority/u],
    ['process["get" + "BuiltinModule"]("node:fs").rmSync("x");', /forbidden runtime authority/u],
    ['import { createRequire } from "node:module";', /Node module-loader/u],
    [
      'import { createRequire } from "node:module"; createRequire(import.meta.url)("node:fs");',
      /Node module-loader/u,
    ],
    ['module.require("node:fs");', /forbidden runtime authority/u],
    ['module["req" + "uire"]("fs");', /forbidden runtime authority/u],
    ["const load = process.getBuiltinModule;", /forbidden runtime authority/u],
    ['const load = process["getBuiltinModule"];', /forbidden runtime authority/u],
    ['Reflect.get(process, "getBuiltinModule")("fs");', /forbidden runtime authority/u],
    ['Reflect["get"](process, "getBuiltinModule")("fs");', /forbidden runtime authority/u],
    ['Reflect["g" + "et"](process, "getBuiltinModule")("fs");', /forbidden runtime authority/u],
    ['const p = process; p["get" + "BuiltinModule"]("fs");', /forbidden runtime authority/u],
    [
      `const k: string = JSON.parse('"getBuiltinModule"'); const p = process; p[k]("fs");`,
      /forbidden runtime authority/u,
    ],
    [
      `const k: string = JSON.parse('"getBuiltinModule"'); Reflect.get(process, k)("fs");`,
      /forbidden runtime authority/u,
    ],
    [
      'const get = Reflect.get.bind(Reflect); get(process, "getBuiltinModule")("fs");',
      /forbidden runtime authority/u,
    ],
    [
      'const { Reflect: R } = globalThis; R.get(process, "getBuiltinModule")("fs");',
      /forbidden runtime authority/u,
    ],
    [
      `const { process: p } = globalThis as any; const k: string = JSON.parse('"getBuiltinModule"'); p[k]("fs");`,
      /forbidden runtime authority/u,
    ],
    ['void import("node:" + "fs");', /forbidden dynamic/u],
    ['void import(`node:${"fs"}`);', /forbidden dynamic/u],
    [
      `const prefix: string = JSON.parse('"node:"'); void import(prefix + "fs");`,
      /computed runtime module load/u,
    ],
    [
      'Reflect.apply(process.getBuiltinModule, process, ["node:fs"]);',
      /forbidden runtime authority/u,
    ],
    ["const { getBuiltinModule: load } = process;", /forbidden runtime authority/u],
    ["const load = createRequire;", /forbidden runtime authority/u],
    ["const load = require;", /forbidden runtime authority/u],
    ['module["require"]("fs");', /forbidden runtime authority/u],
    [
      'import * as processModule from "node:process"; (processModule as any)["get" + "BuiltinModule"]("node:fs").rmSync("x");',
      /unreviewed external module node:process/u,
    ],
    [
      'const p = (global as any)["pro" + "cess"]; p["get" + "BuiltinModule"]("node:fs").rmSync("x");',
      /forbidden runtime authority identifier global/u,
    ],
    [
      'const R = (global as any)["Re" + "flect"]; R["get"]((global as any)["process"], "getBuiltinModule")("node:fs").rmSync("x");',
      /forbidden runtime authority identifier global/u,
    ],
    [
      'import { execFileSync } from "node:child_process"; void execFileSync;',
      /unreviewed external module node:child_process/u,
    ],
    [`eval('require("fs")');`, /forbidden runtime authority/u],
    [`Function('return require("fs")')();`, /forbidden runtime authority/u],
    [
      'const b = process.getBuiltinModule; const make = b("node:module").createRequire;',
      /forbidden runtime authority/u,
    ],
  ])("rejects static loader bypass %#", (source, expected) => {
    expect(() => assertVirtualMutation({ "entry.ts": source })).toThrow(expected);
  });
});

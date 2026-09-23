import ts from "typescript";
import { builtinModules } from "node:module";

import type { Step44ExecutionModuleRosterEntry } from "./real-build-prefix50-step44-source-reader-closure-execution-roster.ts";
import {
  STEP44_BOUNDED_READER_PRIMITIVES,
  STEP44_CHILD_PROCESS_MODULES,
  STEP44_CHILD_PROCESS_PRIMITIVES,
  STEP44_FILESYSTEM_METADATA_PRIMITIVES,
  STEP44_FILESYSTEM_READ_PRIMITIVES,
  STEP44_FILESYSTEM_WRITE_PRIMITIVES,
  STEP44_FORBIDDEN_EXECUTION_MODULES,
  STEP44_FORBIDDEN_GLOBAL_EXECUTORS,
  STEP44_FORBIDDEN_PROCESS_LOADERS,
  STEP44_FS_MODULES,
  STEP44_MODULE_MODULES,
  STEP44_PROCESS_MODULES,
} from "./real-build-prefix50-step44-source-reader-closure-primitives.ts";

export type Step44IoCategory =
  | "bounded-source-read"
  | "browser"
  | "child-process"
  | "child-script"
  | "filesystem-metadata"
  | "filesystem-read"
  | "filesystem-write"
  | "module-loader"
  | "pdfjs"
  | "poppler";

export interface Step44IoUse {
  readonly file: string;
  readonly category: Step44IoCategory;
  readonly primitive: string;
}

export interface Step44ModuleSpecifier {
  readonly value: string;
  readonly dynamic: boolean;
  readonly runtime: boolean;
}

export interface Step44SourcePolicyResult {
  readonly specifiers: readonly Step44ModuleSpecifier[];
  readonly uses: readonly Step44IoUse[];
  readonly executionRosterIds: readonly string[];
}

export const STEP44_REVIEWED_EXTERNAL_RUNTIME_SPECIFIERS = Object.freeze([
  "@napi-rs/canvas",
  "@noble/hashes/sha2.js",
  "@noble/hashes/utils.js",
  "@playwright/test",
  "ajv/dist/runtime/equal.js",
  "ajv/dist/runtime/ucs2length.js",
  "pdfjs-dist",
  "pdfjs-dist/build/pdf.worker.mjs?url",
  "pdfjs-dist/legacy/build/pdf.mjs",
  "playwright",
  "three",
  "three/addons/geometries/RoundedBoxGeometry.js",
] as const);

const STEP44_REVIEWED_EXTERNAL_RUNTIME_SPECIFIER_SET = new Set<string>(
  STEP44_REVIEWED_EXTERNAL_RUNTIME_SPECIFIERS,
);
const STEP44_BUILTIN_MODULES = new Set(
  builtinModules.flatMap((module) => [
    module,
    module.startsWith("node:") ? module.slice(5) : `node:${module}`,
  ]),
);

function isReviewedRuntimeSpecifier(module: string): boolean {
  return (
    module.startsWith(".") ||
    module.startsWith("@lego-studio/") ||
    STEP44_BUILTIN_MODULES.has(module) ||
    STEP44_REVIEWED_EXTERNAL_RUNTIME_SPECIFIER_SET.has(module)
  );
}

function isBrowserModule(module: string): boolean {
  return /(?:^|\/)(?:playwright|playwright-core|puppeteer)(?:\/|$)/u.test(module);
}

function isSensitiveModule(module: string): boolean {
  return (
    STEP44_FS_MODULES.has(module) ||
    STEP44_CHILD_PROCESS_MODULES.has(module) ||
    STEP44_MODULE_MODULES.has(module) ||
    STEP44_PROCESS_MODULES.has(module) ||
    STEP44_FORBIDDEN_EXECUTION_MODULES.has(module) ||
    module.includes("pdfjs-dist") ||
    isBrowserModule(module)
  );
}

function categoryForFsPrimitive(primitive: string): Step44IoCategory | undefined {
  if (STEP44_FILESYSTEM_READ_PRIMITIVES.has(primitive)) return "filesystem-read";
  if (STEP44_FILESYSTEM_WRITE_PRIMITIVES.has(primitive)) return "filesystem-write";
  if (STEP44_FILESYSTEM_METADATA_PRIMITIVES.has(primitive)) return "filesystem-metadata";
  return undefined;
}

function literalText(node: ts.Expression | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
    return literalText(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = literalText(node.left);
    const right = literalText(node.right);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  return undefined;
}

function valueReference(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  return !(
    (ts.isImportSpecifier(parent) &&
      (parent.name === identifier || parent.propertyName === identifier)) ||
    (ts.isImportClause(parent) && parent.name === identifier) ||
    (ts.isNamespaceImport(parent) && parent.name === identifier) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (ts.isPropertyAssignment(parent) &&
      parent.name === identifier &&
      parent.initializer !== identifier) ||
    (ts.isPropertySignature(parent) && parent.name === identifier) ||
    (ts.isTypeReferenceNode(parent) && parent.typeName === identifier) ||
    (ts.isTypeQueryNode(parent) && parent.exprName === identifier) ||
    (ts.isInterfaceDeclaration(parent) && parent.name === identifier) ||
    (ts.isTypeAliasDeclaration(parent) && parent.name === identifier)
  );
}

function rootIdentifier(expression: ts.Expression): ts.Identifier | undefined {
  let current = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current) ||
    ts.isCallExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    if (ts.isCallExpression(current)) current = current.expression;
    else current = current.expression;
  }
  return ts.isIdentifier(current) ? current : undefined;
}

function allowedIntrinsicFunctionBinding(identifier: ts.Identifier): boolean {
  const callMember = identifier.parent;
  const bindMember = callMember.parent;
  const invocation = bindMember.parent;
  return (
    ts.isPropertyAccessExpression(callMember) &&
    callMember.expression === identifier &&
    callMember.name.text === "call" &&
    ts.isPropertyAccessExpression(bindMember) &&
    bindMember.expression === callMember &&
    bindMember.name.text === "bind" &&
    ts.isCallExpression(invocation) &&
    invocation.expression === bindMember
  );
}

function directlyInvokedSensitiveBinding(identifier: ts.Identifier, module: string): boolean {
  let expression: ts.Expression = identifier;
  let parent = expression.parent;
  if (STEP44_CHILD_PROCESS_MODULES.has(module) || STEP44_MODULE_MODULES.has(module))
    return ts.isCallExpression(parent) && parent.expression === expression;
  while (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === expression
  ) {
    expression = parent;
    parent = expression.parent;
  }
  return ts.isCallExpression(parent) && parent.expression === expression;
}

function normalizedCapability(module: string, imported: string): string {
  return `${module.replace(/^node:/u, "")}.${imported}`;
}

export function analyzeStep44SourcePolicy(input: {
  readonly file: string;
  readonly source: ts.SourceFile;
  readonly executionRosterEntry?: Step44ExecutionModuleRosterEntry;
  readonly violations: string[];
}): Step44SourcePolicyResult {
  const specifiers: Step44ModuleSpecifier[] = [];
  const uses: Step44IoUse[] = [];
  const executionRosterIds = new Set<string>();
  const sensitiveLocalNames = new Set<string>();
  const sensitiveBindingModules = new Map<string, string>();
  const sensitiveNamespaceNames = new Set<string>();
  const seenUses = new Set<string>();
  const fail = (node: ts.Node, message: string): void => {
    input.violations.push(`${input.file}: ${message}: ${node.getText(input.source)}`);
  };
  const addUse = (category: Step44IoCategory, primitive: string): void => {
    const key = `${category}:${primitive}`;
    if (seenUses.has(key)) return;
    seenUses.add(key);
    uses.push({ file: input.file, category, primitive });
  };
  const requireExecutionRoster = (node: ts.Node, module: string, imported: string): void => {
    const capability = normalizedCapability(module, imported);
    const roster = input.executionRosterEntry;
    if (roster === undefined || !roster.capabilities.includes(capability))
      fail(node, `unrostered execution capability ${capability}`);
    else {
      executionRosterIds.add(roster.id);
      if (roster.reason.trim().length < 24)
        fail(node, `execution roster ${roster.id} lacks a reason`);
    }
  };
  const requireReviewedSpecifier = (node: ts.Node, module: string): void => {
    if (STEP44_BUILTIN_MODULES.has(module)) return;
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(module)) {
      fail(node, `URL or protocol module specifier ${module} is forbidden`);
      return;
    }
    if (!isReviewedRuntimeSpecifier(module))
      fail(node, `unrostered bare runtime module specifier ${module}`);
  };
  const inspectRuntimeImport = (node: ts.ImportDeclaration, module: string): void => {
    if (!isSensitiveModule(module)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings !== undefined && ts.isNamedImports(bindings))
        for (const element of bindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (STEP44_BOUNDED_READER_PRIMITIVES.has(imported)) {
            if (
              element.propertyName !== undefined &&
              element.propertyName.text !== element.name.text
            )
              fail(element, `aliased bounded-reader import ${imported} is forbidden`);
            sensitiveLocalNames.add(element.name.text);
            sensitiveBindingModules.set(element.name.text, "bounded-reader");
            addUse("bounded-source-read", imported);
          }
        }
      return;
    }
    if (STEP44_FORBIDDEN_EXECUTION_MODULES.has(module)) {
      fail(node, `execution module ${module} is forbidden`);
      return;
    }
    if (STEP44_PROCESS_MODULES.has(module)) {
      fail(node, `runtime process module ${module} is forbidden`);
      return;
    }
    const clause = node.importClause;
    if (clause?.isTypeOnly === true) return;
    if (clause?.name !== undefined) {
      sensitiveBindingModules.set(clause.name.text, module);
      fail(clause.name, `default sensitive import from ${module} is forbidden`);
    }
    if (clause?.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)) {
      sensitiveNamespaceNames.add(clause.namedBindings.name.text);
      fail(clause.namedBindings, `namespace sensitive import from ${module} is forbidden`);
      return;
    }
    if (clause?.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) {
      fail(node, `bare sensitive import from ${module} is forbidden`);
      return;
    }
    for (const element of clause.namedBindings.elements) {
      if (element.isTypeOnly) continue;
      const imported = element.propertyName?.text ?? element.name.text;
      if (element.propertyName !== undefined && element.propertyName.text !== element.name.text) {
        fail(
          element,
          `aliased sensitive import ${normalizedCapability(module, imported)} is forbidden`,
        );
        continue;
      }
      sensitiveLocalNames.add(element.name.text);
      sensitiveBindingModules.set(element.name.text, module);
      if (STEP44_FS_MODULES.has(module)) {
        const category = categoryForFsPrimitive(imported);
        if (category === undefined) fail(element, `uncategorized ${module} primitive ${imported}`);
        else addUse(category, imported);
      } else if (STEP44_CHILD_PROCESS_MODULES.has(module)) {
        if (!STEP44_CHILD_PROCESS_PRIMITIVES.has(imported))
          fail(element, `uncategorized ${module} primitive ${imported}`);
        else {
          addUse("child-process", imported);
          requireExecutionRoster(element, module, imported);
        }
      } else if (STEP44_MODULE_MODULES.has(module)) {
        if (imported !== "registerHooks")
          fail(element, `module-loader import ${imported} is forbidden`);
        else addUse("module-loader", imported);
      } else if (module.includes("pdfjs-dist")) addUse("pdfjs", module);
      else if (isBrowserModule(module)) addUse("browser", module);
    }
  };

  const visit = (node: ts.Node): void => {
    if (input.executionRosterEntry !== undefined && ts.isSwitchStatement(node))
      fail(node, "execution-module switch branching and fall-through are forbidden");
    if (ts.isImportEqualsDeclaration(node)) fail(node, "ImportEqualsDeclaration is forbidden");
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text;
      specifiers.push({
        value: module,
        dynamic: false,
        runtime: node.importClause?.isTypeOnly !== true,
      });
      if (node.importClause?.isTypeOnly !== true) {
        requireReviewedSpecifier(node, module);
        inspectRuntimeImport(node, module);
      }
      if (module.endsWith(".node")) fail(node, "native .node module import is forbidden");
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const module = node.moduleSpecifier.text;
      specifiers.push({ value: module, dynamic: false, runtime: node.isTypeOnly !== true });
      if (node.isTypeOnly !== true) {
        requireReviewedSpecifier(node, module);
        if (isSensitiveModule(module))
          fail(node, `sensitive module re-export from ${module} is forbidden`);
      }
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier === undefined &&
      node.exportClause !== undefined &&
      ts.isNamedExports(node.exportClause)
    )
      for (const element of node.exportClause.elements) {
        const local = element.propertyName?.text ?? element.name.text;
        if (sensitiveLocalNames.has(local))
          fail(element, `sensitive capability re-export ${local} is forbidden`);
      }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const module = literalText(node.arguments[0]);
        if (module === undefined || node.arguments.length !== 1)
          fail(node, "unresolved computed import call is forbidden");
        else {
          specifiers.push({ value: module, dynamic: true, runtime: true });
          requireReviewedSpecifier(node, module);
          if (STEP44_FORBIDDEN_EXECUTION_MODULES.has(module))
            fail(node, `execution module ${module} is forbidden`);
          else if (
            STEP44_FS_MODULES.has(module) ||
            STEP44_CHILD_PROCESS_MODULES.has(module) ||
            STEP44_MODULE_MODULES.has(module) ||
            STEP44_PROCESS_MODULES.has(module)
          )
            fail(node, `dynamic sensitive import from ${module} is forbidden`);
          else if (module.includes("pdfjs-dist")) addUse("pdfjs", module);
          else if (isBrowserModule(module)) addUse("browser", module);
        }
      }
      const expressionText = node.expression.getText(input.source);
      if (expressionText === "module.require" || expressionText === "require")
        fail(node, `${expressionText} loader is forbidden`);
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ["call", "apply", "bind"].includes(node.expression.name.text)
      ) {
        const root = rootIdentifier(node.expression.expression);
        if (root !== undefined && sensitiveLocalNames.has(root.text))
          fail(node, `sensitive capability ${node.expression.name.text} adapter is forbidden`);
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ((rootIdentifier(node.expression.expression)?.text === "Reflect" &&
          node.expression.name.text === "get") ||
          (rootIdentifier(node.expression.expression)?.text === "Object" &&
            node.expression.name.text === "getOwnPropertyDescriptor"))
      ) {
        const key = literalText(node.arguments[1]);
        if (key !== undefined && ["constructor", "eval", "Function"].includes(key))
          fail(node, `reflective ${key} executor extraction is forbidden`);
      }
    }
    if (ts.isNewExpression(node)) {
      const name = rootIdentifier(node.expression)?.text;
      if (name !== undefined && STEP44_FORBIDDEN_GLOBAL_EXECUTORS.has(name))
        fail(node, `${name} constructor is forbidden`);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.CommaToken &&
      /\b(?:process|global|globalThis|module|require|eval|Function|Worker|SharedWorker)\b/u.test(
        node.getText(input.source),
      )
    )
      fail(node, "comma-expression loader or process extraction is forbidden");
    if (ts.isElementAccessExpression(node)) {
      const direct = ts.isIdentifier(node.expression) ? node.expression.text : undefined;
      if (direct !== undefined && ["global", "globalThis", "module", "process"].includes(direct))
        fail(node, "computed global/module/process access is forbidden");
      const key = literalText(node.argumentExpression);
      if (key !== undefined && ["constructor", "eval", "Function"].includes(key))
        fail(node, `computed ${key} executor access is forbidden`);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const root = rootIdentifier(node.expression)?.text;
      if (root === "process" && STEP44_FORBIDDEN_PROCESS_LOADERS.has(node.name.text))
        fail(node, `process.${node.name.text} loader is forbidden`);
      if (
        ["global", "globalThis"].includes(root ?? "") &&
        ["process", ...STEP44_FORBIDDEN_GLOBAL_EXECUTORS].includes(node.name.text)
      )
        fail(node, `global executor access ${node.name.text} is forbidden`);
      if (root === "module" && ["constructor", "require"].includes(node.name.text))
        fail(node, `module.${node.name.text} loader is forbidden`);
      if (
        node.name.text === "constructor" &&
        !(
          ts.isPropertyAccessExpression(node.parent) &&
          node.parent.expression === node &&
          node.parent.name.text === "name"
        )
      )
        fail(node, "constructor extraction or invocation is forbidden");
      if (
        node.questionDotToken !== undefined &&
        ts.isIdentifier(node.expression) &&
        ["global", "globalThis", "module", "process"].includes(node.expression.text)
      )
        fail(node, "optional global/module/process access is forbidden");
    }
    if (ts.isIdentifier(node) && valueReference(node)) {
      if (sensitiveNamespaceNames.has(node.text))
        fail(node, `sensitive namespace ${node.text} must not be referenced`);
      const sensitiveModule = sensitiveBindingModules.get(node.text);
      if (
        sensitiveModule !== undefined &&
        !directlyInvokedSensitiveBinding(node, sensitiveModule) &&
        !(
          STEP44_FS_MODULES.has(sensitiveModule) &&
          STEP44_FILESYSTEM_METADATA_PRIMITIVES.has(node.text)
        )
      )
        fail(node, `sensitive capability ${node.text} must be invoked directly`);
      if (
        STEP44_FORBIDDEN_GLOBAL_EXECUTORS.has(node.text) &&
        !(node.text === "Function" && allowedIntrinsicFunctionBinding(node))
      )
        fail(node, `${node.text} reference is forbidden`);
      if (node.text === "process") {
        const parent = node.parent;
        if (!(
          (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
          (ts.isTypeOfExpression(parent) && parent.expression === node)
        ))
          fail(node, "process alias or indirect process expression is forbidden");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(input.source);
  return {
    specifiers,
    uses,
    executionRosterIds: [...executionRosterIds],
  };
}

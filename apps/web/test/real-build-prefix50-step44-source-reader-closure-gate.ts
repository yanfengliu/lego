import { createHash } from "node:crypto";
import { lstatSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import ts from "typescript";

import {
  EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER,
  type Step44ExecutionModuleRosterEntry,
} from "./real-build-prefix50-step44-source-reader-closure-execution-roster.ts";
import {
  snapshotStep44ClosureFile,
  type Step44ClosureFileKind,
  type Step44ClosureFileSnapshot,
} from "./real-build-prefix50-step44-source-reader-closure-files.ts";
import {
  analyzeStep44SourcePolicy,
  type Step44IoCategory,
  type Step44IoUse,
  type Step44ModuleSpecifier,
} from "./real-build-prefix50-step44-source-reader-closure-policy.ts";
import { STEP44_SOURCE_EXTENSIONS } from "./real-build-prefix50-step44-source-reader-closure-primitives.ts";
import {
  finiteStep44LaunchTargets,
  resolveStep44WorkspaceExport,
  step44ClosureTargetKind,
} from "./real-build-prefix50-step44-source-reader-closure-resolution.ts";

export type { Step44IoCategory, Step44IoUse };

export interface Step44ClosureManifestEntry {
  readonly path: string;
  readonly digest: `sha256:${string}`;
  readonly bytes: number;
  readonly kind: Step44ClosureFileKind;
}

export interface Step44ClosureModule extends Step44ClosureFileSnapshot {
  readonly source: ts.SourceFile;
  readonly specifiers: readonly Step44ModuleSpecifier[];
}

export interface Step44ProcessTarget {
  readonly file: string;
  readonly primitive: string;
  readonly target: string;
  readonly targetClass:
    | "external-immutable-helper"
    | "literal-external-executable"
    | "local-script"
    | "trusted-browser-dependency"
    | "trusted-dependency-script";
}

export interface Step44ClosureAudit {
  readonly modules: ReadonlyMap<string, Step44ClosureModule>;
  readonly manifest: readonly Step44ClosureManifestEntry[];
  readonly uses: readonly Step44IoUse[];
  readonly processTargets: readonly Step44ProcessTarget[];
  readonly executionRosterIds: readonly string[];
  readonly violations: readonly string[];
}

export interface Step44AllowedIoModule {
  readonly file: string;
  readonly categories: Readonly<Partial<Record<Step44IoCategory, string>>>;
}

interface PendingFile {
  readonly file: string;
  readonly kind: Step44ClosureFileKind;
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".mjs") || file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function candidateExists(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function resolveRelativeModule(importer: string, specifier: string): readonly string[] {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    ...STEP44_SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...STEP44_SOURCE_EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ];
  return [...new Set(candidates.filter(candidateExists))];
}

function diagnosticText(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}

function parseModule(input: {
  readonly pending: PendingFile;
  readonly repositoryRoot: string;
  readonly executionRosterEntry?: Step44ExecutionModuleRosterEntry;
  readonly violations: string[];
}): Readonly<{
  module: Step44ClosureModule;
  executionRosterIds: readonly string[];
  uses: readonly Step44IoUse[];
}> {
  const snapshot = snapshotStep44ClosureFile({
    candidate: input.pending.file,
    repositoryRoot: input.repositoryRoot,
    kind: input.pending.kind,
  });
  if (snapshot.kind !== "typescript-source") {
    return {
      module: {
        ...snapshot,
        source: ts.createSourceFile(snapshot.file, "", ts.ScriptTarget.Latest, true),
        specifiers: [],
      },
      executionRosterIds: [],
      uses: [],
    };
  }
  const source = ts.createSourceFile(
    snapshot.file,
    snapshot.text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(snapshot.file),
  );
  const parseDiagnostics = (
    source as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  for (const diagnostic of parseDiagnostics)
    input.violations.push(
      `${snapshot.file}: parser diagnostic ${String(diagnostic.code)}: ${diagnosticText(diagnostic)}`,
    );
  const policy = analyzeStep44SourcePolicy({
    file: snapshot.file,
    source,
    ...(input.executionRosterEntry === undefined
      ? {}
      : { executionRosterEntry: input.executionRosterEntry }),
    violations: input.violations,
  });
  return {
    module: { ...snapshot, source, specifiers: policy.specifiers },
    executionRosterIds: policy.executionRosterIds,
    uses: policy.uses,
  };
}

function repositoryPath(repositoryRoot: string, file: string): string {
  return relative(repositoryRoot, file).replaceAll("\\", "/");
}

function exactManifestFailures(
  actual: readonly Step44ClosureManifestEntry[],
  expected: readonly Step44ClosureManifestEntry[],
): readonly string[] {
  const failures: string[] = [];
  const expectedByPath = new Map<string, Step44ClosureManifestEntry>();
  for (const row of expected) {
    if (expectedByPath.has(row.path)) failures.push(`duplicate manifest entry ${row.path}`);
    expectedByPath.set(row.path, row);
  }
  const actualByPath = new Map(actual.map((row) => [row.path, row]));
  for (const [path, expectedRow] of expectedByPath) {
    const actualRow = actualByPath.get(path);
    if (actualRow === undefined) failures.push(`manifest-pinned module is unreachable ${path}`);
    else if (
      actualRow.digest !== expectedRow.digest ||
      actualRow.bytes !== expectedRow.bytes ||
      actualRow.kind !== expectedRow.kind
    )
      failures.push(`manifest-pinned module changed without reviewed repin ${path}`);
  }
  for (const path of actualByPath.keys())
    if (!expectedByPath.has(path))
      failures.push(`reachable module is absent from manifest ${path}`);
  return failures;
}

export function auditExactStep44ThreeRootClosure(
  roots: readonly string[],
  options: {
    readonly includeDynamic?: boolean;
    readonly repositoryRoot?: string;
    readonly executionRoster?: readonly Step44ExecutionModuleRosterEntry[];
    readonly expectedManifest?: readonly Step44ClosureManifestEntry[];
  } = {},
): Step44ClosureAudit {
  const repositoryRoot = resolve(options.repositoryRoot ?? ".");
  const executionRoster =
    options.executionRoster ?? EXACT_STEP44_THREE_ROOT_EXECUTION_MODULE_ROSTER;
  const rosterByFile = new Map(
    executionRoster.map((entry) => [resolve(repositoryRoot, entry.file), entry]),
  );
  const modules = new Map<string, Step44ClosureModule>();
  const identityOwners = new Map<string, string>();
  const opaqueSnapshots = new Map<string, Step44ClosureFileSnapshot>();
  const uses: Step44IoUse[] = [];
  const processTargets: Step44ProcessTarget[] = [];
  const matchedRosterIds = new Set<string>();
  const violations: string[] = [];
  const pending: PendingFile[] = roots.map((file) => ({
    file: resolve(file),
    kind: "typescript-source",
  }));
  while (pending.length > 0) {
    const next = pending.pop()!;
    if (modules.has(resolve(next.file))) continue;
    let parsed: ReturnType<typeof parseModule>;
    try {
      const executionRosterEntry = rosterByFile.get(resolve(next.file));
      parsed = parseModule({
        pending: next,
        repositoryRoot,
        ...(executionRosterEntry === undefined ? {} : { executionRosterEntry }),
        violations,
      });
    } catch (error) {
      violations.push(
        `${resolve(next.file)}: canonical closure snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    const module = parsed.module;
    const identityKey = `${String(module.identity.device)}:${String(module.identity.inode)}`;
    const identityOwner = identityOwners.get(identityKey);
    if (identityOwner !== undefined && identityOwner !== module.file) {
      violations.push(
        `${module.file}: closure file identity duplicates ${identityOwner}; aliases and hardlinks are forbidden`,
      );
      continue;
    }
    identityOwners.set(identityKey, module.file);
    modules.set(module.file, module);
    uses.push(...parsed.uses);
    for (const id of parsed.executionRosterIds) matchedRosterIds.add(id);
    for (const specifier of module.specifiers) {
      if (!specifier.runtime || (specifier.dynamic && options.includeDynamic === false)) continue;
      if (specifier.value.startsWith("@lego-studio/")) {
        try {
          const resolution = resolveStep44WorkspaceExport({
            repositoryRoot,
            specifier: specifier.value,
            manifests: opaqueSnapshots,
          });
          pending.push({
            file: resolution.target,
            kind: step44ClosureTargetKind(resolution.target),
          });
        } catch (error) {
          violations.push(
            `${module.file}: workspace export resolution failed for ${specifier.value}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        continue;
      }
      if (!specifier.value.startsWith(".")) continue;
      const targets = resolveRelativeModule(module.file, specifier.value);
      if (targets.length !== 1)
        violations.push(
          `${module.file}: literal local import must resolve to exactly one canonical file ${specifier.value}; found ${String(targets.length)}`,
        );
      else
        pending.push({
          file: targets[0]!,
          kind: step44ClosureTargetKind(targets[0]!),
        });
    }
    const roster = rosterByFile.get(module.file);
    if (roster !== undefined) {
      for (const target of roster.localTargets ?? []) {
        const file = resolve(repositoryRoot, target);
        const kind = step44ClosureTargetKind(file);
        pending.push({ file, kind });
        processTargets.push({
          file: module.file,
          primitive: roster.capabilities.join("+"),
          target: file,
          targetClass: kind === "typescript-source" ? "local-script" : "external-immutable-helper",
        });
        if (kind !== "typescript-source")
          uses.push({ file: module.file, category: "child-script", primitive: target });
      }
      for (const target of roster.externalTargets ?? [])
        processTargets.push({
          file: module.file,
          primitive: roster.capabilities.join("+"),
          target,
          targetClass: "literal-external-executable",
        });
      if (roster.id === "owned-process-bootstrap-single-launch") {
        for (const target of finiteStep44LaunchTargets(repositoryRoot, opaqueSnapshots)) {
          pending.push({ file: target.file, kind: target.kind });
          processTargets.push({
            file: module.file,
            primitive: "finite-job-table",
            target: target.file,
            targetClass: target.targetClass,
          });
        }
      }
    }
  }
  for (const manifest of opaqueSnapshots.values()) {
    const identityKey = `${String(manifest.identity.device)}:${String(manifest.identity.inode)}`;
    const identityOwner = identityOwners.get(identityKey);
    if (identityOwner !== undefined && identityOwner !== manifest.file) {
      violations.push(
        `${manifest.file}: closure file identity duplicates ${identityOwner}; aliases and hardlinks are forbidden`,
      );
      continue;
    }
    identityOwners.set(identityKey, manifest.file);
    modules.set(manifest.file, {
      ...manifest,
      source: ts.createSourceFile(manifest.file, "", ts.ScriptTarget.Latest, true),
      specifiers: [],
    });
  }
  for (const entry of executionRoster) {
    const file = resolve(repositoryRoot, entry.file);
    if (modules.has(file) && !matchedRosterIds.has(entry.id))
      violations.push(`${entry.file}: stale execution roster entry ${entry.id}`);
  }
  const manifest = [...modules.values()]
    .map(({ repositoryPath: path, digest, bytes, kind }) => ({
      path,
      digest,
      bytes: bytes.byteLength,
      kind,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (options.expectedManifest !== undefined)
    violations.push(...exactManifestFailures(manifest, options.expectedManifest));
  return {
    modules,
    manifest,
    uses,
    processTargets,
    executionRosterIds: [...matchedRosterIds].sort(),
    violations,
  };
}

export function assertExactStep44IoRoster(
  audit: Step44ClosureAudit,
  repositoryRoot: string,
  roster: readonly Step44AllowedIoModule[],
): void {
  const allowed = new Map(
    roster.map(({ file, categories }) => [
      resolve(repositoryRoot, file),
      new Map(Object.entries(categories).map(([category, reason]) => [category, String(reason)])),
    ]),
  );
  const failures = [...audit.violations];
  const observed = new Set<string>();
  for (const use of audit.uses) {
    const reason = allowed.get(use.file)?.get(use.category);
    const key = `${use.file}:${use.category}`;
    observed.add(key);
    if (reason === undefined || reason.trim().length < 12)
      failures.push(
        `${repositoryPath(repositoryRoot, use.file)}: unrecognized ${use.category} ${use.primitive}`,
      );
  }
  for (const [file, categories] of allowed)
    for (const category of categories.keys())
      if (!observed.has(`${file}:${category}`))
        failures.push(
          `${repositoryPath(repositoryRoot, file)}: stale allowed ${category} roster entry`,
        );
  if (failures.length > 0)
    throw new TypeError(
      `Step-44 exact three-root closure failed closed:\n${failures.sort().join("\n")}`,
    );
}

export function findExtensionlessRuntimeLocalEdges(audit: Step44ClosureAudit): readonly string[] {
  return [...audit.modules.values()].flatMap((module) =>
    module.specifiers
      .filter(
        ({ value, runtime }) => runtime && value.startsWith(".") && extname(value).length === 0,
      )
      .map(({ value }) => `${module.file} -> ${value}`),
  );
}

export function step44ModuleCallsAny(
  parsed: Step44ClosureModule,
  names: ReadonlySet<string>,
): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : undefined;
      if (name !== undefined && names.has(name)) found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed.source);
  return found;
}

export function step44ModuleCalls(
  parsed: Step44ClosureModule,
  name: string,
): readonly ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    )
      calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(parsed.source);
  return calls;
}

export function step44ManifestCommitment(
  manifest: readonly Step44ClosureManifestEntry[],
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(JSON.stringify(manifest)).digest("hex")}`;
}

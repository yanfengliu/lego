import { resolve } from "node:path";

import ts from "typescript";

import type {
  Step44ClosureAudit,
  Step44ClosureModule,
} from "./real-build-prefix50-step44-source-reader-closure-gate.ts";

const AUTHORITY = "real-build-prefix50-step44-later-source-authority.ts";
const DERIVED_OPERATION = "real-build-prefix50-step44-later-source-derived-operation.ts";
const DERIVED_CONTRACT = "real-build-prefix50-step44-later-source-derived-contract.ts";
const DERIVED_RASTER = "real-build-prefix50-step44-later-source-derived-raster.ts";
const DERIVED_VECTOR = "real-build-prefix50-step44-later-source-derived-vector.ts";
const LEDGER = "real-build-prefix50-step44-later-source-ledger.ts";
const LEDGER_PROVISION = "real-build-prefix50-step44-later-source-ledger-provision.ts";
const LEDGER_REPOSITORY_EVENTS =
  "real-build-prefix50-step44-later-source-ledger-repository-events.ts";
const LEDGER_SEAL = "real-build-prefix50-step44-later-source-ledger-seal.ts";
const GATE_EVIDENCE =
  "real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
const ARTIFACT_IO = "real-build-prefix50-subbuild-return-review-artifact-io.ts";
const RENDERER = "real-build-prefix50-subbuild-return-review-pdf.ts";
const PANEL_PREFIX = "real-build-prefix50-step44-panel-face-prefix.ts";

function requireCondition(condition: boolean, message: string): void {
  if (!condition) throw new TypeError(message);
}

function finalComponent(specifier: string): string {
  return specifier.replaceAll("\\", "/").split("/").at(-1) ?? "";
}

function moduleNamed(
  audit: Step44ClosureAudit,
  repositoryRoot: string,
  name: string,
): Step44ClosureModule {
  const module = audit.modules.get(resolve(repositoryRoot, "apps/web/e2e", name));
  if (module === undefined) throw new TypeError(`Step-44 closure omitted ${name}.`);
  return module;
}

function importsTarget(module: Step44ClosureModule, targetName: string): boolean {
  return module.specifiers.some(({ value }) => finalComponent(value) === targetName);
}

function importersOf(audit: Step44ClosureAudit, targetName: string): readonly string[] {
  return [...audit.modules.values()]
    .filter((module) => importsTarget(module, targetName))
    .map(({ file }) => file)
    .sort();
}

function requireExactImporters(
  audit: Step44ClosureAudit,
  repositoryRoot: string,
  targetName: string,
  importerNames: readonly string[],
): void {
  const expected = importerNames
    .map((name) => resolve(repositoryRoot, "apps/web/e2e", name))
    .sort();
  const actual = importersOf(audit, targetName);
  requireCondition(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Step-44 ${targetName} importers changed: ${actual.join(", ") || "none"}.`,
  );
}

function importedBindings(module: Step44ClosureModule, targetName: string): readonly string[] {
  const bindings: string[] = [];
  for (const statement of module.source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      finalComponent(statement.moduleSpecifier.text) !== targetName
    )
      continue;
    const clause = statement.importClause;
    if (clause?.name !== undefined) bindings.push("default");
    if (clause?.namedBindings === undefined) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) bindings.push("*");
    else
      bindings.push(
        ...clause.namedBindings.elements.map(
          (element) => element.propertyName?.text ?? element.name.text,
        ),
      );
  }
  return bindings;
}

function functionText(module: Step44ClosureModule, name: string): string {
  const declaration = module.source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (declaration === undefined)
    throw new TypeError(`Step-44 closure omitted function ${name} from ${module.file}.`);
  return declaration.getText(module.source);
}

export function assertStep44LaterSourceImportExclusivity(
  audit: Step44ClosureAudit,
  repositoryRoot: string,
): void {
  requireExactImporters(audit, repositoryRoot, DERIVED_OPERATION, [AUTHORITY]);
  requireExactImporters(audit, repositoryRoot, DERIVED_RASTER, [DERIVED_OPERATION]);
  requireExactImporters(audit, repositoryRoot, DERIVED_VECTOR, [DERIVED_OPERATION]);
  requireExactImporters(audit, repositoryRoot, DERIVED_CONTRACT, [
    DERIVED_OPERATION,
    DERIVED_RASTER,
    DERIVED_VECTOR,
  ]);
  requireExactImporters(audit, repositoryRoot, LEDGER_PROVISION, [
    GATE_EVIDENCE,
    LEDGER_REPOSITORY_EVENTS,
  ]);
  requireExactImporters(audit, repositoryRoot, LEDGER, [ARTIFACT_IO, AUTHORITY]);

  const authority = moduleNamed(audit, repositoryRoot, AUTHORITY);
  const gateEvidence = moduleNamed(audit, repositoryRoot, GATE_EVIDENCE);
  const derived = moduleNamed(audit, repositoryRoot, DERIVED_OPERATION);
  const renderer = moduleNamed(audit, repositoryRoot, RENDERER);
  const panel = moduleNamed(audit, repositoryRoot, PANEL_PREFIX);
  requireCondition(
    importsTarget(authority, DERIVED_OPERATION) && importsTarget(authority, LEDGER),
    "Step-44 authority must retain the sole fixed dispatcher and transaction imports.",
  );
  const operation = functionText(authority, "executeRealBuildPrefix50Step44LaterSourceDerivation");
  const orderedOperations = [
    "prepareRealBuildPrefix50Step44LaterSourceDerivedOperation",
    "preparedOperationCommitment: prepared.commitment",
    "beginRealBuildPrefix50Step44LaterSourceInternalTransaction",
    "requestForRealBuildPrefix50Step44PreparedLaterSourceDerivedOperation",
    "readRealBuildPrefix50Step44ReviewArtifact",
    "executeRealBuildPrefix50Step44LaterSourceDerivedOperation",
    "completeRealBuildPrefix50Step44LaterSourceInternalTransaction",
  ];
  let previousIndex = -1;
  for (const evidence of orderedOperations) {
    const index = operation.indexOf(evidence);
    requireCondition(
      index > previousIndex,
      `Step-44 authority operation ordering lost ${evidence}.`,
    );
    previousIndex = index;
  }
  requireCondition(
    !operation.includes("input.request") &&
      operation.match(/readRealBuildPrefix50Step44ReviewArtifact/gu)?.length === 1 &&
      operation.match(/executeRealBuildPrefix50Step44LaterSourceDerivedOperation/gu)?.length ===
        1 &&
      operation.includes("bytes?.fill(0)"),
    "Step-44 authority must snapshot without invoking request accessors, read and dispatch once, and zero source bytes.",
  );
  requireCondition(
    importedBindings(gateEvidence, LEDGER_PROVISION).includes(
      "provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis",
    ),
    "Step-44 verified bind seam must retain the sole qualification provision import.",
  );
  for (const module of audit.modules.values())
    if (module.file !== gateEvidence.file)
      requireCondition(
        !importedBindings(module, LEDGER_PROVISION).includes(
          "provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis",
        ),
        `Step-44 qualification provisioner escaped the verified bind seam through ${module.file}.`,
      );

  for (const [label, module] of [
    ["renderer", renderer],
    ["panel-prefix", panel],
  ] as const) {
    requireCondition(
      importsTarget(module, AUTHORITY),
      `Step-44 ${label} must consume only the public later-source authority.`,
    );
    for (const forbidden of [DERIVED_OPERATION, ARTIFACT_IO, LEDGER, LEDGER_PROVISION])
      requireCondition(
        !importsTarget(module, forbidden),
        `Step-44 ${label} directly imported forbidden ${forbidden}.`,
      );
  }
  for (const forbidden of [AUTHORITY, ARTIFACT_IO, LEDGER, LEDGER_PROVISION])
    requireCondition(
      !importsTarget(derived, forbidden),
      `Step-44 fixed derived leaf reached back into forbidden ${forbidden}.`,
    );

  const internalTransactionBindings = new Set([
    "beginRealBuildPrefix50Step44LaterSourceInternalTransaction",
    "completeRealBuildPrefix50Step44LaterSourceInternalTransaction",
    "abandonRealBuildPrefix50Step44LaterSourceInternalTransaction",
  ]);
  for (const module of audit.modules.values()) {
    if (!importsTarget(module, LEDGER)) continue;
    const internal = importedBindings(module, LEDGER).filter(
      (name) => name === "*" || internalTransactionBindings.has(name),
    );
    requireCondition(
      internal.length === 0 || module.file === authority.file,
      `Step-44 internal transaction API escaped authority through ${module.file}.`,
    );
  }
  for (const name of internalTransactionBindings)
    requireCondition(
      importedBindings(authority, LEDGER).includes(name),
      `Step-44 authority omitted internal transaction binding ${name}.`,
    );

  requireCondition(
    audit.executionRosterIds.includes("later-source-ledger-dpapi"),
    "Step-44 DPAPI boundary escaped the exact execution roster.",
  );
  const helperPath = resolve(
    repositoryRoot,
    "apps/web/e2e/real-build-prefix50-step44-later-source-dpapi.ps1",
  );
  const helper = audit.modules.get(helperPath);
  requireCondition(
    helper?.kind === "external-immutable-helper" && helper.source.getText() === "",
    "Step-44 DPAPI helper was not held as exact immutable bytes.",
  );
  const sealPath = resolve(repositoryRoot, "apps/web/e2e", LEDGER_SEAL);
  const targets = audit.processTargets
    .filter(({ file }) => file === sealPath)
    .map(({ target, targetClass }) => `${targetClass}:${target}`)
    .sort();
  const expectedTargets = [
    `external-immutable-helper:${helperPath}`,
    "literal-external-executable:C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ].sort();
  requireCondition(
    JSON.stringify(targets) === JSON.stringify(expectedTargets),
    "Step-44 DPAPI boundary did not bind its exact host and immutable helper.",
  );
}

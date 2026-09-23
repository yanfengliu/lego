import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const FILE = resolve("apps/web/test/real-build-prefix50-step44-later-source-ledger-controls.ts");
const OWNED_ROOT = resolve("output/step44-later-source-ledger-tests/repository-in-memory");
const HOOKS = new Set(["beforeAll", "beforeEach", "afterEach", "afterAll"]);

function actualFixtureHooks(): string {
  const source = ts.createSourceFile(
    FILE,
    readFileSync(FILE, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const selected = source.statements.filter((statement) => {
    if (ts.isFunctionDeclaration(statement)) return statement.name?.text === "syntheticRepository";
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression))
      return false;
    const callee = statement.expression.expression;
    return ts.isIdentifier(callee) && HOOKS.has(callee.text);
  });
  expect(selected.some(ts.isFunctionDeclaration)).toBe(true);
  expect(selected.filter(ts.isExpressionStatement)).toHaveLength(2);
  return selected.map((statement) => statement.getText(source)).join("\n");
}

function failedSetupTrace(fragment: string): readonly (readonly [string, string])[] {
  const calls: [string, string][] = [];
  const setup: (() => void)[] = [];
  const cleanup: (() => void)[] = [];
  const registerSetup = (callback: () => void): void => {
    setup.push(callback);
  };
  const registerCleanup = (callback: () => void): void => {
    cleanup.push(callback);
  };
  const sandbox = {
    resolve,
    join,
    cleanupDirectories: new Set<string>(),
    cleanupFiles: new Set<string>(),
    mkdirSync: () => undefined,
    writeFileSync: () => undefined,
    mkdtempSync: () => OWNED_ROOT,
    provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis: (input: {
      repositoryRoot: string;
    }) => {
      calls.push(["provision", input.repositoryRoot]);
      throw new Error("synthetic provisioning failure");
    },
    beforeAll: registerSetup,
    beforeEach: registerSetup,
    afterEach: registerCleanup,
    afterAll: registerCleanup,
    rmSync: (path: string) => calls.push(["remove-tree", path]),
    unlinkSync: (path: string) => calls.push(["unlink", path]),
  };
  const javascript = ts.transpileModule(`let REPOSITORY_ROOT;\n${fragment}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  // harness: execute the real fixture hooks, but provide no filesystem or process access.
  runInNewContext(javascript, sandbox, { timeout: 1_000 });
  expect(setup).toHaveLength(1);
  expect(cleanup).toHaveLength(1);
  try {
    expect(() => setup[0]!()).toThrow("synthetic provisioning failure");
  } finally {
    for (const callback of cleanup) callback();
  }
  return calls;
}

function requireOwnedFailedSetup(trace: readonly (readonly [string, string])[]): void {
  expect(trace).toEqual([
    ["provision", OWNED_ROOT],
    ["remove-tree", OWNED_ROOT],
  ]);
}

describe("later-source fixture ownership", () => {
  // Bound: the current controls suite's actual lifecycle hooks, including failed setup.
  // The old live-root deletion is reintroduced only in VM text with a fake filesystem.
  it("cleans only its owned root when provisioning fails", () => {
    requireOwnedFailedSetup(failedSetupTrace(actualFixtureHooks()));
  });

  it("detects the old live-checkout provision and cleanup without touching real state", () => {
    const current = actualFixtureHooks();
    const mutation = current
      .replace(
        "REPOSITORY_ROOT = syntheticRepository();",
        'REPOSITORY_ROOT = resolve("."); provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({ repositoryRoot: REPOSITORY_ROOT });',
      )
      .replace(
        "afterEach(() => {",
        'afterEach(() => { rmSync(resolve("var/state/step44-later-source-ledger-v2-genesis"));',
      );
    expect(mutation).not.toBe(current);
    const trace = failedSetupTrace(mutation);
    expect(trace).toContainEqual(["provision", resolve(".")]);
    expect(trace).toContainEqual([
      "remove-tree",
      resolve("var/state/step44-later-source-ledger-v2-genesis"),
    ]);
    expect(() => requireOwnedFailedSetup(trace)).toThrow();
  });
});

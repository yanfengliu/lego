import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * The answer-key guard in eslint.config.js, exercised through the real config:
 * product code may not load tools/booklet or name output/official-model as a
 * path; tests, e2e, tools and scripts may.
 *
 * Every construct and every product root below is a separate case, so the
 * test goes red when any one selector is dropped (the re-exports included),
 * when a root is narrowed (packages/catalog, apps/companion, the config roots),
 * or when the files pattern covers fewer extensions than .ts.
 * Bound: it proves the rule against these snippets and paths; a path assembled
 * at run time ("official-" + "model") passes, and no linter can see it.
 */
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd: repositoryRoot });

async function guardMessages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  const fatal = messages.find(({ fatal }) => fatal);
  if (fatal) throw new Error(`${filePath} did not parse: ${fatal.message}`);
  if (messages.some(({ message }) => /ignored/u.test(message))) {
    throw new Error(`${filePath} is ignored by the lint config, so the guard cannot run on it`);
  }
  return messages
    .filter(({ ruleId }) => ruleId === "no-restricted-syntax")
    .map(({ message }) => message);
}

const HARNESS = "../../../tools/booklet/answer-key/index.ts";
/** One snippet per construct that can load the harness; each must draw exactly one message. */
const LOADS: Readonly<Record<string, string>> = {
  "static import": `import { loadAnswerKey } from "${HARNESS}";\nexport const load = loadAnswerKey;\n`,
  "type import": `import type { AnswerKey } from "${HARNESS}";\nexport type K = AnswerKey;\n`,
  "re-export all": `export * from "${HARNESS}";\n`,
  "re-export named": `export { loadAnswerKey } from "${HARNESS}";\n`,
  "re-export type": `export type { AnswerKey } from "${HARNESS}";\n`,
  "dynamic import": `export const load = () => import("${HARNESS}");\n`,
  "template import": `export const load = () => import(\`${HARNESS}\`);\n`,
  "import of new URL": `export const load = () => import(new URL("${HARNESS}", import.meta.url).href);\n`,
  createRequire: `import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nexport const key: unknown = require("../../../tools/booklet/answer-key/index.cjs");\n`,
  "import equals require": `import key = require("../../../tools/booklet/answer-key/index");\nexport default key;\n`,
  "typeof import": `export type K = typeof import("${HARNESS}");\n`,
  "windows separators": `export const load = () => import("..\\\\..\\\\..\\\\tools\\\\booklet\\\\answer-key\\\\index.ts");\n`,
};
const PATHS: Readonly<Record<string, string>> = {
  "string path": 'export const path = "output/official-model/vx1087034_21066_a.xml";\n',
  "template path":
    "const root = 'x';\nexport const path = `${root}/output/official-model/model.ldr`;\n",
  "path segment":
    'import { join } from "node:path";\nexport const path = join("output", "official-model");\n',
};

describe("answer-key guard", { timeout: 120_000 }, () => {
  it("refuses every construct that loads the harness", async () => {
    for (const [name, code] of Object.entries(LOADS)) {
      expect(await guardMessages("apps/web/src/guard-probe.ts", code), name).toEqual([
        expect.stringMatching(/must not load the booklet harness/u),
      ]);
    }
  });

  it("refuses every path use of the official model", async () => {
    for (const [name, code] of Object.entries(PATHS)) {
      expect(await guardMessages("packages/brick-kernel/src/guard-probe.ts", code), name).toEqual([
        expect.stringMatching(/must not read output\/official-model/u),
      ]);
    }
  });

  it("covers every product root and every script extension", async () => {
    const code = LOADS["re-export all"]!;
    for (const filePath of [
      "packages/protocol/src/guard-probe.ts",
      "packages/catalog/src/guard-probe.ts",
      "packages/brick-kernel/src/guard-probe.ts",
      "packages/rendering/src/guard-probe.ts",
      "apps/web/src/guard-probe.ts",
      "apps/companion/src/guard-probe.ts",
      "apps/web/vite.config.ts",
      "apps/web/guard-probe.config.mjs",
      "packages/catalog/guard-probe.config.ts",
      "apps/web/src/nested/deeper/guard-probe.tsx",
      "apps/web/src/guard-probe.mts",
      "apps/web/src/guard-probe.cts",
      "apps/web/src/guard-probe.js",
      "apps/web/src/guard-probe.jsx",
      "apps/web/src/guard-probe.mjs",
      "apps/web/src/guard-probe.cjs",
    ]) {
      expect(await guardMessages(filePath, code), filePath).toEqual([
        expect.stringMatching(/must not load the booklet harness/u),
      ]);
    }
  });

  it("does not catch a look-alike path or a string that only mentions the model", async () => {
    for (const code of [
      'import { BookletPanel } from "./tools/booklet-panel";\nexport default BookletPanel;\n',
      'export const load = () => import("./tools/bookletish/index.ts");\n',
      'export const label = "Compare against the official-model render";\n',
      "export const hint = `the official-model answer key is never read here`;\n",
    ]) {
      expect(await guardMessages("apps/web/src/guard-probe.tsx", code), code).toEqual([]);
    }
  });

  it("leaves tests, scripts, e2e, the harness and the one exempt ledger alone", async () => {
    for (const filePath of [
      "apps/web/src/guard-probe.test.ts",
      "apps/web/test/guard-probe.ts",
      "apps/web/e2e/guard-probe.ts",
      "scripts/guard-probe.mjs",
      "tools/booklet/guard-probe.ts",
      "packages/catalog/src/quarantine/set-6651557-coverage-ledger.ts",
    ]) {
      expect(await guardMessages(filePath, PATHS["string path"]!), filePath).toEqual([]);
    }
  });
});

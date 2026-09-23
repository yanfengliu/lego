import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * The answer-key guard in eslint.config.js, exercised through the real config:
 * product code (packages/*\/src, apps/*\/src) may not import tools/booklet or
 * name output/official-model; tests, scripts and tools may. Bound: it proves
 * the rule's configuration against these snippets and paths, not that every
 * spelling of a path is caught (a path assembled from "official" + "-model"
 * would pass).
 */
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd: repositoryRoot });

async function guardMessages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter(({ ruleId }) => ruleId === "no-restricted-syntax")
    .map(({ message }) => message);
}

const IMPORTS_ANSWER_KEY =
  'import { loadAnswerKey } from "../../../tools/booklet/answer-key/index.ts";\nexport const load = loadAnswerKey;\n';
const DYNAMIC_IMPORT =
  'export const load = () => import("../../../tools/booklet/answer-key/index.ts");\n';
const READS_OFFICIAL_MODEL = 'export const path = "output/official-model/vx1087034_21066_a.xml";\n';
const TEMPLATE_PATH =
  "const root = 'x';\nexport const path = `${root}/output/official-model/model.ldr`;\n";

describe("answer-key guard", { timeout: 60_000 }, () => {
  it("refuses product code that imports the harness or names the official model", async () => {
    for (const filePath of [
      "apps/web/src/guard-probe.ts",
      "packages/brick-kernel/src/guard-probe.ts",
    ]) {
      expect(await guardMessages(filePath, IMPORTS_ANSWER_KEY)).toEqual([
        expect.stringMatching(/must not import the booklet harness/u),
      ]);
      expect(await guardMessages(filePath, DYNAMIC_IMPORT)).toEqual([
        expect.stringMatching(/must not import the booklet harness/u),
      ]);
      expect(await guardMessages(filePath, READS_OFFICIAL_MODEL)).toEqual([
        expect.stringMatching(/must not read output\/official-model/u),
      ]);
      expect(await guardMessages(filePath, TEMPLATE_PATH)).toEqual([
        expect.stringMatching(/must not read output\/official-model/u),
      ]);
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
      expect(await guardMessages(filePath, READS_OFFICIAL_MODEL)).toEqual([]);
    }
  });
});

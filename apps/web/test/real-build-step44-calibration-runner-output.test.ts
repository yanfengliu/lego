import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const instrument = vi.hoisted(() => ({ afterMkdir: vi.fn(), creations: [] as string[] }));
vi.mock("node:crypto", async (original) => ({
  ...(await original<typeof import("node:crypto")>()),
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => {
      const result = actual.mkdirSync(...args);
      instrument.creations.push(String(args[0]));
      instrument.afterMkdir(String(args[0]));
      return result;
    },
  };
});

const OWNER = "LEGO_REAL_BUILD_STEP44_RUNNER_OWNER";
const RUN = "11111111-1111-4111-8111-111111111111";
const REPOSITORY = resolve(".");
const EVIDENCE = resolve("output/step44-calibration-runner-output-20260905/unit-fixtures");
const CLI = resolve("node_modules/@playwright/test/cli.js");
const savedArgv = process.argv;
const temporaryRoots: string[] = [];
let repositoryRoot: string;

beforeEach(() => {
  vi.resetModules();
  instrument.afterMkdir.mockReset();
  instrument.creations.length = 0;
  for (const key of [
    OWNER,
    "PW_TEST_REPORTER",
    "PLAYWRIGHT_LAST_RUN_OUTPUT_FILE",
    "PWTEST_WATCH",
    "TEST_WORKER_INDEX",
    "TEST_PARALLEL_INDEX",
  ])
    vi.stubEnv(key, undefined);
  // Bound: units substitute argv and the UUID only. Filesystem calls execute against real
  // owned directories. Actual installed CLI/IPC worker behavior has a separate integration gate.
  process.argv = [process.execPath, CLI, "test"];
  mkdirSync(EVIDENCE, { recursive: true });
  repositoryRoot = mkdtempSync(join(EVIDENCE, "case-"));
  temporaryRoots.push(repositoryRoot);
});
afterEach(() => {
  instrument.afterMkdir.mockReset();
  process.argv = savedArgv;
  vi.unstubAllEnvs();
  for (const path of temporaryRoots.splice(0)) {
    if (dirname(resolve(path)) !== EVIDENCE)
      throw new Error("Refusing cleanup outside owned unit parent.");
    rmSync(path, { recursive: true, force: false });
  }
});
async function helper() {
  return import("../e2e/real-build-step44-calibration-runner-output.ts");
}
function base(): string {
  return join(repositoryRoot, "output/playwright/step44-calibration-runs");
}
function parent(): string {
  return join(base(), RUN);
}
function marker(): string {
  return join(parent(), "owner.json");
}
async function prepared() {
  const api = await helper();
  const outputDir = api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot);
  return { api, outputDir };
}

describe("Step-44 runner output ownership over real synthetic directories", () => {
  it("prepares twice in one process with exactly one claim and preserves marker bytes", async () => {
    const { api, outputDir } = await prepared();
    const before = readFileSync(marker());
    expect(outputDir).toBe(join(parent(), "playwright"));
    expect(existsSync(outputDir)).toBe(false);
    expect(api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toBe(outputDir);
    expect(instrument.creations.filter((path) => path === parent())).toHaveLength(1);
    expect(readFileSync(marker())).toEqual(before);
    expect(readdirSync(parent())).toEqual(["owner.json"]);
  });

  it("accepts normal absent and recreated disposable output directories", async () => {
    const { api, outputDir } = await prepared();
    const raw = { outputDir, reporter: "list" };
    api.assertRealBuildStep44CalibrationRawConfig(raw);
    api.assertRealBuildStep44CalibrationRawConfig({ ...raw, projects: [{}] });
    api.assertRealBuildStep44CalibrationRawConfig({ ...raw, projects: [{ outputDir }] });
    api.assertRealBuildStep44CalibrationResolvedConfig({
      projects: [{ outputDir }],
      reporter: [["list"]],
    });
    const testInfo = { project: { outputDir }, outputDir: join(outputDir, "case/attachment") };
    api.assertRealBuildStep44CalibrationTestOutput(testInfo);
    mkdirSync(testInfo.outputDir, { recursive: true });
    api.assertRealBuildStep44CalibrationTestOutput(testInfo);
    rmSync(outputDir, { recursive: true });
    mkdirSync(testInfo.outputDir, { recursive: true });
    api.assertRealBuildStep44CalibrationTestOutput(testInfo);
  });

  it.each([
    "--output",
    "--reporter",
    "--last-failed-file",
    "--ui",
    "--ui-host",
    "--ui-port",
    "--list",
  ])("refuses %s before creating output in both CLI spellings", async (flag) => {
    const api = await helper();
    for (const args of [[flag, "ignored"], [`${flag}=ignored`]]) {
      process.argv = [process.execPath, CLI, "test", ...args];
      expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(
        /does not allow/u,
      );
      expect(existsSync(join(repositoryRoot, "output"))).toBe(false);
    }
  });

  it.each(["PW_TEST_REPORTER", "PLAYWRIGHT_LAST_RUN_OUTPUT_FILE", "PWTEST_WATCH"])(
    "refuses even an empty %s before creating output",
    async (name) => {
      vi.stubEnv(name, "");
      const api = await helper();
      expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(name);
      expect(existsSync(join(repositoryRoot, "output"))).toBe(false);
    },
  );

  it("refuses programmatic entry and changed live invocation settings", async () => {
    const api = await helper();
    process.argv = [process.execPath, resolve("node_modules/vitest/vitest.mjs")];
    expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(
      /normal CLI/u,
    );
    expect(existsSync(base())).toBe(false);
    process.argv = [process.execPath, CLI, "test"];
    const outputDir = api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot);
    process.argv.push("--workers=2");
    expect(() =>
      api.assertRealBuildStep44CalibrationRawConfig({ outputDir, reporter: "list" }),
    ).toThrow(/settings/u);
  });

  it("refuses stale environment after loss of private live memory", async () => {
    await prepared();
    const bytes = readFileSync(marker());
    vi.resetModules();
    const api = await helper();
    expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(
      /cannot adopt inherited/u,
    );
    expect(readFileSync(marker())).toEqual(bytes);
    expect(instrument.creations.filter((path) => path === parent())).toHaveLength(1);
  });

  it.each(["empty directory", "nonempty directory", "file", "dangling junction"])(
    "never reclaims an existing %s destination",
    async (kind) => {
      mkdirSync(base(), { recursive: true });
      if (kind === "file") writeFileSync(parent(), "retain", { flag: "wx" });
      else if (kind === "dangling junction")
        symlinkSync(join(repositoryRoot, "missing"), parent(), "junction");
      else {
        mkdirSync(parent());
        if (kind === "nonempty directory") writeFileSync(join(parent(), "sentinel"), "retain");
      }
      const api = await helper();
      expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(
        /never reclaimed/u,
      );
      if (kind === "nonempty directory")
        expect(readFileSync(join(parent(), "sentinel"), "utf8")).toBe("retain");
    },
  );

  it("checks initial emptiness after successful exclusive creation", async () => {
    instrument.afterMkdir.mockImplementation((path: string) => {
      if (path === parent()) writeFileSync(join(path, "unexpected"), "retain");
    });
    const api = await helper();
    expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(
      /must be empty/u,
    );
    expect(existsSync(marker())).toBe(false);
    expect(readFileSync(join(parent(), "unexpected"), "utf8")).toBe("retain");
  });

  it("rechecks the existing base identity immediately after child creation", async () => {
    instrument.afterMkdir.mockImplementation((path: string) => {
      if (path !== parent()) return;
      instrument.afterMkdir.mockReset();
      renameSync(base(), `${base()}-retained`);
      mkdirSync(base());
    });
    const api = await helper();
    expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot)).toThrow(
      /directory identity changed/u,
    );
    expect(existsSync(marker())).toBe(false);
  });

  it.for(["missing", "replaced", "changed bytes", "hard link", "symlink"])(
    "refuses a %s owner file",
    async (kind, context) => {
      const { api, outputDir } = await prepared();
      const retained = join(parent(), "retained-owner.json");
      const bytes = readFileSync(marker());
      if (kind === "changed bytes") writeFileSync(marker(), "changed");
      else if (kind === "hard link") linkSync(marker(), retained);
      else {
        renameSync(marker(), retained);
        if (kind === "replaced") writeFileSync(marker(), bytes, { flag: "wx" });
        if (kind === "symlink") {
          try {
            symlinkSync(retained, marker(), "file");
          } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "EPERM")
              context.skip(
                "Unavailable: this Windows runner denies file-symlink creation (EPERM).",
              );
            throw error;
          }
        }
      }
      expect(() =>
        api.assertRealBuildStep44CalibrationRawConfig({ outputDir, reporter: "list" }),
      ).toThrow();
    },
  );

  it("refuses a renamed/replaced parent despite identical copied marker bytes", async () => {
    const { api, outputDir } = await prepared();
    const bytes = readFileSync(marker());
    renameSync(parent(), `${parent()}-retained`);
    mkdirSync(parent());
    writeFileSync(marker(), bytes);
    expect(() =>
      api.assertRealBuildStep44CalibrationRawConfig({ outputDir, reporter: "list" }),
    ).toThrow(/directory identity changed/u);
  });

  it.each(["real junction", "dangling junction", "file"])(
    "refuses an existing %s in the prospective per-test path",
    async (kind) => {
      const { api, outputDir } = await prepared();
      mkdirSync(outputDir);
      const ancestor = join(outputDir, "case");
      const target = join(repositoryRoot, "unrelated");
      if (kind === "file") writeFileSync(ancestor, "retain");
      else {
        if (kind === "real junction") mkdirSync(target);
        symlinkSync(target, ancestor, "junction");
      }
      expect(() =>
        api.assertRealBuildStep44CalibrationTestOutput({
          project: { outputDir },
          outputDir: join(ancestor, "child"),
        }),
      ).toThrow();
    },
  );

  it("refuses project, raw, resolved, reporter and test-output drift independently", async () => {
    const { api, outputDir } = await prepared();
    const raw = { outputDir, reporter: "list" };
    expect(() =>
      api.assertRealBuildStep44CalibrationRawConfig({
        ...raw,
        outputDir: "test-results/playwright",
      }),
    ).toThrow(/outputDir/u);
    expect(() => api.assertRealBuildStep44CalibrationRawConfig({ ...raw, projects: [] })).toThrow(
      /one project/u,
    );
    expect(() =>
      api.assertRealBuildStep44CalibrationRawConfig({
        ...raw,
        projects: [{ outputDir: repositoryRoot }],
      }),
    ).toThrow(/outputDir/u);
    expect(() =>
      api.assertRealBuildStep44CalibrationRawConfig({ ...raw, reporter: "json" }),
    ).toThrow(/reporter/u);
    expect(() =>
      api.assertRealBuildStep44CalibrationResolvedConfig({
        projects: [{ outputDir: repositoryRoot }],
        reporter: [["list"]],
      }),
    ).toThrow(/outputDir/u);
    expect(() =>
      api.assertRealBuildStep44CalibrationResolvedConfig({
        projects: [{ outputDir }],
        reporter: [["list"], ["json"]],
      }),
    ).toThrow(/reporter/u);
    expect(() =>
      api.assertRealBuildStep44CalibrationTestOutput({
        project: { outputDir: repositoryRoot },
        outputDir: join(outputDir, "case"),
      }),
    ).toThrow(/outputDir/u);
    for (const path of [outputDir, repositoryRoot, join(parent(), "sibling"), "relative"])
      expect(() =>
        api.assertRealBuildStep44CalibrationTestOutput({ project: { outputDir }, outputDir: path }),
      ).toThrow(/descendant/u);
  });

  it("requires live preparation for every assertion and rejects a repository switch", async () => {
    const api = await helper();
    expect(() => api.assertRealBuildStep44CalibrationRawConfig({})).toThrow(/no live preparation/u);
    await prepared();
    expect(() => api.prepareRealBuildStep44CalibrationRunnerOutput(REPOSITORY)).toThrow(
      /switch repositories/u,
    );
    vi.stubEnv(OWNER, "{}");
    expect(() => api.assertRealBuildStep44CalibrationRawConfig({})).toThrow(/coordinates changed/u);
  });
});

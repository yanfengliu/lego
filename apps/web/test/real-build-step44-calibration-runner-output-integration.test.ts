import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// harness: explicit Vitest -> installed Playwright CLI -> synthetic config/spec only.
// Bound: trusted Node callbacks, one browserless worker, owned synthetic files and real
// runner writers. This does not run source bootstrap or prove screenshot/OS isolation.
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(import.meta.url);
const cli = require.resolve("@playwright/test/cli");
const alternateCli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
const helper = resolve(repository, "apps/web/e2e/real-build-step44-calibration-runner-output.ts");
const factory = pathToFileURL(
  resolve(repository, "apps/web/e2e/playwright-config-support.ts"),
).href;
const ownerEnv = "LEGO_REAL_BUILD_STEP44_RUNNER_OWNER";
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const quoted = (value: string) => JSON.stringify(value);
const receipts: Record<string, unknown>[] = [];
let evidence: string;
let helperBaseline: string;
let helperSource: string;

type Event = {
  event: string;
  pid: number;
  ppid?: number;
  childPid?: number;
  path?: string;
  output?: string;
  owner?: string;
  index?: string;
  call?: number;
  error?: string;
  code?: number;
  ownerBytes?: string;
  options?: { flag?: string };
  attachments?: { name: string; path?: string; contentType: string }[];
};
type Fixture = { root: string; config: string; log: string; shared: string; helperPath: string };
type Result = {
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  pid: number;
};

function write(path: string, value: string) {
  writeFileSync(path, value, { flag: "wx" });
}

function events(fixture: Fixture): Event[] {
  if (!existsSync(fixture.log)) return [];
  return readFileSync(fixture.log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

function inside(parent: string, path: string) {
  const suffix = relative(parent, path);
  return suffix !== "" && !suffix.startsWith(`..${sep}`) && suffix !== ".." && !isAbsolute(suffix);
}

function files(parent: string): string[] {
  return readdirSync(parent).flatMap((name) => {
    const path = join(parent, name);
    const stat = lstatSync(path);
    expect(stat.isSymbolicLink()).toBe(false);
    return stat.isDirectory() ? files(path) : [path];
  });
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error; // EPERM or unavailable observation is not proof of absence.
  }
}

function cleanEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (
      name.startsWith("LEGO_REAL_BUILD") ||
      [
        "PW_TEST_REPORTER",
        "PLAYWRIGHT_LAST_RUN_OUTPUT_FILE",
        "PWTEST_WATCH",
        "TEST_WORKER_INDEX",
        "TEST_PARALLEL_INDEX",
      ].includes(name)
    )
      delete environment[name];
  }
  return { ...environment, ...extra };
}

async function run(
  fixture: Fixture,
  args: string[] = [],
  environment: NodeJS.ProcessEnv = {},
  entry = cli,
): Promise<Result> {
  const child = spawn(process.execPath, [entry, "test", "--config", fixture.config, ...args], {
    cwd: fixture.root,
    env: cleanEnvironment(environment),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!child.pid) throw new Error("Synthetic CLI did not supply an owned PID.");
  const pid = child.pid;
  let stdout = "",
    stderr = "",
    timedOut = false;
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 25_000);
  let result: Result | undefined;
  try {
    result = await new Promise<Result>((resolveResult, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolveResult({ code, signal, stdout, stderr, pid }));
    });
    const prefix = join(fixture.root, `cli-${pid}`);
    write(`${prefix}.stdout.txt`, stdout);
    write(`${prefix}.stderr.txt`, stderr);
    expect(timedOut, `CLI ${pid} exceeded its owned 25-second bound`).toBe(false);
    return result;
  } finally {
    clearTimeout(timer);
    const observed = events(fixture).filter((event) => event.pid === pid || event.ppid === pid);
    const pids = new Set([
      pid,
      ...observed.flatMap((event) => [event.pid, ...(event.childPid ? [event.childPid] : [])]),
    ]);
    const remaining = [...pids].filter(alive);
    const signalErrors: { pid: number; error: string }[] = [];
    for (const remainingPid of remaining) {
      try {
        process.kill(remainingPid);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH")
          signalErrors.push({ pid: remainingPid, error: String(error) });
      }
    }
    let afterCleanup = [...pids].filter(alive);
    for (let attempt = 0; afterCleanup.length > 0 && attempt < 20; attempt++) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      afterCleanup = [...pids].filter(alive);
    }
    receipts.push({
      fixture: fixture.root,
      entry: realpathSync(entry),
      pid,
      close: result ? { code: result.code, signal: result.signal } : null,
      timedOut,
      observedPids: [...pids],
      aliveAfterClose: remaining,
      aliveAfterFinally: afterCleanup,
      signalErrors,
    });
    expect(signalErrors, "Failures to signal recorded owned PIDs must remain visible").toEqual([]);
    expect(afterCleanup, "Finally cleanup must close every observed owned PID").toEqual([]);
    expect(remaining, "Every observed task-owned PID must be gone after CLI close").toEqual([]);
  }
}

const observerSource = `const fs = require('node:fs');
const cp = require('node:child_process');
const {syncBuiltinESMExports} = require('node:module');
const path = require('node:path');
const logPath = process.env.SYNTHETIC_EVENT_LOG;
const base = path.join(process.env.SYNTHETIC_ROOT, 'output/playwright/step44-calibration-runs');
const append = fs.appendFileSync.bind(fs);
const log = (row) => append(logPath, JSON.stringify({...row,pid:process.pid,ppid:process.ppid})+'\\n');
for (const name of ['mkdirSync','writeFileSync']) {
  const original = fs[name];
  fs[name] = function(...args) {
    const result = Reflect.apply(original, this, args);
    const target = String(args[0]);
    if (target.startsWith(base + path.sep)) log({event:name,path:target,options:args[name==='mkdirSync'?1:2]});
    return result;
  };
}
for (const name of ['spawn','fork']) {
  const original = cp[name];
  cp[name] = function(...args) {
    const child = Reflect.apply(original, this, args);
    log({event:name,childPid:child.pid,entry:args[0]});
    child.once('exit',(code,signal)=>log({event:'child-exit',childPid:child.pid,code,signal}));
    child.once('close',(code,signal)=>log({event:'child-close',childPid:child.pid,code,signal}));
    return child;
  };
}
syncBuiltinESMExports();
log({event:'config-enter',index:process.env.TEST_WORKER_INDEX});
module.exports = {log};
`;

function fixture(options: { helperSource?: string; sharedOutput?: boolean } = {}): Fixture {
  const root = mkdtempSync(join(evidence, "case-"));
  const log = join(root, "events.jsonl");
  const shared = join(root, "shared");
  mkdirSync(shared);
  write(join(shared, "sentinel.txt"), "must survive every refused invocation\n");
  write(join(shared, "last-run.json"), "unchanged last-run sentinel\n");
  const helperPath = options.helperSource === undefined ? helper : join(root, "isolated-helper.ts");
  if (options.helperSource !== undefined) write(helperPath, options.helperSource);
  write(join(root, "observer.cjs"), observerSource);
  write(join(root, "source-attachment.txt"), "inert synthetic attachment bytes\n");
  write(
    join(root, "reporter.cjs"),
    `require('node:fs').writeFileSync(${quoted(join(root, "reporter-entered"))},'unexpected reporter entry'); module.exports=class { printsToStdio(){return true;} };\n`,
  );
  const config = join(root, "synthetic.config.mjs");
  write(
    config,
    `import observer from './observer.cjs';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname} from 'node:path';
const {log} = observer;
const api = await import(${quoted(pathToFileURL(helperPath).href)});
let output;
for (let call=1;call<=2;call++) {
  log({event:'prepare-before',call});
  try {
    output=api.prepareRealBuildStep44CalibrationRunnerOutput(${quoted(root)});
    log({event:'prepare-after',call,output,owner:process.env.${ownerEnv},ownerBytes:readFileSync(dirname(output)+'/owner.json','utf8')});
  } catch(error) { log({event:'prepare-refused',call,error:error.message}); throw error; }
}
log({event:'parent-roster',files:readdirSync(dirname(output)),ownerBytes:readFileSync(dirname(output)+'/owner.json','utf8')});
if(process.env.SYNTHETIC_NESTED==='1' && !process.env.TEST_WORKER_INDEX) {
  const {spawn}=await import('node:child_process');
  const child=spawn(process.execPath,[${quoted(cli)},'test','--config',${quoted(config)}],{cwd:${quoted(root)},env:{...process.env,SYNTHETIC_NESTED:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr=''; child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  const timer=setTimeout(()=>child.kill(),10000);
  try { await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{log({event:'nested-result',childPid:child.pid,code,signal,stdout,stderr});resolve();});}); }
  finally {clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null)child.kill();}
}
const {createRealBuildPlaywrightConfig}=await import(${quoted(factory)});
const raw=createRealBuildPlaywrightConfig({port:5267,operation:{mode:'real-domain-calibration',testMatch:'real-build-prefix50-step44-real-domain-calibration.spec.ts'},calibrationOutputDir:output});
const {globalSetup,globalTeardown,...safe}=raw;
const config={...safe,globalSetup:${quoted(join(root, "synthetic-setup.mjs"))},testDir:${quoted(root)},testMatch:'synthetic.spec.ts',preserveOutput:'always',use:{trace:{mode:'on',sources:false},screenshot:'off'},${options.sharedOutput ? `outputDir:${quoted(shared)},` : ""}};
api.assertRealBuildStep44CalibrationRawConfig(config);
log({event:'source-entry',output:config.outputDir,setup:config.globalSetup,teardownPresent:'globalTeardown' in config});
export default config;
`,
  );
  write(
    join(root, "synthetic-setup.mjs"),
    `import observer from './observer.cjs';
import {assertRealBuildStep44CalibrationResolvedConfig} from ${quoted(pathToFileURL(helperPath).href)};
export default function(config){assertRealBuildStep44CalibrationResolvedConfig(config);observer.log({event:'resolved-setup'});}\n`,
  );
  write(
    join(root, "synthetic.spec.ts"),
    `import {test} from '@playwright/test';
import {appendFileSync,readFileSync} from 'node:fs';
import {assertRealBuildStep44CalibrationTestOutput} from ${quoted(pathToFileURL(helperPath).href)};
test('explicit synthetic attachment and unexpected failure',async({},info)=>{
  assertRealBuildStep44CalibrationTestOutput(info);
  await info.attach('inert-source',{path:${quoted(join(root, "source-attachment.txt"))}});
  assertRealBuildStep44CalibrationTestOutput(info);
  if(readFileSync(info.attachments[0].path,'utf8')!=='inert synthetic attachment bytes\\n')throw new Error('Attachment bytes changed');
  process.once('exit',()=>appendFileSync(${quoted(log)},JSON.stringify({event:'artifacts',pid:process.pid,ppid:process.ppid,output:info.outputDir,attachments:info.attachments})+'\\n'));
  throw new Error('EXPECTED_SYNTHETIC_RUNNER_FAILURE');
});
`,
  );
  receipts.push({
    fixture: root,
    helper: helperPath,
    helperSha256: sha(readFileSync(helperPath)),
    observerSha256: sha(observerSource),
    configSha256: sha(readFileSync(config)),
    specSha256: sha(readFileSync(join(root, "synthetic.spec.ts"))),
    syntheticOnly: true,
  });
  return { root, config, log, shared, helperPath };
}

function environment(fixture: Fixture, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { SYNTHETIC_ROOT: fixture.root, SYNTHETIC_EVENT_LOG: fixture.log, ...extra };
}

function refuse(fixture: Fixture, result: Result, cause: string) {
  expect(result.code).toBe(1);
  expect(result.stdout + result.stderr).toContain(cause);
  expect(events(fixture).some((event) => event.event === "prepare-refused")).toBe(true);
  expect(events(fixture).filter((event) => event.event === "source-entry")).toEqual([]);
  expect(events(fixture).filter((event) => event.event === "mkdirSync")).toEqual([]);
  expect(readFileSync(join(fixture.shared, "sentinel.txt"), "utf8")).toBe(
    "must survive every refused invocation\n",
  );
  expect(readFileSync(join(fixture.shared, "last-run.json"), "utf8")).toBe(
    "unchanged last-run sentinel\n",
  );
  expect(existsSync(join(fixture.root, "reporter-entered"))).toBe(false);
}

async function overrideRun(subject: Fixture, kind: string) {
  const option = kind.startsWith("output")
    ? "--output"
    : kind.startsWith("reporter")
      ? "--reporter"
      : "--last-failed-file";
  const value = kind.startsWith("output")
    ? subject.shared
    : kind.startsWith("reporter")
      ? join(subject.root, "reporter.cjs")
      : join(subject.shared, "last-run.json");
  const variable = kind === "reporter-env" ? "PW_TEST_REPORTER" : "PLAYWRIGHT_LAST_RUN_OUTPUT_FILE";
  const args = kind.endsWith("env")
    ? []
    : kind.endsWith("equals")
      ? [`${option}=${value}`]
      : [option, value];
  const cause = `does not allow ${kind.endsWith("env") ? variable : option}`;
  const result = await run(
    subject,
    args,
    environment(subject, kind.endsWith("env") ? { [variable]: value } : {}),
  );
  return { result, cause };
}

function verifyRun(fixture: Fixture, result: Result) {
  expect(result.code).toBe(1);
  expect(result.stdout + result.stderr).toContain("EXPECTED_SYNTHETIC_RUNNER_FAILURE");
  const rows = events(fixture);
  const rootPrepares = rows.filter(
    (row) => row.pid === result.pid && row.event === "prepare-after",
  );
  expect(rootPrepares.map((row) => row.call)).toEqual([1, 2]);
  const output = rootPrepares[0]!.output!;
  expect(rootPrepares[1]!.output).toBe(output);
  expect(rootPrepares[1]!.owner).toBe(rootPrepares[0]!.owner);
  expect(rootPrepares[1]!.ownerBytes).toBe(rootPrepares[0]!.ownerBytes);
  const parent = dirname(output);
  expect(
    rows
      .filter(
        (row) =>
          row.pid === result.pid &&
          row.event === "mkdirSync" &&
          dirname(row.path!) === dirname(parent),
      )
      .map((row) => row.path),
  ).toEqual([parent]);
  const ownerWrites = rows.filter(
    (row) =>
      row.pid === result.pid &&
      row.event === "writeFileSync" &&
      row.path === join(parent, "owner.json"),
  );
  expect(ownerWrites).toHaveLength(1);
  expect(ownerWrites[0]!.options?.flag).toBe("wx");
  expect(
    rows.filter((row) => row.pid === result.pid && row.event === "resolved-setup"),
  ).toHaveLength(1);
  const worker = rows.filter(
    (row) => row.ppid === result.pid && row.event === "config-enter" && row.index !== undefined,
  );
  expect(worker).toHaveLength(1);
  const workerPid = worker[0]!.pid;
  expect(
    rows
      .filter((row) => row.pid === workerPid && row.event === "prepare-after")
      .map((row) => row.output),
  ).toEqual([output, output]);
  expect(
    rows.filter((row) => row.pid === workerPid && row.event === "mkdirSync" && row.path === parent),
  ).toEqual([]);
  expect(rows.some((row) => row.event === "child-exit" && row.childPid === workerPid)).toBe(true);
  const artifacts = rows.find((row) => row.event === "artifacts" && row.pid === workerPid)!;
  expect(artifacts).toBeDefined();
  expect(inside(output, artifacts.output!)).toBe(true);
  const attachment = artifacts.attachments!.find((row) => row.name === "inert-source")!;
  const trace = artifacts.attachments!.find((row) => row.name === "trace")!;
  expect(attachment).toBeDefined();
  expect(trace).toBeDefined();
  expect(readFileSync(attachment.path!, "utf8")).toBe("inert synthetic attachment bytes\n");
  expect(trace.contentType).toBe("application/zip");
  expect(readFileSync(trace.path!).subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(lstatSync(trace.path!).size).toBeGreaterThan(100);
  for (const item of artifacts.attachments!)
    expect(inside(output, realpathSync(item.path!))).toBe(true);
  const lastRun = JSON.parse(readFileSync(join(output, ".last-run.json"), "utf8")) as {
    status: string;
    failedTests: string[];
  };
  expect(lastRun.status).toBe("failed");
  expect(lastRun.failedTests).toHaveLength(1);
  const roster = files(output).map((path) => ({
    path,
    bytes: lstatSync(path).size,
    sha256: sha(readFileSync(path)),
  }));
  expect(roster.every((row) => inside(output, realpathSync(row.path)))).toBe(true);
  receipts.push({
    verifiedRun: result.pid,
    workerPid,
    output,
    parent,
    parentInode: lstatSync(parent, { bigint: true }).ino.toString(),
    roster,
  });
  return { output, parent, owner: rootPrepares[0]!.owner! };
}

beforeAll(() => {
  const base = resolve(repository, "output/step44-calibration-runner-output-20260905");
  mkdirSync(base, { recursive: true });
  const requested = process.env.LEGO_STEP44_RUNNER_TEST_EVIDENCE;
  const parent = requested ? resolve(requested) : base;
  if (parent !== base && !inside(base, parent))
    throw new Error("Synthetic evidence must stay under the task-owned output base.");
  mkdirSync(parent, { recursive: true });
  evidence = mkdtempSync(join(parent, "integration-"));
  helperSource = readFileSync(helper, "utf8");
  helperBaseline = sha(helperSource);
  write(join(evidence, "helper-baseline.ts"), helperSource);
  write(
    join(evidence, "harness.txt"),
    "Actual installed CLI with explicit synthetic config/spec; no production setup, source bootstrap, browser, server, protected payload or screenshots. Retain bounded evidence for independent review.\n",
  );
});

afterAll(() => {
  if (!evidence) return;
  write(
    join(evidence, "receipts.json"),
    JSON.stringify(
      { helperBefore: helperBaseline, helperAfter: sha(readFileSync(helper)), receipts },
      null,
      2,
    ),
  );
  expect(sha(readFileSync(helper))).toBe(helperBaseline);
});

describe("Step-44 runner ownership through the installed browserless CLI", () => {
  it("reuses one live root claim and its real worker, separates runs, and refuses inherited CLI adoption", async () => {
    const subject = fixture();
    const firstResult = await run(subject, [], environment(subject, { SYNTHETIC_NESTED: "1" }));
    const first = verifyRun(subject, firstResult);
    const nested = events(subject).filter((row) => row.event === "nested-result");
    expect(nested).toHaveLength(1);
    expect(nested[0]!.code).toBe(1);
    expect(
      events(subject).some(
        (row) =>
          row.pid === nested[0]!.childPid &&
          row.ppid === firstResult.pid &&
          row.event === "prepare-refused" &&
          row.error?.includes("CLI cannot adopt inherited ownership"),
      ),
    ).toBe(true);
    write(join(first.output, "first-run-sentinel.txt"), "first run retained\n");
    const second = verifyRun(subject, await run(subject, [], environment(subject), alternateCli));
    expect(second.parent).not.toBe(first.parent);
    expect(readFileSync(join(first.output, "first-run-sentinel.txt"), "utf8")).toBe(
      "first run retained\n",
    );
    const stale = fixture();
    refuse(
      stale,
      await run(stale, [], environment(stale, { [ownerEnv]: first.owner })),
      "CLI cannot adopt inherited ownership",
    );
  }, 90_000);

  it.each([
    "output-space",
    "output-equals",
    "reporter-space",
    "reporter-equals",
    "last-space",
    "last-equals",
    "reporter-env",
    "last-env",
  ])(
    "refuses %s before marker, reporter or shared-output writers",
    async (kind) => {
      const subject = fixture();
      const { result, cause } = await overrideRun(subject, kind);
      refuse(subject, result, cause);
    },
    35_000,
  );

  it("rejects an independently injected shared raw output before the synthetic source marker", async () => {
    const subject = fixture({ sharedOutput: true });
    const result = await run(subject, [], environment(subject));
    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).toContain("must equal the owned child");
    expect(() => verifyRun(subject, result)).toThrow();
    expect(events(subject).filter((row) => row.event === "prepare-after")).toHaveLength(2);
    expect(events(subject).filter((row) => row.event === "source-entry")).toEqual([]);
    expect(readFileSync(join(subject.shared, "sentinel.txt"), "utf8")).toBe(
      "must survive every refused invocation\n",
    );
    receipts.push({
      mutation: "synthetic raw output assigned shared path",
      fixture: subject.root,
      positiveOracleRejected: true,
      sourceEntered: false,
      sharedSentinelPreserved: true,
    });
  }, 35_000);

  it.each([
    ["output-space", "(?:output|", "(?:"],
    ["reporter-space", "output|reporter|", "output|"],
    ["last-space", "reporter|last-failed-file|", "reporter|"],
    ["reporter-env", '"PW_TEST_REPORTER", ', ""],
    ["last-env", '"PLAYWRIGHT_LAST_RUN_OUTPUT_FILE", ', ""],
  ])(
    "makes the same refusal oracle red when only %s guarding is removed in an isolated copy",
    async (kind, before, after) => {
      expect(sha(readFileSync(helper))).toBe(helperBaseline);
      expect(helperSource.split(before)).toHaveLength(2);
      const baseline = fixture();
      const control = await overrideRun(baseline, kind);
      refuse(baseline, control.result, control.cause);
      const mutantSource = helperSource.replace(before, after);
      const subject = fixture({ helperSource: mutantSource });
      const { result, cause } = await overrideRun(subject, kind);
      let oracleError: unknown;
      try {
        refuse(subject, result, cause);
      } catch (error) {
        oracleError = error;
      }
      expect(oracleError).toBeInstanceOf(Error);
      expect(events(subject).some((row) => row.event === "source-entry")).toBe(true);
      const effect = kind.startsWith("output")
        ? !existsSync(join(subject.shared, "sentinel.txt"))
        : kind.startsWith("reporter")
          ? existsSync(join(subject.root, "reporter-entered"))
          : readFileSync(join(subject.shared, "last-run.json"), "utf8") !==
            "unchanged last-run sentinel\n";
      expect(
        effect,
        "The removed guard must expose the actual deletion, reporter or last-run writer",
      ).toBe(true);
      receipts.push({
        mutation: kind,
        fixture: subject.root,
        baselineSha256: helperBaseline,
        mutantSha256: sha(mutantSource),
        exactReplacement: { before, after },
        oracleError: String(oracleError),
        sourceEntered: true,
        writerEffectObserved: effect,
        sharedProductionBytesUnchanged: sha(readFileSync(helper)) === helperBaseline,
      });
    },
    60_000,
  );
});

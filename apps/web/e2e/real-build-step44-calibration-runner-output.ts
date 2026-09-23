import { randomUUID } from "node:crypto";
import {
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

// Bound: trusted normal installed CLI and its direct IPC workers. These observations do
// not authenticate same-user processes or close filesystem races between observations.
const OWNER_ENV = "LEGO_REAL_BUILD_STEP44_RUNNER_OWNER";
const SCHEMA = "lego-step44-playwright-output/1";
const LIMIT = 8192;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
type Identity = Readonly<{ path: string; dev: string; ino: string }>;
type FileIdentity = Identity & Readonly<{ size: string; mtime: string; ctime: string }>;
type RecordData = Readonly<{
  schema: typeof SCHEMA;
  repositoryRoot: string;
  rootPid: number;
  runId: string;
  directories: readonly Identity[];
  child: "playwright";
}>;
type Claim = Readonly<{
  record: RecordData;
  owner: FileIdentity;
  environment: string;
  fingerprint: string;
}>;
let live: Claim | undefined;

function refuse(detail: string): never {
  throw new TypeError(`Step-44 calibration runner output ${detail}`);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function samePath(left: string, right: string): boolean {
  const canonical = (path: string) =>
    process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
  return canonical(left) === canonical(right);
}
function identity(path: string, stat: BigIntStats): Identity {
  return { path, dev: String(stat.dev), ino: String(stat.ino) };
}
function sameIdentity(left: Identity, right: Identity): boolean {
  return samePath(left.path, right.path) && left.dev === right.dev && left.ino === right.ino;
}
function directory(path: string): Identity {
  const before = lstatSync(path, { bigint: true });
  const real = realpathSync(path);
  const after = lstatSync(path, { bigint: true });
  if (
    !isAbsolute(path) ||
    !samePath(path, real) ||
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    !sameIdentity(identity(path, before), identity(real, after))
  )
    refuse(`directory ${path} must be one stable real directory without links.`);
  return identity(path, after);
}
function assertDirectory(expected: Identity): void {
  if (!sameIdentity(expected, directory(expected.path)))
    refuse(`directory identity changed at ${expected.path}; retain the original run parent.`);
}
function fileIdentity(path: string, stat: BigIntStats): FileIdentity {
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n || stat.size > BigInt(LIMIT))
    refuse(`owner ${path} must be a bounded ordinary single-link file.`);
  return {
    ...identity(path, stat),
    size: String(stat.size),
    mtime: String(stat.mtimeNs),
    ctime: String(stat.ctimeNs),
  };
}
function readOwner(path: string, expectedBytes: string): FileIdentity {
  const before = fileIdentity(path, lstatSync(path, { bigint: true }));
  const fd = openSync(path, "r");
  try {
    const held = fileIdentity(path, fstatSync(fd, { bigint: true }));
    const bytes = Buffer.alloc(LIMIT + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, count);
      if (read === 0) break;
      count += read;
    }
    const after = fileIdentity(path, fstatSync(fd, { bigint: true }));
    const current = fileIdentity(path, lstatSync(path, { bigint: true }));
    if (
      !samePath(realpathSync(path), path) ||
      [held, after, current].some((value) => JSON.stringify(value) !== JSON.stringify(before)) ||
      count > LIMIT ||
      !bytes.subarray(0, count).equals(Buffer.from(expectedBytes))
    )
      refuse(`owner ${path} changed or has unexpected bytes; require the original owner file.`);
    return current;
  } finally {
    closeSync(fd);
  }
}
function paths(repositoryRoot: string, runId: string): string[] {
  const output = join(repositoryRoot, "output");
  const playwright = join(output, "playwright");
  const base = join(playwright, "step44-calibration-runs");
  return [repositoryRoot, output, playwright, base, join(base, runId)];
}
function ownerBytes(record: RecordData): string {
  return `${JSON.stringify(record)}\n`;
}
function coordinates(
  environment: string,
  repositoryRoot: string,
): {
  record: RecordData;
  owner: FileIdentity;
} {
  if (environment.length > LIMIT) refuse("owner environment exceeds its bounded schema.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(environment);
  } catch {
    refuse("owner environment is not JSON; only a direct worker may inherit a valid claim.");
  }
  if (!object(parsed) || !object(parsed.record) || !object(parsed.owner))
    refuse("owner environment must contain a record and file identity.");
  const record = parsed.record;
  if (
    record.schema !== SCHEMA ||
    record.repositoryRoot !== repositoryRoot ||
    !Number.isSafeInteger(record.rootPid) ||
    (record.rootPid as number) <= 0 ||
    typeof record.runId !== "string" ||
    !UUID.test(record.runId) ||
    record.child !== "playwright" ||
    !Array.isArray(record.directories) ||
    record.directories.length !== 5
  )
    refuse("owner record does not match the repository, run, or directory schema.");
  const expectedPaths = paths(repositoryRoot, record.runId);
  const directories = record.directories.map((item: unknown, index: number): Identity => {
    if (
      !object(item) ||
      item.path !== expectedPaths[index] ||
      typeof item.dev !== "string" ||
      typeof item.ino !== "string" ||
      !DECIMAL.test(item.dev) ||
      !DECIMAL.test(item.ino)
    )
      refuse("owner directory coordinates must match the fixed run-parent chain.");
    return { path: item.path as string, dev: item.dev, ino: item.ino };
  });
  const validated: RecordData = {
    schema: SCHEMA,
    repositoryRoot,
    rootPid: record.rootPid as number,
    runId: record.runId,
    directories,
    child: "playwright",
  };
  const owner = parsed.owner;
  const ownerPath = join(expectedPaths[4]!, "owner.json");
  if (
    owner.path !== ownerPath ||
    ["dev", "ino", "size", "mtime", "ctime"].some(
      (key) => typeof owner[key] !== "string" || !DECIMAL.test(owner[key] as string),
    )
  )
    refuse("owner file coordinates must identify the original bounded marker.");
  const validatedOwner: FileIdentity = {
    path: ownerPath,
    dev: owner.dev as string,
    ino: owner.ino as string,
    size: owner.size as string,
    mtime: owner.mtime as string,
    ctime: owner.ctime as string,
  };
  const result = { record: validated, owner: validatedOwner };
  if (JSON.stringify(result) !== environment) refuse("owner environment has noncanonical fields.");
  return result;
}
function observations(repositoryRoot: string): { role: "root" | "worker"; fingerprint: string } {
  for (const name of ["PW_TEST_REPORTER", "PLAYWRIGHT_LAST_RUN_OUTPUT_FILE", "PWTEST_WATCH"])
    if (process.env[name] !== undefined)
      refuse(`does not allow ${name}; use the fixed normal-CLI list reporter and output child.`);
  for (const argument of process.argv.slice(2))
    if (/^--(?:output|reporter|last-failed-file|ui|ui-host|ui-port|list)(?:=|$)/u.test(argument))
      refuse(`does not allow ${argument.split("=")[0]}; use the fixed normal-CLI configuration.`);
  const require = createRequire(join(repositoryRoot, "package.json"));
  const packageRoot = dirname(require.resolve("playwright/package.json"));
  const cli = [
    realpathSync(join(packageRoot, "cli.js")),
    realpathSync(join(dirname(require.resolve("@playwright/test/package.json")), "cli.js")),
  ];
  const worker = realpathSync(join(packageRoot, "lib/worker/workerProcessEntry.js"));
  const entry = process.argv[1] === undefined ? "" : realpathSync(process.argv[1]);
  let role: "root" | "worker";
  if (cli.some((path) => samePath(entry, path)) && process.argv[2] === "test") {
    if (
      process.env.TEST_WORKER_INDEX !== undefined ||
      process.env.TEST_PARALLEL_INDEX !== undefined
    )
      refuse("CLI entry must not carry worker indices; start a fresh normal CLI invocation.");
    role = "root";
  } else if (
    samePath(entry, worker) &&
    process.argv.length === 2 &&
    process.connected === true &&
    typeof process.send === "function" &&
    [process.env.TEST_WORKER_INDEX, process.env.TEST_PARALLEL_INDEX].every(
      (value) => value !== undefined && value.length <= 10 && DECIMAL.test(value),
    )
  ) {
    role = "worker";
  } else refuse("requires the installed normal CLI test entry or its direct connected worker.");
  return {
    role,
    fingerprint: JSON.stringify([
      repositoryRoot,
      role,
      process.pid,
      process.ppid,
      process.argv,
      process.env.TEST_WORKER_INDEX,
      process.env.TEST_PARALLEL_INDEX,
    ]),
  };
}
function assertClaim(claim: Claim): void {
  const observed = observations(claim.record.repositoryRoot);
  if (
    observed.fingerprint !== claim.fingerprint ||
    process.env[OWNER_ENV] !== claim.environment ||
    (observed.role === "root"
      ? process.pid !== claim.record.rootPid
      : process.pid === claim.record.rootPid || process.ppid !== claim.record.rootPid)
  )
    refuse(
      "invocation settings or owner coordinates changed; require the original live invocation.",
    );
  claim.record.directories.forEach(assertDirectory);
  if (
    JSON.stringify(readOwner(claim.owner.path, ownerBytes(claim.record))) !==
    JSON.stringify(claim.owner)
  )
    refuse(`owner identity changed at ${claim.owner.path}; require the original owner file.`);
  prospective(claim, child(claim));
}
function child(claim: Claim): string {
  return join(claim.record.directories[4]!.path, "playwright");
}
function prospective(claim: Claim, path: string): void {
  const parent = claim.record.directories[4]!.path;
  const rest = relative(parent, path);
  if (
    !isAbsolute(path) ||
    rest === "" ||
    rest.startsWith(`..${sep}`) ||
    rest === ".." ||
    isAbsolute(rest)
  )
    refuse(`path ${path} must stay below the owned run parent ${parent}.`);
  let current = parent;
  for (const segment of rest.split(sep)) {
    current = join(current, segment);
    try {
      lstatSync(current);
    } catch (error) {
      if (object(error) && error.code === "ENOENT") continue;
      throw error;
    }
    directory(current);
  }
}
function currentClaim(): Claim {
  if (live === undefined)
    refuse("has no live preparation; prepare this invocation before validation.");
  assertClaim(live);
  return live;
}

export function prepareRealBuildStep44CalibrationRunnerOutput(repositoryRoot: string): string {
  if (!isAbsolute(repositoryRoot)) refuse("repository root must be an absolute real directory.");
  const root = realpathSync(repositoryRoot);
  directory(repositoryRoot);
  const observed = observations(root);
  if (live !== undefined) {
    if (live.record.repositoryRoot !== root)
      refuse("cannot switch repositories within a live invocation.");
    assertClaim(live);
    return child(live);
  }
  const inherited = process.env[OWNER_ENV];
  if (observed.role === "worker") {
    if (inherited === undefined)
      refuse("worker has no inherited owner; workers may not create runs.");
    const parsed = coordinates(inherited, root);
    const candidate = { ...parsed, environment: inherited, fingerprint: observed.fingerprint };
    assertClaim(candidate);
    live = candidate;
    return child(candidate);
  }
  if (inherited !== undefined)
    refuse(
      "CLI cannot adopt inherited ownership without its live preparation; start a fresh invocation.",
    );
  const runId = randomUUID();
  const expectedPaths = paths(root, runId);
  const directories = [directory(root)];
  for (const path of expectedPaths.slice(1)) {
    assertDirectory(directories.at(-1)!);
    try {
      mkdirSync(path);
    } catch (error) {
      if (!object(error) || error.code !== "EEXIST" || path === expectedPaths[4])
        refuse(`cannot exclusively create ${path}; existing run destinations are never reclaimed.`);
    }
    assertDirectory(directories.at(-1)!);
    directories.push(directory(path));
  }
  const parent = directories[4]!;
  if (readdirSync(parent.path).length !== 0)
    refuse(`new run parent ${parent.path} must be empty before its owner marker is written.`);
  const record: RecordData = {
    schema: SCHEMA,
    repositoryRoot: root,
    rootPid: process.pid,
    runId,
    directories,
    child: "playwright",
  };
  const ownerPath = join(parent.path, "owner.json");
  directories.forEach(assertDirectory);
  writeFileSync(ownerPath, ownerBytes(record), { flag: "wx", mode: 0o600 });
  directories.forEach(assertDirectory);
  const owner = readOwner(ownerPath, ownerBytes(record));
  const environment = JSON.stringify({ record, owner });
  process.env[OWNER_ENV] = environment;
  const candidate = { record, owner, environment, fingerprint: observed.fingerprint };
  assertClaim(candidate);
  live = candidate;
  return child(candidate);
}

function listReporter(reporter: unknown): boolean {
  return (
    reporter === "list" ||
    (Array.isArray(reporter) &&
      reporter.length === 1 &&
      Array.isArray(reporter[0]) &&
      reporter[0][0] === "list" &&
      reporter[0].length <= 2 &&
      (reporter[0][1] === undefined ||
        (object(reporter[0][1]) && Object.keys(reporter[0][1]).length === 0)))
  );
}
function exactOutput(path: string | undefined, expected: string): void {
  if (typeof path !== "string" || !isAbsolute(path) || !samePath(path, expected))
    refuse(`outputDir ${String(path)} must equal the owned child ${expected}.`);
}
export function assertRealBuildStep44CalibrationRawConfig(config: {
  readonly outputDir?: string;
  readonly reporter?: unknown;
  readonly projects?: readonly { readonly outputDir?: string }[];
}): void {
  const claim = currentClaim();
  exactOutput(config.outputDir, child(claim));
  if (!listReporter(config.reporter))
    refuse("raw reporter must be exactly the fixed list reporter.");
  if (config.projects !== undefined) {
    if (config.projects.length !== 1) refuse("raw config must select exactly one project.");
    if (config.projects[0]!.outputDir !== undefined)
      exactOutput(config.projects[0]!.outputDir, child(claim));
  }
}
export function assertRealBuildStep44CalibrationResolvedConfig(config: {
  readonly projects: readonly { readonly outputDir: string }[];
  readonly reporter: readonly (readonly [string, unknown?])[];
}): void {
  const claim = currentClaim();
  if (config.projects.length !== 1) refuse("resolved config must select exactly one project.");
  exactOutput(config.projects[0]!.outputDir, child(claim));
  if (!listReporter(config.reporter))
    refuse("resolved reporter must be exactly the fixed list reporter.");
}
export function assertRealBuildStep44CalibrationTestOutput(testInfo: {
  readonly project: { readonly outputDir: string };
  readonly outputDir: string;
}): void {
  const claim = currentClaim();
  const expected = child(claim);
  exactOutput(testInfo.project.outputDir, expected);
  const rest = relative(expected, testInfo.outputDir);
  if (
    !isAbsolute(testInfo.outputDir) ||
    rest === "" ||
    rest === ".." ||
    rest.startsWith(`..${sep}`) ||
    isAbsolute(rest)
  )
    refuse(`test output ${testInfo.outputDir} must be a descendant of ${expected}.`);
  prospective(claim, testInfo.outputDir);
}

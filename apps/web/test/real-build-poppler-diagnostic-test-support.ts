import { createHash } from "node:crypto";
import { builtinModules, createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";

// harness: fixed synthetic Poppler cases, actual installed serializeError, and the
// accepted native-stack-aware walker. No publication, native execution or sources.
const require = createRequire(import.meta.url);
const fs = require("node:fs") as typeof import("node:fs");
const repository = fileURLToPath(new URL("../../../", import.meta.url));
type Loader = {
  _load: (request: string, parent: unknown, isMain?: boolean) => unknown;
  _resolveFilename: (request: string, parent: unknown, isMain?: boolean) => string;
};
const modules = require("node:module") as Loader;
const nativeStackGetter = Object.getOwnPropertyDescriptor(
  new Error("stack instrument identity"),
  "stack",
)?.get;
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export interface PopplerFileBoundary {
  roots: string[];
  reads: { operation: string; path: string }[];
  forbidden: string[];
  descriptors: Map<number, string>;
}

function deniedModule(object: object, name: string, deny: (name: string) => never) {
  const clone: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
    if (!("value" in descriptor)) {
      if (
        name === "fs" &&
        ["ReadStream", "WriteStream", "FileReadStream", "FileWriteStream"].includes(String(key))
      ) {
        clone[key] = function forbiddenStream() {
          return deny(`${name}.${String(key)}`);
        };
        continue;
      }
      Object.defineProperty(clone, key, {
        configurable: true,
        get: () => deny(`${name}.${String(key)}`),
      });
    } else {
      clone[key] =
        typeof descriptor.value === "function"
          ? function forbiddenOperation() {
              return deny(`${name}.${String(key)}`);
            }
          : descriptor.value;
    }
  }
  return clone;
}

export function guardedPopplerFilesystem(
  actual: typeof import("node:fs"),
  boundary: PopplerFileBoundary,
) {
  const canonical = (path: string) => resolve(path).toLowerCase();
  const prerequisites = [
    resolve(repository, "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-lock.ps1"),
    resolve(
      repository,
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-poppler-job-launcher.dll",
    ),
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ].map(canonical);
  function deny(name: string): never {
    boundary.forbidden.push(name);
    throw new Error(`Poppler diagnostic test forbids ${name}.`);
  }
  function allow(value: unknown, operation: string, write = false) {
    const path = typeof value === "number" ? boundary.descriptors.get(value) : value;
    if (typeof path !== "string") return deny(`${operation}: unregistered path or descriptor`);
    const normalized = canonical(path);
    const synthetic = boundary.roots.some(
      (root) => normalized === canonical(root) || normalized.startsWith(canonical(root) + sep),
    );
    if (!synthetic && (write || !prerequisites.includes(normalized)))
      return deny(`${operation}: ${path}`);
    if (!write) boundary.reads.push({ operation, path });
    return path;
  }
  const clone = deniedModule(actual, "fs", deny);
  Object.defineProperty(clone, "promises", {
    configurable: true,
    value: deniedModule(actual.promises, "fs.promises", deny),
  });
  if ("default" in clone)
    Object.defineProperty(clone, "default", { configurable: true, value: clone });
  const realpath = Object.assign(
    (...args: Parameters<typeof actual.realpathSync>) => {
      allow(args[0], "realpath");
      return actual.realpathSync(...args);
    },
    {
      native: (...args: Parameters<typeof actual.realpathSync.native>) => {
        allow(args[0], "realpath.native");
        return actual.realpathSync.native(...args);
      },
    },
  );
  Object.assign(clone, {
    realpathSync: realpath,
    openSync: (...args: Parameters<typeof actual.openSync>) => {
      const path = allow(args[0], "open");
      if (args[1] !== actual.constants.O_RDONLY) return deny("non-readonly descriptor");
      const descriptor = actual.openSync(...args);
      boundary.descriptors.set(descriptor, path);
      return descriptor;
    },
    closeSync: (descriptor: number) => {
      allow(descriptor, "close");
      actual.closeSync(descriptor);
      boundary.descriptors.delete(descriptor);
    },
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      allow(args[0], "read");
      return actual.readFileSync(...args);
    },
    fstatSync: (...args: Parameters<typeof actual.fstatSync>) => {
      allow(args[0], "fstat");
      return actual.fstatSync(...args);
    },
    lstatSync: (...args: Parameters<typeof actual.lstatSync>) => {
      allow(args[0], "lstat");
      return actual.lstatSync(...args);
    },
    readdirSync: (...args: Parameters<typeof actual.readdirSync>) => {
      allow(args[0], "readdir");
      return actual.readdirSync(...args);
    },
    mkdtempSync: (...args: Parameters<typeof actual.mkdtempSync>) => {
      if (
        typeof args[0] !== "string" ||
        canonical(args[0]) !== canonical(join(tmpdir(), "lego-step44-poppler-test-"))
      )
        return deny("unowned temporary prefix");
      return actual.mkdtempSync(...args);
    },
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => {
      allow(args[0], "mkdir", true);
      return actual.mkdirSync(...args);
    },
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      allow(args[0], "write", true);
      return actual.writeFileSync(...args);
    },
    linkSync: (...args: Parameters<typeof actual.linkSync>) => {
      allow(args[0], "link source", true);
      allow(args[1], "link destination", true);
      return actual.linkSync(...args);
    },
    rmSync: (...args: Parameters<typeof actual.rmSync>) => {
      const path = allow(args[0], "remove", true);
      if (!boundary.roots.includes(path) || dirname(resolve(path)) !== resolve(tmpdir()))
        return deny("non-root cleanup");
      return actual.rmSync(...args);
    },
  });
  return clone;
}

export function inspectDiagnosticGraph(root: unknown) {
  const strings: { path: string; value: string }[] = [];
  const properties: string[] = [],
    incomplete: string[] = [],
    cycles: string[] = [],
    nativeStackReads: string[] = [];
  const seen = new Set<object>();
  let nodes = 0,
    totalBytes = 0;
  function visit(value: unknown, path: string, depth: number) {
    if (depth > 8 || ++nodes > 128) {
      incomplete.push(`${path}: traversal bound`);
      return;
    }
    if (typeof value === "string") {
      const bytes = Buffer.byteLength(value, "utf8");
      if (bytes > 8192 || totalBytes + bytes > 32768) {
        incomplete.push(`${path}: string bound`);
        return;
      }
      totalBytes += bytes;
      strings.push({ path, value });
      return;
    }
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
    if (seen.has(value)) {
      cycles.push(path);
      return;
    }
    seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32) {
      incomplete.push(`${path}: property bound`);
      return;
    }
    for (const key of keys) {
      const next = `${path}.${String(key)}`;
      properties.push(next);
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if ("value" in descriptor) {
        visit(descriptor.value, next, depth + 1);
        continue;
      }
      if (
        key !== "stack" ||
        !nativeStackGetter ||
        descriptor.get !== nativeStackGetter ||
        !types.isNativeError(value)
      ) {
        incomplete.push(`${next}: accessor not invoked`);
        continue;
      }
      const prepare = Object.getOwnPropertyDescriptor(Error, "prepareStackTrace");
      if (prepare && !("value" in prepare)) {
        incomplete.push(`${next}: custom stack formatter accessor`);
        continue;
      }
      try {
        Object.defineProperty(
          Error,
          "prepareStackTrace",
          prepare
            ? { ...prepare, value: undefined }
            : { value: undefined, writable: true, configurable: true },
        );
        nativeStackReads.push(next);
        visit(nativeStackGetter.call(value), next, depth + 1);
      } finally {
        if (prepare) Object.defineProperty(Error, "prepareStackTrace", prepare);
        else Reflect.deleteProperty(Error, "prepareStackTrace");
      }
    }
  }
  visit(root, "$", 0);
  return { strings, properties, incomplete, cycles, nativeStackReads, nodes, totalBytes };
}

export function serializeInstalledPlaywright(error: unknown) {
  const entry = join(dirname(require.resolve("playwright/package.json")), "lib/util.js");
  const roots = ["playwright", "playwright-core"].map(
    (name) => dirname(require.resolve(`${name}/package.json`)).toLowerCase() + sep,
  );
  const evidence = {
    entry,
    loads: [] as { path: string; bytes: number; sha256: string }[],
    denied: [] as string[],
    inertAgents: [] as string[],
    calls: 0,
    loadComplete: false,
    restored: false,
    removedCacheEntries: [] as string[],
    preexistingCacheUnchanged: false,
    parentReferencesRestored: false,
  };
  const oldLoad = modules._load,
    oldResolve = modules._resolveFilename;
  const beforeCache = new Map(Object.entries(require.cache));
  const parents = new Map<NodeJS.Module, { children: NodeJS.Module[]; before: NodeJS.Module[] }>();
  const loaded = new Set<string>(),
    builtins = new Set(builtinModules.map((name) => name.replace(/^node:/u, "")));
  const clones = new Map<string, unknown>();
  let totalBytes = 0;
  const deny = (name: string): never => {
    evidence.denied.push(name);
    throw new Error(`Installed serializer instrument forbids ${name}.`);
  };
  const processObject = process as unknown as Record<string, unknown>;
  const processBefore = ["dlopen", "chdir", "cwd", "exit", "on", "once", "addListener"].map(
    (name) => ({
      name,
      descriptor: Object.getOwnPropertyDescriptor(process, name),
      value: processObject[name],
    }),
  );
  const envBefore = [
    "PWDEBUGIMPL",
    "PW_INSTRUMENT_MODULES",
    "DEBUG",
    "DEBUG_FD",
    "NODE_DEBUG",
    "TEST_GRACEFUL_FS_GLOBAL_PATCH",
    "WS_NO_BUFFER_UTIL",
    "WS_NO_UTF_8_VALIDATE",
  ].map((name) => ({ name, present: Object.hasOwn(process.env, name), value: process.env[name] }));
  function guardedLoad(request: string, parent: unknown, isMain?: boolean): unknown {
    const parentModule = parent as NodeJS.Module | undefined;
    if (parentModule && Array.isArray(parentModule.children) && !parents.has(parentModule)) {
      parents.set(parentModule, {
        children: parentModule.children,
        before: [...parentModule.children],
      });
    }
    const key = request.replace(/^node:/u, "");
    if (builtins.has(key)) {
      if (["module", "worker_threads", "cluster", "dgram"].includes(key))
        return deny(`module ${key}`);
      if (clones.has(key)) return clones.get(key);
      const actual = oldLoad.call(modules, request, parent, isMain);
      if (
        [
          "fs",
          "fs/promises",
          "child_process",
          "net",
          "tls",
          "http",
          "https",
          "http2",
          "dns",
          "dns/promises",
          "inspector",
          "readline",
        ].includes(key)
      ) {
        const clone = deniedModule(actual as object, key, deny);
        if (key === "fs")
          Object.defineProperty(clone, "promises", {
            configurable: true,
            value: deniedModule(fs.promises, "fs.promises", deny),
          });
        for (const pure of ["isIP", "isIPv4", "isIPv6"]) {
          if (pure in (actual as object)) clone[pure] = (actual as Record<string, unknown>)[pure];
        }
        if (key === "http" || key === "https")
          clone.Agent = class InertBoundaryAgent {
            constructor() {
              evidence.inertAgents.push(`${key}.Agent`);
            }
            addRequest() {
              return deny(`${key}.Agent.addRequest`);
            }
            createConnection() {
              return deny(`${key}.Agent.createConnection`);
            }
            createSocket() {
              return deny(`${key}.Agent.createSocket`);
            }
          };
        clones.set(key, clone);
        return clone;
      }
      return actual;
    }
    const resolved = oldResolve.call(modules, request, parent, isMain);
    const name = resolve(resolved).toLowerCase();
    if (!roots.some((root) => name.startsWith(root)) || !/\.(?:js|json)$/u.test(name))
      return deny(`non-code dependency ${request}`);
    if (!loaded.has(resolved)) {
      if (require.cache[resolved]) return deny(`preloaded unguarded dependency ${request}`);
      const bytes = fs.readFileSync(resolved);
      totalBytes += bytes.length;
      if (loaded.size >= 32 || totalBytes > 16 * 1024 * 1024) return deny("code-load budget");
      loaded.add(resolved);
      evidence.loads.push({ path: resolved, bytes: bytes.length, sha256: hash(bytes) });
    }
    return oldLoad.call(modules, request, parent, isMain);
  }
  let serialized: unknown, instrumentError: unknown;
  try {
    for (const old of envBefore) delete process.env[old.name];
    process.env.WS_NO_BUFFER_UTIL = "1";
    process.env.WS_NO_UTF_8_VALIDATE = "1";
    modules._load = guardedLoad;
    for (const old of processBefore.filter((row) => row.name !== "cwd"))
      processObject[old.name] = () => deny(`process.${old.name}`);
    const actual = require(entry) as { serializeError?: (value: unknown) => unknown };
    if (typeof actual.serializeError !== "function")
      throw new Error("Installed serializeError export unavailable.");
    evidence.loadComplete = true;
    evidence.calls++;
    serialized = actual.serializeError(error);
    if (evidence.denied.length)
      throw new Error("Installed serializer attempted a forbidden operation.");
  } catch (error) {
    instrumentError = error;
  } finally {
    modules._load = oldLoad;
    for (const old of processBefore) {
      if (old.descriptor) Object.defineProperty(process, old.name, old.descriptor);
      else Reflect.deleteProperty(process, old.name);
    }
    for (const old of envBefore) {
      if (old.present) process.env[old.name] = old.value;
      else delete process.env[old.name];
    }
    for (const path of loaded) {
      if (!beforeCache.has(path) && require.cache[path]) {
        delete require.cache[path];
        evidence.removedCacheEntries.push(path);
      }
    }
    evidence.preexistingCacheUnchanged = [...beforeCache].every(
      ([path, module]) => require.cache[path] === module,
    );
    for (const { children, before } of parents.values()) {
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index]!;
        if (!before.includes(child) && loaded.has(child.filename)) children.splice(index, 1);
      }
    }
    evidence.parentReferencesRestored = [...parents].every(
      ([parent, { children, before }]) =>
        parent.children === children &&
        children.length === before.length &&
        before.every((child, index) => children[index] === child),
    );
    evidence.restored =
      modules._load === oldLoad &&
      processBefore.every((old) => processObject[old.name] === old.value) &&
      envBefore.every(
        (old) =>
          Object.hasOwn(process.env, old.name) === old.present &&
          process.env[old.name] === old.value,
      ) &&
      evidence.preexistingCacheUnchanged &&
      evidence.parentReferencesRestored &&
      [...loaded].every((path) => !require.cache[path]);
  }
  return { serialized, evidence, instrumentError };
}

export function retainPopplerDiagnosticEvidence(records: unknown[], cleanup: unknown[]) {
  const destination = process.env.LEGO_POPPLER_DIAGNOSTIC_EVIDENCE;
  if (destination === undefined) return;
  const base = resolve(repository, "output/calibration-diagnostic-repair-20260905");
  const root = resolve(destination);
  if (
    !root.startsWith(base + sep) ||
    fs.realpathSync(root) !== root ||
    fs.lstatSync(root).isSymbolicLink()
  )
    throw new Error("Diagnostic evidence requires its real owned repair directory.");
  fs.writeFileSync(
    join(root, "case-results.json"),
    JSON.stringify(
      { expectedDiagnosticCases: 5, node: process.version, records, cleanup },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
}

export function syntheticRootExists(path: string) {
  return fs.existsSync(path);
}

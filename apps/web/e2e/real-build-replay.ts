import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type { RealBuildOptions } from "./real-build-safety";
import {
  parseRealBuildRunContract,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  verifyRealBuildRunContract,
} from "./real-build-run-contract";

export const REAL_BUILD_REPLAY_CLOSURE_SCHEMA = "lego.real-build-replay-closure/2" as const;

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_ROLE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const SAFE_RELATIVE_PATH_PATTERN = /^[A-Za-z0-9._@/-]+$/u;
const REQUIRED_RAW_ROLES = Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST);
const REQUIRED_DOWNSTREAM_ROLES = [
  ...REQUIRED_RAW_ROLES,
  "browser-output",
  "prepared-options",
  "run-contract",
] as const;
const ALLOWED_LOCAL_ROLES = new Set<string>([
  ...REQUIRED_DOWNSTREAM_ROLES,
  ...REQUIRED_RAW_ROLES,
  "prepared-options",
  "run-contract",
]);

const digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export interface RealBuildSourceSnapshot {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}

export interface RealBuildReplayClosureManifest {
  readonly schemaVersion: typeof REAL_BUILD_REPLAY_CLOSURE_SCHEMA;
  readonly authority: "local-diagnostic";
  readonly authenticated: false;
  readonly replayLevel: "downstream-only" | "metadata-only";
  readonly earliestBoundary: "browser-output" | "input-rejection";
  readonly roles: readonly {
    readonly role: string;
    readonly digest: string;
    readonly bytes: number;
    readonly casPath: string;
  }[];
  readonly sourceBundle: {
    readonly files: readonly RealBuildSourceSnapshot[];
    readonly digest: string;
  };
  readonly environmentDigest: string;
  readonly manifestDigest: string;
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

/** Resolves one hostile path under a fixed root and rejects every traversed symlink. */
export function resolveRealBuildPath(
  root: string,
  candidate: string,
  options: { readonly mustExist?: boolean; readonly label?: string } = {},
): string {
  const label = options.label ?? "real-build path";
  const normalized = candidate.replaceAll("\\", "/");
  if (
    candidate.length === 0 ||
    isAbsolute(candidate) ||
    !SAFE_RELATIVE_PATH_PATTERN.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "..")
  ) {
    throw new TypeError(
      `${label} must be a strict relative path without traversal or special characters; received ${JSON.stringify(candidate)}.`,
    );
  }
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(resolvedRoot, normalized);
  if (!inside(resolvedRoot, resolvedCandidate)) {
    throw new TypeError(`${label} resolves outside ${resolvedRoot}: ${resolvedCandidate}.`);
  }
  if (existsSync(resolvedRoot) && lstatSync(resolvedRoot).isSymbolicLink()) {
    throw new TypeError(`${label} root may not be a symlink: ${resolvedRoot}.`);
  }
  let cursor = resolvedRoot;
  for (const segment of relative(resolvedRoot, resolvedCandidate).split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) {
      throw new TypeError(`${label} may not traverse symlink ${cursor}.`);
    }
  }
  if (options.mustExist === true && !existsSync(resolvedCandidate)) {
    throw new TypeError(`${label} does not exist: ${resolvedCandidate}.`);
  }
  return resolvedCandidate;
}

export function captureRealBuildSourceBundle(
  repoRoot: string,
  relativeFiles: readonly string[],
): readonly RealBuildSourceSnapshot[] {
  const unique = [...new Set(relativeFiles.map((path) => path.replaceAll("\\", "/")))].sort();
  return unique.map((path) => {
    const resolved = resolveRealBuildPath(repoRoot, path, {
      mustExist: true,
      label: "source snapshot",
    });
    const stat = lstatSync(resolved);
    if (!stat.isFile()) throw new TypeError(`Source snapshot is not a regular file: ${path}.`);
    const bytes = readFileSync(resolved);
    return { path, digest: digest(bytes), bytes: bytes.length };
  });
}

/** Materializes an execution mirror before import; workspace package copies shadow live symlinks. */
export function materializeRealBuildSourceMirror(input: {
  readonly directory: string;
  readonly repoRoot: string;
  readonly sourceFiles: readonly string[];
  readonly fixedInputs?: readonly { readonly path: string; readonly bytes: Uint8Array }[];
}): string {
  const mirrorRoot = resolveRealBuildPath(input.directory, "source-snapshot", {
    label: "source execution mirror",
  });
  mkdirSync(mirrorRoot, { recursive: true });
  const writeMirrorFile = (path: string, bytes: Uint8Array): void => {
    const target = resolveRealBuildPath(mirrorRoot, path, { label: "source mirror file" });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: "wx" });
    if (digest(readFileSync(target)) !== digest(bytes)) {
      throw new TypeError(`Source mirror verification failed for ${path}.`);
    }
  };
  for (const source of [...new Set(input.sourceFiles)].sort()) {
    const resolved = resolveRealBuildPath(input.repoRoot, source, {
      mustExist: true,
      label: "source mirror input",
    });
    const bytes = readFileSync(resolved);
    writeMirrorFile(source, bytes);
    const packageMatch = /^packages\/([^/]+)\/(.+)$/u.exec(source.replaceAll("\\", "/"));
    if (packageMatch !== null) {
      writeMirrorFile(`node_modules/@lego-studio/${packageMatch[1]!}/${packageMatch[2]!}`, bytes);
    }
  }
  for (const fixed of input.fixedInputs ?? []) writeMirrorFile(fixed.path, fixed.bytes);
  return mirrorRoot;
}

export function sourceDriftFailures(
  expected: readonly RealBuildSourceSnapshot[],
  actual: readonly RealBuildSourceSnapshot[],
): readonly string[] {
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry]));
  const failures = expected.flatMap((entry) => {
    const observed = actualByPath.get(entry.path);
    return observed?.digest === entry.digest && observed.bytes === entry.bytes
      ? []
      : [
          `${entry.path}: expected ${entry.digest}/${entry.bytes}, observed ` +
            `${observed?.digest ?? "missing"}/${observed?.bytes ?? "missing"}`,
        ];
  });
  for (const entry of actual) {
    if (!expected.some(({ path }) => path === entry.path))
      failures.push(`${entry.path}: unexpected`);
  }
  return failures;
}

function writeCasBlob(
  directory: string,
  bytes: Uint8Array,
): {
  readonly digest: string;
  readonly bytes: number;
  readonly casPath: string;
} {
  const valueDigest = digest(bytes);
  const hex = valueDigest.slice("sha256:".length);
  const casPath = `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
  const target = resolveRealBuildPath(directory, casPath, { label: "CAS blob" });
  mkdirSync(dirname(target), { recursive: true });
  if (existsSync(target)) {
    if (digest(readFileSync(target)) !== valueDigest) {
      throw new TypeError(`Existing CAS blob ${casPath} does not match address ${valueDigest}.`);
    }
  } else {
    const temporary = `${target}.tmp-${randomUUID()}`;
    writeFileSync(temporary, bytes, { flag: "wx" });
    if (digest(readFileSync(temporary)) !== valueDigest) {
      throw new TypeError(`CAS write verification failed for ${valueDigest}.`);
    }
    renameSync(temporary, target);
  }
  return { digest: valueDigest, bytes: bytes.length, casPath };
}

function canonicalManifestDigest(
  manifest: Omit<RealBuildReplayClosureManifest, "manifestDigest">,
): string {
  return digest(JSON.stringify(manifest));
}

/** Writes exact input/output/environment/source bytes to CAS and atomically closes the manifest. */
export function writeRealBuildReplayClosure(input: {
  readonly directory: string;
  readonly repoRoot: string;
  readonly roles: readonly { readonly role: string; readonly bytes: Uint8Array }[];
  readonly sourceFiles: readonly string[];
  readonly environment: Readonly<Record<string, unknown>>;
  readonly browserOutputRetained: boolean;
}): RealBuildReplayClosureManifest {
  const roleNames = input.roles.map(({ role }) => role);
  if (
    new Set(roleNames).size !== roleNames.length ||
    roleNames.some((role) => !SAFE_ROLE_PATTERN.test(role)) ||
    roleNames.some((role) => !ALLOWED_LOCAL_ROLES.has(role)) ||
    roleNames.includes("environment")
  ) {
    throw new TypeError(
      "Replay closure roles must be the exact supported raw/contract/diagnostic set with unique lowercase " +
        "kebab-case identifiers; environment is reserved.",
    );
  }
  if (
    input.browserOutputRetained &&
    REQUIRED_DOWNSTREAM_ROLES.some((role) => !roleNames.includes(role))
  ) {
    throw new TypeError(
      `A downstream diagnostic replay closure requires raw roles, run-contract, prepared-options, and ` +
        `browser-output; missing ${REQUIRED_DOWNSTREAM_ROLES.filter((role) => !roleNames.includes(role)).join(", ")}.`,
    );
  }
  if (
    !input.browserOutputRetained &&
    REQUIRED_RAW_ROLES.some((role) => !roleNames.includes(role))
  ) {
    throw new TypeError("A metadata-only closure still requires every raw semantic input role.");
  }
  if (!input.browserOutputRetained && roleNames.includes("browser-output")) {
    throw new TypeError("A closure retaining browser-output cannot claim metadata-only replay.");
  }
  const roles = input.roles
    .map(({ role, bytes }) => ({ role, ...writeCasBlob(input.directory, bytes) }))
    .sort((left, right) => left.role.localeCompare(right.role));
  const sourceFiles = [...new Set(input.sourceFiles)].sort();
  const sourceBundleFiles = sourceFiles.map((path) => {
    const resolved = resolveRealBuildPath(input.repoRoot, path, {
      mustExist: true,
      label: "source bundle file",
    });
    const bytes = readFileSync(resolved);
    const stored = writeCasBlob(input.directory, bytes);
    return { path: path.replaceAll("\\", "/"), digest: stored.digest, bytes: stored.bytes };
  });
  const sourceBundle = {
    files: sourceBundleFiles,
    digest: digest(JSON.stringify(sourceBundleFiles)),
  };
  const environmentBytes = new TextEncoder().encode(JSON.stringify(input.environment));
  const environment = writeCasBlob(input.directory, environmentBytes);
  roles.push({ role: "environment", ...environment });
  roles.sort((left, right) => left.role.localeCompare(right.role));
  const base: Omit<RealBuildReplayClosureManifest, "manifestDigest"> = {
    schemaVersion: REAL_BUILD_REPLAY_CLOSURE_SCHEMA,
    authority: "local-diagnostic",
    authenticated: false,
    replayLevel: input.browserOutputRetained ? "downstream-only" : "metadata-only",
    earliestBoundary: input.browserOutputRetained ? "browser-output" : "input-rejection",
    roles,
    sourceBundle,
    environmentDigest: environment.digest,
  };
  const manifest = { ...base, manifestDigest: canonicalManifestDigest(base) };
  const target = resolveRealBuildPath(input.directory, "replay-closure.json", {
    label: "replay closure manifest",
  });
  const temporary = `${target}.tmp-${randomUUID()}`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 1)}\n`, { flag: "wx" });
  renameSync(temporary, target);
  verifyRealBuildReplayClosure(input.directory);
  return manifest;
}

export function verifyRealBuildReplayClosure(directory: string): RealBuildReplayClosureManifest {
  const path = resolveRealBuildPath(directory, "replay-closure.json", {
    mustExist: true,
    label: "replay closure manifest",
  });
  let parsed: RealBuildReplayClosureManifest;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as RealBuildReplayClosureManifest;
  } catch (error) {
    throw new TypeError(
      `Replay closure manifest is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  if (
    parsed.schemaVersion !== REAL_BUILD_REPLAY_CLOSURE_SCHEMA ||
    parsed.authority !== "local-diagnostic" ||
    parsed.authenticated !== false ||
    !SHA256_PATTERN.test(parsed.manifestDigest) ||
    !SHA256_PATTERN.test(parsed.environmentDigest) ||
    !Array.isArray(parsed.roles) ||
    !Array.isArray(parsed.sourceBundle?.files) ||
    !SHA256_PATTERN.test(parsed.sourceBundle?.digest ?? "") ||
    !["downstream-only:browser-output", "metadata-only:input-rejection"].includes(
      `${parsed.replayLevel}:${parsed.earliestBoundary}`,
    )
  ) {
    throw new TypeError("Replay closure manifest schema is malformed.");
  }
  const { manifestDigest, ...base } = parsed;
  if (canonicalManifestDigest(base) !== manifestDigest) {
    throw new TypeError("Replay closure manifest digest does not match its canonical contents.");
  }
  const roleNames = new Set<string>();
  for (const role of parsed.roles) {
    if (
      roleNames.has(role.role) ||
      !SAFE_ROLE_PATTERN.test(role.role) ||
      (role.role !== "environment" && !ALLOWED_LOCAL_ROLES.has(role.role)) ||
      !SHA256_PATTERN.test(role.digest) ||
      !Number.isInteger(role.bytes) ||
      role.bytes < 0 ||
      role.casPath !== `cas/sha256/${role.digest.slice(7, 9)}/${role.digest.slice(9)}`
    ) {
      throw new TypeError(`Replay closure role is malformed or duplicated: ${role.role}.`);
    }
    roleNames.add(role.role);
    const blob = resolveRealBuildPath(directory, role.casPath, {
      mustExist: true,
      label: `replay role ${role.role}`,
    });
    const bytes = readFileSync(blob);
    if (bytes.length !== role.bytes || digest(bytes) !== role.digest) {
      throw new TypeError(`Replay closure role ${role.role} failed CAS size/hash verification.`);
    }
  }
  if (
    parsed.replayLevel === "downstream-only" &&
    REQUIRED_DOWNSTREAM_ROLES.some((role) => !roleNames.has(role))
  ) {
    throw new TypeError(
      "Downstream diagnostic replay closure is missing a mandatory raw/contract role.",
    );
  }
  if (parsed.replayLevel === "metadata-only" && roleNames.has("browser-output")) {
    throw new TypeError("Metadata-only replay closure contains an undeclared browser-output.");
  }
  if (
    parsed.replayLevel === "metadata-only" &&
    REQUIRED_RAW_ROLES.some((role) => !roleNames.has(role))
  ) {
    throw new TypeError("Metadata-only replay closure is missing a mandatory raw semantic role.");
  }
  const files = parsed.sourceBundle.files;
  if (digest(JSON.stringify(files)) !== parsed.sourceBundle.digest) {
    throw new TypeError("Replay source-bundle listing digest is invalid.");
  }
  for (const source of files) {
    const normalizedPath = source.path?.replaceAll("\\", "/");
    if (
      typeof normalizedPath !== "string" ||
      !SAFE_RELATIVE_PATH_PATTERN.test(normalizedPath) ||
      normalizedPath.split("/").some((segment) => segment === "" || segment === "..") ||
      !SHA256_PATTERN.test(source.digest) ||
      !Number.isInteger(source.bytes) ||
      source.bytes < 0
    ) {
      throw new TypeError(`Replay source-bundle entry is malformed: ${String(source.path)}.`);
    }
    const hex = source.digest.slice("sha256:".length);
    const casPath = `cas/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
    const blob = resolveRealBuildPath(directory, casPath, {
      mustExist: true,
      label: `source bundle ${source.path}`,
    });
    const bytes = readFileSync(blob);
    if (bytes.length !== source.bytes || digest(bytes) !== source.digest) {
      throw new TypeError(`Replay source ${source.path} failed CAS size/hash verification.`);
    }
  }
  if (
    parsed.roles.find(({ role }) => role === "environment")?.digest !== parsed.environmentDigest
  ) {
    throw new TypeError("Replay environment digest is not bound to the reserved environment role.");
  }
  return parsed;
}

export function readRealBuildReplayRole(directory: string, role: string): Buffer {
  const closure = verifyRealBuildReplayClosure(directory);
  const entry = closure.roles.find((candidate) => candidate.role === role);
  if (entry === undefined) throw new TypeError(`Replay closure has no role ${role}.`);
  return readFileSync(
    resolveRealBuildPath(directory, entry.casPath, {
      mustExist: true,
      label: `replay role ${role}`,
    }),
  );
}

export interface RealBuildReplayInspection {
  readonly authority: "local-diagnostic";
  readonly authenticated: false;
  readonly replayLevel: RealBuildReplayClosureManifest["replayLevel"];
  readonly contractDigest: string | null;
  readonly roleTrace: readonly {
    readonly role: string;
    readonly digest: string;
    readonly bytes: number;
  }[];
  readonly sourceTrace: readonly RealBuildSourceSnapshot[];
}

/**
 * Verifies retained bytes, their source/role trace, and the raw-role-bound run contract without
 * loading or executing any retained source.
 */
export function inspectRealBuildReplayClosure(directory: string): RealBuildReplayInspection {
  const closure = verifyRealBuildReplayClosure(directory);
  let contractDigest: string | null = null;
  if (closure.replayLevel === "downstream-only") {
    let options: RealBuildOptions;
    let browserOutput: { readonly schemaVersion?: unknown };
    try {
      options = JSON.parse(
        readRealBuildReplayRole(directory, "prepared-options").toString("utf8"),
      ) as RealBuildOptions;
      browserOutput = JSON.parse(
        readRealBuildReplayRole(directory, "browser-output").toString("utf8"),
      ) as { readonly schemaVersion?: unknown };
    } catch (error) {
      throw new TypeError(
        `Downstream replay roles are not JSON: ${error instanceof Error ? error.message : String(error)}.`,
        { cause: error },
      );
    }
    if (browserOutput.schemaVersion !== "lego.real-build-browser-output/1") {
      throw new TypeError("Retained browser-output role has a malformed schema.");
    }
    const contract = parseRealBuildRunContract(readRealBuildReplayRole(directory, "run-contract"));
    verifyRealBuildRunContract({
      contract,
      options,
      roleDigests: Object.fromEntries(closure.roles.map(({ role, digest }) => [role, digest])),
      sourceFiles: closure.sourceBundle.files,
    });
    contractDigest = contract.contractDigest;
  }
  return {
    authority: "local-diagnostic",
    authenticated: false,
    replayLevel: closure.replayLevel,
    contractDigest,
    roleTrace: closure.roles.map(({ role, digest, bytes }) => ({ role, digest, bytes })),
    sourceTrace: closure.sourceBundle.files,
  };
}

/**
 * Authoritative replay is deliberately unavailable until the released companion broker provides
 * a namespace-bound external signature verifier. Local CAS hashes authenticate no issuer.
 */
export function replayRealBuildFinalization(directory: string): Promise<never> {
  inspectRealBuildReplayClosure(directory);
  return Promise.reject(
    new TypeError(
      "Authoritative real-build replay is unavailable: this repository has no released companion-broker " +
        "trust root or namespace-bound signature verifier. The retained closure can be inspected only as " +
        "unauthenticated data; self-rehashed manifests are not authority.",
    ),
  );
}

/**
 * Kept as a fail-closed compatibility boundary for callers that previously requested executable
 * local replay. Retained source is untrusted and is never loaded or executed.
 */
export function replayRealBuildFinalizationDiagnostic(directory: string): Promise<never> {
  inspectRealBuildReplayClosure(directory);
  return Promise.reject(
    new TypeError(
      "Diagnostic real-build execution is unavailable: retained source is untrusted and is never " +
        "loaded or executed. Use inspectRealBuildReplayClosure only for data-only CAS, role, source, " +
        "and run-contract diagnostics.",
    ),
  );
}

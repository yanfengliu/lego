import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import ts from "typescript";

import {
  selectRealBuildPlaywrightLifecycleHooks,
  type RealBuildPlaywrightOperation,
} from "./playwright-config-support.ts";

export const REAL_BUILD_STEP44_SOURCE_ROOT_POLICY =
  "apps/web/e2e/real-build-source-roots.json" as const;
export const REAL_BUILD_STEP44_LOCK_HELPER =
  "scripts/windows-lock-real-build-snapshot.ps1" as const;

const CAMERA_SPEC = "apps/web/e2e/real-build-prefix50-step44-camera-only.spec.ts";
const CALIBRATION_SPEC = "apps/web/e2e/real-build-prefix50-step44-real-domain-calibration.spec.ts";
const CONFIG_ROOTS = [
  "playwright.config.ts",
  "apps/web/e2e/real-build-global-teardown.ts",
] as const;
const DEVELOPMENT_SERVER_ROOTS = ["apps/web/vite.config.ts", "apps/web/src/main.tsx"] as const;
const CALIBRATION_FORBIDDEN_SERVER_PATHS = new Set([
  "apps/web/e2e/global-setup.ts",
  "apps/web/e2e/sample-booklet.ts",
  "apps/web/e2e/vite-server-lifecycle.ts",
  "apps/web/vite.config.ts",
]);
const EXACT_INFRASTRUCTURE_INPUTS = [
  REAL_BUILD_STEP44_SOURCE_ROOT_POLICY,
  REAL_BUILD_STEP44_LOCK_HELPER,
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "apps/web/package.json",
  "apps/web/index.html",
] as const;
const EXACT_PAGE44_INPUTS = [
  "recipes/6651557.pdf",
  "output/official-model/vx1087034_21066_a.xml",
  "output/part-identification/prefix50-semantic-closure.json",
  "output/real-build/action-preparation.json",
  "output/real-build/builder-shell-geometry.bin",
  "output/real-build/prefix50-ldraw-catalog-frames.json",
  "output/real-build/prefix50-official-ldraw-world-proposal.json",
  "output/real-build/prefix50-official-world-reconciliation.json",
  "output/real-build/prefix50-structural-events.json",
  "output/playwright/real-build-prefix50-step44-return-review/return-review-batch-v2-6bb4f29d7f7133bc7edcc2179c4657732ad6de65a55295aaccc6b2ea542b351d.json",
] as const;
const POST_UNLOCK_DYNAMIC_IMPORTS = new Map<string, ReadonlySet<string>>([
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts",
    new Set(["./real-build-prefix50-subbuild-return-review-camera-real-domain-heldout-raster.ts"]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts",
    new Set([
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-heldout.ts",
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts",
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts",
    ]),
  ],
  [
    "real-build-prefix50-step44-camera-only-gate-support.ts",
    new Set([
      "./real-build-prefix50-step44-camera-only-gate-artifacts.ts",
      "./real-build-prefix50-step44-camera-only-gate-contract.ts",
      "./real-build-prefix50-step44-camera-only-gate-probe.ts",
      "./real-build-prefix50-subbuild-return-review-camera-attempt-persistence.ts",
      "./real-build-prefix50-subbuild-return-review-camera-calibration.ts",
      "./real-build-prefix50-subbuild-return-review-camera-search.ts",
      "./real-build-prefix50-subbuild-return-review-camera-semantic.ts",
      "./real-build-prefix50-subbuild-return-review-camera-source.ts",
      "./real-build-prefix50-subbuild-return-review-camera.ts",
    ]),
  ],
]);
const REQUIRED_DYNAMIC_IMPORTS = new Map<string, ReadonlySet<string>>([
  [
    "part-identification-2453-builder-identity.mjs",
    new Set([
      "../apps/web/e2e/real-build-official.ts",
      "../packages/catalog/src/catalog.ts",
      "../packages/catalog/src/constants.ts",
      "../packages/catalog/src/part-blueprints-6651557-measured-h.ts",
      "../packages/catalog/src/mesh-assets-6651557-measured-h.ts",
      "../packages/catalog/src/ldraw-bundled-sources-6651557.ts",
      "../packages/catalog/src/mesh-assets.ts",
    ]),
  ],
  [
    "part-identification-2453-builder-registry-route.mjs",
    new Set(["../apps/web/e2e/real-build-builder-source-pins-m.ts"]),
  ],
  [
    "part-identification-prefix50-semantic-closure-evidence.mjs",
    new Set(["../apps/web/e2e/real-build-official.ts"]),
  ],
  [
    "part-identification-step31-32-order-reconciliation-source.mjs",
    new Set(["../apps/web/e2e/real-build-official.ts"]),
  ],
  [
    "part-identification-prefix50-ldraw-catalog-frames.mjs",
    new Set([
      "../packages/catalog/src/index.ts",
      "../packages/brick-kernel/src/canonical.ts",
      "../packages/brick-kernel/src/factory.ts",
      "../apps/web/e2e/real-build-builder-frame-geometry.ts",
      "../apps/web/e2e/real-build-builder-sources.ts",
      "../apps/web/e2e/real-build-builder-ldraw-frame-contract.ts",
    ]),
  ],
  [
    "part-identification-prefix50-official-ldraw-world-proposal.mjs",
    new Set(["../packages/catalog/src/index.ts"]),
  ],
  [
    "part-identification-prefix50-official-world-reconciliation.mjs",
    new Set([
      "../packages/catalog/src/index.ts",
      "./part-identification-prefix50-official-world-reconciliation-occurrence.mjs",
      "./part-identification-prefix50-official-world-reconciliation-topology.mjs",
    ]),
  ],
  [
    "part-identification-prefix50-structural-events.mjs",
    new Set(["../apps/web/e2e/real-build-transition-classification.ts"]),
  ],
  [
    "part-identification-legacy-recut-semantic-source.mjs",
    new Set([
      "../apps/web/e2e/real-build-action-ledger.ts",
      "../apps/web/e2e/real-build-official.ts",
    ]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts",
    new Set(["./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts"]),
  ],
  [
    "real-build-prefix50-step44-calibration-publication-proof-loader.ts",
    new Set(["./real-build-prefix50-step44-calibration-publication-proof.ts"]),
  ],
  [
    "real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts",
    new Set([
      "./real-build-prefix50-step44-calibration-persisted-binding.ts",
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    ]),
  ],
  [
    "real-build-prefix50-step44-calibration-persisted-binding.ts",
    new Set([
      "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    ]),
  ],
]);
const FORBIDDEN_PRE_UNLOCK_BASENAMES = new Set([
  "real-build-prefix50-subbuild-return-review-camera.ts",
  "real-build-prefix50-subbuild-return-review-camera-source.ts",
  "real-build-prefix50-subbuild-return-review-camera-source-commitments.ts",
  "real-build-prefix50-subbuild-return-review-camera-real-domain-heldout.ts",
]);
const FORBIDDEN_PRE_UNLOCK_PATH = /(?:^|\/)[^/]*(?:page45|step45|heldout)[^/]*$/iu;
const ALLOWED_NON_LITERAL_IMPORT = "scripts/part-identification-typescript-runtime.mjs";
const SCRIPT_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/iu;
const STRICT_RELATIVE = /^[A-Za-z0-9._@/-]+$/u;
const MAXIMUM_FILES = 10_000;
const MAXIMUM_ENTRIES = 25_000;
const MAXIMUM_BYTES = 512 * 1024 * 1024;

export interface RealBuildStep44SourceSnapshot {
  readonly path: string;
  readonly digest: `sha256:${string}`;
  readonly bytes: number;
}

interface RuntimeImport {
  readonly specifier: string;
  readonly dynamic: boolean;
}

const sameStat = (
  left: ReturnType<typeof fstatSync>,
  right: ReturnType<typeof fstatSync>,
): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs;

function runtimeImports(path: string, bytes: Uint8Array): readonly RuntimeImport[] {
  const source = ts.createSourceFile(
    path,
    new TextDecoder("utf8", { fatal: true }).decode(bytes),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports: RuntimeImport[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings;
      const onlyTypeSpecifiers =
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every(({ isTypeOnly }) => isTypeOnly);
      if (clause?.isTypeOnly || (clause?.name === undefined && onlyTypeSpecifiers)) continue;
      imports.push({
        specifier: (statement.moduleSpecifier as ts.StringLiteral).text,
        dynamic: false,
      });
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (
        clause !== undefined &&
        ts.isNamedExports(clause) &&
        clause.elements.length > 0 &&
        clause.elements.every(({ isTypeOnly }) => isTypeOnly)
      )
        continue;
      imports.push({
        specifier: (statement.moduleSpecifier as ts.StringLiteral).text,
        dynamic: false,
      });
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const required = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (dynamic || required) {
        const argument = node.arguments[0];
        if (
          (argument === undefined || !ts.isStringLiteralLike(argument)) &&
          path !== ALLOWED_NON_LITERAL_IMPORT
        )
          throw new TypeError(
            `Step-44 source closure found a non-literal runtime import in ${path}.`,
          );
        if (argument === undefined || !ts.isStringLiteralLike(argument)) return;
        imports.push({ specifier: argument.text, dynamic });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return imports;
}

function normalizeRelative(repoRoot: string, path: string): string {
  const value = relative(repoRoot, resolve(path)).replaceAll("\\", "/");
  if (
    value.length === 0 ||
    !STRICT_RELATIVE.test(value) ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  )
    throw new TypeError(`Step-44 source closure escaped its exact repository root: ${path}.`);
  return value;
}

function resolveWorkspaceImport(repoRoot: string, specifier: string): string | null {
  const match = /^@lego-studio\/([^/]+)(?:\/(.+))?$/u.exec(specifier);
  if (match === null) return null;
  const suffix = match[2];
  return resolve(repoRoot, "packages", match[1]!, "src", suffix ?? "index.ts");
}

function resolveLocalImport(repoRoot: string, from: string, specifier: string): string | null {
  const workspace = resolveWorkspaceImport(repoRoot, specifier);
  if (!specifier.startsWith(".") && workspace === null) return null;
  const direct = workspace ?? resolve(dirname(from), specifier);
  const candidates = [
    direct,
    `${direct}.ts`,
    `${direct}.tsx`,
    `${direct}.mts`,
    `${direct}.mjs`,
    `${direct}.js`,
    `${direct}.json`,
    `${direct}.css`,
    direct.replace(/\.mjs$/u, ".mts"),
    direct.replace(/\.js$/u, ".ts"),
    join(direct, "index.ts"),
    join(direct, "index.tsx"),
  ];
  for (const candidate of candidates)
    if (existsSync(candidate) && lstatSync(candidate).isFile()) return candidate;
  throw new TypeError(`Step-44 source closure could not resolve ${specifier} from ${from}.`);
}

function requirePage44SafePath(relativePath: string): void {
  if (
    FORBIDDEN_PRE_UNLOCK_BASENAMES.has(basename(relativePath)) ||
    FORBIDDEN_PRE_UNLOCK_PATH.test(relativePath)
  )
    throw new TypeError(
      `Step-44 pre-unlock source closure reached forbidden page45/heldout/step45 path ${relativePath}.`,
    );
}

export function captureRealBuildStep44PreUnlockSourceSnapshots(input: {
  readonly repositoryRoot: string;
  readonly operation: Extract<
    RealBuildPlaywrightOperation,
    Readonly<{ mode: "camera-only" | "real-domain-calibration" }>
  >;
  /** Test observation only; production reads still use the exact internal descriptor path. */
  readonly beforeExactFileRead?: (relativePath: string) => void;
}): readonly RealBuildStep44SourceSnapshot[] {
  const repoRoot = realpathSync.native(resolve(input.repositoryRoot));
  const snapshots = new Map<string, RealBuildStep44SourceSnapshot>();
  let entries = 0;
  let aggregateBytes = 0;

  const exactRead = (relativePath: string): Buffer => {
    requirePage44SafePath(relativePath);
    if (
      input.operation.mode === "real-domain-calibration" &&
      CALIBRATION_FORBIDDEN_SERVER_PATHS.has(relativePath)
    )
      throw new TypeError(
        `Step-44 calibration source closure reached ordinary development-server or booklet-discovery path ${relativePath}; its bootstrap must use only the calibration-owned static server.`,
      );
    input.beforeExactFileRead?.(relativePath);
    const absolute = resolve(repoRoot, relativePath);
    const pathStat = lstatSync(absolute);
    if (pathStat.isSymbolicLink() || !pathStat.isFile())
      throw new TypeError(`Step-44 source closure requires an ordinary file: ${relativePath}.`);
    const descriptor = openSync(absolute, "r");
    try {
      const before = fstatSync(descriptor);
      const bytes = readFileSync(descriptor);
      const after = fstatSync(descriptor);
      if (!sameStat(before, after) || !sameStat(after, lstatSync(absolute)))
        throw new TypeError(`Step-44 source closure changed during exact read: ${relativePath}.`);
      return bytes;
    } finally {
      closeSync(descriptor);
    }
  };

  const visitFile = (path: string): void => {
    const relativePath = normalizeRelative(repoRoot, path);
    if (snapshots.has(relativePath)) return;
    if (++entries > MAXIMUM_ENTRIES || snapshots.size >= MAXIMUM_FILES)
      throw new TypeError("Step-44 source closure exceeded its exact file/entry bound.");
    const bytes = exactRead(relativePath);
    aggregateBytes += bytes.length;
    if (aggregateBytes > MAXIMUM_BYTES)
      throw new TypeError(
        `Step-44 source closure exceeded ${MAXIMUM_BYTES} bytes at ${relativePath}.`,
      );
    snapshots.set(relativePath, {
      path: relativePath,
      digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      bytes: bytes.length,
    });
    if (
      !SCRIPT_EXTENSIONS.test(relativePath) ||
      relativePath.startsWith("node_modules/") ||
      relativePath.includes("/node_modules/") ||
      relativePath.endsWith(".d.ts")
    )
      return;
    for (const edge of runtimeImports(relativePath, bytes)) {
      if (
        input.operation.mode === "real-domain-calibration" &&
        /^vite(?:\/|$)/u.test(edge.specifier)
      )
        throw new TypeError(
          `Step-44 calibration source closure reached Vite import ${edge.specifier} from ${relativePath}; its bootstrap must use only the calibration-owned static server.`,
        );
      if (edge.dynamic && edge.specifier.startsWith(".")) {
        const file = basename(relativePath);
        if (POST_UNLOCK_DYNAMIC_IMPORTS.get(file)?.has(edge.specifier) === true) continue;
        if (REQUIRED_DYNAMIC_IMPORTS.get(file)?.has(edge.specifier) !== true)
          throw new TypeError(
            `Step-44 source closure found unregistered dynamic import ${edge.specifier} from ${relativePath}.`,
          );
      }
      const imported = resolveLocalImport(
        repoRoot,
        resolve(repoRoot, relativePath),
        edge.specifier,
      );
      if (imported !== null) visitFile(imported);
    }
  };

  const visitDirectory = (path: string, depth: number): void => {
    if (depth > 64 || ++entries > MAXIMUM_ENTRIES)
      throw new TypeError("Step-44 external dependency closure exceeded its entry/depth bound.");
    const stat = lstatSync(path);
    if (stat.isSymbolicLink())
      throw new TypeError(`Step-44 source closure may not traverse ${path}.`);
    if (stat.isFile()) return visitFile(path);
    if (!stat.isDirectory())
      throw new TypeError(`Step-44 source closure entry is invalid: ${path}.`);
    for (const name of readdirSync(path).sort((left, right) => left.localeCompare(right)))
      visitDirectory(join(path, name), depth + 1);
  };

  const operationEntry = input.operation.mode === "camera-only" ? CAMERA_SPEC : CALIBRATION_SPEC;
  const setup = selectRealBuildPlaywrightLifecycleHooks(input.operation).globalSetup;
  if (typeof setup !== "string")
    throw new TypeError("Step-44 source closure requires one selected global-setup module.");
  for (const root of [
    ...CONFIG_ROOTS,
    setup,
    ...(input.operation.mode === "camera-only" ? DEVELOPMENT_SERVER_ROOTS : []),
    operationEntry,
    ...EXACT_INFRASTRUCTURE_INPUTS,
    ...EXACT_PAGE44_INPUTS,
  ])
    visitFile(resolve(repoRoot, root));

  const policy = JSON.parse(exactRead(REAL_BUILD_STEP44_SOURCE_ROOT_POLICY).toString("utf8")) as {
    readonly roots?: unknown;
  };
  if (!Array.isArray(policy.roots)) throw new TypeError("Step-44 source-root policy is malformed.");
  for (const root of policy.roots) {
    if (
      typeof root !== "string" ||
      !root.split("/").includes("node_modules") ||
      root.split("/").includes(".vite")
    )
      continue;
    visitDirectory(resolve(repoRoot, root), 0);
  }
  return Object.freeze(
    [...snapshots.values()].sort((left, right) => left.path.localeCompare(right.path)),
  );
}

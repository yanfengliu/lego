import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { createServer } from "node:http";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS,
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_MANIFEST_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ROOT,
  realBuildPrefix50Step44StaticAppManifestCommitment,
} from "./real-build-prefix50-subbuild-return-review-static-app-manifest.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const appRoot = resolve(repositoryRoot, REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ROOT);
const maximumRequestBytes = 4_096;

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function assertCanonicalDirectory(path: string, label: string): void {
  const canonical = realpathSync.native(path);
  const stat = lstatSync(path);
  if (canonical !== path || !stat.isDirectory() || stat.isSymbolicLink())
    throw new TypeError(`Step-44 static app ${label} must be one canonical real directory.`);
}

function assertExactTree(): void {
  assertCanonicalDirectory(appRoot, "root");
  const assetRoot = resolve(appRoot, "assets");
  assertCanonicalDirectory(assetRoot, "asset root");
  const rootNames = readdirSync(appRoot).sort();
  if (rootNames.join("\n") !== ["assets", "index.html"].join("\n"))
    throw new TypeError("Step-44 static app root contains an unreviewed entry.");
  const expectedAssets = REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS.filter(({ relativePath }) =>
    relativePath.startsWith("assets/"),
  )
    .map(({ relativePath }) => relativePath.slice("assets/".length))
    .sort();
  if (readdirSync(assetRoot).sort().join("\n") !== expectedAssets.join("\n"))
    throw new TypeError("Step-44 static app asset root contains an unreviewed entry.");
}

function readExactAsset(
  asset: (typeof REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS)[number],
): Buffer {
  const path = resolve(appRoot, asset.relativePath);
  const local = relative(appRoot, path);
  if (local.length === 0 || local === ".." || local.startsWith(`..${sep}`))
    throw new TypeError("Step-44 static app asset escaped its exact root.");
  if (realpathSync.native(path) !== path)
    throw new TypeError("Step-44 static app asset path is aliased.");
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n)
    throw new TypeError("Step-44 static app asset must be one single-name regular file.");
  const descriptor = openSync(path, "r");
  try {
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    if (
      descriptorBefore.ino !== before.ino ||
      descriptorAfter.ino !== before.ino ||
      descriptorBefore.size !== before.size ||
      descriptorAfter.size !== before.size ||
      descriptorAfter.nlink !== 1n ||
      BigInt(bytes.byteLength) !== before.size ||
      bytes.byteLength !== asset.bytes ||
      digest(bytes) !== asset.digest
    )
      throw new TypeError("Step-44 static app asset bytes changed or missed their reviewed pin.");
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

if (
  REAL_BUILD_PREFIX50_STEP44_STATIC_APP_MANIFEST_COMMITMENT === "sha256:pending" ||
  realBuildPrefix50Step44StaticAppManifestCommitment() !==
    REAL_BUILD_PREFIX50_STEP44_STATIC_APP_MANIFEST_COMMITMENT
)
  throw new TypeError("Step-44 static app manifest changed without reviewed repin.");
assertExactTree();

const routes = new Map<
  string,
  Readonly<{ bytes: Buffer; contentType: string; digest: `sha256:${string}` }>
>();
for (const asset of REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS) {
  const bytes = readExactAsset(asset);
  for (const requestPath of asset.requestPaths) {
    if (routes.has(requestPath))
      throw new TypeError("Step-44 static app manifest repeats one request path.");
    routes.set(
      requestPath,
      Object.freeze({ bytes, contentType: asset.contentType, digest: asset.digest }),
    );
  }
}

const [portText, ...trailing] = process.argv.slice(2);
if (
  trailing.length !== 0 ||
  portText === undefined ||
  !/^[1-9][0-9]{0,4}$/u.test(portText) ||
  Number(portText) > 65_535
)
  throw new TypeError("Step-44 static app server requires one canonical TCP port.");

const server = createServer((request, response) => {
  const rawUrl = request.url;
  if (
    rawUrl === undefined ||
    Buffer.byteLength(rawUrl) > maximumRequestBytes ||
    (request.method !== "GET" && request.method !== "HEAD")
  ) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad request.");
    return;
  }
  const url = new URL(rawUrl, "http://127.0.0.1");
  const asset =
    url.search.length === 0 && url.hash.length === 0 ? routes.get(url.pathname) : undefined;
  if (asset === undefined) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found.");
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-length": String(asset.bytes.byteLength),
    "content-type": asset.contentType,
    etag: `"${asset.digest}"`,
    "x-content-type-options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : asset.bytes);
});

server.listen(Number(portText), "127.0.0.1");

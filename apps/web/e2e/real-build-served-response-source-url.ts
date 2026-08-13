import {
  normalizeRealBuildRelativePath,
  type RealBuildSourceSnapshot,
} from "./real-build-replay-files";
import { REAL_BUILD_RUN_ID_PATTERN } from "./real-build-artifact-publication";

const DEP_CACHE_PREFIX = "/node_modules/.vite/";
const SERVER_ROOT_IN_MIRROR = "apps/web";
const VITE_CLIENT_ROUTES: ReadonlyMap<string, string> = new Map([
  ["/@vite/client", "node_modules/vite/dist/client/client.mjs"],
  ["/@vite/env", "node_modules/vite/dist/client/env.mjs"],
]);
const VERIFICATION_ORIGIN = "http://real-build.invalid";

function canonicalAbsoluteRoot(value: string, label: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/\/$/u, "");
  if (!/^[A-Za-z]:\/(?:[^/]+(?:\/|$))*$/u.test(`${normalized}/`)) {
    throw new TypeError(`${label} must be an absolute canonical Windows path.`);
  }
  return normalized;
}

export function exactServedRequestUrl(requestUrl: string): URL {
  let url: URL;
  try {
    url = new URL(requestUrl, VERIFICATION_ORIGIN);
  } catch (error) {
    throw new TypeError(
      `Served-response request URL was ${JSON.stringify(requestUrl)}; expected one valid origin-relative URL.`,
      {
        cause: error,
      },
    );
  }
  const exact = `${url.pathname}${url.search}`;
  if (
    !requestUrl.startsWith("/") ||
    requestUrl.startsWith("//") ||
    requestUrl !== exact ||
    url.origin !== VERIFICATION_ORIGIN ||
    url.hash !== ""
  ) {
    throw new TypeError(
      `Served-response request URL was ${JSON.stringify(requestUrl)} with origin ${JSON.stringify(url.origin)}; ` +
        `expected exact ${JSON.stringify(exact)} at origin ${JSON.stringify(VERIFICATION_ORIGIN)}, with one leading slash and no fragment.`,
    );
  }
  return url;
}

export function sourcePathFromServedRequestUrl(input: {
  readonly requestUrl: string;
  readonly sourceRoot: string;
  readonly sourceByPath: ReadonlyMap<string, RealBuildSourceSnapshot>;
  readonly expectedCheckoutRoot?: string;
  readonly frozenLegacyArtifactManifestV3RunId?: string;
}): string {
  if (
    input.expectedCheckoutRoot !== undefined &&
    input.frozenLegacyArtifactManifestV3RunId !== undefined
  ) {
    throw new TypeError(
      "Served-response URL verification cannot combine current checkout binding with frozen legacy /3 inspection.",
    );
  }
  const url = exactServedRequestUrl(input.requestUrl);
  const clientRoute = VITE_CLIENT_ROUTES.get(url.pathname);
  if (clientRoute !== undefined) {
    if (!input.sourceByPath.has(clientRoute)) {
      throw new TypeError(
        `Served-response source URL does not identify one exact replay source: ${input.requestUrl}.`,
      );
    }
    return clientRoute;
  }
  const isFsUrl = url.pathname.startsWith("/@fs/");
  const isDepCacheUrl = url.pathname.startsWith(DEP_CACHE_PREFIX);
  if ((!isFsUrl && !isDepCacheUrl) || url.hash !== "") {
    throw new TypeError(
      `Served-response source URL must use the exact Vite /@fs/ route or ${DEP_CACHE_PREFIX}: ${input.requestUrl}.`,
    );
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(
      isFsUrl ? url.pathname.slice("/@fs/".length) : url.pathname.slice(1),
    );
  } catch (error) {
    throw new TypeError(`Served-response source URL has malformed encoding: ${input.requestUrl}.`, {
      cause: error,
    });
  }
  if (/^\/[A-Za-z]:\//u.test(decoded)) decoded = decoded.slice(1);
  if (decoded.includes("\\") || decoded.includes("\0")) {
    throw new TypeError(
      `Served-response source URL has a non-canonical path: ${input.requestUrl}.`,
    );
  }
  if (isDepCacheUrl) {
    const relative = `${SERVER_ROOT_IN_MIRROR}/${decoded}`;
    const normalized = normalizeRealBuildRelativePath(
      relative,
      "served-response dependency-cache source path",
    );
    if (normalized !== relative || !input.sourceByPath.has(normalized)) {
      throw new TypeError(
        `Served-response source URL does not identify one exact replay source: ${input.requestUrl}.`,
      );
    }
    return normalized;
  }
  const sourceRoot = canonicalAbsoluteRoot(input.sourceRoot, "Served-response source root");
  const prefix = `${sourceRoot}/`;
  const lowerDecoded = decoded.toLocaleLowerCase("en-US");
  if (lowerDecoded.startsWith(prefix.toLocaleLowerCase("en-US"))) {
    const relative = decoded.slice(prefix.length);
    const normalized = normalizeRealBuildRelativePath(relative, "served-response URL source path");
    if (normalized === relative && input.sourceByPath.has(normalized)) return normalized;
  }
  let checkoutRoot: string | undefined;
  if (input.expectedCheckoutRoot !== undefined) {
    checkoutRoot = canonicalAbsoluteRoot(
      input.expectedCheckoutRoot,
      "Served-response expected checkout root",
    );
  } else if (input.frozenLegacyArtifactManifestV3RunId !== undefined) {
    const runId = input.frozenLegacyArtifactManifestV3RunId;
    if (!REAL_BUILD_RUN_ID_PATTERN.test(runId)) {
      throw new TypeError("Frozen legacy /3 served-response inspection requires one exact run id.");
    }
    const legacySuffix = `/output/direct-origin-k-production/runs/.tmp-${runId}/source-snapshot`;
    if (!sourceRoot.endsWith(legacySuffix)) {
      throw new TypeError(
        "Frozen legacy /3 served-response source root does not match its exact run generation.",
      );
    }
    checkoutRoot = canonicalAbsoluteRoot(
      sourceRoot.slice(0, -legacySuffix.length),
      "Frozen legacy /3 checkout root",
    );
  }
  if (checkoutRoot !== undefined) {
    const checkoutPrefix = `${checkoutRoot}/`;
    if (!lowerDecoded.startsWith(checkoutPrefix.toLocaleLowerCase("en-US"))) {
      throw new TypeError(
        "Served-response source URL is outside its locked mirror and checkout; an exact boundary is required.",
      );
    }
    const relative = decoded.slice(checkoutPrefix.length);
    const normalized = normalizeRealBuildRelativePath(relative, "served-response checkout path");
    if (normalized === relative && input.sourceByPath.has(normalized)) return normalized;
    throw new TypeError(
      `Served-response source URL does not identify one exact checkout source: ${input.requestUrl}.`,
    );
  }
  throw new TypeError("Served-response source URL is outside its declared locked root.");
}

import { isAbsolute, relative, resolve } from "node:path";

import type { Request } from "@playwright/test";

const MAXIMUM_REDIRECT_CHAIN = 16;
const JAVASCRIPT_CONTENT_TYPE = /(?:java|ecma)script|application\/x-typescript/iu;

export const isStep7Gate3ExecutableContentType = (contentType: string): boolean =>
  JAVASCRIPT_CONTENT_TYPE.test(contentType);

export const relativeStep7Gate3HttpUrl = (value: string): string => {
  const url = new URL(value, "http://localhost");
  return `${url.pathname}${url.search}`;
};

export const auditedStep7Gate3RequiredResponseUrls = (required: string): readonly string[] => {
  const exact = relativeStep7Gate3HttpUrl(required);
  const parsed = new URL(required, "http://localhost");
  return parsed.search === "" ? Object.freeze([exact, `${exact}?import`]) : Object.freeze([exact]);
};

export function assertExactStep7Gate3LocalHttpOrigin(value: string, label: string): void {
  const origin = new URL(value);
  if (
    origin.origin !== value ||
    origin.protocol !== "http:" ||
    (origin.hostname !== "127.0.0.1" && origin.hostname !== "localhost")
  ) {
    throw new TypeError(`${label} ${value} is not an exact local HTTP origin.`);
  }
}

const normalizedRelativeSourcePath = (repoRoot: string, absolute: string): string | null => {
  const candidate = relative(repoRoot, absolute).replaceAll("\\", "/");
  return candidate === "" ||
    candidate === ".." ||
    candidate.startsWith("../") ||
    isAbsolute(candidate)
    ? null
    : candidate;
};

const decodedPathname = (url: URL): string | null => {
  try {
    const decoded = decodeURIComponent(url.pathname);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
};

export function step7Gate3SourcePathForViteUrl(
  url: URL,
  repoRoot: string,
  allowedSourcePaths: ReadonlySet<string>,
): string | null {
  const decoded = decodedPathname(url);
  if (decoded === null) return null;
  const virtualSource =
    decoded === "/@vite/client"
      ? "node_modules/vite/dist/client/client.mjs"
      : decoded === "/@vite/env"
        ? "node_modules/vite/dist/client/env.mjs"
        : null;
  if (virtualSource !== null) return allowedSourcePaths.has(virtualSource) ? virtualSource : null;

  let absolute: string | null = null;
  if (decoded.startsWith("/@fs/")) {
    let candidate = decoded.slice("/@fs/".length);
    if (process.platform === "win32" && /^\/[A-Za-z]:\//u.test(candidate)) {
      candidate = candidate.slice(1);
    }
    absolute = resolve(candidate);
  } else if (
    decoded.startsWith("/src/") ||
    decoded.startsWith("/e2e/") ||
    decoded.startsWith("/node_modules/.vite/")
  ) {
    absolute = resolve(repoRoot, "apps/web", `.${decoded}`);
  }
  if (absolute === null) return null;
  const sourcePath = normalizedRelativeSourcePath(repoRoot, absolute);
  return sourcePath !== null && allowedSourcePaths.has(sourcePath) ? sourcePath : null;
}

export const isAuditedStep7Gate3ViteQuery = (url: URL): boolean =>
  url.search === "" || url.search === "?import" || /^\?v=[0-9a-f]+$/u.test(url.search);

export interface Step7Gate3RedirectRequestProvenance {
  readonly absoluteUrl: string;
  readonly method: string;
  readonly resourceType: string;
}

export function step7Gate3RedirectChain(
  request: Request,
): readonly Step7Gate3RedirectRequestProvenance[] {
  const chain: Step7Gate3RedirectRequestProvenance[] = [];
  let current = request.redirectedFrom();
  while (current !== null) {
    if (chain.length >= MAXIMUM_REDIRECT_CHAIN) {
      throw new RangeError(
        `Gate-3 browser request redirect chain exceeds ${MAXIMUM_REDIRECT_CHAIN} hops.`,
      );
    }
    chain.push({
      absoluteUrl: current.url(),
      method: current.method(),
      resourceType: current.resourceType(),
    });
    current = current.redirectedFrom();
  }
  return Object.freeze(chain.reverse().map((entry) => Object.freeze(entry)));
}

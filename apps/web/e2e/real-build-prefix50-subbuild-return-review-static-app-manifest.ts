import { createHash } from "node:crypto";

export interface RealBuildPrefix50Step44StaticAppAsset {
  readonly relativePath: string;
  readonly requestPaths: readonly string[];
  readonly digest: `sha256:${string}`;
  readonly bytes: number;
  readonly contentType: string;
}

export const REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ROOT = "apps/web/e2e/static-app/dist";

export const REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS = Object.freeze([
  Object.freeze({
    relativePath: "index.html",
    requestPaths: Object.freeze(["/", "/index.html"]),
    digest: "sha256:377ef2f3166fc1fab2db6b1b882529e59abff13ba55f1ca68d01c3f0c48a2b49",
    bytes: 447,
    contentType: "text/html; charset=utf-8",
  }),
  Object.freeze({
    relativePath: "assets/index-kRH0IL9f.js",
    requestPaths: Object.freeze(["/assets/index-kRH0IL9f.js"]),
    digest: "sha256:ad33ca2c1e030198736bf633963d99af0af8d8bedd32b1168eeae5e2dd48cb91",
    bytes: 3_303_563,
    contentType: "text/javascript; charset=utf-8",
  }),
  Object.freeze({
    relativePath: "assets/index-C9DZZugr.css",
    requestPaths: Object.freeze(["/assets/index-C9DZZugr.css"]),
    digest: "sha256:9f4247f31499cbd93408fb5110e855b4e641459cd1b863fb9fca83bb3eaba934",
    bytes: 15_800,
    contentType: "text/css; charset=utf-8",
  }),
  Object.freeze({
    relativePath: "assets/pdf-Bo8U-z5P.js",
    requestPaths: Object.freeze(["/assets/pdf-Bo8U-z5P.js"]),
    digest: "sha256:730d490602f946a29ed7462d212848b67c83cfd5040b8878d865eba3446a332a",
    bytes: 370_844,
    contentType: "text/javascript; charset=utf-8",
  }),
  Object.freeze({
    relativePath: "assets/pdf.worker-BQQyum15.mjs",
    requestPaths: Object.freeze(["/assets/pdf.worker-BQQyum15.mjs"]),
    digest: "sha256:26c0b99111410388f0698d542b132a3f96b49c47e54b378c822cb10e0cd7f41a",
    bytes: 1_892_435,
    contentType: "text/javascript; charset=utf-8",
  }),
  Object.freeze({
    relativePath: "assets/pdf.worker-CFFBobiy.js",
    requestPaths: Object.freeze(["/assets/pdf.worker-CFFBobiy.js"]),
    digest: "sha256:05df791acfbbddcef046a6fe6cf0531c0d03f8de5dc359382cd37446d2137f4a",
    bytes: 61,
    contentType: "text/javascript; charset=utf-8",
  }),
] as const satisfies readonly RealBuildPrefix50Step44StaticAppAsset[]);

export function realBuildPrefix50Step44StaticAppManifestCommitment(): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(REAL_BUILD_PREFIX50_STEP44_STATIC_APP_ASSETS))
    .digest("hex")}`;
}

export const REAL_BUILD_PREFIX50_STEP44_STATIC_APP_MANIFEST_COMMITMENT =
  "sha256:9bac6bfc1b3abd577f3826e4ed8e123997216b66bb5d9386635dcc50bc60078c" as `sha256:${string}`;

#!/usr/bin/env node

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { writeContainedFile } from "./part-identification-io.mjs";
import {
  reproduceCurrentPrefix50LdrawCatalogFrames,
  verifyCurrentPrefix50LdrawCatalogFrames,
} from "./part-identification-prefix50-ldraw-catalog-frames-current.mjs";
import {
  PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
  PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
  PREFIX50_LDRAW_CATALOG_FRAMES_PINS,
} from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";

if (process.argv.length !== 2) {
  throw new TypeError("Prefix-50 LDraw/catalog frame generation accepts no caller arguments.");
}

const reproduced = await reproduceCurrentPrefix50LdrawCatalogFrames();
const expected = PREFIX50_LDRAW_CATALOG_FRAMES_PINS.expectedArtifact;
const digest = sha256Digest(reproduced.bytes);
if (expected === null) {
  throw new TypeError("Prefix-50 LDraw/catalog frame generation has no reviewed artifact pin.");
}
if (reproduced.bytes.length !== expected.bytes || digest !== expected.digest) {
  throw new TypeError(
    `Prefix-50 LDraw/catalog frame generation reproduced ${reproduced.bytes.length} bytes at ${digest}, not reviewed ${expected.bytes} bytes at ${expected.digest}; retained evidence was not overwritten.`,
  );
}
writeContainedFile("output/real-build", "prefix50-ldraw-catalog-frames.json", reproduced.bytes, {
  label: "Prefix-50 LDraw/catalog frames",
  pathLabel: "Prefix-50 LDraw/catalog frame output path",
  maxBytes: PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
});
await verifyCurrentPrefix50LdrawCatalogFrames();
console.log(
  JSON.stringify({
    path: PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
    bytes: reproduced.bytes.length,
    digest,
    frameTableDigest: reproduced.artifact.frameTableDigest,
    accounting: reproduced.artifact.accounting,
  }),
);

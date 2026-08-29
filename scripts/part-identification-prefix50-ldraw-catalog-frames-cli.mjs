#!/usr/bin/env node

import { basename } from "node:path";
import { pathToFileURL } from "node:url";

import { publishContainedArtifactWithoutOverwrite } from "./part-identification-counterevidence-archive.mjs";
import { reproduceCurrentPrefix50LdrawCatalogFrames } from "./part-identification-prefix50-ldraw-catalog-frames-current.mjs";
import {
  bytesFromVerifiedPrefix50LdrawCatalogFrames,
  inspectVerifiedPrefix50LdrawCatalogFrames,
  isVerifiedPrefix50LdrawCatalogFrames,
  verifyPrefix50LdrawCatalogFrames,
} from "./part-identification-prefix50-ldraw-catalog-frames.mjs";
import {
  PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
  PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
} from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";

const OUTPUT_ROOT = "output/real-build";
const OUTPUT_FILE = basename(PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH);

function publishVerifiedFrames(verified) {
  if (!isVerifiedPrefix50LdrawCatalogFrames(verified)) {
    throw new TypeError(
      "Prefix-50 LDraw/catalog frame publication requires its opaque in-memory verifier result.",
    );
  }
  return publishContainedArtifactWithoutOverwrite({
    archiveNameStem: "prefix50-ldraw-catalog-frames",
    currentFile: OUTPUT_FILE,
    label: "Prefix-50 LDraw/catalog frames",
    maxBytes: PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES,
    nextBytes: bytesFromVerifiedPrefix50LdrawCatalogFrames(verified),
    outputRoot: OUTPUT_ROOT,
  });
}

export async function runPrefix50LdrawCatalogFramesCli(argv = process.argv.slice(2), context = {}) {
  const stdout = context.stdout ?? console.log;
  if (argv.length !== 0) {
    throw new TypeError("Prefix-50 LDraw/catalog frame generation accepts no caller arguments.");
  }
  const reproduced = await reproduceCurrentPrefix50LdrawCatalogFrames();
  const verified = await verifyPrefix50LdrawCatalogFrames({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  if (!isVerifiedPrefix50LdrawCatalogFrames(verified)) {
    throw new TypeError(
      "Prefix-50 LDraw/catalog frame verifier did not return its opaque authority object; retained evidence was not touched.",
    );
  }
  const verifiedBytes = bytesFromVerifiedPrefix50LdrawCatalogFrames(verified);
  if (!verifiedBytes.equals(reproduced.bytes)) {
    throw new TypeError(
      "Prefix-50 LDraw/catalog frame verifier bytes differ from the fresh reproduction; retained evidence was not touched.",
    );
  }
  const inspection = inspectVerifiedPrefix50LdrawCatalogFrames(verified);
  const publication = publishVerifiedFrames(verified);
  if (publication.state === "review-required") {
    throw new TypeError(
      `Prefix-50 LDraw/catalog frames retained differing current evidence at ${publication.currentPath}; verified replacement candidate is ${publication.candidate.path} at ${publication.digest}. Review and move the retained current file explicitly before rerunning; automation never overwrites an existing differing pathname.`,
    );
  }
  stdout(
    JSON.stringify({
      path: PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH,
      publication: publication.state,
      bytes: verifiedBytes.length,
      digest: inspection.digest,
      frameTableDigest: inspection.artifact.frameTableDigest,
      accounting: inspection.artifact.accounting,
    }),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50LdrawCatalogFramesCli();

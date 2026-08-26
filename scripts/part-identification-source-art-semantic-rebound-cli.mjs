import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { snapshotExactDataObject } from "./part-identification-bounded-snapshot.mjs";
import { readBoundedFile, writeContainedFile } from "./part-identification-io.mjs";
import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";
import {
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES,
  bytesFromVerifiedPartIdentificationSourceArtSemanticRebound,
  compilePartIdentificationSourceArtSemanticRebound,
  encodePartIdentificationSourceArtSemanticRebound,
  inspectVerifiedPartIdentificationSourceArtSemanticRebound,
  verifyPartIdentificationSourceArtSemanticRebound,
} from "./part-identification-source-art-semantic-rebound.mjs";
import {
  SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
} from "./part-identification-source-art-semantic-rebound-source.mjs";

const CALLOUT_ROOT = "output/callout-thumbnails";
const OUTPUT_ROOT = "output/part-identification";
const OUTPUT_FILE = "source-art-semantic-rebound.json";
const SEMANTIC_ARTIFACT_PATH = "output/part-identification/legacy-recut-semantic.json";
const WORKFLOW_STAGES = Object.freeze(["compile", "verify"]);
const PER_COMPILE_WORK_KEYS = [
  "componentPixelLimit",
  "componentPixels",
  "decodedByteLimit",
  "decodedBytes",
  "decodedPixelLimit",
  "decodedPixels",
  "fullPageRenders",
  "isolatedControlRenders",
  "isolatedImageRenders",
  "officialModelIndexCalls",
  "officialModelInputByteLimit",
  "officialModelInputBytes",
  "officialXmlDecodeByteLimit",
  "officialXmlDecodedBytes",
  "officialXmlFullDecodes",
  "pdfFetchRenderDisposeDestroyCycles",
];
const WORKFLOW_LIMITS = Object.freeze({
  componentPixels: SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS * 2,
  decodedBytes: SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES * 2,
  decodedPixels: SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS * 2,
  fullPageRenders: 100,
  isolatedControlRenders: 374,
  isolatedImageRenders: 374,
  officialModelIndexCalls: 2,
  officialModelInputBytes: 4 * 1024 * 1024,
  officialXmlDecodedBytes: 8 * 1024 * 1024,
  officialXmlFullDecodes: 4,
  pdfFetchRenderDisposeDestroyCycles: 2,
});

function exactPerCompileWork(value) {
  const work = snapshotExactDataObject(
    value,
    "Source-art semantic rebound per-compile work",
    PER_COMPILE_WORK_KEYS,
  );
  if (
    PER_COMPILE_WORK_KEYS.some((key) => !Number.isSafeInteger(work[key])) ||
    work.componentPixelLimit !== SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS ||
    work.componentPixels < 1 ||
    work.componentPixels > work.componentPixelLimit ||
    work.decodedByteLimit !== SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES ||
    work.decodedBytes < 1 ||
    work.decodedBytes > work.decodedByteLimit ||
    work.decodedPixelLimit !== SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS ||
    work.decodedPixels < 1 ||
    work.decodedPixels > work.decodedPixelLimit ||
    work.fullPageRenders < 1 ||
    work.fullPageRenders > 50 ||
    work.isolatedControlRenders < 1 ||
    work.isolatedControlRenders !== work.isolatedImageRenders ||
    work.isolatedImageRenders > 187 ||
    work.officialModelIndexCalls !== 1 ||
    work.officialModelInputByteLimit !== 2 * 1024 * 1024 ||
    work.officialModelInputBytes < 1 ||
    work.officialModelInputBytes > work.officialModelInputByteLimit ||
    work.officialXmlDecodeByteLimit !== 4 * 1024 * 1024 ||
    work.officialXmlFullDecodes !== 2 ||
    work.officialXmlDecodedBytes !== work.officialModelInputBytes * 2 ||
    work.officialXmlDecodedBytes > work.officialXmlDecodeByteLimit ||
    work.pdfFetchRenderDisposeDestroyCycles !== 1
  ) {
    throw new Error(
      `Source-art semantic rebound CLI received malformed per-compile work ${JSON.stringify(work)}.`,
    );
  }
  return work;
}

export function createSourceArtSemanticReboundCliWorkflowLedger() {
  const totals = Object.fromEntries(Object.keys(WORKFLOW_LIMITS).map((key) => [key, 0]));
  const reservations = [];
  return Object.freeze({
    async run(stage, operation) {
      const expected = WORKFLOW_STAGES[reservations.length];
      if (stage !== expected || typeof operation !== "function") {
        throw new Error(
          `Source-art semantic rebound CLI reservation ${reservations.length + 1} must be ${JSON.stringify(expected ?? "none; workflow already complete")}; received ${JSON.stringify(stage)}. An extra protected operation is forbidden before it can read source inputs or do work.`,
        );
      }
      reservations.push(stage);
      const completed = snapshotExactDataObject(
        await operation(),
        `Source-art semantic rebound ${stage} completion`,
        ["result", "work"],
      );
      const work = exactPerCompileWork(completed.work);
      for (const key of Object.keys(totals)) totals[key] += work[key];
      if (
        Object.entries(totals).some(
          ([key, observed]) => !Number.isSafeInteger(observed) || observed > WORKFLOW_LIMITS[key],
        )
      ) {
        throw new Error(
          `Source-art semantic rebound CLI workflow ${JSON.stringify(totals)} exceeds fixed limits ${JSON.stringify(WORKFLOW_LIMITS)}. Reduce source work; do not raise the limits.`,
        );
      }
      return completed.result;
    },
    report() {
      if (reservations.length !== WORKFLOW_STAGES.length) {
        throw new Error(
          `Source-art semantic rebound CLI completed ${reservations.length} of ${WORKFLOW_STAGES.length} protected operations.`,
        );
      }
      return Object.freeze({
        compilePasses: reservations.length,
        ...totals,
        limits: WORKFLOW_LIMITS,
      });
    },
  });
}

function semanticClosureInput() {
  return {
    calloutRoot: CALLOUT_ROOT,
    currentManifestBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.currentManifest.path, {
      label: "Pinned current /6 callout manifest",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.currentManifest.bytes,
    }),
    legacyManifestBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path, {
      label: "Pinned legacy /5 callout manifest",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.legacyManifest.bytes,
    }),
    legacyRecutArtifactBytes: readBoundedFile(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path, {
      label: "Pinned verified legacy-recut artifact",
      maxBytes: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.bytes,
    }),
    officialModelBytes: readBoundedFile(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path, {
      label: "Pinned official model XML",
      maxBytes: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.bytes,
    }),
    truthBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.truth.path, {
      label: "Pinned pair-judged truth/3",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.truth.bytes,
    }),
  };
}

function reboundRawInput() {
  return {
    manifestBytes: readBoundedFile(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.manifest.path, {
      label: "Pinned current /6 callout manifest",
      maxBytes: CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.manifest.bytes,
    }),
    officialModelBytes: readBoundedFile(
      CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.officialModel.path,
      {
        label: "Pinned official model XML",
        maxBytes: CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.officialModel.bytes,
      },
    ),
    pdfBytes: readBoundedFile(CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.path, {
      label: "Pinned instruction-booklet PDF",
      maxBytes: CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.bytes,
    }),
  };
}

export async function runPartIdentificationSourceArtSemanticReboundCli() {
  const semantic = await verifyPartIdentificationLegacyRecutSemantic({
    ...semanticClosureInput(),
    artifactBytes: readBoundedFile(SEMANTIC_ARTIFACT_PATH, {
      label: "Pinned legacy-recut semantic artifact",
      maxBytes: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedArtifact.bytes,
    }),
  });
  const raw = reboundRawInput();
  const workflow = createSourceArtSemanticReboundCliWorkflowLedger();
  const compiled = await workflow.run("compile", async () => {
    const result = await compilePartIdentificationSourceArtSemanticRebound({ ...raw, semantic });
    return { result, work: result.work };
  });
  const artifactBytes = encodePartIdentificationSourceArtSemanticRebound(compiled);
  if (artifactBytes.length > SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES) {
    const sectionBytes = Object.fromEntries(
      Object.entries(compiled.rosters).map(([name, rows]) => [
        name,
        Buffer.byteLength(JSON.stringify(rows)),
      ]),
    );
    sectionBytes.exactClasses = Buffer.byteLength(JSON.stringify(compiled.exactClasses));
    throw new Error(
      `Source-art semantic rebound encoded ${artifactBytes.length} bytes above its fixed ceiling; accounting ${JSON.stringify(compiled.accounting)}; section bytes ${JSON.stringify(sectionBytes)}. Deduplicate evidence instead of raising the ceiling.`,
    );
  }
  const verified = await workflow.run("verify", async () => {
    const result = await verifyPartIdentificationSourceArtSemanticRebound({
      ...raw,
      artifactBytes,
      semantic,
    });
    return {
      result,
      work: inspectVerifiedPartIdentificationSourceArtSemanticRebound(result).artifact.work,
    };
  });
  const publishable = bytesFromVerifiedPartIdentificationSourceArtSemanticRebound(verified);
  writeContainedFile(OUTPUT_ROOT, OUTPUT_FILE, publishable, {
    label: "Source-art semantic rebound diagnostic artifact",
    maxBytes: SOURCE_ART_SEMANTIC_REBOUND_MAX_ARTIFACT_BYTES,
  });
  const inspection = inspectVerifiedPartIdentificationSourceArtSemanticRebound(verified);
  console.log(
    JSON.stringify({
      file: `${OUTPUT_ROOT}/${OUTPUT_FILE}`,
      bytes: publishable.length,
      digest: inspection.digest,
      accounting: inspection.artifact.accounting,
      commitments: inspection.artifact.commitments,
      work: inspection.artifact.work,
      workflow: workflow.report(),
      refusals: inspection.artifact.rosters.refusedSourceArt,
      authority: inspection.artifact.authority,
    }),
  );
  return inspection;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  runPartIdentificationSourceArtSemanticReboundCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

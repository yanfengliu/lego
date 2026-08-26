import { isDeepStrictEqual } from "node:util";

import { assertV6CalloutManifest, sha256Digest } from "./part-identification-artifact-source.mjs";
import { MAX_IMAGE_ARTIFACT_BYTES, readContainedFile } from "./part-identification-io.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
import {
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS,
  PREFIX50_STATIC_REVIEWED_MAP,
  assertPinnedJson,
} from "./part-identification-prefix50-semantic-closure-source.mjs";
import {
  assertReviewOutcomes,
  bindSameReviewOutcomes,
} from "./part-identification-prefix50-semantic-closure-review.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;
const exactKeys = (value, keys) =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");

function indexUnique(rows, key, label) {
  const result = new Map();
  for (const [index, row] of rows.entries()) {
    const value = row?.[key];
    if (typeof value !== "string" || value.length === 0 || result.has(value)) {
      throw new Error(`${label} row ${index} must have one unique nonempty ${key}.`);
    }
    result.set(value, row);
  }
  return result;
}

function assertInventoryManifest(value) {
  if (
    value?.schemaVersion !== "lego.inventory-thumbnails/1" ||
    value.sourceHash !==
      "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" ||
    value.totalPieces !== 1_465 ||
    value.distinctElements !== 276 ||
    value.published !== 276 ||
    value.contaminated !== 0 ||
    !Array.isArray(value.thumbnails) ||
    value.thumbnails.length !== 276
  ) {
    throw new Error(
      "Prefix-50 semantic closure requires the exact complete uncontaminated 276-element inventory manifest.",
    );
  }
  return indexUnique(value.thumbnails, "elementId", "Inventory manifest");
}

function assertResolution(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Element resolution must be one exact element-keyed JSON object.");
  }
  for (const [elementId, row] of Object.entries(value)) {
    if (
      !/^[1-9]\d*$/u.test(elementId) ||
      !exactKeys(row, ["colorId", "name", "partNum", "quantity"]) ||
      typeof row.partNum !== "string" ||
      row.partNum.length === 0 ||
      typeof row.name !== "string" ||
      row.name.length === 0 ||
      !/^\d+$/u.test(row.colorId) ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1
    ) {
      throw new Error(
        `Element resolution ${JSON.stringify(elementId)} is not an exact published mapping.`,
      );
    }
  }
  return value;
}

async function officialDesignIndex(bytes) {
  const officialModule = await importRepositoryTypeScript(
    moduleUrl("../apps/web/e2e/real-build-official.ts"),
  );
  const official = officialModule.parseOfficialModelIndex(bytes);
  const failures = officialModule.validateOfficialModelAccounting(official);
  if (failures.length > 0) {
    throw new Error(
      `Official model accounting rejected semantic closure: ${failures.map(({ code }) => code).join(", ")}.`,
    );
  }
  const result = new Map();
  for (const brick of Object.values(official.bricks)) {
    for (const elementId of brick.itemNos) {
      const prior = result.get(elementId);
      if (prior !== undefined && prior !== brick.designId) {
        throw new Error(
          `Official element ${elementId} resolves to both design ${prior} and ${brick.designId}; semantic identity is ambiguous.`,
        );
      }
      result.set(elementId, brick.designId);
    }
  }
  const identityRefs = official.builderOrder.phases.flatMap((phase) =>
    phase.kind === "direct"
      ? phase.brickRefs
      : phase.copies.map(({ actualBrickRef }) => actualBrickRef),
  );
  if (identityRefs.length < 320) {
    throw new Error(
      `Official Builder order contains only ${identityRefs.length} physical identities; global prefix conservation requires the exact first 320.`,
    );
  }
  const first320Sequence = identityRefs.slice(0, 320).map((brickRef, index) => {
    const brick = official.bricks[brickRef];
    if (brick === undefined || brick.itemNos.length !== 1) {
      throw new Error(
        `Official Builder identity ${index + 1} requires one exact element itemNo for global prefix conservation.`,
      );
    }
    return {
      builderIdentityOrdinal: index + 1,
      elementId: brick.itemNos[0],
      officialDesignId: brick.designId,
    };
  });
  return { designIndex: result, first320Sequence };
}

function assertReview57(value) {
  const keys = [
    "classDigest",
    "elementId",
    "identity",
    "inventoryFile",
    "inventorySha256",
    "normalizedProgramSha256",
    "officialDesignId",
    "pageNumber",
    "quantity",
    "sourceFile",
    "sourceSha256",
    "stepNumber",
  ];
  if (!Array.isArray(value) || value.length !== 57) {
    throw new Error(
      "Prefix-50 semantic closure requires exactly 57 rows in the broad visual review.",
    );
  }
  for (const [index, row] of value.entries()) {
    if (
      !exactKeys(row, keys) ||
      !SHA256.test(row.classDigest ?? "") ||
      !SHA256.test(row.normalizedProgramSha256 ?? "")
    ) {
      throw new Error(`Broad visual review row ${index} has drifted fields or commitments.`);
    }
  }
  return value;
}

function assertReview3(value) {
  const expectedAuthority = {
    semanticIdentity: true,
    physicalAssignment: false,
    physicalFrame: false,
    placement: false,
    documentMutation: false,
    completion: false,
  };
  const rowKeys = [
    "calloutContamination",
    "calloutDigest",
    "calloutFile",
    "designId",
    "elementId",
    "identity",
    "inventoryContamination",
    "inventoryDigest",
    "inventoryFile",
    "quantity",
    "review",
    "stepNumber",
  ];
  if (
    !exactKeys(value, [
      "authority",
      "inputs",
      "reviewMethod",
      "reviewOutcome",
      "reviewedAt",
      "rows",
      "schemaVersion",
    ]) ||
    value.schemaVersion !== CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3.schemaVersion ||
    !isDeepStrictEqual(value.authority, expectedAuthority) ||
    !isDeepStrictEqual(value.inputs, {
      calloutManifestDigest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.calloutManifest.digest,
      inventoryManifestDigest: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest.digest,
    }) ||
    value.reviewOutcome !== "same-semantic-element" ||
    !Array.isArray(value.rows) ||
    value.rows.length !== 3
  ) {
    throw new Error(
      "Three-row visual review has drifted from its exact closed semantic review contract.",
    );
  }
  for (const [index, row] of value.rows.entries()) {
    if (
      !exactKeys(row, rowKeys) ||
      row.review !== "same" ||
      !isDeepStrictEqual(row.calloutContamination, []) ||
      !isDeepStrictEqual(row.inventoryContamination, [])
    ) {
      throw new Error(
        `Three-row visual review row ${index} has drifted evidence or authority fields.`,
      );
    }
  }
  return value.rows;
}

function reviewedRows(review57, review3) {
  return [
    ...PREFIX50_STATIC_REVIEWED_MAP.map((row) => ({
      ...row,
      evidenceMethod: "manual-reviewed-static-map",
    })),
    ...review57.map((row) => ({
      identity: row.identity,
      elementId: row.elementId,
      pageNumber: row.pageNumber,
      stepNumber: row.stepNumber,
      quantity: row.quantity,
      officialDesignId: row.officialDesignId,
      sourceFile: row.sourceFile,
      sourceCropSha256: row.sourceSha256,
      inventoryFile: row.inventoryFile,
      inventoryCropSha256: row.inventorySha256,
      evidenceMethod: "manual-reviewed-57-roster",
    })),
    ...review3.map((row) => ({
      identity: row.identity,
      elementId: row.elementId,
      stepNumber: row.stepNumber,
      quantity: row.quantity,
      officialDesignId: row.designId,
      sourceFile: row.calloutFile,
      sourceCropSha256: row.calloutDigest,
      inventoryFile: row.inventoryFile,
      inventoryCropSha256: row.inventoryDigest,
      evidenceMethod: "manual-reviewed-3-roster",
    })),
  ];
}

function reopenEvidence(root, relativePath, expectedBytes, expectedDigest, label) {
  const bytes = readContainedFile(root, relativePath, {
    label,
    pathLabel: `${label} path`,
    maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
  });
  const digest = sha256Digest(bytes);
  if (bytes.length !== expectedBytes || digest !== expectedDigest) {
    throw new Error(
      `${label} reopened as ${bytes.length} bytes at ${digest}, not manifest-bound ${expectedBytes} bytes at ${expectedDigest}.`,
    );
  }
}

function semanticRow(row, source, designId, resolution) {
  return {
    elementId: row.elementId,
    evidenceMethod: row.evidenceMethod,
    identity: row.identity,
    officialDesignId: designId,
    pageNumber: source.pageNumber,
    publishedColorId: resolution.colorId,
    publishedPartNum: resolution.partNum,
    quantity: source.quantity,
    stepNumber: source.stepNumber,
  };
}

function verifyManualRow(row, context) {
  const source = context.callouts.get(row.identity);
  const inventory = context.inventory.get(row.elementId);
  const resolution = context.resolution[row.elementId];
  const designId = context.officialDesign.get(row.elementId);
  if (
    source === undefined ||
    source.evidenceKind !== "part-art" ||
    source.stepNumber > 50 ||
    (row.pageNumber !== undefined && row.pageNumber !== source.pageNumber) ||
    (row.stepNumber !== undefined && row.stepNumber !== source.stepNumber) ||
    (row.quantity !== undefined && row.quantity !== source.quantity) ||
    inventory === undefined ||
    resolution === undefined ||
    designId === undefined ||
    (row.officialDesignId !== undefined && row.officialDesignId !== designId) ||
    resolution.quantity !== inventory.quantity
  ) {
    throw new Error(
      `Reviewed identity ${JSON.stringify(row.identity)} does not exactly reconcile source, inventory, resolution, and official semantic fields.`,
    );
  }
  if (
    !isDeepStrictEqual(source.contamination, []) ||
    !isDeepStrictEqual(inventory.contamination, [])
  ) {
    throw new Error(
      `Reviewed identity ${JSON.stringify(row.identity)} requires empty source and inventory contamination arrays.`,
    );
  }
  const sourceFile = row.sourceFile ?? source.file;
  const sourceDigest = row.sourceCropSha256 ?? source.sha256;
  const inventoryFile = row.inventoryFile ?? inventory.file;
  const inventoryDigest = row.inventoryCropSha256 ?? inventory.sha256;
  if (
    sourceFile !== source.file ||
    sourceDigest !== source.sha256 ||
    inventoryFile !== inventory.file ||
    inventoryDigest !== inventory.sha256 ||
    inventory.file !== `${row.elementId}.png`
  ) {
    throw new Error(
      `Reviewed identity ${JSON.stringify(row.identity)} names crop evidence that differs from the exact manifests.`,
    );
  }
  reopenEvidence(
    context.calloutRoot,
    source.file,
    source.byteLength,
    source.sha256,
    `Prefix-50 callout ${JSON.stringify(row.identity)}`,
  );
  reopenEvidence(
    context.inventoryRoot,
    inventory.file,
    inventory.byteLength,
    inventory.sha256,
    `Prefix-50 inventory ${JSON.stringify(row.elementId)}`,
  );
  const semantic = semanticRow(row, source, designId, resolution);
  return {
    semantic,
    evidence: {
      ...semantic,
      inventoryCropSha256: inventory.sha256,
      sourceCropSha256: source.sha256,
    },
  };
}

export async function authenticatePrefix50ClosureEvidence(input) {
  const manifest = assertPinnedJson(
    input.calloutManifestBytes,
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.calloutManifest,
    "Prefix-50 callout manifest",
  );
  assertV6CalloutManifest(manifest);
  const inventoryManifest = assertPinnedJson(
    input.inventoryManifestBytes,
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest,
    "Prefix-50 inventory manifest",
  );
  const resolution = assertResolution(
    assertPinnedJson(
      input.elementResolutionBytes,
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution,
      "Prefix-50 element resolution",
    ),
  );
  const review57 = assertReview57(
    assertPinnedJson(
      input.review57Bytes,
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57,
      "Prefix-50 57-row review",
    ),
  );
  const review3 = assertReview3(
    assertPinnedJson(
      input.review3Bytes,
      CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3,
      "Prefix-50 three-row review",
    ),
  );
  const reviewOutcomesValue = assertPinnedJson(
    input.reviewOutcomesBytes,
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.reviewOutcomes,
    "Prefix-50 inspected review outcomes",
  );
  const callouts = indexUnique(manifest.callouts, "identity", "Callout manifest");
  const inventory = assertInventoryManifest(inventoryManifest);
  const officialEvidence = await officialDesignIndex(input.officialModelBytes);
  const officialDesign = officialEvidence.designIndex;
  const rows = reviewedRows(review57, review3);
  if (rows.length !== 101 || new Set(rows.map(({ identity }) => identity)).size !== 101) {
    throw new Error(
      "Manual semantic review must contain exactly 101 unique identities across 41+57+3 rows.",
    );
  }
  const context = {
    calloutRoot: input.calloutRoot,
    inventoryRoot: input.inventoryRoot,
    callouts,
    inventory,
    resolution,
    officialDesign,
  };
  const verified = rows.map((row) => verifyManualRow(row, context));
  const expectedOutcomeRows = [...verified]
    .sort(
      (left, right) =>
        left.semantic.stepNumber - right.semantic.stepNumber ||
        (left.semantic.identity < right.semantic.identity
          ? -1
          : left.semantic.identity > right.semantic.identity
            ? 1
            : 0),
    )
    .map(({ evidence }) => ({
      identity: evidence.identity,
      elementId: evidence.elementId,
      calloutDigest: evidence.sourceCropSha256,
      inventoryDigest: evidence.inventoryCropSha256,
    }));
  const reviewOutcomes = assertReviewOutcomes(reviewOutcomesValue, expectedOutcomeRows);
  const accepted = bindSameReviewOutcomes(verified, reviewOutcomes);
  return {
    manifest,
    inventoryManifest,
    officialDesign,
    resolution,
    officialFirst320Sequence: officialEvidence.first320Sequence,
    semanticRows: accepted.map(({ semantic }) => semantic),
    evidenceRows: accepted.map(({ evidence, reviewOutcome }) => ({
      ...evidence,
      reviewOutcome,
    })),
    groupRows: {
      static: accepted
        .filter(({ semantic }) => semantic.evidenceMethod === "manual-reviewed-static-map")
        .map(({ semantic }) => semantic),
      review57: accepted
        .filter(({ semantic }) => semantic.evidenceMethod === "manual-reviewed-57-roster")
        .map(({ semantic }) => semantic),
      review3: accepted
        .filter(({ semantic }) => semantic.evidenceMethod === "manual-reviewed-3-roster")
        .map(({ semantic }) => semantic),
    },
  };
}

export function enrichSafeSemanticRows(rows, resolution, officialDesign) {
  return rows.map((row) => {
    const published = resolution[row.elementId];
    const official = officialDesign.get(row.elementId);
    if (published === undefined || official !== row.officialDesignId) {
      throw new Error(
        `Safe semantic identity ${row.identity} does not reconcile its exact element-resolution and official design.`,
      );
    }
    return {
      elementId: row.elementId,
      evidenceMethod: row.evidenceMethod,
      identity: row.identity,
      officialDesignId: row.officialDesignId,
      pageNumber: row.pageNumber,
      publishedColorId: published.colorId,
      publishedPartNum: published.partNum,
      quantity: row.quantity,
      stepNumber: row.stepNumber,
    };
  });
}

export const __testOnly = Object.freeze({
  assertReview3,
  assertReviewOutcomes,
  verifyManualRow,
});

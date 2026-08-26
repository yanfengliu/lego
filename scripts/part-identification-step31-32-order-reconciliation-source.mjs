import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes } from "./part-identification-artifact-source.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  sha256Digest,
} from "./part-identification-legacy-recut-source.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES,
} from "./part-identification-legacy-recut-semantic-source.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

export const STEP31_32_ORDER_RECONCILIATION_SCHEMA =
  "lego.part-identification-step31-32-order-reconciliation/2";
export const STEP31_32_ORDER_RECONCILIATION_MAX_ARTIFACT_BYTES = 64 * 1024;

export const REVIEWED_STEP31_32_SEMANTIC_MAP = Object.freeze([
  Object.freeze({
    identity: "p35|q1|x49.835|y481.711",
    pageNumber: 35,
    stepNumber: 31,
    quantity: 1,
    sourceCropSha256: "sha256:6326e679ebcf36962b1c36096831f790725f9e02a14e5c4a1dc095130e5eefc5",
    inventoryCropSha256: "sha256:21d7825a2818190b6a3bfed0710ef735a689e11377aac00b308ff96318cb079a",
    elementId: "4211398",
    officialDesignId: "3023",
    evidenceMethod: "manual-visual-source-and-inventory-crops",
  }),
  Object.freeze({
    identity: "p35|q2|x147.987|y481.711",
    pageNumber: 35,
    stepNumber: 31,
    quantity: 2,
    sourceCropSha256: "sha256:f7621f333493b3683beb089ca9378fb44a7c4f530a6c4cbdf0d31dd762f9a878",
    inventoryCropSha256: "sha256:84e94fcf969cd4ae945e09bcbca792610484927e611017f03f5f58a689e841ab",
    elementId: "4618852",
    officialDesignId: "3245",
    evidenceMethod: "manual-visual-source-and-inventory-crops",
  }),
  Object.freeze({
    identity: "p36|q2|x115.277|y421.615",
    pageNumber: 36,
    stepNumber: 32,
    quantity: 2,
    sourceCropSha256: "sha256:7f1150f9ffbcf4eb0d4f03dc1150c547f58e75fadd64f3934ed52d436c41a2bf",
    inventoryCropSha256: "sha256:8f4f0ff6fbff2ed2b8e68e5d4fbba94e2ccd7c58b244b26e5de010ca07778ae4",
    elementId: "4211104",
    officialDesignId: "3622",
    evidenceMethod: "manual-visual-source-and-inventory-crops",
  }),
]);

const phase = (sequence, phaseId, sourceDigest, firstBuilderIdentityOrdinal, memberCommitment) =>
  Object.freeze({
    sequence,
    phaseId,
    sourceDigest,
    firstBuilderIdentityOrdinal,
    memberCommitment: Object.freeze(memberCommitment),
  });

export const STEP31_32_PHASE_BLUEPRINTS = Object.freeze([
  phase(
    49,
    "direct:42d4892a-b3a3-49fc-960c-270581a1a92f:1",
    "sha256:d751038855ca974bbafcea57ef1635a0bca1d51faeebdcc3fda4e39875a5c20f",
    181,
    {
      rows: 2,
      bytes: 256,
      digest: "sha256:4d54f4b594f240ebeae4aaf3df0e498cbfdea05515e1d880c0a3e6dae41764a7",
    },
  ),
  phase(
    50,
    "direct:8fc61171-d663-474e-af48-025471100b84:1",
    "sha256:1a2b172c743b2d9acb1c977ac38812c5a08a18321e23eb93212c1d5affd79ab6",
    183,
    {
      rows: 2,
      bytes: 256,
      digest: "sha256:6c0c29d6272dae7e3a878b5c3aa2a4af2144232c67b0a17c363dd14a00dbe5d9",
    },
  ),
  phase(
    51,
    "direct:3e61f971-e245-4cd0-a914-b3b1e61aea54:1",
    "sha256:30cab72f789f7b4738c21ef1aae513746f033b0973c3b5c4a1ba3429237690ca",
    185,
    {
      rows: 1,
      bytes: 129,
      digest: "sha256:5f3569dd511e774044a4367ea038b425bf6f9780b582ff2ea5a817472d41cf6e",
    },
  ),
  phase(
    52,
    "direct:ce0d391c-956a-406c-9359-04c59c7264f5:1",
    "sha256:f3733e34d92aee91119757209eff716bee4f372518b7d8349d9fafeeb4b80045",
    186,
    {
      rows: 1,
      bytes: 129,
      digest: "sha256:affa1b292e8847b69aa5d5d0016fe3d7caa1de7a99c39a58d7936dd5240fd48d",
    },
  ),
  phase(
    53,
    "direct:010f5f61-c785-4e4d-9086-3657e3249a1d:1",
    "sha256:d6b4fa8101c7591899a0d8644df6298fd9f75956b54e52f7ff564025f7f0f194",
    187,
    {
      rows: 3,
      bytes: 382,
      digest: "sha256:70fd6775f3f1f7a0812c4203cef2bf54a7cd8b23549064c9cff011c4c3aad0d2",
    },
  ),
  phase(
    54,
    "direct:6626fb6e-5fc0-4c12-b79f-cac495ecba46:1",
    "sha256:3b5ef66b5445588ad2a12ca8113fd98e9c789e68b010dd83a40bed5fa5490229",
    190,
    {
      rows: 5,
      bytes: 636,
      digest: "sha256:c9c1cd73534bd536755b2b393c822171960d003742d313c42672bd224decbda0",
    },
  ),
]);

export const CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  currentManifest: CURRENT_LEGACY_RECUT_PINS.currentManifest,
  officialModel: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel,
  officialPhaseDigest: "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e",
  reviewEvidence: Object.freeze({
    sourcePdfDigest: CURRENT_LEGACY_RECUT_PINS.sourceHash,
    inventoryManifest: Object.freeze({
      path: "output/inventory-thumbnails/manifest.json",
      schemaVersion: "lego.inventory-thumbnails/1",
      bytes: 269_834,
      digest: "sha256:aac36ddc934bd0860782f9158dc80865357d1490b23f74fce827291f09160491",
    }),
  }),
  expectedSourceIndex: Object.freeze({
    expectedPrintedSteps: 359,
    lastIndexedStep: 358,
    rosterSha256: CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex.rosterSha256,
    rosterBytes: CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex.rosterBytes,
    calloutRows: 881,
    partArtRows: 859,
    nonPartRows: 22,
    subassemblyRepeatRows: 17,
    assemblyActionRows: 5,
    prefixLastStep: 50,
    prefixRows: 189,
    prefixPieces: 326,
    prefixPartArtRows: 187,
    prefixPartArtPieces: 320,
    suffixStepsReconstructed: false,
    cropByteEvidence: "not-consumed-reviewed-digests-only",
  }),
  expectedArtifact: Object.freeze({
    bytes: 6_680,
    digest: "sha256:66451b2324142d9f563b731739532c38be06e34018eb8397bacfe4a0e6245810",
  }),
});

function assertPinnedArtifact(bytes, pin, label) {
  const artifact = jsonArtifactFromBytes(bytes, label);
  if (
    artifact.bytes.length !== pin.bytes ||
    artifact.digest !== pin.digest ||
    artifact.value?.schemaVersion !== pin.schemaVersion
  ) {
    throw new Error(
      `${label} must be the exact pinned ${pin.schemaVersion} artifact with ${pin.bytes} bytes at ${pin.digest}; received ${artifact.value?.schemaVersion ?? "missing schema"}, ${artifact.bytes.length} bytes at ${artifact.digest}.`,
    );
  }
  return artifact.value;
}

function observedSourceIndex(callouts) {
  const prefix = callouts.filter((row) => row.stepNumber <= 50);
  const partArt = callouts.filter((row) => row.evidenceKind === "part-art");
  const prefixPartArt = prefix.filter((row) => row.evidenceKind === "part-art");
  return {
    expectedPrintedSteps: 359,
    lastIndexedStep: Math.max(...callouts.map((row) => row.stepNumber)),
    rosterSha256: CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex.rosterSha256,
    rosterBytes: CURRENT_LEGACY_RECUT_PINS.expectedSourceIndex.rosterBytes,
    calloutRows: callouts.length,
    partArtRows: partArt.length,
    nonPartRows: callouts.length - partArt.length,
    subassemblyRepeatRows: callouts.filter((row) => row.evidenceKind === "subassembly-repeat")
      .length,
    assemblyActionRows: callouts.filter((row) => row.evidenceKind === "assembly-action").length,
    prefixLastStep: 50,
    prefixRows: prefix.length,
    prefixPieces: prefix.reduce((total, row) => total + row.quantity, 0),
    prefixPartArtRows: prefixPartArt.length,
    prefixPartArtPieces: prefixPartArt.reduce((total, row) => total + row.quantity, 0),
    suffixStepsReconstructed: false,
    cropByteEvidence: "not-consumed-reviewed-digests-only",
  };
}

export function authenticateStep31_32Manifest(
  bytes,
  reviewedMap = REVIEWED_STEP31_32_SEMANTIC_MAP,
) {
  const manifest = assertPinnedArtifact(
    bytes,
    CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.currentManifest,
    "Step-31/32 current callout manifest",
  );
  if (
    manifest.sourceHash !== CURRENT_LEGACY_RECUT_PINS.sourceHash ||
    manifest.pageSelection !== "full booklet" ||
    manifest.pagesCropped !== 196 ||
    manifest.calloutCount !== 881 ||
    !Array.isArray(manifest.callouts) ||
    manifest.callouts.length !== 881
  ) {
    throw new Error(
      "Step-31/32 reconciliation requires the exact full-booklet 881-row source manifest.",
    );
  }
  const identities = new Map();
  for (const row of manifest.callouts) {
    if (
      typeof row?.identity !== "string" ||
      identities.has(row.identity) ||
      !Number.isSafeInteger(row.stepNumber) ||
      row.stepNumber < 1 ||
      row.stepNumber > 359 ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1
    ) {
      throw new Error("Step-31/32 source manifest contains an invalid or repeated callout row.");
    }
    identities.set(row.identity, row);
  }
  const sourceIndex = observedSourceIndex(manifest.callouts);
  if (
    !isDeepStrictEqual(sourceIndex, CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.expectedSourceIndex)
  ) {
    throw new Error(
      `Step-31/32 reconciliation must retain the exact 359-step source index; received ${JSON.stringify(sourceIndex)}.`,
    );
  }
  assertReviewedSemanticMap(reviewedMap, identities);
  return Object.freeze({ identities, callouts: manifest.callouts, sourceIndex });
}

export function assertReviewedSemanticMap(rows, manifestRows) {
  const expectedKeys = [
    "elementId",
    "evidenceMethod",
    "identity",
    "inventoryCropSha256",
    "officialDesignId",
    "pageNumber",
    "quantity",
    "sourceCropSha256",
    "stepNumber",
  ];
  if (!Array.isArray(rows) || rows.length !== REVIEWED_STEP31_32_SEMANTIC_MAP.length) {
    throw new Error(
      "Step-31/32 reconciliation requires exactly three reviewed semantic rows; incomplete or extra maps are forbidden.",
    );
  }
  for (const [index, row] of rows.entries()) {
    if (
      Object.keys(row ?? {})
        .sort()
        .join(",") !== expectedKeys.join(",")
    ) {
      throw new Error(
        `Reviewed semantic row ${index} must contain exactly ${expectedKeys.join(", ")}; physical assignment and authority fields are forbidden.`,
      );
    }
    if (!isDeepStrictEqual(row, REVIEWED_STEP31_32_SEMANTIC_MAP[index])) {
      throw new Error(
        `Reviewed semantic row ${index} drifted from its exact visually reviewed identity; quantity-only substitutions are forbidden.`,
      );
    }
    const source = manifestRows.get(row.identity);
    if (
      source?.pageNumber !== row.pageNumber ||
      source?.stepNumber !== row.stepNumber ||
      source?.quantity !== row.quantity ||
      source?.sha256 !== row.sourceCropSha256 ||
      source?.evidenceKind !== "part-art"
    ) {
      throw new Error(
        `Reviewed semantic row ${row.identity} no longer matches its digest-bound current manifest crop.`,
      );
    }
  }
}

export async function authenticateStep31_32OfficialModel(bytes) {
  const pin = CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialModel;
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new Error(
      `Step-31/32 official model must be the exact ${pin.bytes}-byte XML at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  if (bytes.length > LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES) {
    throw new Error("Step-31/32 official model exceeds its fixed XML byte limit.");
  }
  const officialModule = await importRepositoryTypeScript(
    moduleUrl("../apps/web/e2e/real-build-official.ts"),
  );
  const official = officialModule.parseOfficialModelIndex(bytes);
  const failures = officialModule.validateOfficialModelAccounting(official);
  if (failures.length > 0 || official.digest !== pin.digest) {
    throw new Error(
      `Step-31/32 official model accounting failed: ${failures.map((failure) => failure.code).join(", ")}.`,
    );
  }
  if (
    official.builderOrder.phaseDigest !==
    CURRENT_STEP31_32_ORDER_RECONCILIATION_PINS.officialPhaseDigest
  ) {
    throw new Error(
      "Step-31/32 official Builder phase commitment drifted from the reviewed source order.",
    );
  }
  return official;
}

export const commitmentFor = (rows) => {
  const bytes = Buffer.from(`${JSON.stringify(rows)}\n`);
  return Object.freeze({ rows: rows.length, bytes: bytes.length, digest: sha256Digest(bytes) });
};

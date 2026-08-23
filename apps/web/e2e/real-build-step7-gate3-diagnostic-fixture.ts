import { createHash } from "node:crypto";

import type { Page } from "@playwright/test";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import type { FartherPlacementWitness } from "./real-build-farther-panel-types";
import type {
  Step7Gate3BrowserInput,
  Step7Gate3Origin,
  Step7Gate3Panel,
} from "./real-build-step7-gate3-diagnostic-browser";

export const SOURCE_RUN =
  "output/direct-origin-k-production/runs/" +
  "2026-08-12T10-28-52-560Z-34694c87c62e-26128a38-4d9e-4294-9091-6aae9b3ca367";
export const OUTPUT_ROOT =
  process.env.LEGO_GATE3_STEP7_DIAGNOSTIC_OUT ?? "output/gate3-step7-diagnostic";

export const EXPECTED = Object.freeze({
  artifactManifest: {
    bytes: 662_466,
    digest: "sha256:4dc5ce021e03ba0bc86667a64a1948f9ad54d2d80f95eb887b559a593c7036aa",
  },
  score: {
    bytes: 83_930,
    digest: "sha256:cbdf5b5502448011356b7fdb15f655734e97021853a45f41d64f63fd3f9e042e",
  },
  diagnosticPrefix: {
    bytes: 14_896,
    digest: "sha256:2edf84fbf1eab57e86cd2670f9bdb5e60a7ac33dbda454f22d9c9a85cbf8b70f",
  },
  replayClosure: {
    bytes: 725_460,
    digest: "sha256:a8562c9ae06569f54e8df4ac7b3ec28d6975466ea77a8e662116e70da61b88ef",
    manifestDigest: "sha256:1c27df8a95c655f7508436489e8e31f486f806c7a5382df76d53e0a80801a66c",
  },
  preparedOptions: {
    bytes: 1_339_294,
    digest: "sha256:030482e93f29014965157ff014a20a5ac88b1b5e58b001c9305e61593fa3980b",
  },
  pdf: {
    bytes: 70_238_655,
    digest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  },
  baseDocumentHash: "sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
  orderedParentIds: [
    "step-006:sha256:a806c6e4db60f71f1193cf7f28aa99189f7666278b64bff6beb075d2646d27e4",
    "step-006:sha256:e637dbcdbad7994ae642f3ab8e3d9c366864730b0d957e2ac75836e150edf1bf",
    "step-006:sha256:d3c69d1704953033eeca63f5702d237cf8a066fc83d3a46e12d1eea23a2f5898",
    "step-006:sha256:0ecf6da53de325a283cc64d5c317583d831c82ab707d64b8b21eb6765169f1c1",
  ],
});

export const sha256 = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export function readPinnedFile(
  runRoot: string,
  file: string,
  expected: { readonly bytes: number; readonly digest: string },
): Buffer {
  return readContainedBoundedRegularFile(runRoot, file, {
    label: `pinned Gate-3 source ${file}`,
    exactBytes: expected.bytes,
    maximumBytes: expected.bytes,
    expectedSha256: expected.digest,
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const expected = [...keys].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(
      `${label} keys are [${actual.join(", ")}]; required [${expected.join(", ")}].`,
    );
  }
}

function parseWitness(value: unknown, label: string): FartherPlacementWitness {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  exactKeys(value, ["catalogPartId", "colorId", "transform"], label);
  if (
    typeof value.catalogPartId !== "string" ||
    typeof value.colorId !== "string" ||
    !isRecord(value.transform)
  ) {
    throw new TypeError(`${label} has malformed part identity or transform.`);
  }
  exactKeys(value.transform, ["positionLdu", "orientationId"], `${label}.transform`);
  if (
    !Array.isArray(value.transform.positionLdu) ||
    value.transform.positionLdu.length !== 3 ||
    value.transform.positionLdu.some((coordinate) => !Number.isSafeInteger(coordinate)) ||
    typeof value.transform.orientationId !== "string"
  ) {
    throw new TypeError(`${label}.transform must contain an exact integer tuple and orientation.`);
  }
  return Object.freeze({
    catalogPartId: value.catalogPartId,
    colorId: value.colorId,
    transform: Object.freeze({
      positionLdu: Object.freeze([...value.transform.positionLdu]) as readonly [
        number,
        number,
        number,
      ],
      orientationId: value.transform.orientationId,
    }),
  });
}

export function projectOrigins(score: unknown): readonly Step7Gate3Origin[] {
  if (!isRecord(score) || !Array.isArray(score.steps)) {
    throw new TypeError("Pinned score does not contain a step array.");
  }
  const step6 = score.steps.find(
    (step): step is Record<string, unknown> => isRecord(step) && step.stepNumber === 6,
  );
  const farther = isRecord(step6?.farther) ? step6.farther : null;
  const origin = farther !== null && isRecord(farther.origin) ? farther.origin : null;
  const candidates = origin !== null && Array.isArray(origin.candidates) ? origin.candidates : null;
  if (candidates === null || candidates.length !== EXPECTED.orderedParentIds.length) {
    throw new TypeError("Pinned score does not retain exactly four step-6 origin candidates.");
  }
  return Object.freeze(
    candidates.map((candidate, index) => {
      if (!isRecord(candidate)) throw new TypeError(`Pinned origin ${index} must be an object.`);
      const candidateId = candidate.candidateId;
      const documentHash = candidate.documentHash;
      if (
        candidateId !== EXPECTED.orderedParentIds[index] ||
        typeof documentHash !== "string" ||
        candidateId !== `step-006:${documentHash}` ||
        !Array.isArray(candidate.pieces) ||
        candidate.pieces.length !== 4
      ) {
        throw new TypeError(`Pinned origin ${index} does not match its exact ordered identity.`);
      }
      return Object.freeze({
        candidateId,
        documentHash,
        pieces: Object.freeze(
          candidate.pieces.map((piece, pieceIndex) =>
            parseWitness(piece, `Pinned origin ${index} piece ${pieceIndex}`),
          ),
        ),
      });
    }),
  );
}

export function projectPanel(preparedOptions: unknown): {
  readonly panel: Step7Gate3Panel;
  readonly numeric: Pick<
    Step7Gate3BrowserInput["options"],
    "renderScale" | "panelWidth" | "workFactor" | "proximityMarginPx" | "minimumScoreMargin"
  >;
} {
  if (!isRecord(preparedOptions) || !Array.isArray(preparedOptions.panels)) {
    throw new TypeError("Pinned prepared options do not contain a panel array.");
  }
  const panel = preparedOptions.panels.find(
    (candidate): candidate is Record<string, unknown> =>
      isRecord(candidate) && candidate.stepNumber === 7,
  );
  if (
    panel === undefined ||
    panel.pageNumber !== 13 ||
    panel.panelFace !== "underside" ||
    !Array.isArray(panel.pieces) ||
    panel.pieces.length !== 4 ||
    !Array.isArray(panel.omittedPieces) ||
    panel.omittedPieces.length !== 0
  ) {
    throw new TypeError("Pinned prepared options do not contain the exact printed step-7 panel.");
  }
  exactKeys(
    panel,
    [
      "stepNumber",
      "pageNumber",
      "panelFace",
      "minXPt",
      "maxXPt",
      "minYPt",
      "maxYPt",
      "calloutBoxes",
      "mappedCalloutKeys",
      "pieces",
      "omittedPieces",
      "calloutPieces",
      "classifiedPhysicalCalloutPieces",
      "semanticMultiplierQuantity",
      "omittedPhysicalPieces",
      "action",
      "coverageFailures",
      "missingDesigns",
      "unresolvedCallouts",
    ],
    "Pinned step-7 panel",
  );
  if (!isRecord(panel.action)) {
    throw new TypeError("Pinned step-7 action must be an object.");
  }
  exactKeys(panel.action, ["kind", "assembledPieces", "evidenceDigest"], "Pinned step-7 action");
  if (panel.action.kind !== "place-callouts" || panel.action.assembledPieces !== 4) {
    throw new TypeError("Pinned step-7 action is not the exact four-piece callout placement.");
  }
  const pieces = panel.pieces.map((piece, index) => {
    if (!isRecord(piece)) {
      throw new TypeError(`Pinned step-7 piece ${index} must be an object.`);
    }
    exactKeys(
      piece,
      [
        "identityKey",
        "designId",
        "materialId",
        "catalogPartId",
        "colorId",
        "calloutKey",
        "identificationConfidence",
        "cropDigest",
        "identificationInputDigest",
        "expectedTransform",
      ],
      `Pinned step-7 piece ${index}`,
    );
    if (!("expectedTransform" in piece)) {
      throw new TypeError(`Pinned step-7 piece ${index} has no removable expectedTransform.`);
    }
    return Object.freeze({
      identityKey: piece.identityKey,
      designId: piece.designId,
      materialId: piece.materialId,
      catalogPartId: piece.catalogPartId,
      colorId: piece.colorId,
      calloutKey: piece.calloutKey,
      identificationConfidence: piece.identificationConfidence,
      cropDigest: piece.cropDigest,
      identificationInputDigest: piece.identificationInputDigest,
    }) as Step7Gate3Panel["pieces"][number];
  });
  const projectedPanel = Object.freeze({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    minXPt: panel.minXPt,
    maxXPt: panel.maxXPt,
    minYPt: panel.minYPt,
    maxYPt: panel.maxYPt,
    calloutBoxes: panel.calloutBoxes,
    mappedCalloutKeys: panel.mappedCalloutKeys,
    pieces: Object.freeze(pieces),
    omittedPieces: Object.freeze([]),
    calloutPieces: panel.calloutPieces,
    classifiedPhysicalCalloutPieces: panel.classifiedPhysicalCalloutPieces,
    semanticMultiplierQuantity: panel.semanticMultiplierQuantity,
    omittedPhysicalPieces: panel.omittedPhysicalPieces,
    action: Object.freeze({
      kind: panel.action.kind,
      assembledPieces: panel.action.assembledPieces,
      evidenceDigest: panel.action.evidenceDigest,
    }),
    coverageFailures: panel.coverageFailures,
    missingDesigns: panel.missingDesigns,
    unresolvedCallouts: panel.unresolvedCallouts,
  }) as unknown as Step7Gate3Panel;
  const projectedPanelJson = JSON.stringify(projectedPanel);
  if (
    projectedPanelJson.includes("expectedTransform") ||
    projectedPanelJson.includes('"transform"')
  ) {
    throw new TypeError("Step-7 diagnostic browser projection retained target transform data.");
  }
  const numericKeys = [
    "renderScale",
    "panelWidth",
    "workFactor",
    "proximityMarginPx",
    "minimumScoreMargin",
  ] as const;
  for (const key of numericKeys) {
    if (typeof preparedOptions[key] !== "number" || !Number.isFinite(preparedOptions[key])) {
      throw new TypeError(`Pinned prepared option ${key} is not finite.`);
    }
  }
  return {
    panel: projectedPanel,
    numeric: {
      renderScale: preparedOptions.renderScale as number,
      panelWidth: preparedOptions.panelWidth as number,
      workFactor: preparedOptions.workFactor as number,
      proximityMarginPx: preparedOptions.proximityMarginPx as number,
      minimumScoreMargin: preparedOptions.minimumScoreMargin as number,
    },
  };
}

export function canonicalTraceDigest(value: unknown): string {
  return sha256(JSON.stringify(value));
}

export async function snapshotBlankRunnerState(page: Page) {
  return page.evaluate(async () => {
    const storageKeys = (storage: Storage): string[] =>
      Array.from({ length: storage.length }, (_value, index) => storage.key(index))
        .filter((key): key is string => key !== null)
        .sort((left, right) => left.localeCompare(right));
    const indexedDbNames = (await indexedDB.databases())
      .map(({ name }) => name)
      .filter((name): name is string => typeof name === "string")
      .sort((left, right) => left.localeCompare(right));
    const serviceWorkerScopes = (await navigator.serviceWorker.getRegistrations())
      .map(({ scope }) => scope)
      .sort((left, right) => left.localeCompare(right));
    return {
      title: document.title,
      scriptCount: document.scripts.length,
      indexedDbNames,
      localStorageKeys: storageKeys(localStorage),
      sessionStorageKeys: storageKeys(sessionStorage),
      cacheNames: (await caches.keys()).sort((left, right) => left.localeCompare(right)),
      cookie: document.cookie,
      serviceWorkerScopes,
    };
  });
}

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import { derivePanelFaces, type PanelFace } from "../src/assembly/panel-face.ts";

import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "./real-build-prefix50-source-pdf-pins.ts";
import {
  executeRealBuildPrefix50Step44LaterSourceDerivation,
  type RealBuildPrefix50Step44LaterSourceDerivationResult,
  type RealBuildPrefix50Step44LaterSourceReadCapability,
} from "./real-build-prefix50-step44-later-source-authority.ts";

export {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
};
export const REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_LAST_STEP = 44 as const;
export const REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING = 45 as const;
export const REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT =
  "sha256:e0053f532df1d943c30a9c4efc450a6d710c45f6be2ad92e6dce441155748ec0" as const;
export const REAL_BUILD_PREFIX50_PAGE44_STEP43_FACE_ROWS_COMMITMENT =
  "sha256:ad03117dc84f26f25dfbe720bda1a044d351d0983795c28b55b6639e9b9062c7" as const;
export const REAL_BUILD_PREFIX50_PAGE44_STEP43_VECTOR_INPUTS_COMMITMENT =
  "sha256:4e33586219a7c7f16d4a95db090014862d0423c671daaeb6bd61ff20fe20fb29" as const;

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const repositoryEvidenceBrands = new WeakSet<object>();
const syntheticEvidenceBrands = new WeakSet<object>();

export interface RealBuildPrefix50Step44PanelFacePrefixRow {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly rotationIconPresent: boolean;
  readonly panelFace: PanelFace;
}

export interface RealBuildPrefix50Step44PanelFacePrefixEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step44-panel-face-prefix/1";
  readonly authority: "repository-pdf-vector" | "synthetic-test-only";
  readonly sourcePdfArtifactPath: "recipes/6651557.pdf" | "synthetic-test-source.pdf";
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly vectorDetector: "white-44.937pt-square-in-step-panel/1" | "synthetic-test-declaration/1";
  readonly firstPrintedStep: 1;
  readonly lastPrintedStep: 44;
  readonly coveredPageCeiling: 45;
  readonly rows: readonly RealBuildPrefix50Step44PanelFacePrefixRow[];
  readonly rowsCommitment: `sha256:${string}`;
  readonly expectedPanelFace: PanelFace;
  readonly commitment: `sha256:${string}`;
}

type PrefixRowInput = Readonly<{
  stepNumber: number;
  pageNumber: number;
  rotationIconPresent: boolean;
}>;

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalDigest(actual) !== canonicalDigest(wanted))
    throw new TypeError(`${label} must contain only ${wanted.join(", ")}.`);
}

export function validateRealBuildPrefix50Step44PanelFacePrefixRows(
  rows: readonly PrefixRowInput[],
  coveredPageCeiling = REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING,
): readonly RealBuildPrefix50Step44PanelFacePrefixRow[] {
  if (
    coveredPageCeiling !== REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING ||
    rows.length !== REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_LAST_STEP
  )
    throw new TypeError(
      "Step-44 panel-face evidence requires exactly printed steps 1..44 under the page-45 ceiling.",
    );
  let previousPage = 0;
  for (const [index, row] of rows.entries()) {
    exactKeys(
      row,
      ["pageNumber", "rotationIconPresent", "stepNumber"],
      `Step-44 panel-face input row ${index + 1}`,
    );
    if (
      row.stepNumber !== index + 1 ||
      !Number.isSafeInteger(row.pageNumber) ||
      row.pageNumber < 1 ||
      row.pageNumber > coveredPageCeiling ||
      row.pageNumber < previousPage ||
      typeof row.rotationIconPresent !== "boolean"
    )
      throw new TypeError(
        `Step-44 panel-face input row ${index + 1} must be ordered printed step ${index + 1}, on a nondecreasing page no later than ${coveredPageCeiling}, with one boolean vector-icon result.`,
      );
    previousPage = row.pageNumber;
  }
  const faces = derivePanelFaces(rows);
  return deepFreeze(rows.map((row, index) => ({ ...row, panelFace: faces[index]!.panelFace })));
}

function createEvidence(input: {
  authority: RealBuildPrefix50Step44PanelFacePrefixEvidence["authority"];
  sourcePdfArtifactPath: RealBuildPrefix50Step44PanelFacePrefixEvidence["sourcePdfArtifactPath"];
  sourcePdfDigest: `sha256:${string}`;
  vectorDetector: RealBuildPrefix50Step44PanelFacePrefixEvidence["vectorDetector"];
  rows: readonly PrefixRowInput[];
}): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  if (!SHA256.test(input.sourcePdfDigest))
    throw new TypeError("Step-44 panel-face evidence requires one lowercase sha256 source digest.");
  const rows = validateRealBuildPrefix50Step44PanelFacePrefixRows(input.rows);
  const expectedPanelFace = rows.at(-1)!.panelFace;
  if (
    input.authority === "repository-pdf-vector" &&
    (input.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
      input.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
      input.vectorDetector !== "white-44.937pt-square-in-step-panel/1" ||
      rows.at(-1)!.pageNumber !== REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING ||
      expectedPanelFace !== "studs-up")
  )
    throw new TypeError(
      "Repository Step-44 panel-face evidence must be the pinned PDF's exact page-45-ending, studs-up 1..44 vector fold.",
    );
  if (
    input.authority === "synthetic-test-only" &&
    (input.sourcePdfArtifactPath !== "synthetic-test-source.pdf" ||
      input.vectorDetector !== "synthetic-test-declaration/1")
  )
    throw new TypeError(
      "Synthetic Step-44 panel-face evidence must remain an explicit non-authoritative test declaration.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-panel-face-prefix/1" as const,
    authority: input.authority,
    sourcePdfArtifactPath: input.sourcePdfArtifactPath,
    sourcePdfDigest: input.sourcePdfDigest,
    vectorDetector: input.vectorDetector,
    firstPrintedStep: 1 as const,
    lastPrintedStep: REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_LAST_STEP,
    coveredPageCeiling: REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING,
    rows,
    rowsCommitment: canonicalDigest(rows),
    expectedPanelFace,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

function requireStructuralEvidence(
  value: RealBuildPrefix50Step44PanelFacePrefixEvidence,
): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  exactKeys(
    value,
    [
      "authority",
      "commitment",
      "coveredPageCeiling",
      "expectedPanelFace",
      "firstPrintedStep",
      "lastPrintedStep",
      "rows",
      "rowsCommitment",
      "schemaVersion",
      "sourcePdfArtifactPath",
      "sourcePdfDigest",
      "vectorDetector",
    ],
    "Step-44 panel-face prefix evidence",
  );
  const rebuilt = createEvidence({
    authority: value.authority,
    sourcePdfArtifactPath: value.sourcePdfArtifactPath,
    sourcePdfDigest: value.sourcePdfDigest,
    vectorDetector: value.vectorDetector,
    rows: value.rows.map(({ stepNumber, pageNumber, rotationIconPresent }) => ({
      stepNumber,
      pageNumber,
      rotationIconPresent,
    })),
  });
  if (
    value.schemaVersion !== rebuilt.schemaVersion ||
    value.firstPrintedStep !== 1 ||
    value.lastPrintedStep !== REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_LAST_STEP ||
    value.coveredPageCeiling !== REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING ||
    value.rowsCommitment !== rebuilt.rowsCommitment ||
    value.expectedPanelFace !== rebuilt.expectedPanelFace ||
    value.commitment !== rebuilt.commitment ||
    canonicalDigest(value.rows) !== canonicalDigest(rebuilt.rows)
  )
    throw new TypeError("Step-44 panel-face prefix evidence does not reproduce its exact fold.");
  return value;
}

export function requireRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(
  value: RealBuildPrefix50Step44PanelFacePrefixEvidence,
): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  requireStructuralEvidence(value);
  if (
    value.authority !== "repository-pdf-vector" ||
    value.commitment !== REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT ||
    !repositoryEvidenceBrands.has(value)
  )
    throw new TypeError(
      "Step-44 repository panel-face authority must retain its live pinned-PDF vector derivation brand.",
    );
  return value;
}

export function requireRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidence(
  value: RealBuildPrefix50Step44PanelFacePrefixEvidence,
): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  requireStructuralEvidence(value);
  if (value.authority !== "synthetic-test-only" || !syntheticEvidenceBrands.has(value))
    throw new TypeError(
      "Synthetic Step-44 panel-face evidence cannot satisfy repository authority.",
    );
  return value;
}

export function requireRealBuildPrefix50Step44PanelFacePrefixEvidenceForSource(input: {
  sourcePdfArtifactPath: RealBuildPrefix50Step44PanelFacePrefixEvidence["sourcePdfArtifactPath"];
  sourcePdfDigest: `sha256:${string}`;
  evidence: RealBuildPrefix50Step44PanelFacePrefixEvidence;
}): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  const evidence =
    input.sourcePdfArtifactPath === REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH
      ? requireRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(input.evidence)
      : requireRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidence(input.evidence);
  if (
    evidence.sourcePdfArtifactPath !== input.sourcePdfArtifactPath ||
    evidence.sourcePdfDigest !== input.sourcePdfDigest
  )
    throw new TypeError(
      "Step-44 page-45 source must bind panel-face evidence derived from its exact PDF bytes.",
    );
  return evidence;
}

export function verifyPersistedRealBuildPrefix50Step44PanelFacePrefixEvidence(
  value: RealBuildPrefix50Step44PanelFacePrefixEvidence,
): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  const evidence = requireStructuralEvidence(value);
  if (
    evidence.authority === "repository-pdf-vector" &&
    evidence.commitment !== REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT
  )
    throw new TypeError(
      "Persisted repository Step-44 panel-face evidence must equal the pinned live first-44 PDF evidence commitment.",
    );
  return evidence;
}

export function verifyPersistedRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(
  value: RealBuildPrefix50Step44PanelFacePrefixEvidence,
): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  const evidence = verifyPersistedRealBuildPrefix50Step44PanelFacePrefixEvidence(value);
  if (evidence.authority !== "repository-pdf-vector")
    throw new TypeError(
      "Persisted Step-44 repository validation refuses synthetic panel-face evidence.",
    );
  return evidence;
}

type PanelResult = Extract<
  RealBuildPrefix50Step44LaterSourceDerivationResult,
  { readonly kind: "panel-prefix" }
>;

async function deriveRepositoryFaceRows(input: {
  readonly capability: RealBuildPrefix50Step44LaterSourceReadCapability;
  readonly purpose: "page44-step43-vector" | "page45-step44-vector";
}): Promise<PanelResult> {
  const { result } = await executeRealBuildPrefix50Step44LaterSourceDerivation({
    capability: input.capability,
    request: { kind: "panel-prefix", purpose: input.purpose },
  });
  if (result.kind !== "panel-prefix" || result.purpose !== input.purpose)
    throw new TypeError("Later-source vector authority returned the wrong fixed derivation kind.");
  return result;
}

export async function deriveRealBuildPrefix50Page44Step43PanelFaceRows(
  capability: RealBuildPrefix50Step44LaterSourceReadCapability,
): Promise<readonly RealBuildPrefix50Step44PanelFacePrefixRow[]> {
  const { rows } = await deriveRepositoryFaceRows({
    capability,
    purpose: "page44-step43-vector",
  });
  if (canonicalDigest(rows) !== REAL_BUILD_PREFIX50_PAGE44_STEP43_FACE_ROWS_COMMITMENT)
    throw new TypeError(
      `Pinned page-44 source no longer reproduces its exact committed first-43 vector face rows: ${canonicalDigest(rows)} != ${REAL_BUILD_PREFIX50_PAGE44_STEP43_FACE_ROWS_COMMITMENT}.`,
    );
  return rows;
}

export async function deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(
  capability: RealBuildPrefix50Step44LaterSourceReadCapability,
): Promise<RealBuildPrefix50Step44PanelFacePrefixEvidence> {
  const { rows } = await deriveRepositoryFaceRows({
    capability,
    purpose: "page45-step44-vector",
  });
  const evidence = createEvidence({
    authority: "repository-pdf-vector",
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    vectorDetector: "white-44.937pt-square-in-step-panel/1",
    rows: rows.map(({ stepNumber, pageNumber, rotationIconPresent }) => ({
      stepNumber,
      pageNumber,
      rotationIconPresent,
    })),
  });
  if (evidence.commitment !== REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT)
    throw new TypeError(
      "Pinned Step-44 PDF no longer reproduces the exact committed first-44 vector face evidence.",
    );
  repositoryEvidenceBrands.add(evidence);
  return evidence;
}

export function createRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidenceForTest(
  sourcePdfDigest: `sha256:${string}`,
  rows: readonly PrefixRowInput[] = Array.from(
    { length: REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_LAST_STEP },
    (_, index) => ({
      stepNumber: index + 1,
      pageNumber: REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING,
      rotationIconPresent: false,
    }),
  ),
): RealBuildPrefix50Step44PanelFacePrefixEvidence {
  if (process.env.NODE_ENV !== "test")
    throw new TypeError("Synthetic Step-44 panel-face evidence is available only to tests.");
  const evidence = createEvidence({
    authority: "synthetic-test-only",
    sourcePdfArtifactPath: "synthetic-test-source.pdf",
    sourcePdfDigest,
    vectorDetector: "synthetic-test-declaration/1",
    rows,
  });
  syntheticEvidenceBrands.add(evidence);
  return evidence;
}

export const realBuildPrefix50Step44PanelFacePrefixTestOnly = Object.freeze({
  createStructuralEvidence(input: {
    authority: RealBuildPrefix50Step44PanelFacePrefixEvidence["authority"];
    sourcePdfArtifactPath: RealBuildPrefix50Step44PanelFacePrefixEvidence["sourcePdfArtifactPath"];
    sourcePdfDigest: `sha256:${string}`;
    vectorDetector: RealBuildPrefix50Step44PanelFacePrefixEvidence["vectorDetector"];
    rows: readonly PrefixRowInput[];
  }) {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Structural Step-44 face evidence construction is test-only.");
    return createEvidence(input);
  },
});

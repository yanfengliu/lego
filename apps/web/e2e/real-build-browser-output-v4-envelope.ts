import type { Sha256Digest } from "@lego-studio/brick-kernel";
import { createHash } from "node:crypto";

import { isRealBuildSuccessfulStepMechanism, type RealBuildStepReport } from "./real-build-safety";
import { parseRealBuildBrowserStepFailure as failure } from "./real-build-browser-step-failure";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput,
  inspectRealBuildPreparedRunInput,
  requireRealBuildPreparedBrowserOutputBoundaryInspection,
} from "./real-build-prepared-step-authority";
import { realBuildBrowserOutputV4BaseReportDefect } from "./real-build-browser-output";
import { snapshotCurrentRealBuildBrowserOutputV4 } from "./real-build-browser-output-snapshot";
import { inspectHostileUint8ArrayLength } from "./real-build-hostile-uint8array";
import {
  MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL,
} from "./real-build-browser-output-v4-role-limits";
import {
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES,
} from "./real-build-browser-output-v4-camera-evidence-types";
import { MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES } from "./real-build-browser-output-v4-source-evidence-types";
import {
  realBuildBrowserOutputV4DenseArray as denseArray,
  realBuildBrowserOutputV4Digest as digest,
  realBuildBrowserOutputV4Exact as exact,
  realBuildBrowserOutputV4Integer as integer,
  realBuildBrowserOutputV4Record as record,
} from "./real-build-browser-output-v4-envelope-primitives";
import {
  MAXIMUM_REAL_BUILD_BROWSER_TRANSITION_EVIDENCE_BYTES,
  REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION,
  type RealBuildBrowserOutputV4DetachedEnvelope,
  type RealBuildBrowserOutputV4EnvelopeInspection,
  type RealBuildBrowserOutputV4EvidenceBindings,
  type RealBuildBrowserOutputV4EvidenceRoleKey,
  type RealBuildBrowserOutputV4IdentityBinding,
  type RealBuildBrowserOutputV4RoleBinding,
  type RealBuildBrowserOutputV4RoleName,
} from "./real-build-browser-output-v4-envelope-types";

export {
  MAXIMUM_REAL_BUILD_BROWSER_TRANSITION_EVIDENCE_BYTES,
  REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION,
} from "./real-build-browser-output-v4-envelope-types";
export type {
  RealBuildBrowserOutputV4DetachedEnvelope,
  RealBuildBrowserOutputV4EnvelopeInspection,
  RealBuildBrowserOutputV4EvidenceBindings,
  RealBuildBrowserOutputV4EvidenceRoleKey,
  RealBuildBrowserOutputV4IdentityBinding,
  RealBuildBrowserOutputV4RoleBinding,
  RealBuildBrowserOutputV4RoleName,
} from "./real-build-browser-output-v4-envelope-types";

const inspectedEnvelopes = new WeakSet<object>();

function role(
  value: unknown,
  path: string,
  expectedRole: RealBuildBrowserOutputV4RoleName,
  maximumBytes: number,
): RealBuildBrowserOutputV4RoleBinding {
  const row = exact(value, path, ["role", "bytes", "digest"]);
  if (row.role !== expectedRole) {
    throw new TypeError(`${path}.role must be ${expectedRole}.`);
  }
  return intrinsicRealBuildFreeze({
    role: expectedRole,
    bytes: integer(row.bytes, `${path}.bytes`, 0, maximumBytes),
    digest: digest(row.digest, `${path}.digest`),
  });
}

function evidenceBindings(
  value: unknown,
  preparedRunInputDigest: Sha256Digest,
): RealBuildBrowserOutputV4EvidenceBindings {
  const row = exact(value, "browserOutput.evidence", [
    "preparedRunInputDigest",
    "branchEvidence",
    "compiledBranchRole",
    "branchObservationRole",
    "sourceManifest",
    "cameraManifest",
    "cameraRenderRole",
    "cameraMaskRole",
    "transitionManifest",
  ]);
  const preparedDigest = digest(
    row.preparedRunInputDigest,
    "browserOutput.evidence.preparedRunInputDigest",
  );
  if (preparedDigest !== preparedRunInputDigest) {
    throw new TypeError(
      `Browser output binds prepared run ${preparedDigest}; expected ${preparedRunInputDigest}.`,
    );
  }
  const compiledBranchRole = role(
    row.compiledBranchRole,
    "browserOutput.evidence.compiledBranchRole",
    "compiled-branch-evidence-bytes",
    MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
  );
  const branchObservationRole = role(
    row.branchObservationRole,
    "browserOutput.evidence.branchObservationRole",
    "branch-observation-bytes",
    MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
  );
  if (
    compiledBranchRole.bytes >
    MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL - branchObservationRole.bytes
  ) {
    throw new RangeError(
      `Browser output branch roles exceed ${MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES_TOTAL} aggregate bytes.`,
    );
  }
  const cameraRenderRole = role(
    row.cameraRenderRole,
    "browserOutput.evidence.cameraRenderRole",
    "d4-child-render-rgba-bytes",
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  );
  const cameraMaskRole = role(
    row.cameraMaskRole,
    "browserOutput.evidence.cameraMaskRole",
    "branch-observation-bytes",
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_ROLE_BYTES,
  );
  if (
    cameraRenderRole.bytes >
    MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES - cameraMaskRole.bytes
  ) {
    throw new RangeError(
      `Browser output camera roles exceed ${MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_TOTAL_BYTES} aggregate bytes.`,
    );
  }
  return intrinsicRealBuildFreeze({
    preparedRunInputDigest: preparedDigest,
    branchEvidence: role(
      row.branchEvidence,
      "browserOutput.evidence.branchEvidence",
      "branch-evidence-index",
      MAXIMUM_REAL_BUILD_BROWSER_BRANCH_INDEX_BYTES,
    ),
    compiledBranchRole,
    branchObservationRole,
    sourceManifest: role(
      row.sourceManifest,
      "browserOutput.evidence.sourceManifest",
      "source-evidence-manifest",
      MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_SOURCE_EVIDENCE_MANIFEST_BYTES,
    ),
    cameraManifest: role(
      row.cameraManifest,
      "browserOutput.evidence.cameraManifest",
      "camera-evidence-manifest",
      MAXIMUM_REAL_BUILD_BROWSER_CAMERA_EVIDENCE_INDEX_BYTES,
    ),
    cameraRenderRole,
    cameraMaskRole,
    transitionManifest: role(
      row.transitionManifest,
      "browserOutput.evidence.transitionManifest",
      "transition-evidence-manifest",
      MAXIMUM_REAL_BUILD_BROWSER_TRANSITION_EVIDENCE_BYTES,
    ),
  });
}

function absentCompletionAuthority(
  value: unknown,
): typeof REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY {
  const row = exact(value, "browserOutput.completionAuthority", ["status", "authorized", "reason"]);
  if (
    row.status !== REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY.status ||
    row.authorized !== REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY.authorized ||
    row.reason !== REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY.reason
  ) {
    throw new TypeError(
      "Browser output /4 completionAuthority must remain explicitly absent until separate trusted-user admission.",
    );
  }
  return REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY;
}

function identityBindings(
  value: unknown,
  maximum: number,
  lastStep: number,
): readonly RealBuildBrowserOutputV4IdentityBinding[] {
  const rows = denseArray(value, "browserOutput.identityBindings", maximum);
  const identities = new Set<string>();
  const parts = new Set<string>();
  return intrinsicRealBuildFreeze(
    rows.map((value, index) => {
      const path = `browserOutput.identityBindings[${index}]`;
      const row = exact(value, path, [
        "identityKey",
        "partId",
        "stepNumber",
        "designId",
        "materialId",
        "catalogPartId",
        "colorId",
      ]);
      for (const key of [
        "identityKey",
        "partId",
        "designId",
        "materialId",
        "catalogPartId",
        "colorId",
      ] as const) {
        if (typeof row[key] !== "string" || row[key].length < 1 || row[key].length > 1_024) {
          throw new TypeError(`${path}.${key} must be one bounded non-empty string.`);
        }
      }
      const stepNumber = integer(row.stepNumber, `${path}.stepNumber`, 1, lastStep);
      if (identities.has(row.identityKey as string) || parts.has(row.partId as string)) {
        throw new TypeError(`${path} duplicates an identityKey or partId.`);
      }
      identities.add(row.identityKey as string);
      parts.add(row.partId as string);
      return intrinsicRealBuildFreeze({
        identityKey: row.identityKey as string,
        partId: row.partId as string,
        stepNumber,
        designId: row.designId as string,
        materialId: row.materialId as string,
        catalogPartId: row.catalogPartId as string,
        colorId: row.colorId as string,
      });
    }),
  );
}

/**
 * Detaches and validates only the /4 envelope and complete report rows. External
 * source, camera, branch, transition, frontier, and terminal bytes remain untrusted
 * until the higher-level reader cross-binds their exact descriptors and replay.
 */
export function inspectRealBuildBrowserOutputV4Envelope(
  value: unknown,
  preparedRunInputBytes: unknown,
): RealBuildBrowserOutputV4EnvelopeInspection {
  const preparedRun = inspectRealBuildPreparedRunInput(preparedRunInputBytes);
  const preparedBoundary = inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput(preparedRun);
  requireRealBuildPreparedBrowserOutputBoundaryInspection(preparedBoundary);
  const snapshot = snapshotCurrentRealBuildBrowserOutputV4(
    value,
    preparedBoundary.lastStep,
    preparedBoundary.maxParts,
  );
  if (!snapshot.ok) {
    throw new TypeError(`Browser output /4 could not be safely detached: ${snapshot.defect}.`);
  }
  const supplied = record(snapshot.value, "browserOutput");
  const status = supplied.status;
  if (status !== "executed" && status !== "failed") {
    throw new TypeError("Browser output /4 status must be executed or failed.");
  }
  const root = exact(
    supplied,
    "browserOutput",
    status === "executed"
      ? [
          "schemaVersion",
          "status",
          "evidence",
          "reports",
          "documentJson",
          "identityBindings",
          "fetchedPdfDigest",
          "totalElapsedMs",
          "completionAuthority",
        ]
      : [
          "schemaVersion",
          "status",
          "evidence",
          "reports",
          "documentJson",
          "identityBindings",
          "fetchedPdfDigest",
          "failure",
          "totalElapsedMs",
          "completionAuthority",
        ],
  );
  if (root.schemaVersion !== REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION) {
    throw new TypeError(
      `Browser output /4 schemaVersion must be ${REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION}.`,
    );
  }
  const reports = denseArray(root.reports, "browserOutput.reports", preparedBoundary.lastStep);
  let terminalReportStepNumber: number | null = null;
  const verifiedReports: RealBuildStepReport[] = [];
  for (let index = 0; index < reports.length; index += 1) {
    if (terminalReportStepNumber !== null) {
      throw new TypeError(
        `Browser output /4 report[${index}] follows terminal failed step ${terminalReportStepNumber}.`,
      );
    }
    const defect = realBuildBrowserOutputV4BaseReportDefect(
      reports[index],
      index,
      preparedBoundary,
    );
    if (defect !== null) throw new TypeError(defect);
    const report = reports[index] as RealBuildStepReport;
    if (report.elapsedMs !== 0) {
      throw new TypeError(
        `Browser output /4 report[${index}].elapsedMs must be replay-neutral zero; no live /4 producer or timing evidence role exists.`,
      );
    }
    if (report.outcome.status === "failed") {
      failure(report.outcome.failure, `browserOutput.reports[${index}].outcome.failure`);
      if (
        report.outcome.attemptedMechanism !== null &&
        !isRealBuildSuccessfulStepMechanism(report.outcome.attemptedMechanism)
      ) {
        throw new TypeError(
          `browserOutput.reports[${index}].outcome.attemptedMechanism must be null or one supported mechanism.`,
        );
      }
    }
    if (report.stepNumber !== index + 1) {
      throw new TypeError(
        `Browser output /4 report[${index}] is printed step ${report.stepNumber}; expected ${index + 1}.`,
      );
    }
    if (report.panelCamera !== null) {
      throw new TypeError(
        `Browser output /4 report[${index}].panelCamera must be null; exact camera evidence lives only in its external role.`,
      );
    }
    if (report.outcome.status === "failed") terminalReportStepNumber = report.stepNumber;
    verifiedReports.push(report);
  }
  if (status === "executed") {
    if (verifiedReports.length !== preparedBoundary.lastStep) {
      throw new TypeError(
        `Executed browser output /4 retains ${verifiedReports.length} reports; expected ${preparedBoundary.lastStep}.`,
      );
    }
    if (terminalReportStepNumber !== null) {
      throw new TypeError(
        `Executed browser output /4 retains terminal failed report ${terminalReportStepNumber}.`,
      );
    }
  } else if (verifiedReports.length > 0 && terminalReportStepNumber === null) {
    throw new TypeError(
      "Failed browser output /4 with retained reports must end in one typed failed report.",
    );
  }
  if (typeof root.documentJson !== "string" || root.documentJson.length < 1) {
    throw new TypeError(
      "Browser output /4 must retain a non-empty exact terminal documentJson even when failed.",
    );
  }
  const fetchedPdfDigest = digest(root.fetchedPdfDigest, "browserOutput.fetchedPdfDigest");
  if (fetchedPdfDigest !== preparedBoundary.inputDigests.pdf) {
    throw new TypeError(
      `Browser output /4 fetched PDF ${fetchedPdfDigest}; prepared input pins ${preparedBoundary.inputDigests.pdf}.`,
    );
  }
  if (root.totalElapsedMs !== 0) {
    throw new TypeError(
      "Browser output /4 totalElapsedMs must be replay-neutral zero; no live /4 producer or timing evidence role exists.",
    );
  }
  const detached = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_SCHEMA_VERSION,
    status,
    evidence: evidenceBindings(root.evidence, preparedRun.preparedRunInputDigest),
    reports: intrinsicRealBuildFreeze(verifiedReports),
    documentJson: root.documentJson,
    identityBindings: identityBindings(
      root.identityBindings,
      preparedBoundary.maxParts,
      preparedBoundary.lastStep,
    ),
    fetchedPdfDigest,
    ...(status === "failed" ? { failure: failure(root.failure, "browserOutput.failure") } : {}),
    totalElapsedMs: root.totalElapsedMs,
    completionAuthority: absentCompletionAuthority(root.completionAuthority),
  }) as RealBuildBrowserOutputV4DetachedEnvelope;
  const inspection = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-browser-output-v4-envelope-inspection/1" as const,
    preparedRun,
    preparedBoundary,
    envelope: detached,
    terminalReportStepNumber,
    authority: "absent" as const,
    completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_ABSENT_COMPLETION_AUTHORITY,
  });
  inspectedEnvelopes.add(inspection);
  return inspection;
}

export function requireRealBuildBrowserOutputV4EnvelopeInspection(
  value: unknown,
): RealBuildBrowserOutputV4EnvelopeInspection {
  if (value === null || typeof value !== "object" || !inspectedEnvelopes.has(value)) {
    throw new TypeError(
      "Browser output /4 envelope must be the exact authority-free result of hostile-safe preflight.",
    );
  }
  return value as RealBuildBrowserOutputV4EnvelopeInspection;
}

/**
 * Cross-binds one small external index/manifest byte string to the descriptor in
 * an already-branded envelope. Large compiled/render roles are compared through
 * their semantic readers' verified descriptors, avoiding another aggregate copy.
 */
export function verifyRealBuildBrowserOutputV4EvidenceRoleBytes(
  envelopeInspection: unknown,
  roleKey: RealBuildBrowserOutputV4EvidenceRoleKey,
  bytesValue: unknown,
): void {
  const inspection = requireRealBuildBrowserOutputV4EnvelopeInspection(envelopeInspection);
  if (
    !["branchEvidence", "sourceManifest", "cameraManifest", "transitionManifest"].includes(roleKey)
  ) {
    throw new TypeError(
      `Browser output /4 direct byte verification is limited to small index/manifest roles; received ${String(roleKey)}.`,
    );
  }
  const binding = inspection.envelope.evidence[roleKey];
  const length = inspectHostileUint8ArrayLength(bytesValue, {
    maximumBytes: binding.bytes,
    typeError: `Browser output /4 ${binding.role} must be a genuine Uint8Array.`,
    oversizeError: (observed) =>
      `Browser output /4 ${binding.role} contains ${observed} bytes; envelope maximum is ${binding.bytes}.`,
    sharedError: `Browser output /4 ${binding.role} cannot use concurrently mutable shared storage.`,
  });
  if (length !== binding.bytes) {
    throw new TypeError(
      `Browser output /4 ${binding.role} contains ${length} bytes; envelope commits ${binding.bytes}.`,
    );
  }
  let measured: Sha256Digest;
  try {
    measured = `sha256:${createHash("sha256")
      .update(bytesValue as Uint8Array)
      .digest("hex")}`;
  } catch {
    throw new TypeError(
      `Browser output /4 ${binding.role} changed or detached during bounded hashing.`,
    );
  }
  if (measured !== binding.digest) {
    throw new TypeError(
      `Browser output /4 ${binding.role} hashes to ${measured}; envelope commits ${binding.digest}.`,
    );
  }
}

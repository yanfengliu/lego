import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";
import { validateRealBuildExactFiveBrokerConsumptionTimelineV1 } from "@lego-studio/protocol";

import { unpackRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  adjudicateRealBuildSourceParityCalibration,
  type RealBuildSourceParityCalibrationAdjudication,
} from "./real-build-observation-source-parity-calibration-adjudication";
import { parseRealBuildSourceParityCalibrationCapture } from "./real-build-observation-source-parity-calibration-capture-parser";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES } from "./real-build-observation-source-parity-calibration-capture-types";
import {
  requireRealBuildSourceParityCalibrationContract,
  type RealBuildSourceParityCalibrationContract,
} from "./real-build-observation-source-parity-calibration-contract";
import { parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest } from "./real-build-observation-source-parity-calibration-publication-manifest";
import { requirePublishedRealBuildSourceParityCalibration } from "./real-build-observation-source-parity-calibration-publication-parser";
import type { RealBuildSourceParityCalibrationPublicationArtifact } from "./real-build-observation-source-parity-calibration-publication-types";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import { requireInspectedRealBuildSourceParityCalibrationPacket } from "./real-build-observation-source-parity-calibration-truth";
import {
  consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent,
  requireRealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent,
  type RealBuildBrowserOutputV4ExactFiveTrustedUserEventRequest,
} from "./real-build-browser-output-v4-exact-five-user-event";

export const REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS =
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES;

export const REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_UNREVIEWED_STEPS = 354 as const;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_IN_FLIGHT_ADMISSIONS = 64;
export const MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_RETAINED_ADMISSIONS = 4_096;

export const REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_ABSENT_COMPLETION_AUTHORITY =
  intrinsicRealBuildFreeze({
    status: "absent" as const,
    authorized: false as const,
    reviewedCalibrationSteps: 5 as const,
    unreviewedCalibrationSteps: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_UNREVIEWED_STEPS,
    authorizedCompletionSteps: 0 as const,
    reason: "trusted-user-exact-five-calibration-does-not-authorize-dense-359-completion" as const,
  });

export const REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_ABSENT_NONCALIBRATION_AUTHORITY =
  intrinsicRealBuildFreeze({
    physicalTransforms: false as const,
    placement: false as const,
    fixedActions: false as const,
    reason:
      "source-parity-calibration-is-not-physical-placement-or-fixed-action-authority" as const,
  });

const REQUEST = Symbol("RealBuildBrowserOutputV4ExactFiveCalibrationRequest");
const ADMISSION = Symbol("RealBuildBrowserOutputV4ExactFiveCalibrationAdmission");

export interface RealBuildBrowserOutputV4ExactFiveCalibrationRequestInspection {
  readonly schemaVersion: "lego.real-build-browser-output-v4-exact-five-calibration-request/1";
  readonly executionIdentityDigest: Sha256Digest;
  readonly calibrationDigest: Sha256Digest;
  readonly truthPacketDigest: Sha256Digest;
  readonly reviewPresentationDigest: Sha256Digest;
  readonly comparison: "published-candidate-w-exactly-matches-inspected-human-truth";
  readonly steps: typeof REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS;
  readonly requestDigest: Sha256Digest;
  readonly authority: "absent";
  readonly [REQUEST]: true;
}

export interface RealBuildBrowserOutputV4ExactFiveCalibrationAdmission {
  readonly schemaVersion: "lego.real-build-browser-output-v4-exact-five-calibration-admission/1";
  readonly status: "admitted";
  readonly authority: "trusted-user";
  readonly basis: "external-authenticated-one-use-user-event";
  readonly eventIdentityDigest: Sha256Digest;
  readonly requestDigest: Sha256Digest;
  readonly executionIdentityDigest: Sha256Digest;
  readonly calibrationDigest: Sha256Digest;
  readonly truthPacketDigest: Sha256Digest;
  readonly officialFrameEquivalence: {
    readonly authorized: true;
    readonly scope: "exact-five-source-parity-calibration-panels-only";
    readonly comparison: "published-candidate-w-exactly-matches-inspected-human-truth";
    readonly steps: typeof REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS;
  };
  readonly publicationAuthorityRemains: "absent";
  readonly nonCalibrationAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_ABSENT_NONCALIBRATION_AUTHORITY;
  readonly completionAuthority: typeof REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_ABSENT_COMPLETION_AUTHORITY;
  readonly [ADMISSION]: true;
}

const requests = new WeakSet<object>();
const admissions = new WeakSet<object>();
const inFlightRequests = new Set<Sha256Digest>();
const consumedRequests = new Set<Sha256Digest>();
const consumedEvents = new Set<Sha256Digest>();
let inFlightAdmissionCount = 0;
let retainedAdmissionCount = 0;

const APPLY = Reflect.apply;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;
const SET_ADD = Set.prototype.add;
const SET_DELETE = Set.prototype.delete;
const SET_HAS = Set.prototype.has;
const DATE_NOW = Date.now;

function weakSetAdd(set: WeakSet<object>, value: object): void {
  APPLY(WEAK_SET_ADD, set, [value]);
}

function weakSetHas(set: WeakSet<object>, value: object): boolean {
  return APPLY(WEAK_SET_HAS, set, [value]) as boolean;
}

function setAdd(set: Set<Sha256Digest>, value: Sha256Digest): void {
  APPLY(SET_ADD, set, [value]);
}

function setDelete(set: Set<Sha256Digest>, value: Sha256Digest): void {
  APPLY(SET_DELETE, set, [value]);
}

function setHas(set: Set<Sha256Digest>, value: Sha256Digest): boolean {
  return APPLY(SET_HAS, set, [value]) as boolean;
}

function exactExecutionIdentity(
  value: unknown,
  publication: RealBuildSourceParityCalibrationPublicationArtifact,
): Sha256Digest {
  if (
    typeof value !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value) ||
    value !== publication.executionIdentityDigest
  ) {
    throw new TypeError(
      `Exact-five calibration request must bind publication execution identity ${publication.executionIdentityDigest}.`,
    );
  }
  return value as Sha256Digest;
}

function sameContract(
  left: RealBuildSourceParityCalibrationContract,
  right: RealBuildSourceParityCalibrationContract,
): boolean {
  return (
    left.calibrationDigest === right.calibrationDigest &&
    left.pdfDigest === right.pdfDigest &&
    left.fullPreparedPanelsDigest === right.fullPreparedPanelsDigest &&
    left.calibrationPreparedPanelsDigest === right.calibrationPreparedPanelsDigest &&
    left.panels.length === right.panels.length &&
    left.panels.every((panel, index) => {
      const other = right.panels[index];
      return (
        other !== undefined &&
        panel.stepNumber === other.stepNumber &&
        panel.pageNumber === other.pageNumber &&
        panel.width === other.width &&
        panel.height === other.height &&
        panel.pixelCount === other.pixelCount &&
        panel.workFactor === other.workFactor
      );
    })
  );
}

function publishedCandidatePanels(
  publication: RealBuildSourceParityCalibrationPublicationArtifact,
  contract: RealBuildSourceParityCalibrationContract,
) {
  const full = parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest(
    publication.readFullPreparedPanelsManifestBytes(),
  );
  if (!sameContract(contract, full.contract)) {
    throw new TypeError(
      "Exact-five calibration request contract does not reproduce the publication's PDF, full 359-panel manifest, and fixed five-panel subset.",
    );
  }
  const capture = parseRealBuildSourceParityCalibrationCapture(
    publication.readCaptureManifestBytes(),
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.map((role) => ({
      role,
      bytes: publication.readRole(role),
    })),
    publication.summary.pngs.map(({ stepNumber, scale }) => ({
      stepNumber,
      scale,
      bytes: publication.readPng(stepNumber, scale),
    })),
  );
  if (
    capture.manifest.pdfDigest !== contract.pdfDigest ||
    capture.manifest.fullPreparedPanelsDigest !== contract.fullPreparedPanelsDigest ||
    capture.manifest.calibrationPreparedPanelsDigest !== contract.calibrationPreparedPanelsDigest ||
    capture.manifest.calibrationDigest !== contract.calibrationDigest ||
    capture.manifest.panels.length !== contract.panels.length
  ) {
    throw new TypeError(
      "Exact-five calibration request publication capture does not bind the authenticated calibration contract.",
    );
  }
  const packedW = capture.readRole("calibration-w-packed-msb");
  return contract.panels.map((panel, index) => {
    const captured = capture.manifest.panels[index];
    if (
      captured === undefined ||
      captured.stepNumber !== panel.stepNumber ||
      captured.pageNumber !== panel.pageNumber ||
      captured.workWidth !== panel.width ||
      captured.workHeight !== panel.height ||
      captured.workPixelCount !== panel.pixelCount ||
      captured.workFactor !== panel.workFactor ||
      captured.wMask.role !== "calibration-w-packed-msb"
    ) {
      throw new TypeError(
        `Exact-five calibration request publication W row ${index} does not bind contract step/page ${panel.stepNumber}/${panel.pageNumber}.`,
      );
    }
    const packed = packedW.slice(
      captured.wMask.offset,
      captured.wMask.offset + captured.wMask.byteLength,
    );
    return intrinsicRealBuildFreeze({
      ...panel,
      wMask: unpackRealBuildCompiledBinaryMaskMsb(packed, panel.width, panel.height),
    });
  });
}

/**
 * Replays the authority-free publication and truth equality into an exact
 * request. Browser/model data may create a request but cannot admit it.
 */
export function inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
  rawPublication: unknown,
  rawContract: unknown,
  rawExecutionIdentityDigest: unknown,
  rawTruth: unknown,
): RealBuildBrowserOutputV4ExactFiveCalibrationRequestInspection {
  const publication = requirePublishedRealBuildSourceParityCalibration(rawPublication);
  const contract = requireRealBuildSourceParityCalibrationContract(rawContract);
  const truth = requireInspectedRealBuildSourceParityCalibrationPacket(rawTruth);
  const executionIdentityDigest = exactExecutionIdentity(rawExecutionIdentityDigest, publication);
  const candidatePanels = publishedCandidatePanels(publication, contract);
  const adjudication: RealBuildSourceParityCalibrationAdjudication =
    adjudicateRealBuildSourceParityCalibration({
      contract,
      executionIdentityDigest,
      truth,
      candidatePanels,
    });
  if (
    adjudication.reason !== "human-review-authority-not-supplied" ||
    adjudication.comparison !== "candidate-w-exactly-matches-unverified-packet" ||
    adjudication.comparedPanels !== 5 ||
    adjudication.differingSteps.length !== 0 ||
    adjudication.truthPacketDigest !== truth.packetDigest
  ) {
    throw new TypeError(
      `Exact-five calibration request requires all five published W masks to exactly match the inspected human-truth packet; comparison was ${adjudication.comparison} with differing steps [${adjudication.differingSteps.join(", ")}].`,
    );
  }
  const reviewPresentationDigest = canonicalDigest({
    schemaVersion: "lego.real-build-browser-output-v4-exact-five-review-presentation/1",
    executionIdentityDigest,
    calibrationDigest: contract.calibrationDigest,
    truthPacketDigest: truth.packetDigest,
    comparison: "published-candidate-w-exactly-matches-inspected-human-truth",
    steps: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS,
  });
  const base = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-browser-output-v4-exact-five-calibration-request/1" as const,
    executionIdentityDigest,
    calibrationDigest: contract.calibrationDigest,
    truthPacketDigest: truth.packetDigest,
    reviewPresentationDigest,
    comparison: "published-candidate-w-exactly-matches-inspected-human-truth" as const,
    steps: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS,
    authority: "absent" as const,
  });
  const inspection = intrinsicRealBuildFreeze({
    ...base,
    requestDigest: canonicalDigest(base),
    [REQUEST]: true as const,
  });
  weakSetAdd(requests, inspection);
  return inspection;
}

export function requireRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
  value: unknown,
): RealBuildBrowserOutputV4ExactFiveCalibrationRequestInspection {
  if (value === null || typeof value !== "object" || !weakSetHas(requests, value)) {
    throw new TypeError(
      "Exact-five calibration request must be the privately branded authority-free replay result.",
    );
  }
  return value as RealBuildBrowserOutputV4ExactFiveCalibrationRequestInspection;
}

/**
 * Consumes a future external broker's authenticated one-use user event. The
 * current repository event seam always refuses, so no production caller can
 * originate this admission yet.
 */
export async function consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
  rawTrustedUserEvent: unknown,
  rawRequest: unknown,
): Promise<RealBuildBrowserOutputV4ExactFiveCalibrationAdmission> {
  const request = requireRealBuildBrowserOutputV4ExactFiveCalibrationRequest(rawRequest);
  if (setHas(consumedRequests, request.requestDigest)) {
    throw new TypeError(
      `Exact-five calibration request ${request.requestDigest} was already admitted; replay is forbidden.`,
    );
  }
  if (setHas(inFlightRequests, request.requestDigest)) {
    throw new TypeError(
      `Exact-five calibration request ${request.requestDigest} is already being consumed; reentrant admission is forbidden.`,
    );
  }
  if (
    inFlightAdmissionCount >= MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_IN_FLIGHT_ADMISSIONS
  ) {
    throw new RangeError(
      `Exact-five calibration admission already has ${inFlightAdmissionCount} in-flight requests; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_IN_FLIGHT_ADMISSIONS}.`,
    );
  }
  if (
    retainedAdmissionCount + inFlightAdmissionCount >=
    MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_RETAINED_ADMISSIONS
  ) {
    throw new RangeError(
      `Exact-five calibration admission retained or reserved ${retainedAdmissionCount + inFlightAdmissionCount} request/event replay pairs; maximum is ${MAXIMUM_REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_RETAINED_ADMISSIONS} for this process session.`,
    );
  }
  setAdd(inFlightRequests, request.requestDigest);
  inFlightAdmissionCount += 1;
  try {
    const eventRequest: RealBuildBrowserOutputV4ExactFiveTrustedUserEventRequest =
      intrinsicRealBuildFreeze({
        schemaVersion: "lego.real-build-browser-output-v4-exact-five-user-event-request/1",
        namespace: "production",
        purpose: "admit-exact-five-official-frame-equivalence",
        scope: "exact-five-source-parity-calibration-panels-only",
        requestDigest: request.requestDigest,
        reviewPresentationDigest: request.reviewPresentationDigest,
      });
    const event = requireRealBuildBrowserOutputV4ExactFiveAuthenticatedTrustedUserEvent(
      await consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent(
        rawTrustedUserEvent,
        eventRequest,
      ),
    );
    const schemaVersion = event.schemaVersion;
    const authority = event.authority;
    const origin = event.origin;
    const namespace = event.namespace;
    const purpose = event.purpose;
    const scope = event.scope;
    const eventRequestDigest = event.requestDigest;
    const reviewPresentationDigest = event.reviewPresentationDigest;
    const challengeNonce = event.challengeNonce;
    const challengeIssuedAtUnixMs = event.challengeIssuedAtUnixMs;
    const consumedAtUnixMs = event.consumedAtUnixMs;
    const replayState = event.replayState;
    const eventIdentityDigest = event.eventIdentityDigest;
    if (
      schemaVersion !== "lego.real-build-browser-output-v4-exact-five-authenticated-user-event/1" ||
      authority !== "trusted-user" ||
      origin !== "external-authenticated-user-event" ||
      namespace !== "production" ||
      purpose !== eventRequest.purpose ||
      scope !== eventRequest.scope ||
      eventRequestDigest !== request.requestDigest ||
      reviewPresentationDigest !== request.reviewPresentationDigest ||
      typeof challengeNonce !== "string" ||
      !/^[0-9a-f]{64}$/u.test(challengeNonce) ||
      replayState !== "consumed-one-use" ||
      !/^sha256:[0-9a-f]{64}$/u.test(eventIdentityDigest)
    ) {
      throw new TypeError(
        "External exact-five trusted-user event consumer returned an inconsistent schema, request, review presentation, scope, purpose, origin, authority, identity, nonce, or replay state.",
      );
    }
    const now = APPLY(DATE_NOW, Date, []) as number;
    if (
      !validateRealBuildExactFiveBrokerConsumptionTimelineV1({
        issuedAtUnixMs: challengeIssuedAtUnixMs,
        consumedAtUnixMs,
        inspectionStartedAtUnixMs: now,
        inspectionFinishedAtUnixMs: now,
      })
    ) {
      throw new TypeError(
        "External exact-five trusted-user event consumer returned a future, expired, or non-two-minute challenge consumption.",
      );
    }
    if (setHas(consumedEvents, eventIdentityDigest)) {
      throw new TypeError(
        `External exact-five trusted-user event ${eventIdentityDigest} was already consumed; replay is forbidden.`,
      );
    }
    setAdd(consumedRequests, request.requestDigest);
    setAdd(consumedEvents, eventIdentityDigest);
    retainedAdmissionCount += 1;
    const admission = intrinsicRealBuildFreeze({
      schemaVersion:
        "lego.real-build-browser-output-v4-exact-five-calibration-admission/1" as const,
      status: "admitted" as const,
      authority: "trusted-user" as const,
      basis: "external-authenticated-one-use-user-event" as const,
      eventIdentityDigest,
      requestDigest: request.requestDigest,
      executionIdentityDigest: request.executionIdentityDigest,
      calibrationDigest: request.calibrationDigest,
      truthPacketDigest: request.truthPacketDigest,
      officialFrameEquivalence: intrinsicRealBuildFreeze({
        authorized: true as const,
        scope: "exact-five-source-parity-calibration-panels-only" as const,
        comparison: request.comparison,
        steps: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS,
      }),
      publicationAuthorityRemains: "absent" as const,
      nonCalibrationAuthority:
        REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_ABSENT_NONCALIBRATION_AUTHORITY,
      completionAuthority: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_ABSENT_COMPLETION_AUTHORITY,
      [ADMISSION]: true as const,
    });
    weakSetAdd(admissions, admission);
    return admission;
  } finally {
    setDelete(inFlightRequests, request.requestDigest);
    inFlightAdmissionCount -= 1;
  }
}

export function requireRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
  value: unknown,
): RealBuildBrowserOutputV4ExactFiveCalibrationAdmission {
  if (value === null || typeof value !== "object" || !weakSetHas(admissions, value)) {
    throw new TypeError(
      "Exact-five calibration authority requires the privately branded result of one successful external trusted-user admission.",
    );
  }
  return value as RealBuildBrowserOutputV4ExactFiveCalibrationAdmission;
}

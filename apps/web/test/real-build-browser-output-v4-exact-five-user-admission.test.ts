import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission,
  inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest,
  REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS,
  requireRealBuildBrowserOutputV4ExactFiveCalibrationAdmission,
  requireRealBuildBrowserOutputV4ExactFiveCalibrationRequest,
} from "../e2e/real-build-browser-output-v4-exact-five-user-admission";
import {
  packRealBuildCompiledBinaryMaskMsb,
  unpackRealBuildCompiledBinaryMaskMsb,
} from "../e2e/real-build-compiled-observation-registration";
import { adjudicateRealBuildSourceParityCalibration } from "../e2e/real-build-observation-source-parity-calibration-adjudication";
import { createRealBuildSourceParityCalibrationCaptureArtifact } from "../e2e/real-build-observation-source-parity-calibration-capture";
import { parseRealBuildSourceParityCalibrationCapture } from "../e2e/real-build-observation-source-parity-calibration-capture-parser";
import {
  createCalibrationCaptureTestFullPreparedPanelsManifestBytes,
  createCalibrationCaptureTestWire,
} from "../e2e/real-build-observation-source-parity-calibration-capture-test-fixture";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES } from "../e2e/real-build-observation-source-parity-calibration-capture-types";
import type { RealBuildSourceParityCalibrationContract } from "../e2e/real-build-observation-source-parity-calibration-contract";
import { publishRealBuildSourceParityCalibration } from "../e2e/real-build-observation-source-parity-calibration-publication";
import { parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest } from "../e2e/real-build-observation-source-parity-calibration-publication-manifest";
import { createRealBuildSourceParityCalibrationTestSourceClosure } from "../e2e/real-build-observation-source-parity-calibration-publication-test-fixture";
import type { RealBuildSourceParityCalibrationPublicationArtifact } from "../e2e/real-build-observation-source-parity-calibration-publication-types";
import {
  parseRealBuildSourceParityCalibrationTruth,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE,
  type InspectedRealBuildSourceParityCalibrationPacket,
} from "../e2e/real-build-observation-source-parity-calibration-truth";
import { SOURCE_PARITY_TEST_PDF_DIGEST } from "../e2e/real-build-observation-source-parity-test-fixture";

const trustedUserEventMock = vi.hoisted(() => {
  const bindingByEvent = new WeakMap<
    object,
    { readonly requestDigest: string; readonly eventIdentityDigest: string }
  >();
  const consumedEvents = new WeakSet<object>();
  let nextEvent = 1;
  let beforeReturn: (() => void) | null = null;
  let nextSchemaVersion: string | null = null;
  return {
    authenticate(requestDigest: string): object {
      const event = Object.freeze({ testEvent: nextEvent });
      const eventIdentityDigest = `sha256:${String(nextEvent).padStart(64, "0")}`;
      nextEvent += 1;
      bindingByEvent.set(event, { requestDigest, eventIdentityDigest });
      return event;
    },
    beforeNextReturn(callback: () => void): void {
      beforeReturn = callback;
    },
    returnSchemaVersionOnce(schemaVersion: string): void {
      nextSchemaVersion = schemaVersion;
    },
    consume: vi.fn(
      (
        rawEvent: unknown,
        challenge: { readonly purpose: string; readonly requestDigest: string },
      ) => {
        if (rawEvent === null || typeof rawEvent !== "object") {
          throw new TypeError("Mock external broker requires an authenticated event.");
        }
        const binding = bindingByEvent.get(rawEvent);
        if (binding === undefined) {
          throw new TypeError("Mock external broker rejected an unauthenticated event.");
        }
        if (consumedEvents.has(rawEvent)) {
          throw new TypeError("Mock external broker rejected replayed event.");
        }
        consumedEvents.add(rawEvent);
        if (binding.requestDigest !== challenge.requestDigest) {
          throw new TypeError("Mock external broker event binds a different request.");
        }
        const callback = beforeReturn;
        beforeReturn = null;
        callback?.();
        const schemaVersion =
          nextSchemaVersion ??
          "lego.real-build-browser-output-v4-exact-five-authenticated-user-event/1";
        nextSchemaVersion = null;
        return Object.freeze({
          schemaVersion,
          authority: "trusted-user",
          origin: "external-authenticated-user-event",
          purpose: challenge.purpose,
          requestDigest: challenge.requestDigest,
          eventIdentityDigest: binding.eventIdentityDigest,
          replayState: "consumed-one-use",
        });
      },
    ),
  };
});

vi.mock("../e2e/real-build-browser-output-v4-exact-five-user-event", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../e2e/real-build-browser-output-v4-exact-five-user-event")
    >();
  return {
    ...actual,
    consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent: trustedUserEventMock.consume,
  };
});

const roots: string[] = [];

const digest = (value: string | Uint8Array): Sha256Digest => `sha256:${sha256Hex(value)}`;

function temporaryRoot(): string {
  const value = mkdtempSync(join(tmpdir(), "lego-exact-five-user-admission-"));
  roots.push(value);
  return value;
}

function parsedCapture(publication: RealBuildSourceParityCalibrationPublicationArtifact) {
  return parseRealBuildSourceParityCalibrationCapture(
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
}

function publishedMasks(
  publication: RealBuildSourceParityCalibrationPublicationArtifact,
): readonly Uint8Array[] {
  const capture = parsedCapture(publication);
  const packed = capture.readRole("calibration-w-packed-msb");
  return capture.manifest.panels.map((panel) =>
    unpackRealBuildCompiledBinaryMaskMsb(
      packed.slice(panel.wMask.offset, panel.wMask.offset + panel.wMask.byteLength),
      panel.workWidth,
      panel.workHeight,
    ),
  );
}

function inspectedTruth(
  contract: RealBuildSourceParityCalibrationContract,
  executionIdentityDigest: Sha256Digest,
  masks: readonly Uint8Array[],
): InspectedRealBuildSourceParityCalibrationPacket {
  const packed = masks.map((mask, index) =>
    packRealBuildCompiledBinaryMaskMsb(
      mask,
      contract.panels[index]!.width,
      contract.panels[index]!.height,
    ),
  );
  const roleBytes = new Uint8Array(packed.reduce((sum, bytes) => sum + bytes.length, 0));
  let offset = 0;
  const panels = contract.panels.map((panel, index) => {
    const rowBytes = packed[index]!;
    const row = {
      ...panel,
      byteOffset: offset,
      byteLength: rowBytes.length,
      lowPaddingBits: (8 - (panel.pixelCount & 7)) & 7,
      packedDigest: digest(rowBytes),
      unpackedDigest: digest(masks[index]!),
    };
    roleBytes.set(rowBytes, offset);
    offset += rowBytes.length;
    return row;
  });
  return parseRealBuildSourceParityCalibrationTruth(
    {
      schemaVersion: "lego.real-build-observation-source-parity-calibration-truth/1",
      review: {
        status: "human-reviewed",
        authority: "external-to-packet",
        method: "exact-human-inspection",
      },
      reviewedCalibrationDigest: contract.calibrationDigest,
      reviewedExecutionIdentityDigest: executionIdentityDigest,
      pdfDigest: contract.pdfDigest,
      fullPreparedPanelsDigest: contract.fullPreparedPanelsDigest,
      calibrationPreparedPanelsDigest: contract.calibrationPreparedPanelsDigest,
      role: {
        role: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE,
        encoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING,
        byteLength: roleBytes.length,
        packedDigest: digest(roleBytes),
      },
      panels,
    },
    {
      role: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ROLE,
      encoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_TRUTH_ENCODING,
      bytes: roleBytes,
    },
  );
}

function fixture() {
  const repoRoot = temporaryRoot();
  const pdfDigest = SOURCE_PARITY_TEST_PDF_DIGEST as Sha256Digest;
  const capture = createRealBuildSourceParityCalibrationCaptureArtifact({
    browserCapture: createCalibrationCaptureTestWire(pdfDigest),
  });
  const fullPreparedPanelsManifestBytes =
    createCalibrationCaptureTestFullPreparedPanelsManifestBytes(pdfDigest);
  const closure = createRealBuildSourceParityCalibrationTestSourceClosure(repoRoot, {
    browserResultDigest: capture.manifest.browserCaptureDigest,
    browserResultBytes: capture.manifest.browserCaptureBytes,
    preparedPanelsDigest: capture.manifest.fullPreparedPanelsDigest,
  });
  const publication = publishRealBuildSourceParityCalibration({
    repoRoot,
    capture,
    fullPreparedPanelsManifestBytes,
    ...closure,
  });
  const contract = parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest(
    publication.readFullPreparedPanelsManifestBytes(),
  ).contract;
  const masks = publishedMasks(publication);
  const truth = inspectedTruth(contract, publication.executionIdentityDigest, masks);
  return { publication, contract, masks, truth };
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("trusted-user exact-five source-parity admission", () => {
  it("settles exact published W equality only for the fixed five panels", () => {
    const { publication, contract, masks, truth } = fixture();
    const prior = adjudicateRealBuildSourceParityCalibration({
      contract,
      executionIdentityDigest: publication.executionIdentityDigest,
      truth,
      candidatePanels: contract.panels.map((panel, index) => ({
        ...panel,
        wMask: masks[index]!,
      })),
    });
    expect(prior).toMatchObject({
      status: "needs-adjudication",
      reason: "human-review-authority-not-supplied",
      comparison: "candidate-w-exactly-matches-unverified-packet",
    });

    const request = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      publication,
      contract,
      publication.executionIdentityDigest,
      truth,
    );
    expect(request).toMatchObject({
      executionIdentityDigest: publication.executionIdentityDigest,
      calibrationDigest: contract.calibrationDigest,
      truthPacketDigest: truth.packetDigest,
      comparison: "published-candidate-w-exactly-matches-inspected-human-truth",
      steps: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS,
      authority: "absent",
    });
    expect(requireRealBuildBrowserOutputV4ExactFiveCalibrationRequest(request)).toBe(request);
    const trustedUserEvent = trustedUserEventMock.authenticate(request.requestDigest);
    const admitted = consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
      trustedUserEvent,
      request,
    );

    expect(admitted).toMatchObject({
      status: "admitted",
      authority: "trusted-user",
      basis: "external-authenticated-one-use-user-event",
      requestDigest: request.requestDigest,
      executionIdentityDigest: publication.executionIdentityDigest,
      calibrationDigest: contract.calibrationDigest,
      truthPacketDigest: truth.packetDigest,
      officialFrameEquivalence: {
        authorized: true,
        scope: "exact-five-source-parity-calibration-panels-only",
        comparison: "published-candidate-w-exactly-matches-inspected-human-truth",
        steps: REAL_BUILD_BROWSER_OUTPUT_V4_EXACT_FIVE_STEPS,
      },
      publicationAuthorityRemains: "absent",
      nonCalibrationAuthority: {
        physicalTransforms: false,
        placement: false,
        fixedActions: false,
      },
      completionAuthority: {
        status: "absent",
        authorized: false,
        reviewedCalibrationSteps: 5,
        unreviewedCalibrationSteps: 354,
        authorizedCompletionSteps: 0,
      },
    });
    expect(Object.isFrozen(admitted)).toBe(true);
    expect(Object.isFrozen(admitted.officialFrameEquivalence)).toBe(true);
    expect(requireRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(admitted)).toBe(admitted);
    expect(() =>
      requireRealBuildBrowserOutputV4ExactFiveCalibrationAdmission({ ...admitted }),
    ).toThrow(/privately branded result/u);
  });

  it("rejects forged request and user-event shapes without reading proxy claims", () => {
    const { publication, contract, truth } = fixture();
    const request = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      publication,
      contract,
      publication.executionIdentityDigest,
      truth,
    );
    expect(() =>
      requireRealBuildBrowserOutputV4ExactFiveCalibrationRequest({ ...request }),
    ).toThrow(/privately branded authority-free replay result/u);
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
        trustedUserEventMock.authenticate(request.requestDigest),
        { ...request },
      ),
    ).toThrow(/privately branded authority-free replay result/u);
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
        {
          authority: "trusted-user",
          requestDigest: request.requestDigest,
          replayState: "consumed-one-use",
        },
        request,
      ),
    ).toThrow(/unauthenticated event/u);
    let traps = 0;
    const proxied = new Proxy(Object.freeze({}), {
      get() {
        traps += 1;
        throw new Error("must not read a proxy claim");
      },
    });
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(proxied, request),
    ).toThrow(/unauthenticated event/u);
    expect(traps).toBe(0);
  });

  it("admits each exact request and authenticated event identity only once", () => {
    const { publication, contract, truth } = fixture();
    const request = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      publication,
      contract,
      publication.executionIdentityDigest,
      truth,
    );
    const trustedUserEvent = trustedUserEventMock.authenticate(request.requestDigest);
    consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(trustedUserEvent, request);
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(trustedUserEvent, request),
    ).toThrow(/request .* already admitted/u);

    const other = fixture();
    const otherRequest = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      other.publication,
      other.contract,
      other.publication.executionIdentityDigest,
      other.truth,
    );
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(trustedUserEvent, otherRequest),
    ).toThrow(/replayed event/u);
    const mismatchedEvent = trustedUserEventMock.authenticate(request.requestDigest);
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(mismatchedEvent, otherRequest),
    ).toThrow(/different request/u);
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(mismatchedEvent, request),
    ).toThrow(/request .* already admitted|replayed event/u);
  });

  it("reserves the request across a reentrant external event callback", () => {
    const { publication, contract, truth } = fixture();
    const request = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      publication,
      contract,
      publication.executionIdentityDigest,
      truth,
    );
    const trustedUserEvent = trustedUserEventMock.authenticate(request.requestDigest);
    let nestedError: unknown = null;
    trustedUserEventMock.beforeNextReturn(() => {
      try {
        consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(trustedUserEvent, request);
      } catch (error) {
        nestedError = error;
      }
    });
    const admitted = consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
      trustedUserEvent,
      request,
    );
    expect(nestedError).toBeInstanceOf(TypeError);
    expect((nestedError as Error).message).toMatch(/already being consumed/u);
    expect(requireRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(admitted)).toBe(admitted);
  });

  it("rejects event schema drift, clears the reservation, and preserves per-event identity", () => {
    const drift = fixture();
    const driftRequest = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      drift.publication,
      drift.contract,
      drift.publication.executionIdentityDigest,
      drift.truth,
    );
    trustedUserEventMock.returnSchemaVersionOnce(
      "lego.real-build-browser-output-v4-exact-five-authenticated-user-event/0",
    );
    expect(() =>
      consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
        trustedUserEventMock.authenticate(driftRequest.requestDigest),
        driftRequest,
      ),
    ).toThrow(/inconsistent schema/u);
    const recovered = consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
      trustedUserEventMock.authenticate(driftRequest.requestDigest),
      driftRequest,
    );
    expect(recovered.status).toBe("admitted");

    const left = fixture();
    const right = fixture();
    const leftRequest = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      left.publication,
      left.contract,
      left.publication.executionIdentityDigest,
      left.truth,
    );
    const rightRequest = inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
      right.publication,
      right.contract,
      right.publication.executionIdentityDigest,
      right.truth,
    );
    const leftEvent = trustedUserEventMock.authenticate(leftRequest.requestDigest);
    const rightEvent = trustedUserEventMock.authenticate(rightRequest.requestDigest);
    const leftAdmission = consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
      leftEvent,
      leftRequest,
    );
    const rightAdmission = consumeRealBuildBrowserOutputV4ExactFiveCalibrationAdmission(
      rightEvent,
      rightRequest,
    );
    expect(leftAdmission.eventIdentityDigest).not.toBe(rightAdmission.eventIdentityDigest);
  });

  it("refuses execution drift and any differing published-versus-truth W mask", () => {
    const executionDrift = fixture();
    expect(() =>
      inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
        executionDrift.publication,
        executionDrift.contract,
        digest("different execution"),
        executionDrift.truth,
      ),
    ).toThrow(/bind publication execution identity/u);

    const mismatch = fixture();
    const changedMasks = mismatch.masks.map((mask) => new Uint8Array(mask));
    const changedStep346 = changedMasks[2]!;
    changedStep346[0] = changedStep346[0]! ^ 1;
    const changedTruth = inspectedTruth(
      mismatch.contract,
      mismatch.publication.executionIdentityDigest,
      changedMasks,
    );
    expect(() =>
      inspectRealBuildBrowserOutputV4ExactFiveCalibrationRequest(
        mismatch.publication,
        mismatch.contract,
        mismatch.publication.executionIdentityDigest,
        changedTruth,
      ),
    ).toThrow(/differing steps \[346\]/u);
  });
});

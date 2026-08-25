import { expect, type Page } from "@playwright/test";

import { preparedSearchOptions } from "../test/real-build-prepared-search.fixture";
import type { RealBuildExactThreeSourcePacketInspection } from "./real-build-exact-three-source-packet-types";

const INTEGRATION_URL: string = "/e2e/real-build-step-one-proper-c4-browser-integration.ts";

function currentCatalogStepOneBytes(): Uint8Array {
  const options = preparedSearchOptions(2, 1);
  const panels = [...options.panels];
  const panel = panels[0]!;
  panels[0] = {
    ...panel,
    pieces: panel.pieces.map((piece, index) => ({
      ...piece,
      designId: index === 0 ? "80015" : "30565",
      materialId: "26",
      catalogPartId:
        index === 0 ? "builtin:corner-plate-5x5-quarter-ring" : "builtin:corner-plate-4x4-round",
      colorId: "builtin:black",
    })),
  };
  return new TextEncoder().encode(JSON.stringify({ ...options, panels }));
}

const bytesBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

export async function runAndVerifyRealBuildStepOneProperC4BrowserIntegration(input: {
  readonly page: Page;
  readonly inspection: RealBuildExactThreeSourcePacketInspection;
  readonly outputDirectory: string;
}): Promise<void> {
  const { readRealBuildExactThreeCompiledObservationSource } =
    await import("./real-build-exact-three-source-packet-reader");
  const compiledSource = readRealBuildExactThreeCompiledObservationSource(input.inspection, 1);
  expect([compiledSource.widthPx, compiledSource.heightPx]).toEqual([500, 336]);
  const { sourceMask, excludedMask, ...sourceHeader } = compiledSource;
  const c4 = await input.page.evaluate(
    async ({ moduleUrl, integrationInputJson }) => {
      const integration = await import(/* @vite-ignore */ moduleUrl);
      return integration.runRealBuildStepOneProperC4BrowserIntegration(integrationInputJson);
    },
    {
      moduleUrl: INTEGRATION_URL,
      integrationInputJson: JSON.stringify({
        preparedRunInputBase64: bytesBase64(currentCatalogStepOneBytes()),
        source: {
          ...sourceHeader,
          sourceMaskBase64: bytesBase64(sourceMask),
          excludedMaskBase64: excludedMask === null ? null : bytesBase64(excludedMask),
        },
      }),
    },
  );
  expect(c4.rawRosterDigest).toBe(
    "sha256:24e68a134cf86c181ede701c2f189d1f2816af4a83510e2a841f270249d5ce72",
  );
  expect(c4.quotientDigest).toBe(
    "sha256:660f8c7c8ea2eac42e7c006acd911099ac28e10af2b8e055adad711cd9643421",
  );
  expect(c4.equivariance).toMatchObject({
    exactParity: true,
    backendClaim: "calibrated-same-factory-only",
    accounting: {
      controlDocuments: 4,
      rendererPreparations: 4,
      physicalRenderCalls: 32,
      rendererDisposals: 4,
    },
    physicalFrameAuthority: "absent",
    placementAuthority: "absent",
    completionAuthority: { status: "absent", authorized: false },
    authority: "absent",
  });
  expect(c4.counts).toEqual({
    calibration: { preparations: 4, renders: 32, disposals: 4 },
    reduction: { preparations: 100, renders: 800, disposals: 100 },
    verification: { preparations: 300, renders: 2_400, disposals: 300 },
    alternateFrame: { preparations: 100, renders: 100, disposals: 100, contactFrames: 100 },
    contactFramesByCamera: [100, 100, 100, 100, 100, 100, 100, 100],
    instructionRendererDisposals: 1,
  });
  expect(c4.visualEvidence).toMatchObject({
    cameraSheets: 8,
    framesPerCamera: [100, 100, 100, 100, 100, 100, 100, 100],
    alternateFrame: {
      cameraIndex: 0,
      pixelsPerUnit: 20,
      frames: 100,
    },
    authority: "absent",
  });
  expect(c4.populationEquivariance).toMatchObject({
    exactPackedMaskCommitmentParity: true,
    scoreAndTiePreservation: "identical-packed-masks-under-one-bound-source",
    backendClaim: "exhaustive-current-population-same-factory",
    accounting: {
      verificationBudget: 8_192,
      verificationReserved: 2_400,
      verificationReservationCount: 60,
      verificationClosureCount: 60,
      membersPerVerificationClosure: 5,
      camerasPerVerificationClosure: 40,
      perClosurePredictedRoleBytes: 882_000,
      perClosurePredictedPixelVisits: 122_808_000,
      omittedMembers: 300,
      verificationPreparations: 300,
      verificationPhysicalRenderCalls: 2_400,
      verificationDisposals: 300,
      reductionPhysicalRenderCalls: 800,
      reductionAndVerificationPhysicalRenderCalls: 3_200,
      verificationMaskPixels: 403_200_000,
    },
    physicalFrameAuthority: "absent",
    placementAuthority: "absent",
    completionAuthority: { status: "absent", authorized: false },
    authority: "absent",
  });
  expect(c4.searchLedger).toEqual({
    budget: 8_192,
    reserved: 800,
    refused: false,
    reservationCount: 20,
    failedReservation: null,
  });
  expect(c4.cameraLedger).toEqual({
    budget: 8_192,
    reserved: 6_400,
    refusedReservation: false,
    failedReservation: null,
  });
  expect(c4.accounting).toEqual({
    closureCount: 20,
    representatives: 100,
    rawCandidates: 400,
    compiledLineageEdges: 800,
    uniquePhysicalTransitions: 100,
    physicalRenderBaseline: 3_200,
    physicalRenderCalls: 800,
    representativeCameraScores: 800,
    inverseExpandedRawCameraScores: 3_200,
    rawLogicalCameraBranches: 25_600,
    quotientLogicalCameraBranches: 6_400,
    reductionNumerator: 3,
    reductionDenominator: 4,
  });
  expect(c4.globalAggregation).toMatchObject({
    representativeRows: 800,
    inverseExpandedRows: 3_200,
    inverseMap: 400,
    selection: {
      status: "unresolved",
      selectedRawEncounterIndex: null,
      selectedRepresentativeEncounterIndex: null,
      margin: 0,
    },
  });
  expect(c4).toMatchObject({
    acceptedDocument: null,
    acceptedTransition: null,
    physicalFrameAuthority: "absent",
    placementAuthority: "absent",
    completionAuthority: { status: "absent", authorized: false },
    authority: "absent",
  });
  for (let cameraIndex = 0; cameraIndex < 8; cameraIndex += 1) {
    await input.page
      .locator(`canvas[data-proper-c4-current-contact-camera="${cameraIndex}"]`)
      .screenshot({
        path: `${input.outputDirectory}/step-one-proper-c4-current-camera-${cameraIndex}.png`,
      });
  }
  await input.page
    .locator('canvas[data-proper-c4-current-contact-alternate-frame="zoom-out-camera-0"]')
    .screenshot({
      path: `${input.outputDirectory}/step-one-proper-c4-current-camera-0-zoom-out.png`,
    });
  process.stdout.write(
    `Proper-C4 integration ${c4.integrationDigest}: calibration ${c4.equivariance.parityDigest}, ` +
      `closures ${c4.closureDigestsDigest}, renderer ${c4.rendererConfigurationDigest}, ` +
      `source ${c4.sourceBindingDigest}; reduction 3,200 -> 800 renders plus 2,400 separately budgeted exhaustive verification renders, 25,600 -> 6,400 logical branches, authority absent.\n`,
  );
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  REAL_BUILD_PREFIX50_STEP44_ADMITTED_BOUNDED_PANEL_RECEIPT_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_FACE_ROWS_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_VECTOR_INPUTS_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_ADMITTED_FACE_ROWS_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_ADMITTED_VECTOR_INPUTS_COMMITMENT,
  requireRealBuildPrefix50Step44PreUnlockSourceReceipt,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-preunlock-receipt.ts";
import { REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding.ts";
import {
  deriveRealBuildPrefix50OfflineStep42VectorAdmission,
  deriveRealBuildPrefix50Step42VectorProjection,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-vector.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "../e2e/real-build-prefix50-source-pdf-pins.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts";

describe("offline admission for the pre-unlock Step-through-42 vector receipt", () => {
  it("refuses copied static Step-42 binding literals without a process-local verifier admission", () => {
    expect(() => requireRealBuildPrefix50Step44PreUnlockSourceReceipt(undefined as never)).toThrow(
      /process-local opaque admission/u,
    );
    expect(() =>
      requireRealBuildPrefix50Step44PreUnlockSourceReceipt(
        REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING as never,
      ),
    ).toThrow(/process-local opaque admission/u);
  });

  it("caps PDF.js at page 43 and has no page-44 panel, callout, or shape derivation", () => {
    const source = readFileSync(
      resolve(
        "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-vector.ts",
      ),
      "utf8",
    );
    expect(source).toContain("numPages: 43");
    expect(source).toContain("pageNumber > 43");
    expect(source).not.toMatch(
      /sampleBookletCalloutBoxes|panelAndCalloutEvidence|spec\.panelBounds|spec\.callouts/u,
    );
    expect(source).not.toMatch(/sampleBookletPageShapes\([^)]*44/su);
  });

  it("regenerates the separately pinned vector commitments from exact PDF bytes", async () => {
    const bytes = readFileSync(resolve(REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH));
    expect(sha256RealBuildPrefix50Step44ReviewBytes(bytes)).toBe(
      REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    );
    const regenerated = await deriveRealBuildPrefix50OfflineStep42VectorAdmission(bytes);
    expect(regenerated).toMatchObject({
      authority: "page43-capped-vector-prefix-plus-bounded-step41-step42-review",
      selectionAuthority: false,
      earlierPageVectorInputsCommitment:
        REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_VECTOR_INPUTS_COMMITMENT,
      earlierPageRowsCommitment: REAL_BUILD_PREFIX50_STEP44_ADMITTED_EARLIER_FACE_ROWS_COMMITMENT,
      boundedCalibrationPanelReceiptCommitment:
        REAL_BUILD_PREFIX50_STEP44_ADMITTED_BOUNDED_PANEL_RECEIPT_COMMITMENT,
      vectorInputsCommitment: REAL_BUILD_PREFIX50_STEP44_ADMITTED_VECTOR_INPUTS_COMMITMENT,
      faceRowsCommitment: REAL_BUILD_PREFIX50_STEP44_ADMITTED_FACE_ROWS_COMMITMENT,
      terminalFace: "studs-up",
    });
  }, 120_000);

  it("projects the same Steps-through-42 receipt when arbitrary Step-43 evidence changes or vanishes", () => {
    const earlier = Array.from({ length: 40 }, (_, index) => ({
      stepNumber: index + 1,
      pageNumber: Math.min(43, index + 1),
      rotationIconPresent: false,
    }));
    const baseline = deriveRealBuildPrefix50Step42VectorProjection(earlier);
    const laterEvidence = new Proxy(
      { stepNumber: 43 },
      {
        get(target, property, receiver) {
          if (property === "stepNumber") return Reflect.get(target, property, receiver);
          throw new TypeError(`Step-43 ${String(property)} was read`);
        },
      },
    );
    expect(
      deriveRealBuildPrefix50Step42VectorProjection([
        ...earlier,
        laterEvidence as unknown as (typeof earlier)[number],
      ]),
    ).toEqual(baseline);
    expect(deriveRealBuildPrefix50Step42VectorProjection(earlier)).toEqual(baseline);
    expect(
      deriveRealBuildPrefix50Step42VectorProjection([
        ...earlier,
        {
          stepNumber: 43,
          pageNumber: Number.MAX_SAFE_INTEGER,
          rotationIconPresent: true,
          label: "arbitrary mutation",
          callouts: [999],
          shapes: ["arbitrary"],
        } as unknown as (typeof earlier)[number],
      ]),
    ).toEqual(baseline);
  });
});

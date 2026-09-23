import { existsSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock(
  "../e2e/real-build-prefix50-step44-later-source-authority.ts",
  () => import("./real-build-prefix50-step44-later-source-authority-test-seam.ts"),
);

import {
  createRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidenceForTest,
  deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence,
  REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING,
  REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  realBuildPrefix50Step44PanelFacePrefixTestOnly,
  requireRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence,
  requireRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidence,
  validateRealBuildPrefix50Step44PanelFacePrefixRows,
  verifyPersistedRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence,
} from "../e2e/real-build-prefix50-step44-panel-face-prefix";
import PANEL_FACE_GROUND_TRUTH from "./fixtures/panel-face-ground-truth.json" with { type: "json" };
import { issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest } from "./real-build-prefix50-step44-later-source-authority-test-seam.ts";

const rows = () =>
  Array.from({ length: 44 }, (_, index) => ({
    stepNumber: index + 1,
    pageNumber: REAL_BUILD_PREFIX50_STEP44_FACE_PREFIX_PAGE_CEILING,
    rotationIconPresent: false,
  }));

describe("prefix-50 Step-44 panel-face prefix evidence", () => {
  it("refuses missing, duplicate, out-of-order, and page-46 prefix rows", () => {
    const complete = rows();
    expect(() => validateRealBuildPrefix50Step44PanelFacePrefixRows(complete.slice(0, -1))).toThrow(
      /exactly printed steps 1\.\.44/u,
    );
    expect(() =>
      validateRealBuildPrefix50Step44PanelFacePrefixRows([
        complete[0]!,
        complete[0]!,
        ...complete.slice(2),
      ]),
    ).toThrow(/ordered printed step 2/u);
    expect(() =>
      validateRealBuildPrefix50Step44PanelFacePrefixRows([
        complete[1]!,
        complete[0]!,
        ...complete.slice(2),
      ]),
    ).toThrow(/ordered printed step 1/u);
    expect(() =>
      validateRealBuildPrefix50Step44PanelFacePrefixRows([
        ...complete.slice(0, -1),
        { ...complete.at(-1)!, pageNumber: 46 },
      ]),
    ).toThrow(/no later than 45/u);
  });

  it("keeps synthetic face declarations explicit and outside repository authority", () => {
    const evidence = createRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidenceForTest(
      `sha256:${"a".repeat(64)}`,
    );
    expect(evidence).toMatchObject({
      authority: "synthetic-test-only",
      sourcePdfArtifactPath: "synthetic-test-source.pdf",
      vectorDetector: "synthetic-test-declaration/1",
      expectedPanelFace: "studs-up",
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.rows)).toBe(true);
    expect(requireRealBuildPrefix50Step44SyntheticPanelFacePrefixEvidence(evidence)).toBe(evidence);
    expect(() => requireRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(evidence)).toThrow(
      /repository panel-face authority/u,
    );
    expect(() =>
      verifyPersistedRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(evidence),
    ).toThrow(/refuses synthetic/u);
  });

  it("rejects a self-consistent forged repository fold that merely ends studs-up", () => {
    const forged = realBuildPrefix50Step44PanelFacePrefixTestOnly.createStructuralEvidence({
      authority: "repository-pdf-vector",
      sourcePdfArtifactPath: "recipes/6651557.pdf",
      sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      vectorDetector: "white-44.937pt-square-in-step-panel/1",
      rows: rows(),
    });
    expect(forged.expectedPanelFace).toBe("studs-up");
    expect(forged.commitment).not.toBe(
      REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT,
    );
    expect(() =>
      verifyPersistedRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(forged),
    ).toThrow(/pinned live first-44 PDF evidence commitment/u);
  });
});

describe.runIf(existsSync("recipes/6651557.pdf"))(
  "prefix-50 Step-44 live repository PDF face parity",
  () => {
    it("reads exactly through page 45, reproduces the independent first 43, and proves step 44 studs-up", async () => {
      const evidence = await deriveRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(
        issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
          repositoryRoot: process.cwd(),
          sourcePdfArtifactPath: "recipes/6651557.pdf",
          sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
          maximumSourceBytes: 80 * 1024 * 1024,
          purpose: "page45-step44-vector",
          physicalPageNumber: 45,
        }),
      );
      const truthFaces = PANEL_FACE_GROUND_TRUTH.faces as Record<string, string>;
      expect(evidence).toMatchObject({
        authority: "repository-pdf-vector",
        sourcePdfArtifactPath: "recipes/6651557.pdf",
        sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
        coveredPageCeiling: 45,
        expectedPanelFace: "studs-up",
      });
      expect(evidence.rows).toHaveLength(44);
      expect(evidence.commitment).toBe(
        REAL_BUILD_PREFIX50_STEP44_PANEL_FACE_PREFIX_EVIDENCE_COMMITMENT,
      );
      expect(Object.isFrozen(evidence)).toBe(true);
      expect(Object.isFrozen(evidence.rows)).toBe(true);
      expect(Object.isFrozen(evidence.rows[43])).toBe(true);
      expect(evidence.rows.map(({ stepNumber }) => stepNumber)).toEqual(
        Array.from({ length: 44 }, (_, index) => index + 1),
      );
      expect(Math.max(...evidence.rows.map(({ pageNumber }) => pageNumber))).toBe(45);
      expect(
        evidence.rows
          .slice(0, 43)
          .filter(({ rotationIconPresent }) => rotationIconPresent)
          .map(({ stepNumber }) => stepNumber),
      ).toEqual(PANEL_FACE_GROUND_TRUTH.iconSteps);
      expect(
        evidence.rows
          .slice(0, 43)
          .map(({ stepNumber, pageNumber, panelFace }) => [stepNumber, pageNumber, panelFace]),
      ).toEqual(
        PANEL_FACE_GROUND_TRUTH.verdicts.map(({ stepNumber, pageNumber }) => [
          stepNumber,
          pageNumber,
          truthFaces[String(stepNumber)],
        ]),
      );
      expect(evidence.rows.at(-1)).toEqual({
        stepNumber: 44,
        pageNumber: 45,
        rotationIconPresent: false,
        panelFace: "studs-up",
      });
      expect(requireRealBuildPrefix50Step44RepositoryPanelFacePrefixEvidence(evidence)).toBe(
        evidence,
      );
    }, 120_000);
  },
);

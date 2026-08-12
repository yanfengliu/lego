import { describe, expect, it } from "vitest";

import { executeRunDirectPlacements } from "../e2e/real-build-run-placement";
import type { RealBuildPanelSpec } from "../e2e/real-build-safety";

const piece = {
  identityKey: "brick-1",
  designId: "3024",
  materialId: "21",
  catalogPartId: "builtin:plate-1x1",
  colorId: "builtin:red",
  calloutKey: "step-1-callout-1",
  identificationConfidence: "pair-judged-same",
  cropDigest: null,
  identificationInputDigest: null,
  expectedTransform: { positionLdu: [0, 0, 0], orientationId: "identity" },
} as const satisfies RealBuildPanelSpec["pieces"][number];

const options = {
  proximityMarginPx: 4,
  maxRendersPerPiece: 2,
  blindRenderBudget: 2,
  minimumScoreMargin: 0.01,
};

describe("real-build run direct placement", () => {
  it("returns a provisional child and caller-owned bookkeeping without committing identity", () => {
    const secondPiece = { ...piece, identityKey: "brick-2", calloutKey: "step-1-callout-2" };
    const candidates = [
      {
        catalogPartId: piece.catalogPartId,
        transform: { positionLdu: [0, 0, 0] as const, orientationId: "identity" },
      },
      {
        catalogPartId: piece.catalogPartId,
        transform: { positionLdu: [20, 0, 0] as const, orientationId: "identity" },
      },
    ];
    const reports: Parameters<typeof executeRunDirectPlacements>[0]["pieceReports"] = [];
    const registrations: Parameters<typeof executeRunDirectPlacements>[0]["pendingRegistrations"] =
      [];
    const partIds: string[] = [];
    const base = { parts: [] as string[] };
    let liveCentre: [number, number] = [10, 12];
    const probeCentres: [number, number][] = [];
    const result = executeRunDirectPlacements({
      stepNumber: 1,
      pieces: [piece, secondPiece],
      skip: false,
      initialDocument: base,
      initialStepId: null,
      initialCentre: liveCentre,
      updateCentre: (nextCentre) => {
        liveCentre = nextCentre;
      },
      initialCandidatePlaced: 0,
      initialFailure: null,
      candidatePartIds: partIds,
      pendingRegistrations: registrations,
      pieceReports: reports,
      anchorStep: true,
      highlightBox: null,
      width: 20,
      height: 24,
      view: { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1, upSign: 1 },
      frame: { widthPx: 20, heightPx: 24, target: [0, 0, 0], sceneRadius: 60 },
      options,
      assembly: {
        enumeratePlacements: () => ({ candidates }),
        placementOccupancyKey: (
          _catalogPartId: string,
          transform: (typeof candidates)[number]["transform"],
        ) => transform.positionLdu.join(","),
      },
      rendering: {
        createOrthographicViewCamera: (view: { centerXPx: number; centerYPx: number }) => {
          probeCentres.push([view.centerXPx, view.centerYPx]);
          return {};
        },
      },
      kernel: { documentStructuralHash: () => "same-prefix" },
      renderAndScore: (_document, candidate) => ({
        candidate,
        score: candidate.transform.positionLdu[0] === 0 ? 0.9 : 0.5,
        centre:
          candidate.transform.positionLdu[0] === 0
            ? [liveCentre[0] + 1, liveCentre[1] + 1]
            : [liveCentre[0] + 2, liveCentre[1] + 2],
      }),
      place: (document) => ({
        document: { parts: [...document.parts, `part-${document.parts.length + 1}`] },
        partId: `part-${document.parts.length + 1}`,
        stepId: "step-1",
      }),
    });

    expect(result).toMatchObject({
      document: { parts: ["part-1", "part-2"] },
      printedStepId: "step-1",
      centre: [12, 14],
      candidatePlaced: 2,
      failure: null,
      ownPanelMargin: null,
    });
    expect(probeCentres).toEqual([
      [10, 12],
      [11, 13],
    ]);
    expect(partIds).toEqual(["part-1", "part-2"]);
    expect(registrations).toEqual([
      expect.objectContaining({ identityKey: "brick-1", partId: "part-1", stepNumber: 1 }),
      expect.objectContaining({ identityKey: "brick-2", partId: "part-2", stepNumber: 1 }),
    ]);
    expect(reports).toEqual([
      expect.objectContaining({ placed: true, bestScore: 0.9, runnerUpScore: 0.5 }),
      expect.objectContaining({ placed: true, bestScore: 0.9, runnerUpScore: 0.5 }),
    ]);
  });

  it("does not touch placement dependencies when the caller defers or uses exploded evidence", () => {
    const base = { parts: ["base"] };
    const untouched = () => {
      throw new Error("placement dependency must remain untouched");
    };
    const result = executeRunDirectPlacements({
      stepNumber: 2,
      pieces: [piece],
      skip: true,
      initialDocument: base,
      initialStepId: "step-1",
      initialCentre: [5, 6],
      updateCentre: untouched,
      initialCandidatePlaced: 0,
      initialFailure: null,
      candidatePartIds: [],
      pendingRegistrations: [],
      pieceReports: [],
      anchorStep: false,
      highlightBox: null,
      width: 10,
      height: 12,
      view: { azimuthDegrees: 0, elevationDegrees: 0, pixelsPerUnit: 1, upSign: 1 },
      frame: { widthPx: 10, heightPx: 12, target: [0, 0, 0], sceneRadius: 60 },
      options,
      assembly: { enumeratePlacements: untouched },
      rendering: { createOrthographicViewCamera: untouched },
      kernel: { documentStructuralHash: untouched },
      renderAndScore: untouched,
      place: untouched,
    });

    expect(result).toEqual({
      document: base,
      printedStepId: "step-1",
      centre: [5, 6],
      candidatePlaced: 0,
      failure: null,
      ownPanelMargin: null,
    });
  });
});

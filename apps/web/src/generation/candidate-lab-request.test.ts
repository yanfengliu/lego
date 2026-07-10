import { describe, expect, it } from "vitest";

import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import { createEmptyBrickDocument, documentStructuralHash } from "@lego-studio/brick-kernel";
import { runDeterministicMakerPopulation } from "@lego-studio/generation";

import { createCandidateLabRequest } from "./candidate-lab-request";

describe("local candidate lab request", () => {
  it("binds a bounded full-empty brief and scope to the exact current document", () => {
    const document = createEmptyBrickDocument({ id: "candidate-lab", name: "Candidate lab" });
    const request = createCandidateLabRequest(
      document,
      "Build a red and yellow 18-piece staircase",
      "local-lab-job-1",
    );

    expect(request.jobId).toBe("local-lab-job-1");
    expect(request.brief).toMatchObject({
      schemaVersion: "lego.build-brief/1",
      mode: "full",
      prompt: "Build a red and yellow 18-piece staircase",
      baseRevision: document.revision,
      baseDocumentHash: documentStructuralHash(document),
      pieceBudget: 24,
      referenceArtifactIds: [],
      semanticRequirements: ["one connected model"],
      styleTags: ["simple"],
      consent: {
        providerTransmission: "none",
        knowledgeUse: false,
        benchmarkUse: false,
        trainingUse: false,
      },
    });
    expect(request.scope).toMatchObject({
      schemaVersion: "lego.scope-capability/1",
      baseRevision: document.revision,
      baseDocumentHash: documentStructuralHash(document),
      frozenPartIds: [],
      mutablePartIds: [],
      requiredAttachmentPorts: [],
      budgets: { maxAddedParts: 24, maxRemovedParts: 0, maxOperations: 160 },
    });
    expect(request.brief.allowedCatalogPartIds).toEqual(PART_DEFINITIONS.map(({ id }) => id));
    expect(request.brief.allowedColorIds).toEqual(COLOR_DEFINITIONS.map(({ id }) => id));
    expect(request.scope.allowedCatalogPartIds).toEqual(request.brief.allowedCatalogPartIds);
    expect(request.scope.allowedColorIds).toEqual(request.brief.allowedColorIds);
    expect(runDeterministicMakerPopulation(request)).toMatchObject({
      ok: true,
      attempts: { length: 4 },
    });
  });

  it("narrows authority to document allowlists and preserves an unsupported small budget as evidence", () => {
    const base = createEmptyBrickDocument({
      id: "candidate-lab-limited",
      name: "Limited lab",
      maxParts: 9,
    });
    const document = {
      ...base,
      constraints: {
        ...base.constraints,
        allowedCatalogPartIds: ["builtin:brick-1x2"],
        allowedColorIds: ["builtin:red"],
      },
    };
    const request = createCandidateLabRequest(document, "Build a red tower", "local-lab-job-2");

    expect(request.brief.allowedCatalogPartIds).toEqual(["builtin:brick-1x2"]);
    expect(request.brief.allowedColorIds).toEqual(["builtin:red"]);
    expect(request.brief.pieceBudget).toBe(9);
    expect(runDeterministicMakerPopulation(request)).toMatchObject({
      ok: false,
      failure: { code: "PART_BUDGET_TOO_SMALL" },
    });
  });
});

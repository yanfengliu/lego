import {
  createBuiltinTruthSnapshot,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { BuildBriefV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

import type { DeterministicMakerPopulationInput } from "./types.ts";

/**
 * The one run whose canonical digest is pinned, and enough context to tell a
 * moved pin apart from a broken deterministic path.
 *
 * The pin catches an accidental change to generation, ranking, compilation or
 * validation. It also moves whenever catalog truth moves, because the run
 * embeds the document's truth snapshot and the brief's catalog allow-lists — so
 * the digest on its own cannot say which of the two happened. Recording the
 * catalog truth beside it makes that question answerable, and
 * `npm run pin:generate` makes the answer cheap to act on: nobody copies a
 * sha256 by hand, and nobody has to guess whether re-pinning is safe.
 */
export function pinnedRunInput(): DeterministicMakerPopulationInput {
  const document = createEmptyBrickDocument({
    id: "captured-population-test",
    name: "Captured population test",
  });
  const baseDocumentHash = documentStructuralHash(document);
  const allowedCatalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
  const allowedColorIds = COLOR_DEFINITIONS.map(({ id }) => id);
  const brief = {
    schemaVersion: "lego.build-brief/1",
    mode: "full",
    prompt: "Build a red and yellow 16 piece tower",
    referenceArtifactIds: [],
    baseRevision: document.revision,
    baseDocumentHash,
    allowedCatalogPartIds,
    allowedColorIds,
    pieceBudget: 24,
    semanticRequirements: ["one connected model"],
    styleTags: ["simple"],
    budgets: {
      maxCandidates: 4,
      maxRepairs: 0,
      maxProviderCalls: 0,
      maxTokens: 0,
      maxCostMicros: 0,
      maxWallTimeMs: 10_000,
      maxRenders: 28,
      maxStoredBytes: 16_777_216,
    },
    consent: {
      policyVersion: "local-captured-population-1",
      providerTransmission: "none",
      retainRunArtifacts: true,
      knowledgeUse: false,
      benchmarkUse: false,
      trainingUse: false,
    },
  } satisfies BuildBriefV1;
  const scope = {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "captured-full-empty-scope",
    baseRevision: document.revision,
    baseDocumentHash,
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-400, -400, -400], maxLdu: [400, 400, 400] },
    allowedCatalogPartIds,
    allowedColorIds,
    budgets: { maxAddedParts: 24, maxRemovedParts: 0, maxOperations: 160 },
  } satisfies ScopeCapabilityV1;
  return { jobId: "captured-population-job", document, brief, scope };
}

/** Catalog truth as this build sees it, which is what the pin is relative to. */
export function liveCatalogTruth(): { readonly version: string; readonly hash: string } {
  const { version, hash } = createBuiltinTruthSnapshot().catalog;
  return { version, hash };
}

export interface RunPin {
  readonly catalogVersion: string;
  readonly catalogTruthHash: string;
  readonly populationDigest: string;
}

/**
 * Why the digest moved, and what to do about it.
 *
 * Two very different failures arrive at this pin, and answering them the same
 * way is how a real regression gets re-pinned out of sight: a catalog change
 * moves the digest as a matter of course, while a digest that moves under
 * unchanged catalog truth means generation, ranking, compilation or validation
 * behaves differently than it did.
 */
export function describePinDrift(pin: RunPin, liveDigest: string): string {
  const live = liveCatalogTruth();
  const catalogMoved = live.version !== pin.catalogVersion || live.hash !== pin.catalogTruthHash;
  const header = `Pinned deterministic maker run digest is ${pin.populationDigest}; this build produced ${liveDigest}.`;
  if (catalogMoved) {
    return [
      header,
      `Catalog truth moved with it: ${pin.catalogVersion} ${pin.catalogTruthHash}`,
      `                          -> ${live.version} ${live.hash}`,
      "Every run embeds the document's truth snapshot and the brief's catalog allow-lists, so any catalog change moves this digest. For a catalog change that is the expected outcome, not a regression.",
      "Fix: run `npm run pin:generate` and commit packages/generation/src/run-pin.generated.ts with the catalog change.",
      "Dead end: editing the literal by hand. That is the tax this pin exists to remove, and it is how a wrong digest gets committed.",
    ].join("\n");
  }
  return [
    header,
    `Catalog truth did not move: it is still ${live.version} ${live.hash}.`,
    "So the change is in the deterministic path itself — generateDeterministicPrograms, RANKING_POLICY, compileBuildProgram, or the kernel validators — and not in the catalog.",
    "Fix: find the behavioural change first, then re-pin with `npm run pin:generate` once you can say what moved and why.",
    "Dead end: re-pinning to make this green. The pin will accept any digest you generate, so re-pinning before you know what changed is exactly the accident it is here to catch.",
  ].join("\n");
}

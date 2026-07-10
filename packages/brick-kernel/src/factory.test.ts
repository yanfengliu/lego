import { describe, expect, it } from "vitest";

import { validateBrickDocumentV1, validateTruthSnapshot } from "@lego-studio/protocol";

import {
  createBuiltinTruthSnapshot,
  createEmptyBrickDocument,
  createPartInstance,
  getBuiltinTruthDigestInputs,
} from "./factory.ts";
import { canonicalDigest } from "./canonical.ts";

describe("builtin document factories", () => {
  it("pins every interpretation snapshot with a canonical SHA-256 digest", () => {
    const truth = createBuiltinTruthSnapshot();
    expect(validateTruthSnapshot(truth), validateTruthSnapshot.errors?.[0]?.message).toBe(true);
    expect(Object.values(truth).filter((value) => typeof value === "object")).toHaveLength(5);
    expect(truth.catalog.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const inputs = getBuiltinTruthDigestInputs();
    expect(truth.connectorTaxonomy.hash).toBe(canonicalDigest(inputs.connectorTaxonomy));
    expect(truth.collisionModel.hash).toBe(canonicalDigest(inputs.collisionModel));
    expect(truth.transformPolicy.hash).toBe(canonicalDigest(inputs.transformPolicy));
    expect(truth.validatorSet.hash).toBe(canonicalDigest(inputs.validatorSet));
    expect(
      canonicalDigest({
        ...inputs.validatorSet,
        rules: [...inputs.validatorSet.rules, "new-rule"],
      }),
    ).not.toBe(truth.validatorSet.hash);
  });

  it("creates a schema-valid empty manual document", () => {
    const document = createEmptyBrickDocument({ id: "document-1", name: "Untitled" });
    expect(validateBrickDocumentV1(document), validateBrickDocumentV1.errors?.[0]?.message).toBe(
      true,
    );
    expect(document.parts).toEqual([]);
    expect(document.submodels).toHaveLength(1);
    expect(document.steps).toHaveLength(1);
  });

  it("creates a legal default part without sharing mutable arrays", () => {
    const left = createPartInstance({ id: "left" });
    const right = createPartInstance({ id: "right" });
    expect(left.transform).toEqual({ positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" });
    expect(left.semanticTags).not.toBe(right.semanticTags);
  });
});

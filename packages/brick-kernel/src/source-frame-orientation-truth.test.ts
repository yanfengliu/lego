import { PROPER_ORIENTATIONS, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";

describe("source-frame orientation infrastructure truth boundary", () => {
  it("keeps the exact /26 saved-document truth while exposing 24 source frames", () => {
    const digestInputs = getBuiltinTruthDigestInputs();
    const truth = createBuiltinTruthSnapshot();

    expect(PROPER_ORIENTATIONS).toHaveLength(24);
    expect(digestInputs.catalog.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(digestInputs.transformPolicy.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(truth).toEqual({
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/26",
        hash: "sha256:f86310b89f3224cff7a8d571de5a26fd36440ab46235abf1cf530e2f65f41b37",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:93f0a5fc899083be25c5364266e7046b397683204e0e0991f106425ec5a99059",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:7e9905d9f988c288eaeddee3d7befb7af79266518612bbba171d9b7f7fb1c463",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:a8694ddcdc39da5afd946a6012ac2588233bebe2eed457e8501cf572661b2956",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/3",
        hash: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
      },
    });
    expect(canonicalDigest(truth)).toBe(
      "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9",
    );
  });
});

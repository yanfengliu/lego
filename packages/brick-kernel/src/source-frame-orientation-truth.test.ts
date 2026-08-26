import { PROPER_ORIENTATIONS, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";

describe("source-frame orientation infrastructure truth boundary", () => {
  it("keeps placement truth upright while /28 exposes 24 source frames", () => {
    const digestInputs = getBuiltinTruthDigestInputs();
    const truth = createBuiltinTruthSnapshot();

    expect(PROPER_ORIENTATIONS).toHaveLength(24);
    expect(digestInputs.catalog.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(digestInputs.transformPolicy.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(truth).toEqual({
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/28",
        hash: "sha256:15decef17024421dec825287923d2ae0142973f83281b3479b0eeeb5e5ddd837",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:41b9011f2ae13baadd4bc173936ea962d5ef6419809bc17fa3dcfcf01e83a553",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:11a791eaed761857eeb7446a4feaa278635593a8767e0d6d7ed9426d0cebeabd",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:b67a6b5226f97eeef8d18dc038df8e6e51da51843b0846cb64a61c328f46eb9a",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/4",
        hash: "sha256:ac785c8f5ac9f2d642bf53c8ef51764b7954c981355b1d7d508a2228a5f1bf55",
      },
    });
    expect(canonicalDigest(truth)).toBe(
      "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b",
    );
  });
});

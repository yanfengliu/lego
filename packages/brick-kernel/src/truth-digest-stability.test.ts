import { createHash } from "node:crypto";

import { PART_DEFINITIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";

/**
 * Every saved document pins these five hashes, so moving one silently
 * reinterprets documents that were valid under the truth they recorded. They
 * are literals rather than recomputed expectations on purpose: a test that
 * derives what it checks from the code it is checking cannot notice a change.
 *
 * Measured at HEAD 12d328b, catalog builtin.basic-parts/6 with 77 definitions.
 * A move here is legitimate only alongside a deliberate version bump and its
 * migration report; red for any other reason means something re-hashed the
 * catalog by accident.
 */
const PINNED_TRUTH_HASHES = {
  catalog: "sha256:590a94c9b9498faace4b29b74c4c9ba8352d644365585d9aeb96b4a7c53bdb7f",
  connectorTaxonomy: "sha256:720d9d3f430c388bd4fa47de41f93aed138505642bf9b33b3f6e5ca6a0510dfb",
  collisionModel: "sha256:692e143470b6a19f54299301de79daf74acd75af0ffeefb82437b5e81c6bda2a",
  transformPolicy: "sha256:535a51b5b102dac0d5788ffecb3c1330d51e0799853d7cc9a1fa1236354f8a09",
  validatorSet: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
} as const;

/** SHA-256 of the ordered `[partId, geometry.contentHash]` roster, all 77 rows. */
const PINNED_GEOMETRY_ROSTER_SHA256 =
  "92c7dc3d6f7990dc5b6dbbddabf02e557f2ec54927f61d6e16bf7e9530b0db4d";

const PINNED_PART_COUNT = 77;
const PINNED_CATALOG_SERIALIZED_LENGTH = 1_204_568;

describe("builtin truth digest stability", () => {
  it("keeps the five pinned truth hashes byte-identical", () => {
    const inputs = getBuiltinTruthDigestInputs();

    expect({
      catalog: canonicalDigest(inputs.catalog),
      connectorTaxonomy: canonicalDigest(inputs.connectorTaxonomy),
      collisionModel: canonicalDigest(inputs.collisionModel),
      transformPolicy: canonicalDigest(inputs.transformPolicy),
      validatorSet: canonicalDigest(inputs.validatorSet),
    }).toEqual(PINNED_TRUTH_HASHES);
  });

  it("publishes those hashes through the snapshot every document stores", () => {
    const truth = createBuiltinTruthSnapshot();

    expect(truth.catalog.hash).toBe(PINNED_TRUTH_HASHES.catalog);
    expect(truth.catalog.version).toBe("builtin.basic-parts/6");
    expect(truth.connectorTaxonomy.hash).toBe(PINNED_TRUTH_HASHES.connectorTaxonomy);
    expect(truth.collisionModel.hash).toBe(PINNED_TRUTH_HASHES.collisionModel);
    expect(truth.transformPolicy.hash).toBe(PINNED_TRUTH_HASHES.transformPolicy);
    expect(truth.validatorSet.hash).toBe(PINNED_TRUTH_HASHES.validatorSet);
  });

  it("keeps every part's geometry content hash and the serialized catalog size", () => {
    const roster = PART_DEFINITIONS.map(({ id, geometry }) => [id, geometry.contentHash]);

    expect(roster).toHaveLength(PINNED_PART_COUNT);
    expect(createHash("sha256").update(JSON.stringify(roster)).digest("hex")).toBe(
      PINNED_GEOMETRY_ROSTER_SHA256,
    );
    // A field added to or removed from any definition moves this length, so a
    // break localizes to the serialized shape rather than to the hashing.
    expect(JSON.stringify(getBuiltinTruthDigestInputs().catalog)).toHaveLength(
      PINNED_CATALOG_SERIALIZED_LENGTH,
    );
  });

  it("emits no exact bound for a part that never declared one", () => {
    // Exact bounds are additive: a part already in the catalog must not gain a
    // field, because a new key is a new digest for a part nobody changed.
    for (const part of PART_DEFINITIONS) {
      expect(Object.hasOwn(part, "exactBodyBoundsLdu")).toBe(false);
      expect(Object.hasOwn(part, "exactBoundsLdu")).toBe(false);
      expect(Object.hasOwn(part.geometry, "exactBodyBoundsLdu")).toBe(false);
      expect(part.geometry.digestInput).not.toContain("exactBodyBoundsLdu");
    }
  });
});

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
 * Measured at catalog builtin.basic-parts/7 with 82 definitions, the first
 * production admission of parts declared from measured source. A move here is
 * legitimate only alongside a deliberate version bump and its migration report;
 * red for any other reason means something re-hashed the catalog by accident.
 *
 * What they were at builtin.basic-parts/6, HEAD c78c6f3 with 77 definitions:
 *   catalog            sha256:590a94c9b9498faace4b29b74c4c9ba8352d644365585d9aeb96b4a7c53bdb7f
 *   connectorTaxonomy  sha256:720d9d3f430c388bd4fa47de41f93aed138505642bf9b33b3f6e5ca6a0510dfb
 *   collisionModel     sha256:692e143470b6a19f54299301de79daf74acd75af0ffeefb82437b5e81c6bda2a
 *   transformPolicy    sha256:535a51b5b102dac0d5788ffecb3c1330d51e0799853d7cc9a1fa1236354f8a09
 *   validatorSet       sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e
 * The validator set is unchanged; the other four moved because the catalog
 * gained five parts and every part's provenance carries the catalog version.
 */
const PINNED_TRUTH_HASHES = {
  catalog: "sha256:f26a1ba141ca0485f1bf046c68d94082497fcd8dcea85906723a389a09ec55d2",
  connectorTaxonomy: "sha256:2f3f165461925f9ba3be532d9b5a2e76836d6eb1c93709f954ae7f6150d8db5e",
  collisionModel: "sha256:c8b66e871ec0e730795ace974befb927844ecd1d99929f94c76cb955287c955c",
  transformPolicy: "sha256:5d9342646d5f6434e57e0673aa43192d9274e47588e4dc07081960644402b7ca",
  validatorSet: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
} as const;

/**
 * SHA-256 of the ordered `[partId, geometry.contentHash]` roster, all 82 rows.
 * It was 92c7dc3d6f7990dc5b6dbbddabf02e557f2ec54927f61d6e16bf7e9530b0db4d over
 * the first 77 rows, and those 77 rows still hash to exactly that: the five new
 * parts were appended, and mesh-assets.test.ts holds that separately.
 */
const PINNED_GEOMETRY_ROSTER_SHA256 =
  "1061f97d932fb9193eb697bcc6f90f060f48a988a241f16ad03aee9272c03eb3";

const PINNED_PART_COUNT = 82;
/** 1_204_568 at builtin.basic-parts/6. */
const PINNED_CATALOG_SERIALIZED_LENGTH = 1_298_834;

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
    expect(truth.catalog.version).toBe("builtin.basic-parts/7");
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
      if (part.geometry.generatorId === "builtin:preloaded-mesh-reference/1") continue;
      expect(Object.hasOwn(part, "exactBodyBoundsLdu")).toBe(false);
      expect(Object.hasOwn(part, "exactBoundsLdu")).toBe(false);
      expect(Object.hasOwn(part.geometry, "exactBodyBoundsLdu")).toBe(false);
      expect(part.geometry.digestInput).not.toContain("exactBodyBoundsLdu");
    }
  });
});

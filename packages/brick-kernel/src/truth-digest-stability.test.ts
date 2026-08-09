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
 * Measured at catalog builtin.basic-parts/9 with 85 definitions, which drew the
 * first part as the shell it is: `plate-2x4` gained the ceiling and four walls
 * `3020.dat` models, so its body is five boxes rather than one. A move here is
 * legitimate only alongside a deliberate version bump and its migration report;
 * red for any other reason means something re-hashed the catalog by accident.
 *
 * What they were at builtin.basic-parts/8, HEAD 262d274 with the same 85
 * definitions and a filled `plate-2x4`:
 *   catalog            sha256:a9adf38bfad3c73d47524100f4e3891ac32a8e6cdd7865a37ec00eccf31281e2
 *   connectorTaxonomy  sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2
 *   collisionModel     sha256:8f181d6f69af1cbe385a1d91fa07477bb75df9ef6b5af21b4e1f5bcb3a96b878
 *   transformPolicy    sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6
 *   validatorSet       sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e
 * Exactly two moved: the catalog, because every part's provenance carries the
 * version and one part's body changed, and the collision model, because it
 * reads those same body primitives. The connector taxonomy and the transform
 * policy did not, which is the check working — no connector moved.
 *
 * What they were at builtin.basic-parts/7, HEAD 9d0ebed with 82 definitions:
 *   catalog            sha256:f26a1ba141ca0485f1bf046c68d94082497fcd8dcea85906723a389a09ec55d2
 *   connectorTaxonomy  sha256:2f3f165461925f9ba3be532d9b5a2e76836d6eb1c93709f954ae7f6150d8db5e
 *   collisionModel     sha256:c8b66e871ec0e730795ace974befb927844ecd1d99929f94c76cb955287c955c
 *   transformPolicy    sha256:5d9342646d5f6434e57e0673aa43192d9274e47588e4dc07081960644402b7ca
 *   validatorSet       sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e
 */
const PINNED_TRUTH_HASHES = {
  catalog: "sha256:37044e203031a9efc791ed9d9d41468796e57522e4a048d3403eac1a958386ff",
  connectorTaxonomy: "sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2",
  collisionModel: "sha256:be31c76510a2ccefc2904a858accd2f2fcc162ed8ae723a3c285a5d3dbc5ea3b",
  transformPolicy: "sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6",
  validatorSet: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
} as const;

/**
 * SHA-256 of the ordered `[partId, geometry.contentHash]` roster, all 85 rows.
 * It was 5ea04c448b04800b87087f0c5dcb818d46e805eb51d535c9b40b7894281f4af1 at /8.
 *
 * Every earlier move of this number came from appending parts, which left the
 * existing prefixes hashing exactly as before. This one does not: `plate-2x4` is
 * row 14 and its geometry digest changed, so the 77-row and 82-row prefixes
 * moved too — to 66275737ee36d02aa7a31dc4134310b314332a7397424246c0d677e85d5565d5
 * and 4233f1496f925c3035f2f2b3158b5a47480d75a5371630aef3e9ccc225679a99. That is
 * the point of the version bump: a part in place changed what it draws.
 */
const PINNED_GEOMETRY_ROSTER_SHA256 =
  "19c6fbc5190d808bfa0b3ffd4d81fef3262a8758fffc53f9ecc7dfe76857cce8";

const PINNED_PART_COUNT = 85;
/** 1_204_568 at builtin.basic-parts/6, 1_298_834 at /7, 1_358_361 at /8. */
const PINNED_CATALOG_SERIALIZED_LENGTH = 1_359_123;

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
    expect(truth.catalog.version).toBe("builtin.basic-parts/9");
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

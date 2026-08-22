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
 * Measured at catalog builtin.basic-parts/15 with 87 definitions. /15 appends
 * 28802 as one complete measured bracket: its official LDraw closure supplies
 * exact render and collision geometry, while the LDCad shadow route supplies
 * two clutch cells and verifies six outward stud frames. The four horizontal
 * studs are represented exactly but remain unusable under the unchanged
 * upright-only transform policy. Catalog, connector, collision and transform
 * manifests gain only that additive row; validator truth remains byte-identical.
 *
 * What they were at builtin.basic-parts/14, HEAD 5d90788:
 *   catalog            sha256:c2a3556085f8a3a3efe66a2f52d2a70378be04ff52c53a57fbff2f2701cd194c
 *   connectorTaxonomy  sha256:537ec8b084b9ac9633c4511817204fcd2037e123d96b7628c3e6b803b32a31cf
 *   collisionModel     sha256:a219f827b9dcceda98b7f320bb53c9f7fa172d515a8081af4b97623975aaf97b
 *   transformPolicy    sha256:a005d64462b0805e82b28f8571e40aeb48d6b3602b8fe5db01a4e1cf56635896
 *
 * What they were at builtin.basic-parts/13, HEAD 8fc0186:
 *   catalog            sha256:100283423bf1cfecfdfec5ba2216d1834a9eb19b1757c71772f7fa53223190d6
 *   connectorTaxonomy  sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2
 *   collisionModel     sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb
 *   transformPolicy    sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6
 *
 * What they were at builtin.basic-parts/12, HEAD e70346d:
 *   catalog            sha256:7a058d34855c49d1b46317e0fff51117c36aa92051ba57449465e506fb6986f5
 *   collisionModel     sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb
 *
 * What they were at builtin.basic-parts/11, HEAD bd46506:
 *   catalog            sha256:c7e1f3ff0c5edb175c3b97ad98795aa5ed776636941c5e1b3ff52fcee2daa3bc
 *   collisionModel     sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb
 *
 * What they were at builtin.basic-parts/10, HEAD 081bd53:
 *   catalog            sha256:c41d4c2faf78534bcfab3142907a4271210d9dc855ce1103f12390b0d2c0709e
 *   collisionModel     sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb
 *
 * /10 with 85 definitions drew
 * fifty-eight parts as the shells they are: every brick, plate, tile, jumper
 * plate, grille tile, technic brick and the corner plate now carry the ceiling,
 * walls and underside tubes their own LDraw files model. A move here is
 * legitimate only alongside a deliberate version bump and its migration report;
 * red for any other reason means something re-hashed the catalog by accident.
 *
 * What they were at builtin.basic-parts/9, HEAD 108d5b3 with the same 85
 * definitions and only `plate-2x4` shelled:
 *   catalog            sha256:37044e203031a9efc791ed9d9d41468796e57522e4a048d3403eac1a958386ff
 *   connectorTaxonomy  sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2
 *   collisionModel     sha256:be31c76510a2ccefc2904a858accd2f2fcc162ed8ae723a3c285a5d3dbc5ea3b
 *   transformPolicy    sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6
 *   validatorSet       sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e
 *
 * What they were at builtin.basic-parts/8, HEAD 262d274 with the same 85
 * definitions and a filled `plate-2x4`:
 *   catalog            sha256:a9adf38bfad3c73d47524100f4e3891ac32a8e6cdd7865a37ec00eccf31281e2
 *   collisionModel     sha256:8f181d6f69af1cbe385a1d91fa07477bb75df9ef6b5af21b4e1f5bcb3a96b878
 *
 * Across both bumps exactly two moved: the catalog, because every part's
 * provenance carries the version and those parts' bodies changed, and the
 * collision model, because it reads those same body primitives. The connector
 * taxonomy and the transform policy did not, which is the check working — it
 * says in one number that shelling fifty-eight parts moved no connector at all.
 *
 * What they were at builtin.basic-parts/7, HEAD 9d0ebed with 82 definitions:
 *   catalog            sha256:f26a1ba141ca0485f1bf046c68d94082497fcd8dcea85906723a389a09ec55d2
 *   connectorTaxonomy  sha256:2f3f165461925f9ba3be532d9b5a2e76836d6eb1c93709f954ae7f6150d8db5e
 *   collisionModel     sha256:c8b66e871ec0e730795ace974befb927844ecd1d99929f94c76cb955287c955c
 *   transformPolicy    sha256:5d9342646d5f6434e57e0673aa43192d9274e47588e4dc07081960644402b7ca
 *   validatorSet       sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e
 */
const PINNED_TRUTH_HASHES = {
  catalog: "sha256:08e3812b08d6dd9f0b397dd6d79c6ae89c834e43900508ee00410dfb692f9905",
  connectorTaxonomy: "sha256:e64815499844dfc745d8d12c3caa0ff2a0ef55777b627f604a44506478999513",
  collisionModel: "sha256:a8a000c6402260d5302cd14c613d6577e74e44811b6f431fbb4269c2cfe75e04",
  transformPolicy: "sha256:80594a60bb36cb7d9def2c92566aef0d67181c0c9e9983214a673dae59315a53",
  validatorSet: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
} as const;

/**
 * SHA-256 of the ordered `[partId, geometry.contentHash]` roster, all 87 rows.
 * It was 5ea04c448b04800b87087f0c5dcb818d46e805eb51d535c9b40b7894281f4af1 at /8
 * and 19c6fbc5190d808bfa0b3ffd4d81fef3262a8758fffc53f9ecc7dfe76857cce8 at /9.
 *
 * Every move of this number through /8 came from appending parts, which left the
 * existing prefixes hashing exactly as before. /9 moved one row in place and /10
 * moves fifty-seven more, so no prefix survives either. That is the point of the
 * version bump: parts in place changed what they draw.
 */
const PINNED_GEOMETRY_ROSTER_SHA256 =
  "43fbaffb6f36bd0f55068f3e0caeb737fcb4fd4e3aed97e6fd5a90763a873bee";

const PINNED_PART_COUNT = 87;
/**
 * 1_204_568 at builtin.basic-parts/6, 1_298_834 at /7, 1_358_361 at /8,
 * 1_359_123 at /9, 1_504_522 at /12, 1_508_599 at /13, and 1_516_304 at /14.
 * The /15 increase records the complete 28802 definition: source mesh, eight
 * directed connectors and axis-aware collision evidence all enter together.
 */
const PINNED_CATALOG_SERIALIZED_LENGTH = 1_526_531;

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
    expect(truth.catalog.version).toBe("builtin.basic-parts/15");
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

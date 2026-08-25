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
 * Measured at catalog builtin.basic-parts/26 with 98 definitions. /26 appends
 * 78329 as one complete measured 1 x 5 plate: its exact official LDraw closure
 * supplies the shell, five studs, and conservative collision rows, while the
 * pinned LDCad grid supplies five underside clutches. Predecessor
 * semantic payloads are unchanged. The active catalog input also moves global
 * catalog provenance labels, while the connector, collision, and transform
 * manifests gain only the additive row. Validator set `/3` does not change.
 *
 * What they were at builtin.basic-parts/25, HEAD cf8996f, with 97 definitions:
 *   catalog            sha256:77f8faaacf9e0ad21f74bab3a06daab8e5cb4df088ee672d21da1e639ad76036
 *   connectorTaxonomy  sha256:5c1ee759633b3962e41e26a3f94f296fdd07b3450381f2613ee018caba8ba48d
 *   collisionModel     sha256:8a39981fddfbd1d4e9a5e4a21656105094a11dbdfb35305cb4da07c51263c742
 *   transformPolicy    sha256:e8066b7f1c3c18530536525bbc569a6dff4b311d4c2002c2d0c55f2cde30c4f5
 *   validatorSet       sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4
 *   truth              sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f
 *
 * What they were at builtin.basic-parts/24, HEAD ec2387b, with 96 definitions:
 *   catalog            sha256:8cf9f35a1a692f285994c1819d1063fde6912f7b0ef949fcca1ae2adadeaa65e
 *   connectorTaxonomy  sha256:c88a4334befcea378749b7a31d7c46fb0d0a5818f5a5914c608e0ed9ef506623
 *   collisionModel     sha256:5e4de952a9aa7b49211e563ef2d397572b805ffa6f80b3f96995a7511daff693
 *   transformPolicy    sha256:cf509b04cfab06646a74144cdcda8efc2f6313f7658fe7d2c08d77f53af7e56a
 *   validatorSet       sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4
 *   truth              sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d
 *
 * What they were at builtin.basic-parts/23, HEAD d99b74d, with 95 definitions:
 *   catalog            sha256:d7df28c96d3b4d8c31267289a972f0441c9b275ab1d65aa21a2247ca7f1d7a19
 *   connectorTaxonomy  sha256:57eb657485d5049c5e3624e2811886473b0f230463815fd6ddfd677329b8c62f
 *   collisionModel     sha256:daeb4dcd18ecb29153b425c6c9db060b087a5486e0238dbe3673cfdd521e6cfa
 *   transformPolicy    sha256:397a1cddf7cba68e3fae67753075cdd82003f5a0d2d00ebbae066848610d3d27
 *   validatorSet       sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4
 *   truth              sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb
 *
 * What they were at builtin.basic-parts/22, HEAD 94db468, with 94 definitions:
 *   catalog            sha256:3700b53f804db905fc0b7b1f41f5e2b5d3f60f79dd6ee6ae0bc1f33ed2f99176
 *   connectorTaxonomy  sha256:ba08980d0b651273651f5abd00a9eda0da412ef1ce82fbf8252f09dbff6db1fc
 *   collisionModel     sha256:29d9de56ab3e4215749d51b14923457528f2afd04ce6c149731802db65e748b0
 *   transformPolicy    sha256:3ac16864f8a77c198b0cf78d055bedfee61990c84ff2a14fbe2ef2684632071d
 *   validatorSet       sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4
 *   truth              sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e
 *
 * What they were at builtin.basic-parts/21, HEAD 98dc1e8, with 93 definitions:
 *   catalog            sha256:2e7bed932f81ae85af63d689924f66161ece3d3e12d3520d3839727054a8a73d
 *   connectorTaxonomy  sha256:be31f7dc69941b200254ecea0e2e81af60954a2edb79790eb64ad5eba9bf354b
 *   collisionModel     sha256:b953a7541a50fd1b32fb255356d760134c61c180f77c6059cbcdb42c9cecada1
 *   transformPolicy    sha256:2f1dd7d46273c829e7990f0e28a091ca68c0335089f785442088746ae23f10af
 *   validatorSet       sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4
 *   truth              sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1
 *
 * What they were at builtin.basic-parts/16, HEAD d58ea05:
 *   catalog            sha256:e80f7c99912fba393a549b53549e3f8b9578b48fe5331682ad5e140edca600f6
 *   connectorTaxonomy  sha256:6f19cd949127543229d54366a37dd377cb7fbcd8042115c9339aabbbfe4deddc
 *   collisionModel     sha256:8c32b975cd25b5b0417432f28789a1124b97053f1d056ab1b547730ec6899599
 *   transformPolicy    sha256:34aa4fb3af8d22fbb565fd67beaf48f824a888f68390c6183bab6657768819b2
 *
 * What they were at builtin.basic-parts/15, HEAD 8ac4c6e:
 *   catalog            sha256:08e3812b08d6dd9f0b397dd6d79c6ae89c834e43900508ee00410dfb692f9905
 *   connectorTaxonomy  sha256:e64815499844dfc745d8d12c3caa0ff2a0ef55777b627f604a44506478999513
 *   collisionModel     sha256:a8a000c6402260d5302cd14c613d6577e74e44811b6f431fbb4269c2cfe75e04
 *   transformPolicy    sha256:80594a60bb36cb7d9def2c92566aef0d67181c0c9e9983214a673dae59315a53
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
  catalog: "sha256:f86310b89f3224cff7a8d571de5a26fd36440ab46235abf1cf530e2f65f41b37",
  connectorTaxonomy: "sha256:93f0a5fc899083be25c5364266e7046b397683204e0e0991f106425ec5a99059",
  collisionModel: "sha256:7e9905d9f988c288eaeddee3d7befb7af79266518612bbba171d9b7f7fb1c463",
  transformPolicy: "sha256:a8694ddcdc39da5afd946a6012ac2588233bebe2eed457e8501cf572661b2956",
  validatorSet: "sha256:fb0676931eb66a0096f393794d0be1297227811a77b986c0a1d05847ee3127d4",
} as const;

const PINNED_TRUTH_HASH = "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9";

/**
 * SHA-256 of the ordered `[partId, geometry.contentHash]` roster, all 97 rows.
 * It was 5ea04c448b04800b87087f0c5dcb818d46e805eb51d535c9b40b7894281f4af1 at /8
 * and 19c6fbc5190d808bfa0b3ffd4d81fef3262a8758fffc53f9ecc7dfe76857cce8 at /9.
 *
 * Every move of this number through /8 came from appending parts, which left the
 * existing prefixes hashing exactly as before. /9 moved one row in place and /10
 * moves fifty-seven more, so no prefix survives either. That is the point of the
 * version bump: parts in place changed what they draw.
 */
const PINNED_GEOMETRY_ROSTER_SHA256 =
  "c182bd6a4b4ec4f189dfc5846d7982bb4ef3d00f2ac04d250a63f7080354d9ad";

const PINNED_PART_COUNT = 98;
/**
 * 1_204_568 at builtin.basic-parts/6, 1_298_834 at /7, 1_358_361 at /8,
 * 1_359_123 at /9, 1_504_522 at /12, 1_508_599 at /13, and 1_516_304 at /14.
 * The /15 increase records the complete 28802 definition: source mesh, eight
 * directed connectors and axis-aware collision evidence all enter together.
 * /16 appends the complete 35787 mesh, three clutch cells and 66 collision rows;
 * /17 appends the complete 11253 mesh, two connectors and 79 collision rows;
 * /18 appends the complete 15254 mesh, eight connectors and 173 collision rows;
 * /19 appends the complete 41682 mesh, six connectors and 56 collision rows;
 * /20 appends the complete 2877 mesh, four connectors and 28 collision rows.
 * /21 appends the complete 3040 mesh, three connectors and 68 collision rows.
 * /22 appends the complete 4519 mesh, three axle seats and its collision rows.
 * /23 appends the complete 32064 mesh, five connectors and 25 collision rows.
 * /24 appends the complete 11212 mesh, eighteen connectors and 138 collision bodies.
 * /25 appends the complete 33909 mesh, six connectors and 43 collision bodies.
 * /26 appends the complete 78329 mesh, ten connectors and 44 collision bodies.
 */
const PINNED_CATALOG_SERIALIZED_LENGTH = 1_674_016;

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
    expect(truth.catalog.version).toBe("builtin.basic-parts/26");
    expect(truth.connectorTaxonomy.hash).toBe(PINNED_TRUTH_HASHES.connectorTaxonomy);
    expect(truth.collisionModel.hash).toBe(PINNED_TRUTH_HASHES.collisionModel);
    expect(truth.transformPolicy.hash).toBe(PINNED_TRUTH_HASHES.transformPolicy);
    expect(truth.validatorSet.hash).toBe(PINNED_TRUTH_HASHES.validatorSet);
    expect(canonicalDigest(truth)).toBe(PINNED_TRUTH_HASH);
  });

  it("keeps every part's geometry content hash and the serialized catalog size", () => {
    const roster = PART_DEFINITIONS.map(({ id, geometry }) => [id, geometry.contentHash]);

    expect(roster).toHaveLength(PINNED_PART_COUNT);
    const rosterHash = createHash("sha256").update(JSON.stringify(roster)).digest("hex");
    // A field added to or removed from any definition moves this length, so a
    // break localizes to the serialized shape rather than to the hashing.
    expect({
      rosterHash,
      serializedLength: JSON.stringify(getBuiltinTruthDigestInputs().catalog).length,
    }).toEqual({
      rosterHash: PINNED_GEOMETRY_ROSTER_SHA256,
      serializedLength: PINNED_CATALOG_SERIALIZED_LENGTH,
    });
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

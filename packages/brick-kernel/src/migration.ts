import {
  BUILTIN_CATALOG_VERSION,
  COLOR_DEFINITIONS,
  PART_DEFINITIONS,
  getColorDefinition,
  getPartDefinition,
} from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { canonicalDigest, canonicalSha256 } from "./canonical.ts";
import { normalizeBrickDocument } from "./document.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { historicalConnectionSemanticsBlockingReasons } from "./historical-connection-semantics.ts";

/**
 * Catalog versions this kernel knows how to carry forward. A version outside
 * this list is refused rather than reinterpreted, because a document must never
 * float to a newer truth implicitly.
 */
export const MIGRATABLE_CATALOG_VERSIONS: readonly string[] = Object.freeze([
  "builtin.basic-parts/1",
  "builtin.basic-parts/2",
  "builtin.basic-parts/3",
  "builtin.basic-parts/4",
  "builtin.basic-parts/5",
  "builtin.basic-parts/6",
  "builtin.basic-parts/7",
  "builtin.basic-parts/8",
  "builtin.basic-parts/9",
  "builtin.basic-parts/10",
  "builtin.basic-parts/11",
  "builtin.basic-parts/12",
  "builtin.basic-parts/13",
  "builtin.basic-parts/14",
  "builtin.basic-parts/15",
  "builtin.basic-parts/16",
  "builtin.basic-parts/17",
  "builtin.basic-parts/18",
  "builtin.basic-parts/19",
  "builtin.basic-parts/20",
  "builtin.basic-parts/21",
  "builtin.basic-parts/22",
  "builtin.basic-parts/23",
  "builtin.basic-parts/24",
  "builtin.basic-parts/25",
  "builtin.basic-parts/26",
  "builtin.basic-parts/27",
  BUILTIN_CATALOG_VERSION,
]);

/**
 * Full truth snapshots emitted by reviewed historical commits.
 *
 * The commit is part of the evidence: it lets a reviewer check out the exact
 * source that produced a hash instead of trusting an unexplained digest. More
 * than one commit may share a catalog version because connector, collision, or
 * validator truth can move independently. Component-version allowlists alone
 * would accept impossible cross-products, so migration admits only one of
 * these complete snapshots and reports every component it advances.
 */
export const REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS = Object.freeze([
  {
    catalogVersion: "builtin.basic-parts/1",
    sourceCommit: "b62cbdf53ced2b45cfd8c49d3bcbd74dc5b9b711",
    truthHash: "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
  },
  {
    catalogVersion: "builtin.basic-parts/2",
    sourceCommit: "98a3b14e95c6f60cfe7bb852053dfdeb4a56243b",
    truthHash: "sha256:2d980a480fc5b82011b3a09f9e962d74a8e7af068595503ceaa88e9811a7b17a",
  },
  {
    catalogVersion: "builtin.basic-parts/3",
    sourceCommit: "d86b274750aa0b971769df605ba70e2dd68cc02a",
    truthHash: "sha256:e10d6cd07af66fc3bf9bbb2917992e74bb15f76385ec989bd7e94bcd4cffeedd",
  },
  {
    catalogVersion: "builtin.basic-parts/4",
    sourceCommit: "e0f99cddd820f6dd3915fa10a9ce2f856fc852c4",
    truthHash: "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843",
  },
  {
    catalogVersion: "builtin.basic-parts/4",
    sourceCommit: "d493dcf390e3009046b457d681a7b80733c3804c",
    truthHash: "sha256:4a1dea5f4706dba84aeee1bcbd495fec7eac0f7321e7447979a03a8fb089d3bc",
  },
  {
    catalogVersion: "builtin.basic-parts/4",
    sourceCommit: "5d2ca4f25bd8fae1437daf608c762b99c63ac2a6",
    truthHash: "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef",
  },
  {
    catalogVersion: "builtin.basic-parts/5",
    sourceCommit: "0267c0919156df1cede84db91dd716f4565d0fb2",
    truthHash: "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa",
  },
  // The snapshot /7 replaced. It became historical at the first production part
  // admission rather than when the mesh contract landed, so a document saved
  // against the six-part catalog still carries forward.
  {
    catalogVersion: "builtin.basic-parts/6",
    sourceCommit: "c78c6f31744b4ef846ecc477015dea4aa20d6ee3",
    truthHash: "sha256:e5ae3655ebac2b16ede784efa82728c2412d0c95021183653b07222ac9d76a09",
  },
  // The snapshot /8 replaced. /7 admitted the five parts LEGO Builder has a
  // record for; /8 admits the three it has none for, whose clutch cells the
  // LDCad shadow library authored instead. Both are additive, so a document
  // saved against the eighty-two-part catalog still carries forward.
  {
    catalogVersion: "builtin.basic-parts/7",
    sourceCommit: "9d0ebed8f6639d71affeaed63ab1682f35e1a18b",
    truthHash: "sha256:29eaae6325eba701dc52827a9373c7583889ce3fd16fd8057f3c6f243a8ab868",
  },
  // The snapshot /9 replaced. /9 changes no part's identity and no connector's
  // position — it gives `plate-2x4` the cavity `3020.dat` models, so the change
  // is to what one part draws and collides with, not to what a document may
  // refer to. A document saved against the eighty-five-part catalog therefore
  // still carries forward, and gains a plate that is hollow where it clutches.
  {
    catalogVersion: "builtin.basic-parts/8",
    sourceCommit: "262d274b51f819f13de0c118b836747da1fd14db",
    truthHash: "sha256:33787b02b898a83957e2cc92cff5b8da39da45dfaa3cafcd12f2446e30748613",
  },
  // The snapshot /10 replaced. /10 generalises /9's single hand-authored shell
  // to every part shaped like it — fifty-eight of them — and, like /9, changes
  // only what a part draws and collides with. No part identity moves and no
  // connector moves, so a document saved against /9 carries forward and gains
  // the cavity and tubes its plates and bricks always had.
  {
    catalogVersion: "builtin.basic-parts/9",
    sourceCommit: "108d5b3cc873a90eddce34a1d0e1688c0dce6f16",
    truthHash: "sha256:79cca11d5dbee2dd620b20a6cba7815235fefd53bd2f6b3d003586c8d5a1c635",
  },
  // The snapshot /11 replaced. /11 adds three measured modes to the eight parts
  // that draw a bundled mesh and changes nothing else — no part, no connector,
  // no collision primitive — so a document saved against /10 carries forward
  // and its parts hash differently only because provenance names the version.
  {
    catalogVersion: "builtin.basic-parts/10",
    sourceCommit: "081bd53edccf4c0c62691660c94eed5c723dc152",
    truthHash: "sha256:17ab2f6c385ecb861526921817a96805b77f29f87574c4eff0c174be6abbe5fb",
  },
  // The snapshot /12 replaced. /12 changes only the visible geometry and exact
  // visual bounds of four existing parts. Their catalog identities, connectors,
  // allowances and collision recipes remain byte-identical, so a document saved
  // against /11 carries forward through an explicit migration whose report names
  // the four visual reinterpretations.
  {
    catalogVersion: "builtin.basic-parts/11",
    sourceCommit: "bd46506950385df6e4be0f82385f910616e11675",
    truthHash: "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43",
  },
  // The snapshot /13 replaced. /13 stores source-faithful normals and changes
  // rendered geometry for all twenty-four bundled meshes; twenty-three change
  // expanded triangulation, while 54200 moves from its /12 parametric drawing
  // to an exact mesh. Exact visual/body bounds change for the twelve new render
  // promotions. Their identities, connectors, allowances, collision
  // recipes, connector-grid centres and partial-overhang evidence remain
  // byte-identical to /12.
  {
    catalogVersion: "builtin.basic-parts/12",
    sourceCommit: "e70346d7ec2c75a206a436e8c9cc233e1ca2de37",
    truthHash: "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e",
  },
  // The snapshot /14 replaced. /14 appends 25269 as one complete measured
  // definition: the official LDraw closure supplies its render mesh, the LDCad
  // shadow subpart supplies its centre clutch, and the closure-derived height
  // field supplies its conservative collision columns. No existing catalog row
  // changes interpretation, so a /13 document carries forward and reports the
  // one newly available part rather than an in-place reinterpretation.
  {
    catalogVersion: "builtin.basic-parts/13",
    sourceCommit: "8fc01861ec059da71eb09c3273815f7ea49eec62",
    truthHash: "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5",
  },
  // The snapshot /15 replaced. /15 appends 28802 as one complete measured
  // definition, adding exact catalog geometry, connector frames and collision
  // truth without reinterpreting an existing definition. Horizontal placement
  // remains outside the unchanged upright transform policy.
  {
    catalogVersion: "builtin.basic-parts/14",
    sourceCommit: "5d90788b0c10576ae1fef592206a66540dbcb131",
    truthHash: "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3",
  },
  // The snapshot /16 replaced. /16 appends 35787 as one complete measured
  // definition: exact official geometry and collision columns plus three
  // LDCad-authored clutch cells. The native Builder field remains unframed
  // counterevidence and changes no preceding catalog definition.
  {
    catalogVersion: "builtin.basic-parts/15",
    sourceCommit: "8ac4c6e9518e7b00fd0ed23ad44c6f38b657efe3",
    truthHash: "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f",
  },
  // The snapshot /17 replaced. /17 appends 11253 as one complete measured
  // definition: exact official geometry and collision columns plus one
  // LDCad-authored clutch cell. The unframed native Builder record remains
  // count-only counterevidence. /17 is catalog-additive and moves global
  // catalog, collision, and validator labels; predecessor semantic payloads
  // are byte-identical only after their historical truth labels are restored.
  {
    catalogVersion: "builtin.basic-parts/16",
    sourceCommit: "d58ea055120ea8e99a30faab35384a7a54f18de2",
    truthHash: "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be",
  },
  // The snapshot /18 replaced. /18 appends 15254 as one complete measured
  // definition: exact official geometry, visible studs and collision columns,
  // plus two Builder-authored end clutches through a checksum-pinned exact
  // frame. No preceding catalog definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/17",
    sourceCommit: "4cb37ef80c045ab5b7732dd9021938590ecbb086",
    truthHash: "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926",
  },
  // The snapshot /19 replaced. /19 appends 41682 as one complete measured
  // definition: exact official geometry and collision columns plus four
  // LDCad-authored underside clutches and two directional stud frames. No
  // preceding catalog definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/18",
    sourceCommit: "201fafba454d1db74a986ef0087f84530f96214e",
    truthHash: "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20",
  },
  // The snapshot /20 replaced. /20 appends 2877 as one complete measured
  // definition: exact official geometry, visible studs and collision columns,
  // plus two Builder-authored clutches through the checksum-pinned asymmetric
  // shell frame. No preceding catalog definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/19",
    sourceCommit: "a49137131566247daeb01d80ff88302b41bcf538",
    truthHash: "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26",
  },
  // The snapshot /21 replaces. /21 appends 3040 as one complete measured
  // definition: exact moved-alias official geometry, one visible stud and
  // collision columns, plus two Builder-authored clutches through the exact
  // stud-and-tube-anchored frame. No preceding definition changes meaning.
  {
    catalogVersion: "builtin.basic-parts/20",
    sourceCommit: "e037b7e60e1240ddf196d381850ae49bc8c80e9b",
    truthHash: "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2",
  },
  // The snapshot /22 replaces. /22 appends 4519 as one complete measured
  // definition: exact official geometry and collision columns plus three axle
  // seats projected from the exact pinned LDCad A6x60 shaft. No preceding
  // definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/21",
    sourceCommit: "98dc1e82b309eb52a6a32e0928ce075acb3e93ed",
    truthHash: "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1",
  },
  // The snapshot /23 replaces. /23 appends 32064 as one complete measured
  // definition: exact moved-to official geometry and collision columns plus a
  // transverse female axle-hole endpoint projected from the pinned LDCad A6x1
  // segment. No preceding definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/22",
    sourceCommit: "94db468e6a5045a0a7732f8f4adc128e90f025b6",
    truthHash: "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e",
  },
  // The snapshot /24 replaces. /24 appends 11212 as one complete measured
  // definition: exact official geometry, nine visible studs and conservative
  // collision columns, plus the matching regular 3 x 3 LDCad-authored clutch
  // grid. No preceding definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/23",
    sourceCommit: "d99b74d355684c8ceaca0ad6f2df76d96ebe4937",
    truthHash: "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb",
  },
  // The snapshot /25 replaces. /25 appends 33909 as one complete measured
  // definition: exact official geometry, two visible studs and conservative
  // collision columns, plus the matching four-cell LDCad-authored underside
  // clutch grid. No preceding definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/24",
    sourceCommit: "ec2387bf8b3b1a8d70a11e95c6c6547049037886",
    truthHash: "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d",
  },
  // The snapshot /26 replaces. /26 appends 78329 as one complete measured
  // definition: exact official geometry, five visible studs and conservative
  // collision columns, plus the matching five-cell LDCad-authored underside
  // clutch line. No preceding definition changes interpretation.
  {
    catalogVersion: "builtin.basic-parts/25",
    sourceCommit: "cf8996f015eee595d76ef79f06c15169f674aca6",
    truthHash: "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f",
  },
  // The snapshot /27 replaces. /27 appends four complete measured definitions
  // in generated order: 99563, 73230, 35464, and 49307. Geometry, connector,
  // collision, and source-frame truth are additive; no preceding definition is
  // reinterpreted, so a /26 document carries forward explicitly.
  {
    catalogVersion: "builtin.basic-parts/26",
    sourceCommit: "2361a30117f7a393e12c8563fc9a66d140bff323",
    truthHash: "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9",
  },
  // The snapshot /28 replaces. /28 appends exact 3245c and 2453b measured
  // definitions from their suffixed official roots and LDCad routes. It grants
  // no bare/cross-suffix alias and changes no preceding definition.
  {
    catalogVersion: "builtin.basic-parts/27",
    sourceCommit: "8a947a9acedd090c6215d547d631a13d6ce747e0",
    truthHash: "sha256:614c61787b6c45d645e3e84c71dd931a15c258535a1959ee4b3aa1906303b70f",
  },
] as const);

const MIGRATABLE_TRUTH_HASHES: ReadonlySet<string> = new Set(
  REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash),
);

export interface TruthComponentChange {
  readonly component:
    "catalog" | "connector-taxonomy" | "collision-model" | "transform-policy" | "validator-set";
  readonly fromVersion: string;
  readonly toVersion: string;
}

export interface CatalogInterpretationChange {
  readonly fromCatalogVersion: string;
  readonly toCatalogVersion: string;
  readonly affectedCatalogPartIds: readonly string[];
  readonly changedFields: readonly (
    "render-geometry" | "surface-normals" | "body-bounds" | "visual-bounds"
  )[];
}

export const REVIEWED_CATALOG_INTERPRETATION_CHANGES: readonly CatalogInterpretationChange[] =
  Object.freeze([
    {
      fromCatalogVersion: "builtin.basic-parts/11",
      toCatalogVersion: "builtin.basic-parts/12",
      affectedCatalogPartIds: [
        "builtin:wedge-plate-4x4-cut-corner",
        "builtin:wedge-plate-6x6-cut-corner",
        "builtin:corner-plate-4x4-round",
        "builtin:corner-plate-5x5-quarter-ring",
      ],
      changedFields: ["render-geometry", "visual-bounds"],
    },
    {
      fromCatalogVersion: "builtin.basic-parts/12",
      toCatalogVersion: "builtin.basic-parts/13",
      affectedCatalogPartIds: [
        "builtin:wedge-plate-2x4-left",
        "builtin:wedge-plate-2x4-right",
        "builtin:wedge-plate-2x3-left",
        "builtin:wedge-plate-2x3-right",
        "builtin:arch-1x4",
        "builtin:arch-1x6",
        "builtin:curved-slope-1x2",
        "builtin:curved-slope-1x3",
        "builtin:curved-slope-1x4",
        "builtin:cheese-slope-1x1",
        "builtin:cheese-slope-2x1",
        "builtin:wedge-plate-4x4-cut-corner",
        "builtin:wedge-plate-6x6-cut-corner",
        "builtin:wedge-plate-3x6-right",
        "builtin:corner-plate-4x4-round",
        "builtin:corner-plate-5x5-quarter-ring",
        "builtin:tile-1x2-cut-right-45",
        "builtin:plate-1x2-round-end",
        "builtin:wedge-plate-2x4-wing",
        "builtin:corner-plate-3x3",
        "builtin:curved-slope-1x4-double",
        "builtin:plate-3x3-corner-round",
        "builtin:wedge-plate-3x3-cut-corner",
        "builtin:corner-plate-2x2-round",
      ],
      changedFields: ["surface-normals"],
    },
    {
      fromCatalogVersion: "builtin.basic-parts/12",
      toCatalogVersion: "builtin.basic-parts/13",
      affectedCatalogPartIds: [
        "builtin:wedge-plate-2x4-left",
        "builtin:wedge-plate-2x4-right",
        "builtin:wedge-plate-2x3-left",
        "builtin:wedge-plate-2x3-right",
        "builtin:arch-1x4",
        "builtin:arch-1x6",
        "builtin:curved-slope-1x2",
        "builtin:curved-slope-1x3",
        "builtin:curved-slope-1x4",
        "builtin:cheese-slope-1x1",
        "builtin:cheese-slope-2x1",
        "builtin:wedge-plate-4x4-cut-corner",
        "builtin:wedge-plate-6x6-cut-corner",
        "builtin:wedge-plate-3x6-right",
        "builtin:corner-plate-4x4-round",
        "builtin:corner-plate-5x5-quarter-ring",
        "builtin:tile-1x2-cut-right-45",
        "builtin:plate-1x2-round-end",
        "builtin:wedge-plate-2x4-wing",
        "builtin:corner-plate-3x3",
        "builtin:curved-slope-1x4-double",
        "builtin:plate-3x3-corner-round",
        "builtin:wedge-plate-3x3-cut-corner",
        "builtin:corner-plate-2x2-round",
      ],
      changedFields: ["render-geometry"],
    },
    {
      fromCatalogVersion: "builtin.basic-parts/12",
      toCatalogVersion: "builtin.basic-parts/13",
      affectedCatalogPartIds: [
        "builtin:wedge-plate-2x4-left",
        "builtin:wedge-plate-2x4-right",
        "builtin:wedge-plate-2x3-left",
        "builtin:wedge-plate-2x3-right",
        "builtin:wedge-plate-3x6-right",
        "builtin:arch-1x4",
        "builtin:arch-1x6",
        "builtin:curved-slope-1x2",
        "builtin:curved-slope-1x3",
        "builtin:curved-slope-1x4",
        "builtin:cheese-slope-1x1",
        "builtin:cheese-slope-2x1",
      ],
      changedFields: ["body-bounds", "visual-bounds"],
    },
  ]);

export interface TruthMigrationReport {
  readonly schemaVersion: "lego.truth-migration/2";
  readonly migrated: boolean;
  readonly fromCatalogVersion: string;
  readonly toCatalogVersion: string;
  readonly fromTruthHash: string;
  readonly toTruthHash: string;
  /** Colour IDs the document gained access to, in catalog order. */
  readonly addedColorIds: readonly string[];
  /** Complete newly available definitions, including render, connectors and collision. */
  readonly addedCatalogPartIds: readonly string[];
  /** Reviewed in-place catalog reinterpretations crossed by this migration. */
  readonly catalogInterpretationChanges: readonly CatalogInterpretationChange[];
  /** Every pinned truth component whose version changed, not only the catalog. */
  readonly truthComponentChanges: readonly TruthComponentChange[];
  /** Populated only when the document could not be carried forward. */
  readonly blockingReasons: readonly string[];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Carries a document pinned to reviewed compatible builtin truth onto the current
 * one. Every part must still resolve, and additive plus in-place interpretation
 * changes are reported; anything else is a blocking reason and leaves the
 * document untouched, so migration is always an explicit, inspectable event.
 */
export function migrateDocumentTruth(document: BrickDocumentV1): {
  readonly document: BrickDocumentV1;
  readonly report: TruthMigrationReport;
} {
  const expectedTruth = createBuiltinTruthSnapshot();
  const fromTruthHash = canonicalDigest(document.truth);
  const toTruthHash = canonicalDigest(expectedTruth);
  const fromCatalogVersion = document.truth.catalog.version;
  const toCatalogVersion = expectedTruth.catalog.version;
  const truthChange = (
    component: TruthComponentChange["component"],
    fromVersion: string,
    toVersion: string,
  ): readonly TruthComponentChange[] =>
    fromVersion === toVersion ? [] : [{ component, fromVersion, toVersion }];
  const truthComponentChanges: readonly TruthComponentChange[] = [
    ...truthChange("catalog", document.truth.catalog.version, expectedTruth.catalog.version),
    ...truthChange(
      "connector-taxonomy",
      document.truth.connectorTaxonomy.version,
      expectedTruth.connectorTaxonomy.version,
    ),
    ...truthChange(
      "collision-model",
      document.truth.collisionModel.version,
      expectedTruth.collisionModel.version,
    ),
    ...truthChange(
      "transform-policy",
      document.truth.transformPolicy.version,
      expectedTruth.transformPolicy.version,
    ),
    ...truthChange(
      "validator-set",
      document.truth.validatorSet.version,
      expectedTruth.validatorSet.version,
    ),
  ];
  const sourceCatalogOrdinal = Number(fromCatalogVersion.split("/").at(-1));
  const targetCatalogOrdinal = Number(toCatalogVersion.split("/").at(-1));
  const catalogInterpretationChanges = MIGRATABLE_CATALOG_VERSIONS.includes(fromCatalogVersion)
    ? REVIEWED_CATALOG_INTERPRETATION_CHANGES.filter(
        ({ fromCatalogVersion: changeFrom, toCatalogVersion: changeTo }) => {
          const changeFromOrdinal = Number(changeFrom.split("/").at(-1));
          const changeToOrdinal = Number(changeTo.split("/").at(-1));
          return (
            Number.isInteger(sourceCatalogOrdinal) &&
            Number.isInteger(targetCatalogOrdinal) &&
            sourceCatalogOrdinal <= changeFromOrdinal &&
            targetCatalogOrdinal >= changeToOrdinal
          );
        },
      )
    : [];
  const base = {
    schemaVersion: "lego.truth-migration/2",
    fromCatalogVersion,
    toCatalogVersion,
    fromTruthHash,
    toTruthHash,
    addedColorIds: [],
    addedCatalogPartIds: [],
    catalogInterpretationChanges,
    truthComponentChanges,
  } as const;

  if (fromTruthHash === toTruthHash) {
    return { document, report: { ...base, migrated: false, blockingReasons: [] } };
  }

  const blockingReasons: string[] = [];
  const sourceRoster = getReviewedHistoricalCatalogRoster(fromTruthHash);
  if (!MIGRATABLE_TRUTH_HASHES.has(fromTruthHash)) {
    blockingReasons.push(
      `Truth snapshot ${fromTruthHash} is not one of the reviewed historical builtin snapshots; unknown or cross-mixed truth cannot be reinterpreted as ${toTruthHash}`,
    );
  }
  if (!MIGRATABLE_CATALOG_VERSIONS.includes(fromCatalogVersion)) {
    blockingReasons.push(
      `Catalog version ${fromCatalogVersion} has no migration to ${toCatalogVersion}; known source versions are ${MIGRATABLE_CATALOG_VERSIONS.join(", ")}`,
    );
  }
  if (sourceRoster === undefined) {
    blockingReasons.push(
      `Truth snapshot ${fromTruthHash} has no reviewed catalog roster; migration cannot infer historical part or color membership from caller-owned constraints`,
    );
  } else {
    const sourcePartIds = new Set(sourceRoster.catalogPartIds);
    const sourceColorIds = new Set(sourceRoster.colorIds);
    for (const part of document.parts) {
      if (!sourcePartIds.has(part.catalogPartId)) {
        blockingReasons.push(
          `Part ${part.id} uses catalog part ${part.catalogPartId}, which reviewed source truth ${fromTruthHash} (${fromCatalogVersion}) did not define; the part cannot be legitimized by migration`,
        );
      }
      if (!sourceColorIds.has(part.colorId)) {
        blockingReasons.push(
          `Part ${part.id} uses color ${part.colorId}, which reviewed source truth ${fromTruthHash} (${fromCatalogVersion}) did not define; the color cannot be legitimized by migration`,
        );
      }
    }
  }
  if (sourceRoster !== undefined && MIGRATABLE_TRUTH_HASHES.has(fromTruthHash)) {
    blockingReasons.push(
      ...historicalConnectionSemanticsBlockingReasons(document, fromTruthHash, toTruthHash),
    );
  }
  if (sourceRoster !== undefined) {
    const sourcePartIds = new Set(sourceRoster.catalogPartIds);
    const sourceColorIds = new Set(sourceRoster.colorIds);
    for (const catalogPartId of document.constraints.allowedCatalogPartIds) {
      if (!sourcePartIds.has(catalogPartId)) {
        blockingReasons.push(
          `Document constraints allow catalog part ${catalogPartId}, which reviewed source truth ${fromTruthHash} (${fromCatalogVersion}) did not define; remove the future ID or load the document under the truth that introduced it`,
        );
      }
    }
    for (const colorId of document.constraints.allowedColorIds) {
      if (!sourceColorIds.has(colorId)) {
        blockingReasons.push(
          `Document constraints allow color ${colorId}, which reviewed source truth ${fromTruthHash} (${fromCatalogVersion}) did not define; remove the future ID or load the document under the truth that introduced it`,
        );
      }
    }
  }
  const compatibleComponents = [
    {
      label: "Catalog",
      source: document.truth.catalog,
      expected: expectedTruth.catalog,
      versions: MIGRATABLE_CATALOG_VERSIONS,
    },
    {
      label: "Connector taxonomy",
      source: document.truth.connectorTaxonomy,
      expected: expectedTruth.connectorTaxonomy,
      versions: [expectedTruth.connectorTaxonomy.version],
    },
    {
      label: "Collision model",
      source: document.truth.collisionModel,
      expected: expectedTruth.collisionModel,
      versions: [
        "rectilinear-stud-clearance/1",
        "rectilinear-stud-clearance/2",
        expectedTruth.collisionModel.version,
      ],
    },
    {
      label: "Transform policy",
      source: document.truth.transformPolicy,
      expected: expectedTruth.transformPolicy,
      versions: [expectedTruth.transformPolicy.version],
    },
    {
      label: "Validator set",
      source: document.truth.validatorSet,
      expected: expectedTruth.validatorSet,
      versions: [
        "lego.kernel-validators/1",
        "lego.kernel-validators/2",
        "lego.kernel-validators/3",
        expectedTruth.validatorSet.version,
      ],
    },
  ] as const;
  for (const { label, source, expected, versions } of compatibleComponents) {
    if (source.id !== expected.id) {
      blockingReasons.push(
        `${label} id ${source.id} cannot migrate to ${expected.id}; only the builtin truth component is supported`,
      );
      continue;
    }
    if (!(versions as readonly string[]).includes(source.version)) {
      blockingReasons.push(
        `${label} version ${source.version} cannot migrate to ${expected.version}; known source versions are ${versions.join(", ")}`,
      );
      continue;
    }
  }
  for (const part of document.parts) {
    if (!getPartDefinition(part.catalogPartId)) {
      blockingReasons.push(
        `Part ${part.id} uses catalog part ${part.catalogPartId}, which ${toCatalogVersion} no longer defines`,
      );
    }
    if (!getColorDefinition(part.colorId)) {
      blockingReasons.push(
        `Part ${part.id} uses color ${part.colorId}, which ${toCatalogVersion} no longer defines`,
      );
    }
  }
  if (sourceRoster === undefined || blockingReasons.length > 0) {
    return {
      document,
      report: { ...base, migrated: false, blockingReasons: blockingReasons.slice(0, 32) },
    };
  }

  const colorIds = COLOR_DEFINITIONS.map(({ id }) => id);
  const catalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
  // These caller-owned constraints are safe delta inputs only after every ID
  // above has been proved a member of the exact reviewed source roster.
  const previousColorIds = new Set(document.constraints.allowedColorIds);
  const previousPartIds = new Set(document.constraints.allowedCatalogPartIds);

  const migrated = normalizeBrickDocument({
    ...document,
    revision: `revision-${canonicalSha256({
      baseRevision: document.revision,
      migration: "truth",
      fromTruthHash,
      toTruthHash,
    }).slice(0, 24)}`,
    truth: expectedTruth,
    constraints: {
      ...document.constraints,
      allowedCatalogPartIds: [...catalogPartIds].sort(compareStrings),
      allowedColorIds: [...colorIds].sort(compareStrings),
    },
  });

  return {
    document: migrated,
    report: {
      ...base,
      migrated: true,
      addedColorIds: colorIds.filter((id) => !previousColorIds.has(id)),
      addedCatalogPartIds: catalogPartIds.filter((id) => !previousPartIds.has(id)),
      blockingReasons: [],
    },
  };
}

import { validateRigidTransform } from "@lego-studio/protocol";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { deepFreeze } from "./canonical.ts";

type Sha256Digest = `sha256:${string}`;

export interface ReviewedHistoricalTransformPolicy {
  readonly id: "upright-quarter-turns-negative-y-up";
  readonly version: "upright-quarter-turns-negative-y-up/1";
  readonly legalOrientationIds: readonly [
    "upright-yaw-0",
    "upright-yaw-90",
    "upright-yaw-180",
    "upright-yaw-270",
  ];
}

/**
 * The exact global orientation vocabulary carried by every reviewed source
 * snapshot through catalog /28. These literals are historical authority, not
 * aliases of the live catalog's transform vocabulary: expanding current truth
 * must never silently expand what an older document was allowed to contain.
 */
const LEGACY_UPRIGHT_TRANSFORM_POLICY = deepFreeze({
  id: "upright-quarter-turns-negative-y-up",
  version: "upright-quarter-turns-negative-y-up/1",
  legalOrientationIds: ["upright-yaw-0", "upright-yaw-90", "upright-yaw-180", "upright-yaw-270"],
} as const satisfies ReviewedHistoricalTransformPolicy);

/**
 * Complete truth hashes authenticate the source policy as one inseparable
 * component of a reviewed historical snapshot. The list is deliberately
 * explicit: a future source policy receives no migration authority until its
 * transform semantics are reviewed and added here.
 */
const LEGACY_UPRIGHT_SOURCE_TRUTH_HASHES = deepFreeze([
  "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
  "sha256:2d980a480fc5b82011b3a09f9e962d74a8e7af068595503ceaa88e9811a7b17a",
  "sha256:e10d6cd07af66fc3bf9bbb2917992e74bb15f76385ec989bd7e94bcd4cffeedd",
  "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843",
  "sha256:4a1dea5f4706dba84aeee1bcbd495fec7eac0f7321e7447979a03a8fb089d3bc",
  "sha256:6015f52a986a0ed4f5c5310f8b30c2a35b58f8b015025db8804c67e14ff5e9ef",
  "sha256:72657715102652a49e08ae683650758958d5c9fad2235761368269ffd15fc4aa",
  "sha256:e5ae3655ebac2b16ede784efa82728c2412d0c95021183653b07222ac9d76a09",
  "sha256:29eaae6325eba701dc52827a9373c7583889ce3fd16fd8057f3c6f243a8ab868",
  "sha256:33787b02b898a83957e2cc92cff5b8da39da45dfaa3cafcd12f2446e30748613",
  "sha256:79cca11d5dbee2dd620b20a6cba7815235fefd53bd2f6b3d003586c8d5a1c635",
  "sha256:17ab2f6c385ecb861526921817a96805b77f29f87574c4eff0c174be6abbe5fb",
  "sha256:6b784ce4259131b1ed637815b78bbf14a0bd2e92627ce2a8f4d09c3504465c43",
  "sha256:cdfeae99ea405770f35f83173eec10804078346d257c5e56006707639313ae8e",
  "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5",
  "sha256:db8c1740f23c65a4c0046c679e321a559623ac18a9c3fe59357b912e3a48a1b3",
  "sha256:f8e7efbd1bc969ac699fd68db9696af693898a15ffb7901821e676d843240e2f",
  "sha256:71c76ba1d6740cbaf89b1ab721dba2ffa3136e9d742198b289373ad2205be1be",
  "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926",
  "sha256:8172cc4f993b46bb9fa8f782bb2b295c516e95c16f2d6861e4a18219ef2e1b20",
  "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26",
  "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2",
  "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1",
  "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e",
  "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb",
  "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d",
  "sha256:364ef046160736292eb51b331ce27ff246fa8940e16b256d53a68b9656a6018f",
  "sha256:3226590b11882fea03d8a6370d4ca3c6c8201feaddb56882a243a69acba627e9",
  "sha256:614c61787b6c45d645e3e84c71dd931a15c258535a1959ee4b3aa1906303b70f",
  "sha256:643185fe21f0d0c77a7aada8b170395f11bb7da1079f97d5c0cd0a03d7464f1b",
] as const satisfies readonly Sha256Digest[]);

export const REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH: Readonly<
  Record<string, ReviewedHistoricalTransformPolicy>
> = deepFreeze(
  Object.fromEntries(
    LEGACY_UPRIGHT_SOURCE_TRUTH_HASHES.map((truthHash) => [
      truthHash,
      LEGACY_UPRIGHT_TRANSFORM_POLICY,
    ]),
  ),
);

/**
 * Refuses to let a newer transform vocabulary retroactively legitimize source
 * document state. Callers pass the digest of the complete claimed source truth;
 * an unreviewed digest has no authority here and is blocked by migration's
 * complete-snapshot check.
 */
export function historicalTransformPolicyBlockingReasons(
  document: BrickDocumentV1,
  sourceTruthHash: string,
): readonly string[] {
  const authority = REVIEWED_HISTORICAL_TRANSFORM_POLICIES_BY_TRUTH_HASH[sourceTruthHash];
  if (authority === undefined) {
    return [
      `Truth snapshot ${sourceTruthHash} has no reviewed transform-policy authority; migration cannot infer historical legal orientations from current catalog truth`,
    ];
  }

  const legalOrientationIds = new Set<string>(authority.legalOrientationIds);
  const reasons: string[] = [];
  for (const part of document.parts) {
    if (!validateRigidTransform(part.transform)) {
      reasons.push(
        `Part ${part.id} has a malformed rigid transform under reviewed source transform policy ${authority.version} at ${sourceTruthHash}; require exactly three integer LDU coordinates from -10000000 through 10000000 and one orientation identifier before migration`,
      );
      continue;
    }
    if (!legalOrientationIds.has(part.transform.orientationId)) {
      reasons.push(
        `Part ${part.id} uses orientation ${part.transform.orientationId}, which reviewed source transform policy ${authority.version} at ${sourceTruthHash} did not permit; migration cannot legitimize a transform introduced only by current truth`,
      );
    }
  }
  return reasons;
}

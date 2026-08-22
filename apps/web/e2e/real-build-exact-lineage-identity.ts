import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  deriveRealBuildLineageIdentity,
  snapshotRealBuildLineageIdentity,
  type DetachedRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";

const EXACT_LINEAGE_ID = /^exact-lineage:sha256:[0-9a-f]{64}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SCHEMA = "real-build-exact-lineage-identity/1";
const exactIdentities = new WeakSet<object>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

export type RealBuildExactLineageId = `exact-lineage:sha256:${string}`;

export type RealBuildExactLineageIdentity = RealBuildLineageIdentity & {
  readonly exactLineageId: RealBuildExactLineageId;
  readonly parentExactLineageId: RealBuildExactLineageId | null;
  readonly canonicalBytesHash: Sha256Digest;
  readonly canonicalByteLength: number;
};

function ownData(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be an exact lineage identity object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function digest(input: {
  readonly lineageId: string;
  readonly parentExactLineageId: string | null;
  readonly canonicalBytesHash: Sha256Digest;
  readonly canonicalByteLength: number;
}): RealBuildExactLineageId {
  return `exact-lineage:sha256:${sha256Hex(canonicalStringify({ schema: SCHEMA, ...input }))}`;
}

function canonicalBinding(
  canonicalBytesHash: unknown,
  canonicalByteLength: unknown,
): { readonly canonicalBytesHash: Sha256Digest; readonly canonicalByteLength: number } {
  if (typeof canonicalBytesHash !== "string" || !DIGEST.test(canonicalBytesHash)) {
    throw new TypeError("Exact lineage canonicalBytesHash must be one lowercase sha256 digest.");
  }
  if (!Number.isSafeInteger(canonicalByteLength) || (canonicalByteLength as number) < 1) {
    throw new RangeError("Exact lineage canonicalByteLength must be a positive safe integer.");
  }
  return {
    canonicalBytesHash: canonicalBytesHash as Sha256Digest,
    canonicalByteLength: canonicalByteLength as number,
  };
}

function close(
  identity: DetachedRealBuildLineageIdentity,
  binding: { readonly canonicalBytesHash: Sha256Digest; readonly canonicalByteLength: number },
  parentExactLineageId: RealBuildExactLineageId | null,
): RealBuildExactLineageIdentity {
  const exactLineageId = digest({
    lineageId: identity.lineageId,
    parentExactLineageId,
    ...binding,
  });
  const exact = intrinsicRealBuildFreeze({
    ...identity,
    exactLineageId,
    parentExactLineageId,
    ...binding,
  }) as RealBuildExactLineageIdentity;
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, exactIdentities, [exact]);
  return exact;
}

/** Binds a digest-valid run root to one exact canonical parent byte string. */
export function bindRealBuildExactRootLineageIdentity(input: {
  readonly identity: RealBuildLineageIdentity;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
}): RealBuildExactLineageIdentity {
  const identity = snapshotRealBuildLineageIdentity(input.identity);
  const snapshot = requireRealBuildCandidateDocumentSnapshotValue(input.documentSnapshot);
  if (identity.lineageOrigin !== "root" || identity.documentHash !== snapshot.documentHash) {
    throw new TypeError(
      "Exact root lineage must bind one root identity to canonical bytes with the same structural document hash.",
    );
  }
  return close(
    identity,
    {
      canonicalBytesHash: snapshot.canonicalBytesHash,
      canonicalByteLength: snapshot.canonicalByteLength,
    },
    null,
  );
}

/** Derives a child whose digest binds both its exact parent and exact child bytes. */
export function deriveRealBuildExactLineageIdentity(input: {
  readonly candidateId: unknown;
  readonly documentHash: unknown;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly parent: RealBuildExactLineageIdentity;
  readonly throughStepNumber: unknown;
  readonly localIdentity: unknown;
}): RealBuildExactLineageIdentity {
  const parent = snapshotRealBuildExactLineageIdentity(input.parent);
  const snapshot = requireRealBuildCandidateDocumentSnapshotValue(input.documentSnapshot);
  const identity = deriveRealBuildLineageIdentity({
    candidateId: input.candidateId,
    documentHash: input.documentHash,
    parent,
    throughStepNumber: input.throughStepNumber,
    localIdentity: input.localIdentity,
  });
  if (identity.documentHash !== snapshot.documentHash) {
    throw new TypeError(
      "Exact descendant lineage canonical bytes must reproduce its structural document hash.",
    );
  }
  return close(
    identity,
    {
      canonicalBytesHash: snapshot.canonicalBytesHash,
      canonicalByteLength: snapshot.canonicalByteLength,
    },
    parent.exactLineageId,
  );
}

/** Reproduces the public and exact digests without trusting caller-created fields. */
export function snapshotRealBuildExactLineageIdentity(
  value: unknown,
): RealBuildExactLineageIdentity {
  const identity = snapshotRealBuildLineageIdentity(value);
  const binding = canonicalBinding(
    ownData(value, "canonicalBytesHash", "Exact lineage identity"),
    ownData(value, "canonicalByteLength", "Exact lineage identity"),
  );
  const rawParent = ownData(value, "parentExactLineageId", "Exact lineage identity");
  const parentExactLineageId =
    rawParent === null
      ? null
      : typeof rawParent === "string" && EXACT_LINEAGE_ID.test(rawParent)
        ? (rawParent as RealBuildExactLineageId)
        : (() => {
            throw new TypeError(
              "Exact lineage parentExactLineageId must be null or one exact-lineage digest.",
            );
          })();
  if ((identity.lineageOrigin === "root") !== (parentExactLineageId === null)) {
    throw new TypeError(
      "Exact root lineage must have a null exact parent and each descendant must name one exact parent.",
    );
  }
  const expected = digest({
    lineageId: identity.lineageId,
    parentExactLineageId,
    ...binding,
  });
  const claimed = ownData(value, "exactLineageId", "Exact lineage identity");
  if (claimed !== expected) {
    throw new TypeError(
      "Exact lineage exactLineageId does not bind its lineage, exact parent, canonical byte hash, and byte length.",
    );
  }
  return close(identity, binding, parentExactLineageId);
}

export function requireRealBuildExactLineageIdentity(
  value: unknown,
): RealBuildExactLineageIdentity {
  if (
    value === null ||
    typeof value !== "object" ||
    !(SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, exactIdentities, [value]) as boolean)
  ) {
    throw new TypeError("Exact lineage identity must be created or snapshotted by this module.");
  }
  return value as RealBuildExactLineageIdentity;
}

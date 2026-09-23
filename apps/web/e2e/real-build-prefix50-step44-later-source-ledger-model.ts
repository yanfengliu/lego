export type RealBuildPrefix50Step44LaterSourceLedgerPurpose =
  | "page44-step43-vector"
  | "page45-step44-vector"
  | "page45-camera-raster"
  | "page45-contact-raster"
  | "page45-review-artifact-raster"
  | "page45-promotion-raster";

export interface RealBuildPrefix50Step44LaterSourceLedgerClaim {
  readonly qualificationCommitment: `sha256:${string}`;
  readonly sourceLockCommitment: `sha256:${string}`;
  readonly purpose: RealBuildPrefix50Step44LaterSourceLedgerPurpose;
  readonly physicalPageNumber: 44 | 45;
  readonly capabilityCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44LaterSourceDerivedEvidence {
  readonly sourceByteLength: number;
  readonly sourceBindingCommitment: `sha256:${string}`;
  readonly derivedCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44LaterSourceTransactionEvidence extends RealBuildPrefix50Step44LaterSourceDerivedEvidence {
  readonly schemaVersion: "lego.real-build-prefix50-step44-later-source-transaction-evidence/2";
  readonly operationCommitment: `sha256:${string}`;
  readonly transactionCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44LaterSourceInternalTransaction {
  readonly schemaVersion: "lego.real-build-prefix50-step44-later-source-internal-transaction/2";
  readonly namespaceCommitment: `sha256:${string}`;
  readonly claimCommitment: `sha256:${string}`;
  readonly operationCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step44LaterSourceLedgerEntry = Readonly<{
  claimCommitment: `sha256:${string}`;
  capabilityCommitment: `sha256:${string}`;
  sourceLockCommitment: `sha256:${string}`;
  physicalPageNumber: 44 | 45;
  status: "issued" | "burned" | "completed";
  operationCommitment: `sha256:${string}` | null;
  resultCommitment: `sha256:${string}` | null;
}>;

export type RealBuildPrefix50Step44LaterSourceLedgerState = Readonly<{
  schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-state/2";
  namespaceCommitment: `sha256:${string}`;
  repositoryIdentityCommitment: `sha256:${string}`;
  qualificationCommitment: `sha256:${string}`;
  revision: number;
  entries: Partial<
    Record<
      RealBuildPrefix50Step44LaterSourceLedgerPurpose,
      RealBuildPrefix50Step44LaterSourceLedgerEntry
    >
  >;
}>;

export const REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256 = /^sha256:[0-9a-f]{64}$/u;
export const REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_PURPOSE_PAGES: Readonly<
  Record<RealBuildPrefix50Step44LaterSourceLedgerPurpose, 44 | 45>
> = Object.freeze({
  "page44-step43-vector": 44,
  "page45-step44-vector": 45,
  "page45-camera-raster": 45,
  "page45-contact-raster": 45,
  "page45-review-artifact-raster": 45,
  "page45-promotion-raster": 45,
});

export function requireRealBuildPrefix50Step44LaterSourceExactKeys(
  value: object,
  keys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new TypeError(`${label} is not one closed-schema value.`);
}

export function requireRealBuildPrefix50Step44LaterSourceLedgerClaim(
  claim: RealBuildPrefix50Step44LaterSourceLedgerClaim,
): RealBuildPrefix50Step44LaterSourceLedgerClaim {
  if (claim === null || typeof claim !== "object" || Array.isArray(claim))
    throw new TypeError("Later-source ledger claim is not one closed-schema value.");
  requireRealBuildPrefix50Step44LaterSourceExactKeys(
    claim,
    [
      "qualificationCommitment",
      "sourceLockCommitment",
      "purpose",
      "physicalPageNumber",
      "capabilityCommitment",
    ],
    "Later-source ledger claim",
  );
  if (
    !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(claim.qualificationCommitment) ||
    !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(claim.sourceLockCommitment) ||
    !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(claim.capabilityCommitment) ||
    REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_PURPOSE_PAGES[claim.purpose] !==
      claim.physicalPageNumber
  )
    throw new TypeError("Later-source ledger claim has an invalid finite purpose binding.");
  return claim;
}

export function requireRealBuildPrefix50Step44LaterSourceLedgerEntry(
  value: unknown,
): RealBuildPrefix50Step44LaterSourceLedgerEntry {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Later-source ledger entry is invalid.");
  requireRealBuildPrefix50Step44LaterSourceExactKeys(
    value,
    [
      "claimCommitment",
      "capabilityCommitment",
      "sourceLockCommitment",
      "physicalPageNumber",
      "status",
      "operationCommitment",
      "resultCommitment",
    ],
    "Later-source ledger entry",
  );
  const entry = value as RealBuildPrefix50Step44LaterSourceLedgerEntry;
  const validDigest = REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256;
  if (
    !validDigest.test(entry.claimCommitment) ||
    !validDigest.test(entry.capabilityCommitment) ||
    !validDigest.test(entry.sourceLockCommitment) ||
    (entry.physicalPageNumber !== 44 && entry.physicalPageNumber !== 45) ||
    !["issued", "burned", "completed"].includes(entry.status) ||
    (entry.operationCommitment !== null && !validDigest.test(entry.operationCommitment)) ||
    (entry.resultCommitment !== null && !validDigest.test(entry.resultCommitment)) ||
    (entry.status === "issued" &&
      (entry.operationCommitment !== null || entry.resultCommitment !== null)) ||
    (entry.status === "burned" &&
      (entry.operationCommitment === null || entry.resultCommitment !== null)) ||
    (entry.status === "completed" &&
      (entry.operationCommitment === null || entry.resultCommitment === null))
  )
    throw new TypeError("Later-source ledger entry is malformed.");
  return Object.freeze({ ...entry });
}

export function requireRealBuildPrefix50Step44LaterSourceLedgerState(
  value: unknown,
  binding: Readonly<{
    namespaceCommitment: `sha256:${string}`;
    repositoryIdentityCommitment: `sha256:${string}`;
    qualificationCommitment: `sha256:${string}`;
  }>,
): RealBuildPrefix50Step44LaterSourceLedgerState {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Later-source ledger state is invalid.");
  requireRealBuildPrefix50Step44LaterSourceExactKeys(
    value,
    [
      "schemaVersion",
      "namespaceCommitment",
      "repositoryIdentityCommitment",
      "qualificationCommitment",
      "revision",
      "entries",
    ],
    "Later-source ledger state",
  );
  const state = value as RealBuildPrefix50Step44LaterSourceLedgerState;
  if (
    state.schemaVersion !== "lego.real-build-prefix50-step44-later-source-ledger-state/2" ||
    state.namespaceCommitment !== binding.namespaceCommitment ||
    state.repositoryIdentityCommitment !== binding.repositoryIdentityCommitment ||
    state.qualificationCommitment !== binding.qualificationCommitment ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    state.entries === null ||
    typeof state.entries !== "object" ||
    Array.isArray(state.entries)
  )
    throw new TypeError("Later-source ledger state binding is malformed.");
  const entries: Partial<
    Record<
      RealBuildPrefix50Step44LaterSourceLedgerPurpose,
      RealBuildPrefix50Step44LaterSourceLedgerEntry
    >
  > = {};
  for (const [purpose, entry] of Object.entries(state.entries)) {
    if (!(purpose in REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_PURPOSE_PAGES))
      throw new TypeError("Later-source ledger state purpose drifted.");
    const exact = requireRealBuildPrefix50Step44LaterSourceLedgerEntry(entry);
    if (
      exact.physicalPageNumber !==
      REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_PURPOSE_PAGES[
        purpose as RealBuildPrefix50Step44LaterSourceLedgerPurpose
      ]
    )
      throw new TypeError("Later-source ledger state page binding drifted.");
    entries[purpose as RealBuildPrefix50Step44LaterSourceLedgerPurpose] = exact;
  }
  return Object.freeze({ ...state, entries: Object.freeze(entries) });
}

export function requireRealBuildPrefix50Step44LaterSourceDerivedEvidence(
  value: RealBuildPrefix50Step44LaterSourceDerivedEvidence,
): RealBuildPrefix50Step44LaterSourceDerivedEvidence {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Later-source operation returned invalid derived evidence.");
  requireRealBuildPrefix50Step44LaterSourceExactKeys(
    value,
    ["sourceByteLength", "sourceBindingCommitment", "derivedCommitment"],
    "Later-source derived evidence",
  );
  if (
    !Number.isSafeInteger(value.sourceByteLength) ||
    value.sourceByteLength < 1 ||
    !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(value.sourceBindingCommitment) ||
    !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(value.derivedCommitment)
  )
    throw new TypeError("Later-source operation returned malformed derived evidence.");
  return Object.freeze({ ...value });
}

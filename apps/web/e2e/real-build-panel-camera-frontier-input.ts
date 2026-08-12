import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  describePanelCameraValue as describe,
  describePanelCameraThrown as describeThrown,
  isPanelCameraRecord as isRecord,
  PANEL_CAMERA_DIGEST_PATTERN,
  realBuildStableDocumentCandidateId,
  snapshotPanelCameraDocumentWithCanonical,
  type RealBuildPanelCameraDocument,
} from "./real-build-panel-camera-resolver-boundary";
import type { RealBuildPanelCameraPrefixInput } from "./real-build-panel-camera-resolver";
import { PanelCameraPartLimitError } from "./real-build-panel-camera-json-snapshot";

const PREFIX_KEYS = ["document", "documentHash", "parentLineageId", "throughStepNumber"] as const;
const LINEAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;
const MAX_FRONTIER_PREFIXES = 100_000;
const MAX_TOTAL_PART_REFERENCES = 200_000;
const MAX_TOTAL_CANONICAL_BYTES = 16_777_216;
const MAX_TOTAL_CANONICAL_NODES = 2_000_000;
const MAX_DOCUMENT_PARTS = 100_000;

export interface PanelCameraFrontierPrefixHeader<D extends RealBuildPanelCameraDocument> {
  readonly throughStepNumber: number;
  readonly parentLineageId: string;
  readonly document: D;
  readonly documentHash: Sha256Digest;
  readonly candidateId: string;
}

interface PreparedPrefix<
  D extends RealBuildPanelCameraDocument,
> extends PanelCameraFrontierPrefixHeader<D> {
  readonly canonicalDocument: string;
}

export interface PreparedPanelCameraFrontierCandidate<
  D extends RealBuildPanelCameraDocument,
> extends PreparedPrefix<D> {
  readonly parentLineageIds: readonly string[];
}

export function snapshotPanelCameraFrontierPrefixHeaders<
  D extends RealBuildPanelCameraDocument,
>(input: {
  readonly prefixes: readonly RealBuildPanelCameraPrefixInput<D>[];
  readonly registrationPanelStepNumber: number;
}): readonly PanelCameraFrontierPrefixHeader<D>[] {
  let prefixes: readonly unknown[];
  try {
    if (!Array.isArray(input.prefixes)) throw new TypeError("not an array");
    const lengthDescriptor = Object.getOwnPropertyDescriptor(input.prefixes, "length");
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 1 || length > MAX_FRONTIER_PREFIXES) {
      throw new RangeError(`length ${String(length)}`);
    }
    const fixed: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input.prefixes, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) {
        throw new TypeError(
          `prefixes contain a hole at index ${index}, or that index is an accessor; required one stable own data row`,
        );
      }
      fixed.push(descriptor.value);
    }
    prefixes = Object.freeze(fixed);
  } catch (error) {
    throw new RangeError(
      `Panel-camera frontier prefixes must be a non-empty dense plain-data array of at most ${MAX_FRONTIER_PREFIXES} fixed rows; received ${describe(input.prefixes)}. ${describeThrown(error)}`,
      { cause: error },
    );
  }
  const parentCandidates = new Set<string>();
  const headers: PanelCameraFrontierPrefixHeader<D>[] = [];
  let commonStep: number | null = null;
  for (let index = 0; index < prefixes.length; index += 1) {
    const prefix = prefixes[index];
    let properties: Record<(typeof PREFIX_KEYS)[number], unknown>;
    try {
      if (!isRecord(prefix) || Object.getPrototypeOf(prefix) !== Object.prototype) {
        throw new TypeError("not a plain object");
      }
      const keys = Reflect.ownKeys(prefix);
      if (
        keys.length !== PREFIX_KEYS.length ||
        keys.some((key) => typeof key !== "string" || !PREFIX_KEYS.includes(key as never))
      ) {
        throw new TypeError("wrong keys");
      }
      const copied = {} as Record<(typeof PREFIX_KEYS)[number], unknown>;
      for (const key of PREFIX_KEYS) {
        const descriptor = Object.getOwnPropertyDescriptor(prefix, key);
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          !descriptor.enumerable ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined
        ) {
          throw new TypeError(`property ${key} is not stable plain data`);
        }
        copied[key] = descriptor.value;
      }
      properties = copied;
    } catch (error) {
      throw new TypeError(
        `Panel-camera frontier prefix ${index} must contain exactly ${PREFIX_KEYS.join(", ")} as enumerable own data properties on a plain object; received ${describe(prefix)}.`,
        { cause: error },
      );
    }
    const { throughStepNumber, parentLineageId, document, documentHash } = properties;
    if (!Number.isSafeInteger(throughStepNumber) || (throughStepNumber as number) < 1) {
      throw new RangeError(
        `Panel-camera frontier prefix ${index} throughStepNumber must be a positive safe integer; received ${describe(throughStepNumber)}.`,
      );
    }
    const step = throughStepNumber as number;
    if (commonStep !== null && step !== commonStep) {
      throw new TypeError(
        `Panel-camera frontier prefix ${index} is through step ${step}, but the frontier began through step ${commonStep}; one frontier must retain one exact step.`,
      );
    }
    commonStep = step;
    if (input.registrationPanelStepNumber <= step) {
      throw new RangeError(
        `Panel-camera frontier registration panel ${input.registrationPanelStepNumber} is not later than prefix ${index} through step ${step}.`,
      );
    }
    if (typeof parentLineageId !== "string" || !LINEAGE_ID_PATTERN.test(parentLineageId)) {
      throw new TypeError(
        `Panel-camera frontier prefix ${index} parentLineageId must be a 1-256 character ASCII lineage id; received ${describe(parentLineageId)}.`,
      );
    }
    if (typeof documentHash !== "string" || !PANEL_CAMERA_DIGEST_PATTERN.test(documentHash)) {
      throw new TypeError(
        `Panel-camera frontier prefix ${index} documentHash must be a lowercase sha256 digest; received ${describe(documentHash)}.`,
      );
    }
    const candidateId = realBuildStableDocumentCandidateId(documentHash);
    const parentCandidate = `${parentLineageId}\0${candidateId}`;
    if (parentCandidates.has(parentCandidate)) {
      throw new TypeError(
        `Panel-camera frontier prefix ${index} repeats parent ${JSON.stringify(parentLineageId)} with candidate ${JSON.stringify(candidateId)}; each (parentLineageId, candidateId) pair must be unique before budget.`,
      );
    }
    parentCandidates.add(parentCandidate);
    headers.push(
      Object.freeze({
        throughStepNumber: step,
        parentLineageId,
        document: document as D,
        documentHash: documentHash as Sha256Digest,
        candidateId,
      }),
    );
  }
  return Object.freeze(headers);
}

function snapshotPreparedPrefixes<D extends RealBuildPanelCameraDocument>(
  headers: readonly PanelCameraFrontierPrefixHeader<D>[],
): readonly PreparedPrefix<D>[] {
  const snapshots = new WeakMap<
    object,
    {
      readonly document: D;
      readonly canonical: string;
      readonly canonicalBytes: number;
      readonly nodeCount: number;
      readonly partCount: number;
    }
  >();
  let remainingPartReferences = MAX_TOTAL_PART_REFERENCES;
  let remainingCanonicalBytes = MAX_TOTAL_CANONICAL_BYTES;
  let remainingCanonicalNodes = MAX_TOTAL_CANONICAL_NODES;
  const prepared: PreparedPrefix<D>[] = [];
  for (const [index, header] of headers.entries()) {
    const source = header.document as unknown;
    let snapshot =
      source !== null && typeof source === "object" ? snapshots.get(source) : undefined;
    if (snapshot === undefined) {
      try {
        snapshot = snapshotPanelCameraDocumentWithCanonical<D>(source, {
          maximumParts: Math.min(MAX_DOCUMENT_PARTS, remainingPartReferences),
          maximumCanonicalBytes: remainingCanonicalBytes,
          maximumNodes: remainingCanonicalNodes,
        });
      } catch (error) {
        if (
          error instanceof PanelCameraPartLimitError &&
          remainingPartReferences < MAX_DOCUMENT_PARTS &&
          error.limit === remainingPartReferences
        ) {
          throw new RangeError(
            `Panel-camera frontier prefixes reference more than ${MAX_TOTAL_PART_REFERENCES} aggregate input parts at prefix ${index}; no document was cloned or hashed, and the ledger must be discarded.`,
            { cause: error },
          );
        }
        throw error;
      }
      remainingCanonicalBytes -= snapshot.canonicalBytes;
      remainingCanonicalNodes -= snapshot.nodeCount;
      if (source !== null && typeof source === "object") snapshots.set(source, snapshot);
    }
    if (snapshot.partCount > remainingPartReferences) {
      throw new RangeError(
        `Panel-camera frontier prefix ${index} would raise aggregate input part references above ${MAX_TOTAL_PART_REFERENCES}; no further document was detached or hashed, and the ledger must be discarded.`,
      );
    }
    remainingPartReferences -= snapshot.partCount;
    if (snapshot.partCount === 0) {
      throw new TypeError(
        `Panel-camera frontier prefix ${index} through step ${header.throughStepNumber} retains no parts; only the separate step-0 seeding operation may be empty, and the reserved ledger must be discarded.`,
      );
    }
    prepared.push(
      Object.freeze({
        ...header,
        document: snapshot.document,
        canonicalDocument: snapshot.canonical,
      }),
    );
  }
  return Object.freeze(prepared);
}

export function preparePanelCameraFrontierCandidates<D extends RealBuildPanelCameraDocument>(
  headers: readonly PanelCameraFrontierPrefixHeader<D>[],
): readonly PreparedPanelCameraFrontierCandidate<D>[] {
  const byCandidate = new Map<
    string,
    { readonly prefix: PreparedPrefix<D>; readonly parentLineageIds: string[] }
  >();
  const candidateByBytes = new Map<string, string>();
  for (const prefix of snapshotPreparedPrefixes(headers)) {
    const bytesOwner = candidateByBytes.get(prefix.canonicalDocument);
    if (bytesOwner !== undefined && bytesOwner !== prefix.candidateId) {
      throw new TypeError(
        `Panel-camera frontier document bytes claim both ${JSON.stringify(bytesOwner)} and ${JSON.stringify(prefix.candidateId)}; one canonical document must have one stable candidate identity.`,
      );
    }
    candidateByBytes.set(prefix.canonicalDocument, prefix.candidateId);
    const existing = byCandidate.get(prefix.candidateId);
    if (existing !== undefined && existing.prefix.canonicalDocument !== prefix.canonicalDocument) {
      throw new TypeError(
        `Panel-camera frontier candidate ${JSON.stringify(prefix.candidateId)} aliases different canonical document bytes after reservation; discard the ledger.`,
      );
    }
    if (existing === undefined) {
      byCandidate.set(prefix.candidateId, {
        prefix,
        parentLineageIds: [prefix.parentLineageId],
      });
    } else existing.parentLineageIds.push(prefix.parentLineageId);
  }
  return Object.freeze(
    [...byCandidate.values()].map(({ prefix, parentLineageIds }) =>
      Object.freeze({
        ...prefix,
        parentLineageIds: Object.freeze(parentLineageIds),
      }),
    ),
  );
}

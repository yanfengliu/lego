import { lstatSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { types as nodeTypes } from "node:util";

import {
  boundedDenseSourceParityArray,
  exactSourceParityKeys,
  snapshotDenseSourceParityArray,
  snapshotSourceParityRecord,
} from "./real-build-observation-source-parity-output-primitives";
import type { RealBuildSourceParityPublicationLimits } from "./real-build-observation-source-parity-output-validation";
import type {
  RealBuildSourceParityProbeResult,
  RealBuildSourceParityProvenanceRole,
} from "./real-build-observation-source-parity-types";

export interface RealBuildSourceParityPublishInput {
  readonly repoRoot: string;
  readonly result: RealBuildSourceParityProbeResult;
  readonly provenance: readonly RealBuildSourceParityProvenanceRole[];
  readonly __testLimits?: Partial<RealBuildSourceParityPublicationLimits>;
}

export function snapshotRealBuildSourceParityPublishInput(
  input: RealBuildSourceParityPublishInput,
): RealBuildSourceParityPublishInput {
  if (
    input === null ||
    typeof input !== "object" ||
    nodeTypes.isProxy(input) ||
    Array.isArray(input)
  ) {
    throw new TypeError("Source-parity publish input must be a non-proxy plain data record.");
  }
  if (Object.getPrototypeOf(input) !== Object.prototype) {
    throw new TypeError("Source-parity publish input must use Object.prototype.");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const hasLimits = Object.prototype.hasOwnProperty.call(descriptors, "__testLimits");
  exactSourceParityKeys(
    input,
    hasLimits
      ? ["repoRoot", "result", "provenance", "__testLimits"]
      : ["repoRoot", "result", "provenance"],
    "Source-parity publish input",
  );
  const values = snapshotSourceParityRecord(input, [
    "repoRoot",
    "result",
    "provenance",
    ...(hasLimits ? (["__testLimits"] as const) : []),
  ]);
  if (
    typeof values.repoRoot !== "string" ||
    !isAbsolute(values.repoRoot) ||
    resolve(values.repoRoot) !== values.repoRoot
  ) {
    throw new TypeError("Source-parity repoRoot must be one resolved absolute path.");
  }
  const status = lstatSync(values.repoRoot, { throwIfNoEntry: false });
  if (status === undefined || !status.isDirectory() || status.isSymbolicLink()) {
    throw new TypeError("Source-parity repoRoot must be an existing ordinary directory.");
  }
  boundedDenseSourceParityArray(values.provenance, 4, 10, "Source-parity provenance roles");
  let limits: Partial<RealBuildSourceParityPublicationLimits> | undefined;
  if (hasLimits) {
    const rawLimits = values.__testLimits;
    const limitKeys = [
      "maximumCaptureBytes",
      "maximumAggregateCaptureBytes",
      "maximumAggregatePackedEvidenceBytes",
    ] as const;
    if (rawLimits === undefined) {
      limits = undefined;
    } else {
      if (rawLimits === null || typeof rawLimits !== "object" || nodeTypes.isProxy(rawLimits)) {
        throw new TypeError("Source-parity test limits must be a non-proxy plain data record.");
      }
      const supplied = Reflect.ownKeys(Object.getOwnPropertyDescriptors(rawLimits));
      if (supplied.some((key) => typeof key !== "string")) {
        throw new TypeError("Source-parity test limits may not contain symbol keys.");
      }
      const suppliedKeys = (supplied as string[]).sort();
      if (suppliedKeys.some((key) => !limitKeys.includes(key as (typeof limitKeys)[number]))) {
        throw new TypeError("Source-parity test limits contain an unknown bound.");
      }
      exactSourceParityKeys(rawLimits, suppliedKeys, "Source-parity test limits");
      limits = snapshotSourceParityRecord(
        rawLimits,
        suppliedKeys as (keyof RealBuildSourceParityPublicationLimits)[],
      );
    }
  }
  const snapshot: RealBuildSourceParityPublishInput = {
    repoRoot: values.repoRoot,
    result: values.result,
    provenance: snapshotDenseSourceParityArray(values.provenance),
  };
  return hasLimits && limits !== undefined ? { ...snapshot, __testLimits: limits } : snapshot;
}

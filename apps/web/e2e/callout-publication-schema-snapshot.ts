import { isProxy } from "node:util/types";

import {
  STRICT_JSON_SNAPSHOT_LIMITS,
  strictBoundedJsonSnapshotReport,
  type StrictJsonSnapshotReport,
} from "./callout-publication-json";
import type {
  CalloutManifest,
  PixelBounds,
  PixelClearance,
  PublishedCallout,
  RecoveryBenchmark,
  RetainedFailure,
  SourceComponentEvidence,
  StrategyScore,
} from "./callout-types";
import type { PanelBounds } from "../src/instructions/step-panels";

const ARRAY_CONSTRUCTOR = Array;
const ARRAY_IS_ARRAY = Array.isArray;
const ARRAY_PROTOTYPE = Array.prototype;
const ERROR_CONSTRUCTOR = Error;
const NUMBER_IS_FINITE = Number.isFinite;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_CREATE = Object.create;
const OBJECT_DEFINE_PROPERTY = Object.defineProperty;
const OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const OBJECT_PROTOTYPE = Object.prototype;
const STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const REFLECT_APPLY = Reflect.apply;

const SCHEMA_ARRAY_LIMITS = Object.freeze({
  pageSelection: 2_000,
  failures: 2_000,
  callouts: 2_000,
  observedLegacyFailures: 2_000,
  scores: 2,
  invalidIdentities: 2_000,
  masks: 2,
  contamination: 256,
});

type ManifestCallout = CalloutManifest["callouts"][number];
type FixedField = readonly [key: string, value: unknown];

function charCodeAt(value: string, index: number): number {
  return REFLECT_APPLY(STRING_CHAR_CODE_AT, value, [index]) as number;
}

function printableAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = charCodeAt(value, index);
    if (codeUnit < 0x20 || codeUnit > 0x7e) return false;
  }
  return true;
}

function assertInvocation(label: string, maximumBytes: number, maximumNodes: number): void {
  if (
    typeof label !== "string" ||
    label.length < 1 ||
    label.length > STRICT_JSON_SNAPSHOT_LIMITS.maxLabelCharacters ||
    !printableAscii(label)
  ) {
    throw new ERROR_CONSTRUCTOR(
      `Callout schema snapshot label must contain 1..${STRICT_JSON_SNAPSHOT_LIMITS.maxLabelCharacters} printable ASCII characters.`,
    );
  }
  if (
    !NUMBER_IS_SAFE_INTEGER(maximumBytes) ||
    maximumBytes < 1 ||
    maximumBytes > STRICT_JSON_SNAPSHOT_LIMITS.maxBytes
  ) {
    throw new ERROR_CONSTRUCTOR(
      `${label} schema snapshot byte ceiling must be a safe integer in 1..${STRICT_JSON_SNAPSHOT_LIMITS.maxBytes}.`,
    );
  }
  if (
    !NUMBER_IS_SAFE_INTEGER(maximumNodes) ||
    maximumNodes < 1 ||
    maximumNodes > STRICT_JSON_SNAPSHOT_LIMITS.maxNodes
  ) {
    throw new ERROR_CONSTRUCTOR(
      `${label} schema snapshot node ceiling must be a safe integer in 1..${STRICT_JSON_SNAPSHOT_LIMITS.maxNodes}.`,
    );
  }
}

function sourceRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || isProxy(value) || ARRAY_IS_ARRAY(value)) {
    throw new ERROR_CONSTRUCTOR(`${label} must be one non-Proxy plain record.`);
  }
  const prototype = OBJECT_GET_PROTOTYPE_OF(value);
  if (prototype !== OBJECT_PROTOTYPE && prototype !== null) {
    throw new ERROR_CONSTRUCTOR(`${label} must be one non-Proxy plain record.`);
  }
  return value as Record<string, unknown>;
}

function ownData(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new ERROR_CONSTRUCTOR(`${label}.${key} must be one stable own data property.`);
  }
  return descriptor.value;
}

function scalar(value: unknown, label: string): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && NUMBER_IS_FINITE(value))
  )
    return value;
  throw new ERROR_CONSTRUCTOR(
    `${label} must be null, a boolean, a string, or one finite number in an own data property.`,
  );
}

function ownScalar(value: Record<string, unknown>, key: string, label: string): unknown {
  return scalar(ownData(value, key, label), `${label}.${key}`);
}

function exactRecord<T>(fields: readonly FixedField[]): T {
  const result = OBJECT_CREATE(null) as Record<string, unknown>;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    OBJECT_DEFINE_PROPERTY(result, field[0], {
      value: field[1],
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return result as T;
}

function denseArray<T>(
  value: unknown,
  label: string,
  maximumLength: number,
  snapshotItem: (item: unknown, label: string) => T,
): T[] {
  if (value === null || typeof value !== "object" || isProxy(value) || !ARRAY_IS_ARRAY(value)) {
    throw new ERROR_CONSTRUCTOR(`${label} must be one non-Proxy dense array.`);
  }
  if (OBJECT_GET_PROTOTYPE_OF(value) !== ARRAY_PROTOTYPE) {
    throw new ERROR_CONSTRUCTOR(`${label} must be one non-Proxy dense array.`);
  }
  const lengthDescriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !NUMBER_IS_SAFE_INTEGER(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0 ||
    (lengthDescriptor.value as number) > maximumLength
  ) {
    throw new ERROR_CONSTRUCTOR(`${label}.length must be a safe integer in 0..${maximumLength}.`);
  }
  const length = lengthDescriptor.value as number;
  const result = new ARRAY_CONSTRUCTOR<T>(length);
  for (let index = 0; index < length; index += 1) {
    const itemLabel = `${label}[${index}]`;
    const descriptor = OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, `${index}`);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new ERROR_CONSTRUCTOR(`${itemLabel} must be one stable own data property.`);
    }
    OBJECT_DEFINE_PROPERTY(result, `${index}`, {
      value: snapshotItem(descriptor.value, itemLabel),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return result;
}

function scalarArray(value: unknown, label: string, maximumLength: number): unknown[] {
  return denseArray(value, label, maximumLength, scalar);
}

function pixelBounds(value: unknown, label: string): PixelBounds {
  const source = sourceRecord(value, label);
  return exactRecord<PixelBounds>([
    ["left", ownScalar(source, "left", label)],
    ["top", ownScalar(source, "top", label)],
    ["right", ownScalar(source, "right", label)],
    ["bottom", ownScalar(source, "bottom", label)],
  ]);
}

function pixelClearance(value: unknown, label: string): PixelClearance {
  return pixelBounds(value, label);
}

function panelBounds(value: unknown, label: string): PanelBounds {
  const source = sourceRecord(value, label);
  return exactRecord<PanelBounds>([
    ["minXPt", ownScalar(source, "minXPt", label)],
    ["maxXPt", ownScalar(source, "maxXPt", label)],
    ["minYPt", ownScalar(source, "minYPt", label)],
    ["maxYPt", ownScalar(source, "maxYPt", label)],
  ]);
}

function sourceComponent(value: unknown, label: string): SourceComponentEvidence | null {
  if (value === null) return null;
  const source = sourceRecord(value, label);
  return exactRecord<SourceComponentEvidence>([
    ["rasterScale", ownScalar(source, "rasterScale", label)],
    ["boundsPx", pixelBounds(ownData(source, "boundsPx", label), `${label}.boundsPx`)],
    ["foregroundPixels", ownScalar(source, "foregroundPixels", label)],
    ["rawComponentCount", ownScalar(source, "rawComponentCount", label)],
    ["absoluteForegroundSha256", ownScalar(source, "absoluteForegroundSha256", label)],
  ]);
}

function callout(
  value: unknown,
  label: string,
  fileKey: "file" | "fileName",
): ManifestCallout | PublishedCallout {
  const source = sourceRecord(value, label);
  const fields: FixedField[] = [
    ["identity", ownScalar(source, "identity", label)],
    ["pageNumber", ownScalar(source, "pageNumber", label)],
    ["stepNumber", ownScalar(source, "stepNumber", label)],
    ["quantity", ownScalar(source, "quantity", label)],
    ["xPt", ownScalar(source, "xPt", label)],
    ["yPt", ownScalar(source, "yPt", label)],
    ["heightPt", ownScalar(source, "heightPt", label)],
    ["boxMethod", ownScalar(source, "boxMethod", label)],
    ["box", panelBounds(ownData(source, "box", label), `${label}.box`)],
    ["evidenceKind", ownScalar(source, "evidenceKind", label)],
    ["regionKind", ownScalar(source, "regionKind", label)],
    ["cropStrategy", ownScalar(source, "cropStrategy", label)],
    [
      "masksApplied",
      scalarArray(
        ownData(source, "masksApplied", label),
        `${label}.masksApplied`,
        SCHEMA_ARRAY_LIMITS.masks,
      ),
    ],
    [
      "contamination",
      scalarArray(
        ownData(source, "contamination", label),
        `${label}.contamination`,
        SCHEMA_ARRAY_LIMITS.contamination,
      ),
    ],
    ["sha256", ownScalar(source, "sha256", label)],
    ["byteLength", ownScalar(source, "byteLength", label)],
    ["widthPx", ownScalar(source, "widthPx", label)],
    ["heightPx", ownScalar(source, "heightPx", label)],
    ["foregroundPixels", ownScalar(source, "foregroundPixels", label)],
    ["sourceTextGlyphPixels", ownScalar(source, "sourceTextGlyphPixels", label)],
    ["sourceQuantityGlyphPixels", ownScalar(source, "sourceQuantityGlyphPixels", label)],
    ["textGlyphOverlapPixels", ownScalar(source, "textGlyphOverlapPixels", label)],
    ["quantityGlyphOverlapPixels", ownScalar(source, "quantityGlyphOverlapPixels", label)],
    ["quantityGlyphPixelsMasked", ownScalar(source, "quantityGlyphPixelsMasked", label)],
    ["cropRectPx", pixelBounds(ownData(source, "cropRectPx", label), `${label}.cropRectPx`)],
    [
      "boundaryClearancePx",
      pixelClearance(ownData(source, "boundaryClearancePx", label), `${label}.boundaryClearancePx`),
    ],
    [
      "sourceComponent",
      sourceComponent(ownData(source, "sourceComponent", label), `${label}.sourceComponent`),
    ],
    [fileKey, ownScalar(source, fileKey, label)],
  ];
  return exactRecord<ManifestCallout | PublishedCallout>(fields);
}

function failure(value: unknown, label: string): RetainedFailure {
  const source = sourceRecord(value, label);
  return exactRecord<RetainedFailure>([
    ["identity", ownScalar(source, "identity", label)],
    ["pageNumber", ownScalar(source, "pageNumber", label)],
    ["quantity", ownScalar(source, "quantity", label)],
    ["xPt", ownScalar(source, "xPt", label)],
    ["yPt", ownScalar(source, "yPt", label)],
    ["heightPt", ownScalar(source, "heightPt", label)],
    ["stage", ownScalar(source, "stage", label)],
    ["code", ownScalar(source, "code", label)],
    ["message", ownScalar(source, "message", label)],
  ]);
}

function strategyScore(value: unknown, label: string): StrategyScore {
  const source = sourceRecord(value, label);
  return exactRecord<StrategyScore>([
    ["strategy", ownScalar(source, "strategy", label)],
    ["valid", ownScalar(source, "valid", label)],
    ["recovered", ownScalar(source, "recovered", label)],
    ["kindCorrect", ownScalar(source, "kindCorrect", label)],
    ["regionCorrect", ownScalar(source, "regionCorrect", label)],
    ["masksCorrect", ownScalar(source, "masksCorrect", label)],
    ["uncontaminated", ownScalar(source, "uncontaminated", label)],
    [
      "invalidIdentities",
      scalarArray(
        ownData(source, "invalidIdentities", label),
        `${label}.invalidIdentities`,
        SCHEMA_ARRAY_LIMITS.invalidIdentities,
      ),
    ],
    ["points", ownScalar(source, "points", label)],
  ]);
}

function recoveryBenchmark(value: unknown, label: string): RecoveryBenchmark {
  const source = sourceRecord(value, label);
  return exactRecord<RecoveryBenchmark>([
    ["schemaVersion", ownScalar(source, "schemaVersion", label)],
    ["fixtureSourceHash", ownScalar(source, "fixtureSourceHash", label)],
    ["fixedFailureClassSize", ownScalar(source, "fixedFailureClassSize", label)],
    [
      "observedLegacyFailureIdentities",
      scalarArray(
        ownData(source, "observedLegacyFailureIdentities", label),
        `${label}.observedLegacyFailureIdentities`,
        SCHEMA_ARRAY_LIMITS.observedLegacyFailures,
      ),
    ],
    [
      "scores",
      denseArray(
        ownData(source, "scores", label),
        `${label}.scores`,
        SCHEMA_ARRAY_LIMITS.scores,
        strategyScore,
      ),
    ],
    ["selected", ownScalar(source, "selected", label)],
    ["winner", ownScalar(source, "winner", label)],
    ["winningMargin", ownScalar(source, "winningMargin", label)],
  ]);
}

function manifestShape(value: unknown, label: string): CalloutManifest {
  const source = sourceRecord(value, label);
  const pageSelectionValue = ownData(source, "pageSelection", label);
  const pageSelection =
    typeof pageSelectionValue === "string"
      ? pageSelectionValue
      : scalarArray(
          pageSelectionValue,
          `${label}.pageSelection`,
          SCHEMA_ARRAY_LIMITS.pageSelection,
        );
  const accountingSource = sourceRecord(
    ownData(source, "accounting", label),
    `${label}.accounting`,
  );
  const conservationSource = sourceRecord(
    ownData(source, "conservation", label),
    `${label}.conservation`,
  );
  return exactRecord<CalloutManifest>([
    ["schemaVersion", ownScalar(source, "schemaVersion", label)],
    ["sourceHash", ownScalar(source, "sourceHash", label)],
    ["pageSelection", pageSelection],
    ["pagesCropped", ownScalar(source, "pagesCropped", label)],
    ["calloutCount", ownScalar(source, "calloutCount", label)],
    [
      "accounting",
      exactRecord([
        [
          "rawNxIdentityCount",
          ownScalar(accountingSource, "rawNxIdentityCount", `${label}.accounting`),
        ],
        [
          "rawNxQuantityTotal",
          ownScalar(accountingSource, "rawNxQuantityTotal", `${label}.accounting`),
        ],
        [
          "physicalPartArtIdentityCount",
          ownScalar(accountingSource, "physicalPartArtIdentityCount", `${label}.accounting`),
        ],
        [
          "physicalPartArtQuantityTotal",
          ownScalar(accountingSource, "physicalPartArtQuantityTotal", `${label}.accounting`),
        ],
        [
          "semanticIdentityCount",
          ownScalar(accountingSource, "semanticIdentityCount", `${label}.accounting`),
        ],
        [
          "semanticQuantityTotal",
          ownScalar(accountingSource, "semanticQuantityTotal", `${label}.accounting`),
        ],
      ]),
    ],
    [
      "recoveryBenchmark",
      recoveryBenchmark(ownData(source, "recoveryBenchmark", label), `${label}.recoveryBenchmark`),
    ],
    [
      "conservation",
      exactRecord([
        [
          "expectedIdentityCount",
          ownScalar(conservationSource, "expectedIdentityCount", `${label}.conservation`),
        ],
        [
          "expectedRawNxQuantityTotal",
          ownScalar(conservationSource, "expectedRawNxQuantityTotal", `${label}.conservation`),
        ],
        [
          "expectedIdentitySetSha256",
          ownScalar(conservationSource, "expectedIdentitySetSha256", `${label}.conservation`),
        ],
        [
          "publishedIdentityCount",
          ownScalar(conservationSource, "publishedIdentityCount", `${label}.conservation`),
        ],
        [
          "publishedRawNxQuantityTotal",
          ownScalar(conservationSource, "publishedRawNxQuantityTotal", `${label}.conservation`),
        ],
        [
          "publishedIdentitySetSha256",
          ownScalar(conservationSource, "publishedIdentitySetSha256", `${label}.conservation`),
        ],
      ]),
    ],
    [
      "failures",
      denseArray(
        ownData(source, "failures", label),
        `${label}.failures`,
        SCHEMA_ARRAY_LIMITS.failures,
        failure,
      ),
    ],
    [
      "callouts",
      denseArray(
        ownData(source, "callouts", label),
        `${label}.callouts`,
        SCHEMA_ARRAY_LIMITS.callouts,
        (item, itemLabel) => callout(item, itemLabel, "file") as ManifestCallout,
      ),
    ],
  ]);
}

export function snapshotCalloutManifest(
  value: unknown,
  label: string,
  maximumBytes: number,
  maximumNodes: number = STRICT_JSON_SNAPSHOT_LIMITS.maxNodes,
): StrictJsonSnapshotReport<CalloutManifest> {
  assertInvocation(label, maximumBytes, maximumNodes);
  return strictBoundedJsonSnapshotReport(
    manifestShape(value, label),
    label,
    maximumBytes,
    maximumNodes,
  );
}

export function snapshotPublishedCallout(
  value: unknown,
  label: string,
  maximumBytes: number,
  maximumNodes: number = STRICT_JSON_SNAPSHOT_LIMITS.maxNodes,
): StrictJsonSnapshotReport<PublishedCallout> {
  assertInvocation(label, maximumBytes, maximumNodes);
  return strictBoundedJsonSnapshotReport(
    callout(value, label, "fileName") as PublishedCallout,
    label,
    maximumBytes,
    maximumNodes,
  );
}

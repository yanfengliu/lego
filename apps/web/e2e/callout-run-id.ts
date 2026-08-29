import { createHash } from "node:crypto";

import { OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD } from "./callout-field-names.ts";
import type {
  CalloutManifest,
  PixelBounds,
  PublishedCallout,
  RecoveryBenchmark,
  SourceComponentEvidence,
} from "./callout-types";

export interface CalloutRunIdentityInput {
  readonly schemaVersion: CalloutManifest["schemaVersion"];
  readonly sourceHash: string;
  readonly pageSelection: CalloutManifest["pageSelection"];
  readonly recoveryBenchmark: RecoveryBenchmark;
  readonly accounting: CalloutManifest["accounting"];
  readonly conservation: CalloutManifest["conservation"];
  readonly crops: readonly PublishedCallout[];
}

const ARRAY_CONSTRUCTOR = Array;
const JSON_STRINGIFY = JSON.stringify;
const OBJECT_CREATE = Object.create;
const OBJECT_DEFINE_PROPERTY = Object.defineProperty;
const OBJECT_SET_PROTOTYPE_OF = Object.setPrototypeOf;
const REFLECT_APPLY = Reflect.apply;
const STRING_SLICE = String.prototype.slice;

type Field = readonly [string, unknown];

function record<T>(fields: readonly Field[]): T {
  const result = REFLECT_APPLY(OBJECT_CREATE, Object, [null]) as Record<string, unknown>;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    const key = field[0];
    const value = field[1];
    REFLECT_APPLY(OBJECT_DEFINE_PROPERTY, Object, [
      result,
      key,
      {
        value,
        enumerable: true,
        configurable: false,
        writable: false,
      },
    ]);
  }
  return result as T;
}

function arrayOf<T, U>(values: readonly T[], convert: (value: T) => U): U[] {
  const result = new ARRAY_CONSTRUCTOR<U>(values.length);
  for (let index = 0; index < values.length; index += 1) result[index] = convert(values[index]!);
  REFLECT_APPLY(OBJECT_SET_PROTOTYPE_OF, Object, [result, null]);
  return result;
}

function scalars<T>(values: readonly T[]): T[] {
  return arrayOf(values, (value) => value);
}

function pixelBounds(value: PixelBounds): PixelBounds {
  return record<PixelBounds>([
    ["left", value.left],
    ["top", value.top],
    ["right", value.right],
    ["bottom", value.bottom],
  ]);
}

function sourceComponent(value: SourceComponentEvidence | null): SourceComponentEvidence | null {
  if (value === null) return null;
  return record<SourceComponentEvidence>([
    ["rasterScale", value.rasterScale],
    ["boundsPx", pixelBounds(value.boundsPx)],
    ["foregroundPixels", value.foregroundPixels],
    ["rawComponentCount", value.rawComponentCount],
    ["absoluteForegroundSha256", value.absoluteForegroundSha256],
  ]);
}

function recoveryBenchmark(value: RecoveryBenchmark): RecoveryBenchmark {
  return record<RecoveryBenchmark>([
    ["schemaVersion", value.schemaVersion],
    ["fixtureSourceHash", value.fixtureSourceHash],
    ["fixedFailureClassSize", value.fixedFailureClassSize],
    [OBSERVED_LEGACY_FAILURE_IDENTITIES_FIELD, scalars(value.observedLegacyFailureIdentities)],
    [
      "scores",
      arrayOf(value.scores, (score) =>
        record([
          ["strategy", score.strategy],
          ["valid", score.valid],
          ["recovered", score.recovered],
          ["kindCorrect", score.kindCorrect],
          ["regionCorrect", score.regionCorrect],
          ["masksCorrect", score.masksCorrect],
          ["uncontaminated", score.uncontaminated],
          ["invalidIdentities", scalars(score.invalidIdentities)],
          ["points", score.points],
        ]),
      ),
    ],
    ["selected", value.selected],
    ["winner", value.winner],
    ["winningMargin", value.winningMargin],
  ]);
}

function publishedCallout(value: PublishedCallout): PublishedCallout {
  return record<PublishedCallout>([
    ["identity", value.identity],
    ["fileName", value.fileName],
    ["pageNumber", value.pageNumber],
    ["stepNumber", value.stepNumber],
    ["quantity", value.quantity],
    ["xPt", value.xPt],
    ["yPt", value.yPt],
    ["heightPt", value.heightPt],
    ["boxMethod", value.boxMethod],
    [
      "box",
      record([
        ["minXPt", value.box.minXPt],
        ["maxXPt", value.box.maxXPt],
        ["minYPt", value.box.minYPt],
        ["maxYPt", value.box.maxYPt],
      ]),
    ],
    ["evidenceKind", value.evidenceKind],
    ["regionKind", value.regionKind],
    ["cropStrategy", value.cropStrategy],
    ["masksApplied", scalars(value.masksApplied)],
    ["contamination", scalars(value.contamination)],
    ["sha256", value.sha256],
    ["byteLength", value.byteLength],
    ["widthPx", value.widthPx],
    ["heightPx", value.heightPx],
    ["foregroundPixels", value.foregroundPixels],
    ["sourceTextGlyphPixels", value.sourceTextGlyphPixels],
    ["sourceQuantityGlyphPixels", value.sourceQuantityGlyphPixels],
    ["textGlyphOverlapPixels", value.textGlyphOverlapPixels],
    ["quantityGlyphOverlapPixels", value.quantityGlyphOverlapPixels],
    ["quantityGlyphPixelsMasked", value.quantityGlyphPixelsMasked],
    ["cropRectPx", pixelBounds(value.cropRectPx)],
    ["boundaryClearancePx", pixelBounds(value.boundaryClearancePx)],
    ["sourceComponent", sourceComponent(value.sourceComponent)],
  ]);
}

/**
 * Content address for one v6 publication, using only metadata retained in its
 * manifest. Fixed fields and prototype-free containers make it independent of
 * caller insertion order, inherited toJSON hooks, and mutable array helpers.
 */
export function deriveCalloutRunId(input: CalloutRunIdentityInput): string {
  const canonical = record([
    ["schemaVersion", input.schemaVersion],
    ["sourceHash", input.sourceHash],
    [
      "pageSelection",
      input.pageSelection === "full booklet" ? input.pageSelection : scalars(input.pageSelection),
    ],
    ["recoveryBenchmark", recoveryBenchmark(input.recoveryBenchmark)],
    [
      "accounting",
      record([
        ["rawNxIdentityCount", input.accounting.rawNxIdentityCount],
        ["rawNxQuantityTotal", input.accounting.rawNxQuantityTotal],
        ["physicalPartArtIdentityCount", input.accounting.physicalPartArtIdentityCount],
        ["physicalPartArtQuantityTotal", input.accounting.physicalPartArtQuantityTotal],
        ["semanticIdentityCount", input.accounting.semanticIdentityCount],
        ["semanticQuantityTotal", input.accounting.semanticQuantityTotal],
      ]),
    ],
    [
      "conservation",
      record([
        ["expectedIdentityCount", input.conservation.expectedIdentityCount],
        ["expectedRawNxQuantityTotal", input.conservation.expectedRawNxQuantityTotal],
        ["expectedIdentitySetSha256", input.conservation.expectedIdentitySetSha256],
        ["publishedIdentityCount", input.conservation.publishedIdentityCount],
        ["publishedRawNxQuantityTotal", input.conservation.publishedRawNxQuantityTotal],
        ["publishedIdentitySetSha256", input.conservation.publishedIdentitySetSha256],
      ]),
    ],
    ["crops", arrayOf(input.crops, publishedCallout)],
  ]);
  const encoded = REFLECT_APPLY(JSON_STRINGIFY, JSON, [canonical]) as string;
  const digest = createHash("sha256").update(encoded).digest("hex");
  return REFLECT_APPLY(STRING_SLICE, digest, [0, 24]) as string;
}

function fileStem(identity: string): string {
  let result = "";
  for (let index = 0; index < identity.length; index += 1) {
    const character = identity[index]!;
    result += character === "|" ? "-" : character === "." ? "d" : character;
  }
  return result;
}

function calloutFromManifest(callout: CalloutManifest["callouts"][number]): PublishedCallout {
  return publishedCallout({
    identity: callout.identity,
    fileName: `${fileStem(callout.identity)}.png`,
    pageNumber: callout.pageNumber,
    stepNumber: callout.stepNumber,
    quantity: callout.quantity,
    xPt: callout.xPt,
    yPt: callout.yPt,
    heightPt: callout.heightPt,
    boxMethod: callout.boxMethod,
    box: callout.box,
    evidenceKind: callout.evidenceKind,
    regionKind: callout.regionKind,
    cropStrategy: callout.cropStrategy,
    masksApplied: callout.masksApplied,
    contamination: callout.contamination,
    sha256: callout.sha256,
    byteLength: callout.byteLength,
    widthPx: callout.widthPx,
    heightPx: callout.heightPx,
    foregroundPixels: callout.foregroundPixels,
    sourceTextGlyphPixels: callout.sourceTextGlyphPixels,
    sourceQuantityGlyphPixels: callout.sourceQuantityGlyphPixels,
    textGlyphOverlapPixels: callout.textGlyphOverlapPixels,
    quantityGlyphOverlapPixels: callout.quantityGlyphOverlapPixels,
    quantityGlyphPixelsMasked: callout.quantityGlyphPixelsMasked,
    cropRectPx: callout.cropRectPx,
    boundaryClearancePx: callout.boundaryClearancePx,
    sourceComponent: callout.sourceComponent,
  });
}

/** Reconstructs the exact producer metadata from one already-validated manifest. */
export function deriveCalloutManifestRunId(manifest: CalloutManifest): string {
  return deriveCalloutRunId({
    schemaVersion: manifest.schemaVersion,
    sourceHash: manifest.sourceHash,
    pageSelection: manifest.pageSelection,
    recoveryBenchmark: manifest.recoveryBenchmark,
    accounting: manifest.accounting,
    conservation: manifest.conservation,
    crops: arrayOf(manifest.callouts, calloutFromManifest),
  });
}

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  assertFeaturesArtifact,
  assertV6CalloutManifest,
  readBoundManifestCrop,
  readJsonArtifact,
} from "../../../scripts/part-identification-artifacts.mjs";
import { readBoundedFile } from "../../../scripts/part-identification-io.mjs";
import { assertPairJudgedTruthFromParsedJson } from "../../../scripts/part-identification-pair-judged.mjs";
import type { ParsedJsonObject } from "../../../scripts/part-identification-pair-judged.mjs";
import {
  canonicalizeCalloutPng,
  measureExactBottomBackgroundRecut,
} from "../../../scripts/part-identification-source-art-canonical.mjs";
import { bindCalloutSourceArtMeasurement } from "../../../scripts/part-identification-source-art-binding.mjs";
import type { SourceArtBindingRow } from "../../../scripts/part-identification-source-art-binding.mjs";
import { measurePdfSourceArtImages } from "../../../scripts/part-identification-source-art-images.mjs";
import { decodeCanonicalCardRgba } from "../../../scripts/part-thumbnail-image-guard.mjs";
import { renderCalloutCropsInPage } from "./callout-browser-runner";
import {
  IMAGE_WITNESSES,
  PAGE_18_TARGETS,
  PAGE_20_TARGETS,
  SOURCE_ART_ROWS,
  SOURCE_IDENTITY,
  TARGET_3023_IDENTITY,
  TARGET_35480_IDENTITY,
} from "./callout-source-art-step16-fixture";
import { bookletProbeUrls, hasSampleBooklet, SAMPLE_BOOKLET_PATH } from "./sample-booklet";
import type { BrowserCrop } from "./callout-types";

type Digest = `sha256:${string}`;

interface CalloutEntry {
  readonly identity: string;
  readonly pageNumber: number;
  readonly stepNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly heightPt: number;
  readonly cropStrategy: string;
  readonly evidenceKind: string;
  readonly regionKind: string;
  readonly file: string;
  readonly sha256: Digest;
  readonly byteLength: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly foregroundPixels: number;
  readonly sourceComponent: SourceArtBindingRow["sourceComponent"] | null;
  readonly [key: string]: unknown;
}

interface ManifestValue {
  readonly callouts: readonly CalloutEntry[];
  readonly [key: string]: unknown;
}

interface FeaturesValue {
  readonly inputDigests: { readonly pdf: Digest; readonly calloutManifest: Digest };
  readonly callouts: readonly CalloutEntry[];
  readonly [key: string]: unknown;
}

interface TruthVerdict extends ParsedJsonObject {
  readonly n: number;
  readonly judgedCropSha256: Digest;
  readonly elementId: string;
  readonly same: boolean;
}

interface TruthValue extends ParsedJsonObject {
  readonly verdicts: readonly TruthVerdict[];
}

interface ElementEntry {
  readonly partNum: string;
  readonly name: string;
  readonly colorId: string | number;
  readonly quantity: number;
}

type ElementsValue = Readonly<Record<string, ElementEntry>>;

const PDF_SHA256 = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const MANIFEST_SHA256 = "sha256:c8d20cfe87ef9d21488725b393b94e61870fcc82b26bb497ea734fc7b97a67bf";
const FEATURES_SHA256 = "sha256:13574857858b9b71ce3132ee797ff346597d0d4c20eace70eaf83408d4a523cb";
const TRUTH_SHA256 = "sha256:c7b6aa8990ab9771a4de7c960ffa0b2e69a0d26e8e802ff28d1be4cc8291ca0c";
const ELEMENTS_SHA256 = "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30";

const MANIFEST_PATH = "output/callout-thumbnails/manifest.json";
const CALLOUT_ROOT = "output/callout-thumbnails";
const FEATURES_PATH = "output/part-identification/features.json";
const TRUTH_PATH = "scripts/fixtures/part-identification-truth-first50.json";
const ELEMENTS_PATH = "output/part-identification/element-resolution.json";
const hasProofInputs =
  hasSampleBooklet &&
  [MANIFEST_PATH, FEATURES_PATH, TRUTH_PATH, ELEMENTS_PATH].every((path) => existsSync(path));

const sha256 = (bytes: Uint8Array): Digest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function pngBytes(url: string, label: string): Buffer {
  const prefix = "data:image/png;base64,";
  if (!url.startsWith(prefix)) throw new Error(`${label} is not a base64 PNG data URL.`);
  const payload = url.slice(prefix.length);
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length < 1 || bytes.length > 8 * 1024 * 1024 || bytes.toString("base64") !== payload) {
    throw new Error(`${label} is not one canonical bounded base64 payload.`);
  }
  return bytes;
}

function requiredCrop(crop: BrowserCrop | null, label: string): BrowserCrop {
  if (crop === null) throw new Error(`${label} was not rendered.`);
  return crop;
}

test("measures exact step-16 embedded source art without granting identity authority", async ({
  page,
}, testInfo) => {
  test.skip(
    !hasProofInputs,
    "exact sample booklet and current identification artifacts unavailable",
  );
  if (SAMPLE_BOOKLET_PATH === null) throw new Error("Sample booklet path disappeared after skip.");

  const manifestArtifact = readJsonArtifact<ManifestValue>(
    MANIFEST_PATH,
    "current callout manifest",
  );
  const featuresArtifact = readJsonArtifact<FeaturesValue>(FEATURES_PATH, "current part features");
  const truthArtifact = readJsonArtifact<TruthValue>(TRUTH_PATH, "tracked pair-judged truth");
  const elementsArtifact = readJsonArtifact<ElementsValue>(
    ELEMENTS_PATH,
    "current element resolution",
  );
  expect(manifestArtifact.digest).toBe(MANIFEST_SHA256);
  expect(featuresArtifact.digest).toBe(FEATURES_SHA256);
  expect(truthArtifact.digest).toBe(TRUTH_SHA256);
  expect(elementsArtifact.digest).toBe(ELEMENTS_SHA256);

  const manifest = assertV6CalloutManifest(manifestArtifact.value);
  assertFeaturesArtifact(featuresArtifact);
  const features = featuresArtifact.value;
  assertPairJudgedTruthFromParsedJson(truthArtifact.value, "tracked pair-judged truth");
  expect(features.inputDigests).toEqual({ pdf: PDF_SHA256, calloutManifest: MANIFEST_SHA256 });

  const identities = [SOURCE_IDENTITY, TARGET_3023_IDENTITY, TARGET_35480_IDENTITY];
  const manifestEntries = new Map(
    manifest.callouts
      .filter(({ identity }) => identities.includes(identity))
      .map((entry) => [entry.identity, entry]),
  );
  const featureEntries = new Map(
    features.callouts
      .filter(({ identity }) => identities.includes(identity))
      .map((entry) => [entry.identity, entry]),
  );
  expect([...manifestEntries.keys()].sort()).toEqual([...identities].sort());
  for (const identity of identities)
    expect(featureEntries.get(identity)).toMatchObject(manifestEntries.get(identity)!);

  const sourceEntry = manifestEntries.get(SOURCE_IDENTITY)!;
  const target3023Entry = manifestEntries.get(TARGET_3023_IDENTITY)!;
  const target35480Entry = manifestEntries.get(TARGET_35480_IDENTITY)!;
  await Promise.all(
    [sourceEntry, target3023Entry, target35480Entry].map((entry) =>
      readBoundManifestCrop(entry, CALLOUT_ROOT, (bytes: Uint8Array) => bytes),
    ),
  );

  const verdict20 = truthArtifact.value.verdicts.find(({ n }: { n: number }) => n === 20);
  const verdict22 = truthArtifact.value.verdicts.find(({ n }: { n: number }) => n === 22);
  if (verdict20 === undefined || verdict22 === undefined) {
    throw new Error("Tracked truth does not contain both exact source-art anchor verdicts.");
  }
  expect(verdict20).toEqual({
    n: 20,
    judgedCropSha256: sourceEntry.sha256,
    elementId: "302326",
    same: true,
  });
  expect(verdict22).toMatchObject({
    n: 22,
    judgedCropSha256: "sha256:f5667a72d63f321c009bf54ae07578680f01f6812da065cc5183d86273205ae8",
    elementId: "6221607",
    same: true,
  });
  expect(elementsArtifact.value["302326"]).toEqual({
    partNum: "3023",
    name: "Plate 1 x 2",
    colorId: "0",
    quantity: 24,
  });
  expect(elementsArtifact.value["6221607"]).toEqual({
    partNum: "35480",
    name: "Plate Special 1 x 2 Rounded with 2 Open Studs",
    colorId: "72",
    quantity: 7,
  });

  const pdfBytes = readBoundedFile(SAMPLE_BOOKLET_PATH, {
    label: "sample booklet",
    maxBytes: 96 * 1024 * 1024,
  });
  const firstMeasurement = await measurePdfSourceArtImages({
    pdfBytes,
    expectedPdfSha256: PDF_SHA256,
    witnesses: IMAGE_WITNESSES,
  });
  const secondMeasurement = await measurePdfSourceArtImages({
    pdfBytes,
    expectedPdfSha256: PDF_SHA256,
    witnesses: IMAGE_WITNESSES,
  });
  expect(secondMeasurement).toEqual(firstMeasurement);
  expect(firstMeasurement).toMatchObject({
    admissionAuthority: "none",
    claim: "embedded-source-art-only",
    observedPdfSha256: PDF_SHA256,
    pdfjsVersion: "5.4.149",
    semanticIdentityClaimed: false,
  });
  expect(firstMeasurement.witnesses).toMatchObject([
    {
      decodedBytes: 5_355,
      decodedPixelSha256: "sha256:947a808863fc4f864e6957a2f4aaf927a442b08cd8ace55b81297db971e6468c",
      width: 51,
      height: 35,
      kind: 2,
      operatorIndex: 22,
      projectedBoundsPxAtScale8: { left: 232, top: 177, right: 425, bottom: 308 },
      transform: [24.23026, 0, 0, 16.29094, 29.00519, 505.74934],
      embeddedSourceArtSha256:
        "sha256:2d34094e6fa953628bd0d5daf61fea3e362db78809c690fc202c24ca7d2f532c",
    },
    {
      decodedBytes: 5_355,
      decodedPixelSha256: "sha256:947a808863fc4f864e6957a2f4aaf927a442b08cd8ace55b81297db971e6468c",
      width: 51,
      height: 35,
      kind: 2,
      operatorIndex: 22,
      projectedBoundsPxAtScale8: { left: 286, top: 346, right: 480, bottom: 476 },
      transform: [24.23026, 0, 0, 16.29094, 35.84491, 484.68932],
      embeddedSourceArtSha256:
        "sha256:2d34094e6fa953628bd0d5daf61fea3e362db78809c690fc202c24ca7d2f532c",
    },
    {
      decodedBytes: 4_128,
      decodedPixelSha256: "sha256:3c127f2802e3fa9ae8be255eb0fc6d58bad91a4e7dabf6b67daa2a5176098236",
      width: 43,
      height: 32,
      kind: 2,
      operatorIndex: 86,
      projectedBoundsPxAtScale8: { left: 990, top: 733, right: 1153, bottom: 852 },
      transform: [20.38833, 0, 0, 14.84803, 123.79984, 437.6908],
      embeddedSourceArtSha256:
        "sha256:72169cac1fe9f77e777792de0a85321a36ee75a1e7c98fe0fe6b124db602d81c",
    },
  ]);

  await page.goto("/");
  const urls = bookletProbeUrls();
  const page18 = await renderCalloutCropsInPage(page, {
    ...urls,
    pageNumber: 18,
    expectedSourceHash: PDF_SHA256,
    targets: PAGE_18_TARGETS,
  });
  const page20 = await renderCalloutCropsInPage(page, {
    ...urls,
    pageNumber: 20,
    expectedSourceHash: PDF_SHA256,
    targets: PAGE_20_TARGETS,
  });
  const rendered = new Map([...page18, ...page20].map((result) => [result.identity, result]));
  const sourceCrop = requiredCrop(rendered.get(SOURCE_IDENTITY)!.ranked, "3023 source crop");
  const target3023Crop = requiredCrop(
    rendered.get(TARGET_3023_IDENTITY)!.ranked,
    "3023 target crop",
  );
  const legacy35480Crop = requiredCrop(
    rendered.get(TARGET_35480_IDENTITY)!.legacy,
    "35480 legacy crop",
  );
  const current35480Crop = requiredCrop(
    rendered.get(TARGET_35480_IDENTITY)!.ranked,
    "35480 current crop",
  );
  const sourcePng = pngBytes(sourceCrop.url, "3023 source crop");
  const target3023Png = pngBytes(target3023Crop.url, "3023 target crop");
  const legacy35480Png = pngBytes(legacy35480Crop.url, "35480 legacy crop");
  const current35480Png = pngBytes(current35480Crop.url, "35480 current crop");
  const cropAttachments = [
    { name: "3023-step14-source.png", body: sourcePng, sha256: sha256(sourcePng) },
    { name: "3023-step16-target.png", body: target3023Png, sha256: sha256(target3023Png) },
    { name: "35480-step16-legacy.png", body: legacy35480Png, sha256: sha256(legacy35480Png) },
    { name: "35480-step16-current.png", body: current35480Png, sha256: sha256(current35480Png) },
  ] as const;
  expect(cropAttachments.map(({ sha256: digest }) => digest)).toEqual([
    sourceEntry.sha256,
    target3023Entry.sha256,
    verdict22.judgedCropSha256,
    target35480Entry.sha256,
  ]);
  const binding = bindCalloutSourceArtMeasurement({
    rows: SOURCE_ART_ROWS,
    measurement: firstMeasurement,
    manifestCallouts: [sourceEntry, target3023Entry, target35480Entry],
    renderedCrops: [
      { identity: SOURCE_IDENTITY, sha256: sha256(sourcePng), crop: sourceCrop },
      { identity: TARGET_3023_IDENTITY, sha256: sha256(target3023Png), crop: target3023Crop },
      { identity: TARGET_35480_IDENTITY, sha256: sha256(current35480Png), crop: current35480Crop },
    ],
  });
  expect(binding).toMatchObject({
    admissionAuthority: "none",
    coverageTrustGranted: false,
    semanticIdentityClaimed: false,
  });

  const legacyCanonical = canonicalizeCalloutPng(legacy35480Png, "35480 legacy crop");
  const currentCanonical = canonicalizeCalloutPng(current35480Png, "35480 current crop");
  const canonicalSummary = (value: typeof legacyCanonical) => ({
    backgroundRgba: value.backgroundRgba,
    boundsHalfOpen: value.boundsHalfOpen,
    canonicalHeight: value.canonicalHeight,
    canonicalRgbaSha256: value.canonicalRgbaSha256,
    canonicalWidth: value.canonicalWidth,
    framedSha256: value.framedSha256,
  });
  expect(canonicalSummary(legacyCanonical)).toEqual(canonicalSummary(currentCanonical));
  expect({
    legacy: [legacyCanonical.originalWidth, legacyCanonical.originalHeight],
    current: [currentCanonical.originalWidth, currentCanonical.originalHeight],
  }).toEqual({ legacy: [165, 122], current: [165, 118] });
  expect(canonicalSummary(currentCanonical)).toEqual({
    backgroundRgba: [140, 148, 148, 255],
    boundsHalfOpen: { left: 5, top: 5, right: 160, bottom: 113 },
    canonicalHeight: 108,
    canonicalRgbaSha256: "sha256:e5809c58b9b26e73e407b37950eab09415db49a16c34ee07f3cbd5beb6b060d0",
    canonicalWidth: 155,
    framedSha256: "sha256:773195db76206514426028e82f24049ab5152fa53cfd04ba20017dda9926ed31",
  });
  const recut = measureExactBottomBackgroundRecut(
    decodeCanonicalCardRgba(legacy35480Png, "35480 legacy crop"),
    decodeCanonicalCardRgba(current35480Png, "35480 current crop"),
    "35480 exact browser recut",
  );
  expect(recut).toEqual({
    backgroundRgba: [140, 148, 148, 255],
    currentPrefixBytes: 77_880,
    currentPrefixSha256: "sha256:00828fd2c91bcdede6a20749b204f92adc4426f60e28b04b11b9c75bc37d09b2",
    removedBytes: 2_640,
    removedRows: 4,
    removedRgbaSha256: "sha256:e0a18bc57c96816e6e10dd970a34f1fef56dadeeb67c877fd819addf011b7d59",
  });

  for (const { name, body } of cropAttachments)
    await testInfo.attach(name, { body, contentType: "image/png" });
  await testInfo.attach("step16-source-art-proof.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          admissionAuthority: "none",
          semanticIdentityClaimed: false,
          coverageTrustGranted: false,
          inputDigests: {
            pdf: PDF_SHA256,
            manifest: MANIFEST_SHA256,
            features: FEATURES_SHA256,
            truth: TRUTH_SHA256,
            elementResolution: ELEMENTS_SHA256,
          },
          binding,
          cropAttachments: cropAttachments.map(({ name, sha256: digest }) => ({
            name,
            sha256: digest,
          })),
          canonical35480: {
            legacy: canonicalSummary(legacyCanonical),
            current: canonicalSummary(currentCanonical),
          },
          measurement: firstMeasurement,
          recut,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});

import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  readRealBuildPrefix50Step44ReviewArtifact,
  sha256RealBuildPrefix50Step44ReviewBytes,
} from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { runRealBuildPrefix50Step44Poppler } from "./real-build-prefix50-subbuild-return-review-poppler.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
  type RealBuildPrefix50Step44RealDomainSourceCaseSpec,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "./real-build-prefix50-source-pdf-pins.ts";
import type { RealBuildPrefix50Step44HeldOutUnlockCapability } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";

const MAXIMUM_CROP_BYTES = 8 * 1024 * 1024;
const MAXIMUM_CROP_PIXELS = 1_000_000;
const HELD_OUT_READ_REQUEST_COMMITMENT =
  "sha256:0c1025269fb589ef96c33341f9bd859db45cfe184e3867fc2de6de9bd3c35028";
const heldOutReadGate = new WeakSet<object>();

export interface RealBuildPrefix50Step44PdfCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function temporaryCropDirectory(): string {
  const root = realpathSync(tmpdir());
  const created = realpathSync(mkdtempSync(join(root, "lego-step44-pdf-crop-")));
  const local = relative(root, created);
  if (local.length === 0 || local.startsWith("..")) {
    rmSync(created, { recursive: true, force: true });
    throw new TypeError("Bounded Step-44 PDF crop directory escaped the OS temporary root.");
  }
  return created;
}

function requireCrop(crop: RealBuildPrefix50Step44PdfCrop): void {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (
    !values.every(Number.isSafeInteger) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.width * crop.height > MAXIMUM_CROP_PIXELS
  )
    throw new RangeError(
      `Bounded Step-44 PDF crop must be a non-negative integer origin with 1..${MAXIMUM_CROP_PIXELS} pixels.`,
    );
}

type PdfReadAuthorization =
  | Readonly<{
      kind: "sealed-calibration";
      spec: RealBuildPrefix50Step44RealDomainSourceCaseSpec;
    }>
  | Readonly<{
      kind: "held-out-one-shot";
      capability: RealBuildPrefix50Step44HeldOutUnlockCapability;
    }>;

function requestCommitment(input: {
  readonly sourcePdfArtifactPath: string;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly maximumSourceBytes: number;
  readonly pageNumber: 44;
  readonly densityDpi: number;
  readonly crop: RealBuildPrefix50Step44PdfCrop;
}): `sha256:${string}` {
  return canonicalDigest({
    sourcePdfArtifactPath: input.sourcePdfArtifactPath,
    maximumSourceBytes: input.maximumSourceBytes,
    pageNumber: input.pageNumber,
    densityDpi: input.densityDpi,
    crop: {
      x: input.crop.x,
      y: input.crop.y,
      width: input.crop.width,
      height: input.crop.height,
    },
  });
}

async function requireReadAuthorization(
  input: {
    readonly sourcePdfArtifactPath: string;
    readonly sourcePdfDigest: `sha256:${string}`;
    readonly maximumSourceBytes: number;
    readonly pageNumber: 44;
    readonly densityDpi: number;
    readonly crop: RealBuildPrefix50Step44PdfCrop;
  },
  authorization: PdfReadAuthorization,
): Promise<void> {
  if (authorization.kind === "sealed-calibration") {
    const sealed = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.find(
      ({ panelStep }) => panelStep === authorization.spec.panelStep,
    );
    if (
      sealed === undefined ||
      canonicalDigest(authorization.spec) !== canonicalDigest(sealed) ||
      input.sourcePdfArtifactPath !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH ||
      input.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST ||
      input.maximumSourceBytes !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES ||
      input.pageNumber !== 44 ||
      input.densityDpi !== REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi ||
      canonicalDigest(input.crop) !== canonicalDigest(sealed.crop)
    )
      throw new TypeError(
        "Lowest-level source PDF read admits only the exact sealed Step-41/42 calibration request before unlock.",
      );
    return;
  }
  if (input.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST)
    throw new TypeError("Lowest-level held-out source PDF read requires the pinned PDF digest.");
  if (requestCommitment(input) !== HELD_OUT_READ_REQUEST_COMMITMENT)
    throw new TypeError(
      "Lowest-level held-out source PDF read admits only the exact sealed Step-43 request.",
    );
  const session =
    await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts");
  const capability = session.requireRealBuildPrefix50Step44HeldOutUnlockCapability(
    authorization.capability,
  );
  if (heldOutReadGate.has(capability))
    throw new TypeError(
      "This held-out unlock capability has already attempted its one permitted Step-43 PDF read.",
    );
  heldOutReadGate.add(capability);
}

export async function rerenderRealBuildPrefix50Step44PdfCrop(input: {
  readonly repositoryRoot: string;
  readonly sourcePdfArtifactPath: string;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly maximumSourceBytes: number;
  readonly pageNumber: 44;
  readonly densityDpi: number;
  readonly crop: RealBuildPrefix50Step44PdfCrop;
  readonly label: string;
  readonly authorization: PdfReadAuthorization;
}): Promise<
  Readonly<{
    rendererVersion: string;
    popplerToolchainCommitment: `sha256:${string}`;
    pngDigest: `sha256:${string}`;
    pixelDigest: `sha256:${string}`;
    width: number;
    height: number;
    rgba: Uint8Array;
  }>
> {
  if (input.pageNumber !== 44)
    throw new RangeError("Bounded Step-44 source raster may read only physical page 44.");
  if (!Number.isSafeInteger(input.densityDpi) || input.densityDpi < 1 || input.densityDpi > 600)
    throw new RangeError("Bounded Step-44 PDF crop density must be an integer from 1 through 600.");
  requireCrop(input.crop);
  await requireReadAuthorization(input, input.authorization);
  const sourceBytes = readRealBuildPrefix50Step44ReviewArtifact(
    input.repositoryRoot,
    input.sourcePdfArtifactPath,
    input.maximumSourceBytes,
    `${input.label} source PDF`,
    input.sourcePdfDigest,
  );
  const directory = temporaryCropDirectory();
  let popplerQuiescent = false;
  try {
    const outputPrefix = join(directory, "physical-page44-bounded-crop");
    const { x, y, width, height } = input.crop;
    const poppler = runRealBuildPrefix50Step44Poppler({
      sourceBytes,
      label: `${input.label} Poppler crop`,
      arguments: [
        "-f",
        "44",
        "-l",
        "44",
        "-r",
        String(input.densityDpi),
        "-x",
        String(x),
        "-y",
        String(y),
        "-W",
        String(width),
        "-H",
        String(height),
        "-png",
        "-singlefile",
        "-",
        outputPrefix,
      ],
    });
    popplerQuiescent = true;
    const outputPath = `${outputPrefix}.png`;
    const stats = lstatSync(outputPath);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size < 1 ||
      stats.size > MAXIMUM_CROP_BYTES
    )
      throw new RangeError(
        `${input.label} output must be a regular 1..${MAXIMUM_CROP_BYTES}-byte crop PNG.`,
      );
    const pngBytes = readFileSync(outputPath);
    const decoded = decodeRealBuildPrefix50Step44ReviewPng(
      pngBytes,
      width * height,
      `${input.label} bounded Poppler crop`,
    );
    if (decoded.width !== width || decoded.height !== height)
      throw new TypeError(
        `${input.label} crop is ${decoded.width}x${decoded.height}, not ${width}x${height}.`,
      );
    return Object.freeze({
      rendererVersion: poppler.version,
      popplerToolchainCommitment: poppler.toolchainCommitment,
      pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(pngBytes),
      pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(decoded.rgba),
      width: decoded.width,
      height: decoded.height,
      rgba: decoded.rgba,
    });
  } finally {
    // A failed wrapper return does not establish that its child released this directory.
    if (popplerQuiescent) rmSync(directory, { recursive: true, force: true });
  }
}

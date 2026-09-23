import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import {
  CANONICAL_CAPTURE_POLICY,
  CANONICAL_CAPTURE_POLICY_HASH,
  CANONICAL_VIEW_NAMES,
} from "@lego-studio/rendering";
import { validateValidationReportV1 } from "@lego-studio/protocol";

import type { RealBuildPrefix50Step44CaptureManifestV3 } from "./real-build-prefix50-subbuild-return-review-artifact-contract.ts";

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function finiteTuple(value: readonly number[], label: string): void {
  if (value.length !== 3 || value.some((component) => !Number.isFinite(component)))
    throw new TypeError(`${label} must be one exact finite three-number tuple.`);
}

export function requireRealBuildPrefix50Step44ProductionCaptureContract(input: {
  readonly manifest: RealBuildPrefix50Step44CaptureManifestV3;
  readonly expectedInputBytesHash: `sha256:${string}`;
  readonly selectedDocumentHash: `sha256:${string}`;
}): void {
  const { manifest } = input;
  const packet = manifest.viewPacket;
  exactKeys(
    packet,
    [
      "bounds",
      "cameraPolicyVersion",
      "coordinateSystem",
      "documentHash",
      "rendererVersion",
      "schemaVersion",
      "sourceCoordinateSystem",
      "threeUnitsPerLdu",
      "usedFallbackBounds",
      "views",
    ],
    "Step-44 production view packet",
  );
  exactKeys(packet.bounds, ["max", "min"], "Step-44 production view-packet bounds");
  finiteTuple(packet.bounds.min, "Step-44 production view-packet minimum");
  finiteTuple(packet.bounds.max, "Step-44 production view-packet maximum");
  if (
    packet.views.length !== CANONICAL_VIEW_NAMES.length ||
    packet.views.some(({ name }, index) => name !== CANONICAL_VIEW_NAMES[index])
  )
    throw new TypeError(
      "Step-44 production view packet must retain the exact ordered view roster.",
    );
  for (const view of packet.views) {
    exactKeys(
      view,
      [
        "far",
        "frameRadius",
        "name",
        "near",
        "position",
        "projection",
        "target",
        "up",
        "verticalFovDegrees",
      ],
      `Step-44 production ${view.name} view`,
    );
    finiteTuple(view.position, `Step-44 production ${view.name} position`);
    finiteTuple(view.target, `Step-44 production ${view.name} target`);
    finiteTuple(view.up, `Step-44 production ${view.name} up`);
    if (
      !Number.isFinite(view.near) ||
      !Number.isFinite(view.far) ||
      !Number.isFinite(view.frameRadius) ||
      view.near <= 0 ||
      view.far <= view.near ||
      view.frameRadius <= 0 ||
      (view.projection === "perspective") !== (view.verticalFovDegrees !== null) ||
      (view.verticalFovDegrees !== null && !Number.isFinite(view.verticalFovDegrees))
    )
      throw new TypeError(`Step-44 production ${view.name} view has invalid camera numbers.`);
  }
  exactKeys(
    manifest.renderPacket,
    [
      "authority",
      "capturePolicyHash",
      "capturesCommitment",
      "commitment",
      "documentHash",
      "rendererSnapshot",
      "rendererSnapshotCommitment",
      "schemaVersion",
      "validationReport",
      "validationReportCommitment",
      "viewPacketCommitment",
    ],
    "Step-44 production render packet",
  );
  exactKeys(
    manifest.renderPacket.rendererSnapshot,
    ["contextLost", "rendererMemory", "viewPacket"],
    "Step-44 production renderer snapshot",
  );
  const renderer = manifest.renderPacket.rendererSnapshot as {
    readonly contextLost: unknown;
    readonly rendererMemory: unknown;
    readonly viewPacket: unknown;
  };
  exactKeys(
    renderer.rendererMemory,
    ["geometries", "textures"],
    "Step-44 production renderer memory",
  );
  const memory = renderer.rendererMemory as {
    readonly geometries: unknown;
    readonly textures: unknown;
  };
  if (
    manifest.sourceSetId !== "6651557" ||
    manifest.partCount !== 280 ||
    manifest.buildStepCount !== 43 ||
    manifest.inputBytesHash !== input.expectedInputBytesHash ||
    manifest.canonicalCapturePolicy !== CANONICAL_CAPTURE_POLICY.version ||
    manifest.canonicalCapturePolicyHash !== CANONICAL_CAPTURE_POLICY_HASH ||
    manifest.browserVersion.trim().length === 0 ||
    manifest.userAgent.trim().length === 0 ||
    packet.schemaVersion !== "lego.canonical-view-packet/1" ||
    packet.rendererVersion !== "lego.rendering/1" ||
    packet.cameraPolicyVersion !== "lego.canonical-cameras/1" ||
    packet.documentHash !== input.selectedDocumentHash ||
    packet.coordinateSystem !== "three-plus-y-up" ||
    packet.sourceCoordinateSystem !== "ldu-minus-y-up" ||
    packet.threeUnitsPerLdu !== 0.04 ||
    packet.usedFallbackBounds !== false ||
    manifest.viewPacketCommitment !== canonicalDigest(packet) ||
    manifest.renderPacket.schemaVersion !== "lego.real-build-prefix50-step44-render-packet/1" ||
    manifest.renderPacket.authority !== "none" ||
    manifest.renderPacket.documentHash !== input.selectedDocumentHash ||
    !validateValidationReportV1(manifest.renderPacket.validationReport) ||
    manifest.renderPacket.validationReport.targetDocumentHash !== input.selectedDocumentHash ||
    manifest.renderPacket.validationReport.documentGloballyValid !== true ||
    manifest.renderPacket.validationReportCommitment !==
      canonicalDigest(manifest.renderPacket.validationReport) ||
    renderer.contextLost !== false ||
    !Number.isSafeInteger(memory.geometries) ||
    Number(memory.geometries) < 0 ||
    !Number.isSafeInteger(memory.textures) ||
    Number(memory.textures) < 0 ||
    canonicalStringify(renderer.viewPacket) !== canonicalStringify(packet) ||
    manifest.renderPacket.rendererSnapshotCommitment !== canonicalDigest(renderer) ||
    manifest.renderPacket.capturePolicyHash !== CANONICAL_CAPTURE_POLICY_HASH ||
    manifest.renderPacket.viewPacketCommitment !== manifest.viewPacketCommitment ||
    manifest.renderPacket.capturesCommitment !== canonicalDigest(manifest.captures) ||
    manifest.renderPacketCommitment !== manifest.renderPacket.commitment
  )
    throw new TypeError(
      "Step-44 production capture manifest source, view packet, or render packet drifted.",
    );
}

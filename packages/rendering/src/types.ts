import type { BrickDocumentV1, ValidationReportV1 } from "@lego-studio/protocol";
import type { MeshAssetResolutionErrorCode } from "@lego-studio/catalog";
import type { Box3, Camera, Group } from "three";

import type { PartMaterialCache } from "./material-cache.ts";

export type RenderDiagnosticCode =
  | "DUPLICATE_PART_ID"
  | "MALFORMED_VALIDATION_REPORT"
  | "STALE_VALIDATION_REPORT"
  | "UNKNOWN_CATALOG_PART"
  | "UNKNOWN_COLOR"
  | "UNKNOWN_ORIENTATION"
  | "VALIDATION_REPORT_MISMATCH"
  | MeshAssetResolutionErrorCode;

export interface RenderDiagnostic {
  readonly code: RenderDiagnosticCode;
  readonly message: string;
  readonly partId: string | null;
}

export interface DeriveBrickSceneOptions {
  readonly selectedPartIds?: readonly string[];
  readonly validationReport?: ValidationReportV1;
  readonly includeStuds?: boolean;
  /**
   * "flat" is the deterministic finish canonical captures are pinned to, and is
   * the default. "presentation" bevels edges and uses a clearcoat material for
   * display only; evaluation renders must never ask for it. "instruction"
   * imitates printed booklet art so a render can be compared against one.
   */
  readonly finish?: BrickFinish;
  /**
   * Shared part materials that outlive this scene. Supplying one makes the
   * derived scene a borrower: `dispose()` frees its geometry and its own
   * overlays but leaves the cache's materials — and therefore their compiled GL
   * programs — alive for the next derivation. Omit it and the scene owns every
   * material it makes, which is what a one-shot capture wants.
   */
  readonly materialCache?: PartMaterialCache;
}

export type BrickFinish = "flat" | "presentation" | "instruction";

export interface DerivedBrickScene {
  readonly schemaVersion: "lego.derived-brick-scene/1";
  readonly root: Group;
  readonly partObjects: ReadonlyMap<string, Group>;
  readonly bounds: Box3;
  readonly documentHash: string;
  readonly validationReport: ValidationReportV1;
  readonly diagnostics: readonly RenderDiagnostic[];
  /**
   * The shared material store this scene borrowed from, if any. Carried on the
   * scene so a later mutation of it — a selection change — retires and rebuilds
   * overlays under the same borrowing rule the derivation used.
   */
  readonly materialCache: PartMaterialCache | undefined;
  readonly disposed: boolean;
  dispose(): void;
}

export type CanonicalViewName =
  "isometric" | "front" | "back" | "left" | "right" | "top" | "underside";

export interface CanonicalViewDefinition {
  readonly name: CanonicalViewName;
  readonly projection: "perspective" | "orthographic";
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly near: number;
  readonly far: number;
  readonly frameRadius: number;
  readonly verticalFovDegrees: number | null;
}

export interface CanonicalViewPacket {
  readonly schemaVersion: "lego.canonical-view-packet/1";
  readonly rendererVersion: "lego.rendering/1";
  readonly cameraPolicyVersion: "lego.canonical-cameras/1";
  readonly documentHash: string;
  readonly coordinateSystem: "three-plus-y-up";
  readonly sourceCoordinateSystem: "ldu-minus-y-up";
  readonly threeUnitsPerLdu: number;
  readonly bounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly usedFallbackBounds: boolean;
  readonly views: readonly CanonicalViewDefinition[];
}

export interface CanonicalViewPacketOptions {
  readonly padding?: number;
  readonly perspectiveFovDegrees?: number;
}

export type CanonicalCamera = Camera;

export type BrickDocument = BrickDocumentV1;

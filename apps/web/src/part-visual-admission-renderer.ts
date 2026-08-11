import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  MESH_ASSET_LIMITS,
  createPreloadedMeshAssetResolver,
  getCatalogSnapshotDigestInput,
  getPartDefinition,
  resolvePreloadedMeshAsset,
  type PartDefinition,
  type PreloadedMeshAsset,
} from "@lego-studio/catalog";
import {
  PART_VISUAL_ADMISSION_CAPTURE_POLICY,
  PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
  PART_VISUAL_ADMISSION_VIEW_NAMES,
  PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
  createCatalogPartGeometry,
  createPartVisualAdmissionCameraPacket,
  ldrawAssetToCatalogThreeMatrix,
  type PartVisualAdmissionBounds,
  type PartVisualAdmissionCameraPacket,
  type RenderDiagnostic,
} from "@lego-studio/rendering";
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  FrontSide,
  GridHelper,
  Line,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  REVISION,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type BufferGeometry,
  type Group,
  type Material,
  type Object3D,
} from "three";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";
import { LDrawLoader } from "three/addons/loaders/LDrawLoader.js";

import {
  capturePartVisualAdmissionView,
  comparePartVisualAdmissionView,
  type PartVisualAdmissionCaptureTransport,
  type PartVisualAdmissionViewMetric,
  type RawPartVisualAdmissionCapture,
} from "./part-visual-admission-pixels.ts";

export type {
  PartVisualAdmissionCaptureTransport,
  PartVisualAdmissionViewMetric,
} from "./part-visual-admission-pixels.ts";

export interface PartVisualAdmissionCaptureInput {
  readonly source: {
    readonly libraryUrl: string;
    readonly rootPath: string;
    readonly materializedClosureDigest: `sha256:${string}`;
  };
  readonly candidate:
    | { readonly kind: "builtin"; readonly catalogPartId: string }
    | {
        readonly kind: "synthetic";
        readonly catalogId: string;
        readonly definition: PartDefinition;
        readonly meshAsset: PreloadedMeshAsset;
      };
}

export interface PartVisualAdmissionCaptureResult {
  readonly schemaVersion: "lego.part-visual-admission-browser-capture/1";
  readonly sourceClosureDigest: `sha256:${string}`;
  readonly catalogId: string;
  readonly catalogHash: `sha256:${string}`;
  readonly definitionHash: `sha256:${string}`;
  readonly meshHash: `sha256:${string}`;
  readonly frameHash: `sha256:${string}`;
  readonly viewPolicyHash: `sha256:${string}`;
  readonly capturePolicyHash: `sha256:${string}`;
  readonly cameraPacket: PartVisualAdmissionCameraPacket;
  readonly cameraPacketHash: `sha256:${string}`;
  readonly sourceBounds: PartVisualAdmissionBounds;
  readonly candidateBounds: PartVisualAdmissionBounds;
  readonly captures: readonly PartVisualAdmissionCaptureTransport[];
  readonly metrics: readonly PartVisualAdmissionViewMetric[];
  readonly diagnostics: readonly RenderDiagnostic[];
  readonly sceneAudit: {
    readonly gridHelpers: number;
    readonly shadowCasters: number;
    readonly shadowReceivers: number;
    readonly selectionObjects: number;
    readonly hiddenSourceLines: number;
    readonly sharedMaterialInstances: number;
    readonly primaryMaterialSide: "FrontSide";
  };
  readonly rendererBuild: Record<string, string | number | boolean>;
  readonly rendererBuildHash: `sha256:${string}`;
  readonly cleanup: {
    readonly geometriesDisposed: number;
    readonly materialsDisposed: number;
    readonly rendererDisposed: boolean;
    readonly contextLossRequested: boolean;
    readonly canvasRemoved: boolean;
    readonly canvasesRemaining: number;
  };
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ROOT_PATH_PATTERN = /^(?:parts|p)\/[a-z0-9][a-z0-9._/-]{0,255}$/u;

function requireSource(input: PartVisualAdmissionCaptureInput["source"]): void {
  if (!DIGEST_PATTERN.test(input.materializedClosureDigest)) {
    throw new TypeError(
      `Visual-admission source closure digest must be lowercase SHA-256; received ${JSON.stringify(input.materializedClosureDigest)}.`,
    );
  }
  if (!ROOT_PATH_PATTERN.test(input.rootPath) || input.rootPath.includes("..")) {
    throw new TypeError(
      `Visual-admission LDraw root must be a contained parts/ or p/ path; received ${JSON.stringify(input.rootPath)}.`,
    );
  }
  const url = new URL(input.libraryUrl, window.location.origin);
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith("/@fs/") ||
    !url.pathname.endsWith("/") ||
    url.search !== "" ||
    url.hash !== "" ||
    decodeURIComponent(url.pathname).split("/").includes("..")
  ) {
    throw new TypeError(
      `Visual-admission source library must be one same-origin, contained Vite /@fs/ directory URL; received ${JSON.stringify(input.libraryUrl)}.`,
    );
  }
}

function candidate(input: PartVisualAdmissionCaptureInput["candidate"]): {
  readonly catalogId: string;
  readonly catalogHash: `sha256:${string}`;
  readonly definition: PartDefinition;
  readonly resolver: typeof resolvePreloadedMeshAsset;
} {
  if (input.kind === "builtin") {
    const definition = getPartDefinition(input.catalogPartId);
    if (definition === undefined) {
      throw new TypeError(
        `Visual admission cannot resolve builtin catalog part ${JSON.stringify(input.catalogPartId)}.`,
      );
    }
    return {
      catalogId: definition.id,
      catalogHash: canonicalDigest(getCatalogSnapshotDigestInput()),
      definition,
      resolver: resolvePreloadedMeshAsset,
    };
  }
  const syntheticGeometry = input.definition.geometry;
  if (
    input.definition.id !== input.catalogId ||
    syntheticGeometry.generatorId !== "builtin:preloaded-mesh-reference/1" ||
    input.meshAsset.assetId !== syntheticGeometry.assetId
  ) {
    throw new TypeError(
      `Synthetic visual-admission candidate ids disagree: catalog ${JSON.stringify(input.catalogId)}, definition ${JSON.stringify(input.definition.id)}, asset ${JSON.stringify(input.meshAsset.assetId)}.`,
    );
  }
  return {
    catalogId: input.catalogId,
    catalogHash: canonicalDigest({
      schemaVersion: "lego.synthetic-visual-admission-catalog/1",
      definition: input.definition,
      meshAsset: input.meshAsset,
    }),
    definition: input.definition,
    resolver: createPreloadedMeshAssetResolver(
      { [input.meshAsset.assetId]: input.meshAsset },
      { maxAssets: 1, maxResolvedCacheEntries: 1, maxTotalBytes: MESH_ASSET_LIMITS.maxTotalBytes },
    ),
  };
}

function exactMeshDefinition(definition: PartDefinition) {
  if (definition.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
    throw new TypeError(
      `Visual admission compares an exact LDraw source only to a production mesh-reference candidate; ${definition.id} uses ${definition.geometry.generatorId}.`,
    );
  }
  return definition.geometry;
}

function replaceSurfaceMaterials(
  root: Object3D,
  shared: MeshStandardMaterial,
): {
  readonly retiredMaterials: Set<Material>;
  readonly hiddenLines: number;
} {
  const retiredMaterials = new Set<Material>();
  let hiddenLines = 0;
  root.traverse((object) => {
    if (object instanceof Line || object instanceof LineSegments) {
      object.visible = false;
      hiddenLines += 1;
    }
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      retiredMaterials.add(material);
    }
    object.material = shared;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return { retiredMaterials, hiddenLines };
}

function disposeTree(root: Object3D, geometries: Set<BufferGeometry>): void {
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line || object instanceof LineSegments) {
      geometries.add(object.geometry);
    }
  });
}

export async function runPartVisualAdmissionCapture(
  input: PartVisualAdmissionCaptureInput,
): Promise<PartVisualAdmissionCaptureResult> {
  requireSource(input.source);
  const resolved = candidate(input.candidate);
  const recipe = exactMeshDefinition(resolved.definition);
  const cleanup = {
    geometriesDisposed: 0,
    materialsDisposed: 0,
    rendererDisposed: false,
    contextLossRequested: false,
    canvasRemoved: false,
    canvasesRemaining: -1,
  };
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  let sourceGroup: Group | null = null;
  let candidateGroup: Group | null = null;
  let renderer: WebGLRenderer | null = null;
  let result: Omit<PartVisualAdmissionCaptureResult, "cleanup"> | undefined;
  try {
    const loader = new LDrawLoader();
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    loader.setPartsLibraryPath(input.source.libraryUrl);
    loader.setPath(input.source.libraryUrl);
    sourceGroup = await loader.loadAsync(input.source.rootPath);
    sourceGroup.applyMatrix4(ldrawAssetToCatalogThreeMatrix(recipe.assetToCatalogFrame));
    sourceGroup.updateMatrixWorld(true);

    const diagnostics: RenderDiagnostic[] = [];
    candidateGroup = createCatalogPartGeometry(
      {
        id: "part-visual-admission-candidate",
        catalogPartId: resolved.catalogId,
        colorId: "builtin:light-bluish-gray",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: [],
        provenance: { source: "manual" },
      },
      resolved.definition,
      true,
      diagnostics,
      "flat",
      resolved.resolver,
    );
    candidateGroup.updateMatrixWorld(true);
    if (diagnostics.length > 0 || candidateGroup.userData.placeholder === true) {
      throw new Error(
        `Production candidate geometry for ${resolved.catalogId} emitted ${diagnostics.length} diagnostics and placeholder=${String(candidateGroup.userData.placeholder)}: ${diagnostics.map(({ code, message }) => `${code}: ${message}`).join("; ")}.`,
      );
    }

    const sourceBounds = new Box3().setFromObject(sourceGroup, true);
    const candidateBounds = new Box3().setFromObject(candidateGroup, true);
    const cameraPacket = createPartVisualAdmissionCameraPacket(sourceBounds, candidateBounds);
    const sharedMaterial = new MeshStandardMaterial({
      color: PART_VISUAL_ADMISSION_CAPTURE_POLICY.material.color,
      roughness: PART_VISUAL_ADMISSION_CAPTURE_POLICY.material.roughness,
      metalness: PART_VISUAL_ADMISSION_CAPTURE_POLICY.material.metalness,
      side: FrontSide,
    });
    materials.add(sharedMaterial);
    const sourceReplacement = replaceSurfaceMaterials(sourceGroup, sharedMaterial);
    const candidateReplacement = replaceSurfaceMaterials(candidateGroup, sharedMaterial);
    for (const material of sourceReplacement.retiredMaterials) materials.add(material);
    for (const material of candidateReplacement.retiredMaterials) materials.add(material);

    const scene = new Scene();
    scene.background = null;
    scene.add(sourceGroup, candidateGroup);
    for (const light of PART_VISUAL_ADMISSION_CAPTURE_POLICY.lights) {
      if (light.kind === "AmbientLight") {
        scene.add(new AmbientLight(light.color, light.intensity));
      } else {
        const directional = new DirectionalLight(light.color, light.intensity);
        directional.position.fromArray(light.position);
        directional.castShadow = false;
        scene.add(directional);
      }
    }
    renderer = new WebGLRenderer({
      antialias: PART_VISUAL_ADMISSION_CAPTURE_POLICY.renderer.antialias,
      alpha: PART_VISUAL_ADMISSION_CAPTURE_POLICY.renderer.alpha,
      preserveDrawingBuffer: PART_VISUAL_ADMISSION_CAPTURE_POLICY.renderer.preserveDrawingBuffer,
    });
    renderer.setPixelRatio(PART_VISUAL_ADMISSION_CAPTURE_POLICY.devicePixelRatio);
    renderer.setSize(
      PART_VISUAL_ADMISSION_CAPTURE_POLICY.width,
      PART_VISUAL_ADMISSION_CAPTURE_POLICY.height,
      false,
    );
    renderer.setClearColor(0xffffff, 1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.shadowMap.enabled = false;
    document.body.append(renderer.domElement);

    const context = renderer.getContext();
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    const rendererBuild = {
      threeRevision: REVISION,
      webglVersion: String(context.getParameter(context.VERSION)),
      shadingLanguageVersion: String(context.getParameter(context.SHADING_LANGUAGE_VERSION)),
      vendor: String(context.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR)),
      renderer: String(context.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER)),
      maxTextureSize: Number(context.getParameter(context.MAX_TEXTURE_SIZE)),
      antialias: Boolean(context.getContextAttributes()?.antialias),
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };

    const rawSource: RawPartVisualAdmissionCapture[] = [];
    const rawCandidate: RawPartVisualAdmissionCapture[] = [];
    sourceGroup.visible = true;
    candidateGroup.visible = false;
    for (const view of cameraPacket.views) {
      rawSource.push(capturePartVisualAdmissionView(renderer, scene, "source", view));
    }
    sourceGroup.visible = false;
    candidateGroup.visible = true;
    for (const view of cameraPacket.views) {
      rawCandidate.push(capturePartVisualAdmissionView(renderer, scene, "candidate", view));
    }
    const metrics = PART_VISUAL_ADMISSION_VIEW_NAMES.map((viewName, index) =>
      comparePartVisualAdmissionView(viewName, rawSource[index]!.rgba, rawCandidate[index]!.rgba),
    );
    const sceneObjects: Object3D[] = [];
    scene.traverse((object) => sceneObjects.push(object));
    result = {
      schemaVersion: "lego.part-visual-admission-browser-capture/1",
      sourceClosureDigest: input.source.materializedClosureDigest,
      catalogId: resolved.catalogId,
      catalogHash: resolved.catalogHash,
      definitionHash: canonicalDigest(resolved.definition),
      meshHash: recipe.contentHash,
      frameHash: canonicalDigest(recipe.assetToCatalogFrame),
      viewPolicyHash: PART_VISUAL_ADMISSION_VIEW_POLICY_HASH,
      capturePolicyHash: PART_VISUAL_ADMISSION_CAPTURE_POLICY_HASH,
      cameraPacket,
      cameraPacketHash: canonicalDigest(cameraPacket),
      sourceBounds: cameraPacket.sourceBounds,
      candidateBounds: cameraPacket.candidateBounds,
      captures: [...rawSource, ...rawCandidate].map(({ transport }) => transport),
      metrics,
      diagnostics,
      sceneAudit: {
        gridHelpers: sceneObjects.filter((object) => object instanceof GridHelper).length,
        shadowCasters: sceneObjects.filter((object) => object.castShadow).length,
        shadowReceivers: sceneObjects.filter((object) => object.receiveShadow).length,
        selectionObjects: sceneObjects.filter((object) =>
          String(object.userData.renderRole ?? "").includes("selection"),
        ).length,
        hiddenSourceLines: sourceReplacement.hiddenLines,
        primaryMaterialSide: "FrontSide",
        sharedMaterialInstances: new Set(
          sceneObjects
            .filter((object): object is Mesh => object instanceof Mesh)
            .map((object) => object.material),
        ).size,
      },
      rendererBuild,
      rendererBuildHash: canonicalDigest(rendererBuild),
    };
  } finally {
    if (sourceGroup !== null) disposeTree(sourceGroup, geometries);
    if (candidateGroup !== null) disposeTree(candidateGroup, geometries);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    cleanup.geometriesDisposed = geometries.size;
    cleanup.materialsDisposed = materials.size;
    if (renderer !== null) {
      renderer.renderLists.dispose();
      renderer.dispose();
      cleanup.rendererDisposed = true;
      renderer.forceContextLoss();
      cleanup.contextLossRequested = true;
      renderer.domElement.remove();
      cleanup.canvasRemoved = !renderer.domElement.isConnected;
    }
    cleanup.canvasesRemaining = document.querySelectorAll("canvas").length;
  }
  if (result === undefined) throw new Error("Visual-admission capture produced no result.");
  return { ...result, cleanup };
}

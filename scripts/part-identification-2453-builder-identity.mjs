import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  BUILDER_2453_IDENTITY_AUTHORITY,
  BUILDER_2453_IDENTITY_ROUTE,
  BUILDER_2453_IDENTITY_SCHEMA,
  CURRENT_BUILDER_2453_IDENTITY_PINS,
} from "./part-identification-2453-builder-identity-source.mjs";
import {
  assertNativePack,
  assertRawBuilderEvidence,
  assertSame,
  assertVariantEvidence,
  boundsForMesh,
  deepFreeze,
  determinant,
  multiplyMatrices,
  transformPoint,
} from "./part-identification-2453-builder-identity-evidence.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;
const INPUT_KEYS = [
  "officialModelBytes",
  "builderManifestBytes",
  "builderBundleBytes",
  "builderBundleProofBytes",
  "nativePackBytes",
  "officialSolidRootBytes",
  "officialHollowRootBytes",
  "officialSolidStudBytes",
  "officialHollowStudBytes",
  "shadowSolidRootBytes",
  "shadowHollowRootBytes",
  "shadowSolidStudBytes",
  "shadowHollowStudBytes",
];
const TOKENS = new WeakMap();

function snapshotInputs(input, pins) {
  const roles = snapshotExactDataObject(input, "2453 identity evidence", INPUT_KEYS);
  const rolePins = {
    officialModelBytes: pins.officialModel,
    builderManifestBytes: pins.builderManifest,
    builderBundleBytes: pins.builderBundle,
    builderBundleProofBytes: pins.builderBundleProof,
    nativePackBytes: pins.nativePack,
    officialSolidRootBytes: pins.officialLdraw.solidRoot,
    officialHollowRootBytes: pins.officialLdraw.hollowRoot,
    officialSolidStudBytes: pins.officialLdraw.solidStud,
    officialHollowStudBytes: pins.officialLdraw.hollowStud,
    shadowSolidRootBytes: pins.ldcadShadow.solidRoot,
    shadowHollowRootBytes: pins.ldcadShadow.hollowRoot,
    shadowSolidStudBytes: pins.ldcadShadow.solidStud,
    shadowHollowStudBytes: pins.ldcadShadow.hollowStud,
  };
  return Object.fromEntries(
    INPUT_KEYS.map((key) => {
      const pin = rolePins[key];
      const bytes = snapshotBoundedUint8Array(roles[key], {
        label: `2453 identity evidence.${key}`,
        minimumBytes: pin.bytes,
        maximumBytes: pin.bytes,
      });
      const digest = sha256Digest(bytes);
      if (digest !== pin.digest) {
        throw new Error(
          `2453 identity evidence.${key} must be exact ${pin.bytes}-byte evidence at ${pin.digest}; received ${digest}.`,
        );
      }
      return [key, bytes];
    }),
  );
}

async function assertOfficialAndCatalog(inputs, pins, native, variant) {
  const [
    officialModule,
    catalogModule,
    constantsModule,
    blueprintModule,
    meshModule,
    ldrawModule,
    meshHashModule,
  ] = await Promise.all([
    importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-official.ts")),
    importRepositoryTypeScript(moduleUrl("../packages/catalog/src/catalog.ts")),
    importRepositoryTypeScript(moduleUrl("../packages/catalog/src/constants.ts")),
    importRepositoryTypeScript(
      moduleUrl("../packages/catalog/src/part-blueprints-6651557-measured-h.ts"),
    ),
    importRepositoryTypeScript(
      moduleUrl("../packages/catalog/src/mesh-assets-6651557-measured-h.ts"),
    ),
    importRepositoryTypeScript(
      moduleUrl("../packages/catalog/src/ldraw-bundled-sources-6651557.ts"),
    ),
    importRepositoryTypeScript(moduleUrl("../packages/catalog/src/mesh-assets.ts")),
  ]);
  const official = officialModule.parseOfficialModelIndex(inputs.officialModelBytes);
  if (official.digest !== pins.officialModel.digest) {
    throw new Error("Canonical official-model parser disagrees with the pinned XML digest.");
  }
  const itemRows = Object.values(official.bricks)
    .filter((brick) => brick.itemNos.includes(pins.builderScope.itemNo))
    .sort((left, right) => left.brickRef.localeCompare(right.brickRef));
  const compactRows = itemRows.map((brick) => ({
    brickRef: brick.brickRef,
    partRef: brick.parts[0]?.partRef,
    boneRef: brick.parts[0]?.boneRef,
  }));
  assertSame(compactRows, pins.builderScope.brickRecords, "Official 6595205 Brick records");
  for (const brick of itemRows) {
    if (
      brick.designId !== pins.builderScope.designId ||
      brick.designRevision !== pins.builderScope.designRevision ||
      !isDeepStrictEqual(brick.itemNos, [pins.builderScope.itemNo]) ||
      brick.materialId !== pins.builderScope.materialId ||
      brick.parts.length !== 1 ||
      brick.parts[0].designRevision !== pins.builderScope.designRevision
    ) {
      throw new Error(
        `Official Brick ${brick.brickRef} no longer has the exact 2453;I / 6595205 identity.`,
      );
    }
  }
  if (constantsModule.BUILTIN_CATALOG_VERSION !== pins.catalog.version) {
    throw new Error(
      "The 2453 identity proof does not silently reinterpret another catalog version.",
    );
  }
  const part = catalogModule.getPartDefinition(pins.catalog.partId);
  const blueprint = blueprintModule.SET_6651557_MEASURED_BLUEPRINTS_H.find(
    (row) => row.catalogId === pins.catalog.partId,
  );
  const mesh = meshModule.SET_6651557_MEASURED_MESH_ASSETS_H[pins.catalog.assetId];
  if (part === undefined || blueprint === undefined || mesh === undefined) {
    throw new Error("Exact catalog 2453b definition, blueprint, and mesh must all be present.");
  }
  if (
    part.id !== pins.catalog.partId ||
    part.geometry.assetId !== pins.catalog.assetId ||
    part.geometry.contentHash !== pins.catalog.geometryContentHash ||
    meshHashModule.meshAssetContentHash(mesh) !== pins.catalog.geometryContentHash ||
    blueprint.designId !== "2453b" ||
    blueprint.ldrawId !== pins.catalog.ldrawId ||
    blueprint.variant !== "solid-stud" ||
    !isDeepStrictEqual(blueprint.assetToCatalogFrame, pins.catalog.assetToCatalogFrame) ||
    !isDeepStrictEqual(blueprint.ldcadShadowSource.shadowFiles, ["p/stud.dat", "parts/2453b.dat"])
  ) {
    throw new Error("Catalog 2453b no longer binds the exact solid-suffix blueprint and mesh.");
  }
  if (
    mesh.positionsLdu.length / 3 !== pins.catalog.vertexCount ||
    mesh.indices.length / 3 !== pins.catalog.triangleCount
  ) {
    throw new Error("Catalog 2453b mesh counts drifted from the reviewed exact geometry.");
  }
  assertSame(
    mesh.groups,
    [
      { role: "body", triangleStart: 0, triangleCount: 28 },
      { role: "stud", triangleStart: 28, triangleCount: 48 },
    ],
    "Catalog 2453b mesh groups",
  );
  const closure = ldrawModule.BUNDLED_LDRAW_CLOSURES["2453b"].map(
    (index) => ldrawModule.BUNDLED_LDRAW_SOURCE_FILES[index],
  );
  const closureManifest = ldrawModule.BUNDLED_LDRAW_CLOSURE_MANIFESTS["2453b"];
  if (
    closure.length !== 6 ||
    closure.reduce((sum, row) => sum + row.bytes, 0) !== pins.catalog.closureBytes ||
    closureManifest.bytes !== pins.catalog.closureBytes ||
    closureManifest.manifestSha256 !== pins.catalog.closureManifestSha256 ||
    !closure.some(
      (row) => row.path === "parts/2453b.dat" && row.sha256 === pins.officialLdraw.solidRoot.digest,
    ) ||
    closure.some((row) => row.path === "parts/2453a.dat" || row.path === "p/stud2a.dat")
  ) {
    throw new Error("Catalog 2453b closure lost its exact six-file solid-only manifest.");
  }
  const connectors = part.connectors.map(({ kind, gender, positionLdu, normal }) => ({
    kind,
    gender,
    positionLdu,
    normal,
  }));
  assertSame(
    connectors,
    [
      { kind: "stud", gender: "male", ...pins.frame.catalogStud },
      { kind: "undersideClutch", gender: "female", ...pins.frame.catalogClutch },
    ],
    "Catalog 2453b connector route",
  );
  const orientation = constantsModule.UPRIGHT_ORIENTATIONS.find(
    ({ id }) => id === blueprint.assetToCatalogFrame.orientationId,
  );
  if (orientation !== undefined) {
    assertSame(
      orientation.matrix,
      pins.frame.assetToCatalogMatrix,
      "Catalog 2453b asset-frame orientation",
    );
  }
  const builderToCatalogMatrix =
    orientation === undefined
      ? []
      : multiplyMatrices(orientation.matrix, pins.frame.builderToLdrawMatrix);
  const builderToCatalogTranslationLdu =
    orientation === undefined
      ? []
      : transformPoint(
          orientation.matrix,
          blueprint.assetToCatalogFrame.translationLdu,
          pins.frame.builderToLdrawTranslationLdu,
        );
  if (
    orientation === undefined ||
    determinant(orientation.matrix) !== 1 ||
    determinant(pins.frame.normalizedOrientation) !== pins.frame.normalizedDeterminant ||
    determinant(builderToCatalogMatrix) !== pins.frame.determinant
  ) {
    throw new Error(
      "The exact 2453 route must remain proper; mirrors and reflections are forbidden.",
    );
  }
  assertSame(
    builderToCatalogMatrix,
    pins.frame.expectedBuilderToCatalogMatrix,
    "Composed Builder-to-catalog matrix",
  );
  assertSame(
    builderToCatalogTranslationLdu,
    pins.frame.expectedBuilderToCatalogTranslationLdu,
    "Composed Builder-to-catalog translation",
  );
  assertSame(
    transformPoint(
      pins.frame.builderToLdrawMatrix,
      pins.frame.builderToLdrawTranslationLdu,
      pins.frame.builderSolidStudCenter,
    ),
    [0, 0, 0],
    "Raw Builder solid-stud to LDraw asset endpoint",
  );
  assertSame(
    transformPoint(
      pins.frame.builderToLdrawMatrix,
      pins.frame.builderToLdrawTranslationLdu,
      pins.frame.builderClutchCenter,
    ),
    [0, 120, 0],
    "Raw Builder clutch to LDraw asset endpoint",
  );
  assertSame(
    transformPoint(
      builderToCatalogMatrix,
      builderToCatalogTranslationLdu,
      pins.frame.builderSolidStudCenter,
    ),
    pins.frame.catalogStud.positionLdu,
    "Builder solid-stud frame endpoint",
  );
  assertSame(
    transformPoint(
      builderToCatalogMatrix,
      builderToCatalogTranslationLdu,
      pins.frame.builderClutchCenter,
    ),
    pins.frame.catalogClutch.positionLdu,
    "Builder clutch frame endpoint",
  );
  const nativeCatalogBounds = {
    min: native.mesh.bounds.min.map((value, axis) => value + builderToCatalogTranslationLdu[axis]),
    max: native.mesh.bounds.max.map((value, axis) => value + builderToCatalogTranslationLdu[axis]),
  };
  const bodyBounds = boundsForMesh(mesh, mesh.groups[0].triangleCount * 3);
  const fullBounds = boundsForMesh(mesh);
  assertSame(
    bodyBounds,
    { min: [-10, 0, -10], max: [10, 120, 10] },
    "Catalog 2453b body asset bounds",
  );
  assertSame(
    fullBounds,
    { min: [-10, -4, -10], max: [10, 120, 10] },
    "Catalog 2453b full asset bounds",
  );
  for (const [axis, expected] of [-10, -60, -10].entries()) {
    if (Math.abs(nativeCatalogBounds.min[axis] - expected) > 1e-5)
      throw new Error("Native 2453 minimum bounds do not corroborate the catalog frame.");
  }
  for (const [axis, expected] of [10, 60, 10].entries()) {
    if (Math.abs(nativeCatalogBounds.max[axis] - expected) > 1e-5)
      throw new Error("Native 2453 maximum bounds do not corroborate the catalog frame.");
  }
  return {
    closure,
    itemRows,
    localPartFrame: {
      matrix: builderToCatalogMatrix,
      translationLdu: builderToCatalogTranslationLdu,
      composition: {
        builderToLdraw: {
          matrix: pins.frame.builderToLdrawMatrix,
          translationLdu: pins.frame.builderToLdrawTranslationLdu,
        },
        ldrawAssetToCatalog: {
          orientationId: blueprint.assetToCatalogFrame.orientationId,
          matrix: orientation.matrix,
          translationLdu: blueprint.assetToCatalogFrame.translationLdu,
        },
      },
    },
    nativeCatalogBounds,
    part,
    variant,
  };
}

function inputCommitments(inputs) {
  return Object.fromEntries(
    INPUT_KEYS.map((key) => [
      key,
      { bytes: inputs[key].length, digest: sha256Digest(inputs[key]) },
    ]),
  );
}

function encodeArtifact(artifact) {
  return Buffer.from(`${JSON.stringify(artifact)}\n`);
}

export function verifyBuilder2453IdentityArtifact(
  bytes,
  pins = CURRENT_BUILDER_2453_IDENTITY_PINS,
) {
  if (pins !== CURRENT_BUILDER_2453_IDENTITY_PINS) {
    throw new Error("2453 identity artifact verifier accepts only its module-owned current pins.");
  }
  const held = snapshotBoundedUint8Array(bytes, {
    label: "2453 identity artifact",
    minimumBytes: pins.expectedArtifact.bytes,
    maximumBytes: pins.expectedArtifact.bytes,
  });
  const digest = sha256Digest(held);
  if (digest !== pins.expectedArtifact.digest) {
    throw new Error(
      `2453 identity artifact digest is ${digest}; expected ${pins.expectedArtifact.digest}.`,
    );
  }
  const artifact = jsonArtifactFromBytes(held, "2453 identity artifact").value;
  if (
    artifact?.schemaVersion !== BUILDER_2453_IDENTITY_SCHEMA ||
    artifact?.routeId !== BUILDER_2453_IDENTITY_ROUTE ||
    !isDeepStrictEqual(artifact.authority, BUILDER_2453_IDENTITY_AUTHORITY)
  ) {
    throw new Error(
      "2453 identity artifact cannot manufacture schema, route, or authority fields.",
    );
  }
  return deepFreeze(artifact);
}

export async function compileBuilder2453IdentityProof(
  input,
  pins = CURRENT_BUILDER_2453_IDENTITY_PINS,
) {
  if (pins !== CURRENT_BUILDER_2453_IDENTITY_PINS) {
    throw new Error("2453 identity proof accepts only its module-owned current pin object.");
  }
  const inputs = snapshotInputs(input, pins);
  const variant = assertVariantEvidence(inputs);
  const native = assertNativePack(inputs.nativePackBytes, pins);
  const rawBuilder = assertRawBuilderEvidence(inputs, pins, native.record);
  const catalog = await assertOfficialAndCatalog(inputs, pins, native, variant);
  const artifact = deepFreeze({
    schemaVersion: BUILDER_2453_IDENTITY_SCHEMA,
    routeId: BUILDER_2453_IDENTITY_ROUTE,
    scope: {
      builder: {
        designRevision: pins.builderScope.designRevision,
        itemNo: pins.builderScope.itemNo,
      },
      catalogPartId: pins.catalog.partId,
      exactLdrawId: pins.catalog.ldrawId,
    },
    authority: BUILDER_2453_IDENTITY_AUTHORITY,
    inputs: inputCommitments(inputs),
    official: {
      modelDigest: pins.officialModel.digest,
      materialId: pins.builderScope.materialId,
      brickRecords: pins.builderScope.brickRecords,
    },
    rawBuilder: {
      manifestTarget: rawBuilder.manifestTarget,
      bundle: rawBuilder.proof.bundle,
      parserEnvironment: rawBuilder.proof.environment,
      primitive: {
        bytes: rawBuilder.proof.primitive.bytes,
        sha256: rawBuilder.proof.primitive.sha256,
        pathId: rawBuilder.proof.primitive.pathId,
        identity: rawBuilder.proof.primitive.identity,
        connectorSemantics: rawBuilder.proof.primitive.connectorSemantics,
      },
      partinfo: rawBuilder.proof.partinfo,
      shell: rawBuilder.proof.shell,
    },
    native: {
      frameId: pins.nativePack.frameId,
      sourceManifestSha256: pins.nativePack.sourceManifestSha256,
      recordSha256: native.mesh.recordSha256,
      bundleSha256: native.record.bundleSha256,
      meshCanonicalSha256: native.record.meshCanonicalSha256,
      primitiveXmlSha256: native.record.primitiveXmlSha256,
      vertices: native.record.positionCount,
      triangles: native.record.indexCount / 3,
      connectivity: [
        { fieldType: "23", centerFamily: "0:4:1", gender: "male", role: "solid-stud" },
        {
          fieldType: "22",
          centerFamily: "15:4:1",
          gender: "female",
          role: "under-stud-clutch",
        },
      ],
    },
    variant,
    catalog: {
      version: pins.catalog.version,
      geometryContentHash: pins.catalog.geometryContentHash,
      closureBytes: pins.catalog.closureBytes,
      closureManifestSha256: pins.catalog.closureManifestSha256,
      closurePaths: catalog.closure.map(({ path }) => path),
      vertices: pins.catalog.vertexCount,
      triangles: pins.catalog.triangleCount,
    },
    localPartFrame: {
      matrix: catalog.localPartFrame.matrix,
      translationLdu: catalog.localPartFrame.translationLdu,
      composition: catalog.localPartFrame.composition,
      determinant: pins.frame.determinant,
      properNoReflection: true,
      stud: pins.frame.catalogStud,
      clutch: pins.frame.catalogClutch,
      corroboratedNativeBoundsLdu: catalog.nativeCatalogBounds,
    },
    conclusion: "exact-builder-identity-and-local-part-frame-only",
  });
  const encoded = encodeArtifact(artifact);
  verifyBuilder2453IdentityArtifact(encoded, pins);
  const token = deepFreeze({ routeId: BUILDER_2453_IDENTITY_ROUTE });
  TOKENS.set(token, artifact.localPartFrame);
  return deepFreeze({ artifact, encoded, encodedDigest: sha256Digest(encoded), token });
}

export function adjudicateBuilder2453Identity(token, request) {
  const localPartFrame = TOKENS.get(token);
  if (localPartFrame === undefined) {
    throw new Error(
      "2453 identity adjudication requires the opaque token from exact evidence compilation.",
    );
  }
  const fields = snapshotExactDataObject(request, "2453 identity request", [
    "designRevision",
    "itemNo",
  ]);
  const pins = CURRENT_BUILDER_2453_IDENTITY_PINS;
  if (
    fields.designRevision !== pins.builderScope.designRevision ||
    fields.itemNo !== pins.builderScope.itemNo
  ) {
    throw new Error(
      "2453 identity proof authorizes only designRevision 2453;I with itemNo 6595205.",
    );
  }
  return deepFreeze({
    routeId: BUILDER_2453_IDENTITY_ROUTE,
    catalogPartId: pins.catalog.partId,
    exactLdrawId: pins.catalog.ldrawId,
    localPartFrame: {
      matrix: localPartFrame.matrix,
      translationLdu: localPartFrame.translationLdu,
    },
    authority: BUILDER_2453_IDENTITY_AUTHORITY,
  });
}

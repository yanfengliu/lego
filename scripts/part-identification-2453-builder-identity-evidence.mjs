import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes } from "./part-identification-artifact-source.mjs";
import { snapshotExactDataObject } from "./part-identification-bounded-snapshot.mjs";

export const deepFreeze = (value) => {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export function assertSame(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label} drifted from the exact reviewed value.`);
  }
}

function decodeText(bytes, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} must be exact UTF-8 text.`, { cause: error });
  }
  if (text.includes("\0")) throw new Error(`${label} may not contain NUL bytes.`);
  return text;
}

function ldrawReferences(bytes, label) {
  const text = decodeText(bytes, label);
  const references = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    const fields = line.trim().split(/\s+/u);
    if (fields[0] !== "1") continue;
    if (fields.length !== 15) {
      throw new Error(`${label} has a malformed type-1 reference at line ${index + 1}.`);
    }
    references.push(fields[14].replaceAll("\\", "/").toLowerCase());
  }
  return { text, references };
}

export function assertVariantEvidence(inputs) {
  const solid = ldrawReferences(inputs.officialSolidRootBytes, "Official 2453b root");
  const hollow = ldrawReferences(inputs.officialHollowRootBytes, "Official 2453a root");
  const solidStud = decodeText(inputs.officialSolidStudBytes, "Official solid stud primitive");
  const hollowStud = decodeText(inputs.officialHollowStudBytes, "Official hollow stud primitive");
  if (
    !solid.text.split(/\r?\n/u)[0].includes("with Solid Stud") ||
    !solid.references.includes("stud.dat") ||
    solid.references.includes("stud2a.dat")
  ) {
    throw new Error(
      "Official 2453b must bind exactly to the solid stud.dat family, not stud2a.dat.",
    );
  }
  if (
    !hollow.text.split(/\r?\n/u)[0].includes("with Hollow Stud") ||
    !hollow.references.includes("stud2a.dat") ||
    hollow.references.includes("stud.dat")
  ) {
    throw new Error("Official 2453a must bind exactly to the hollow stud2a.dat family.");
  }
  if (!solidStud.startsWith("0 Stud") || !hollowStud.startsWith("0 Stud Open")) {
    throw new Error("Official stud primitives no longer preserve the solid/open discriminator.");
  }
  const shadowSolidRoot = decodeText(inputs.shadowSolidRootBytes, "LDCad 2453b shadow");
  const shadowHollowRoot = decodeText(inputs.shadowHollowRootBytes, "LDCad 2453a shadow");
  const shadowSolidStud = decodeText(inputs.shadowSolidStudBytes, "LDCad solid stud shadow");
  const shadowHollowStud = decodeText(inputs.shadowHollowStudBytes, "LDCad hollow stud shadow");
  if (
    !shadowSolidRoot.includes('with Solid Stud"') ||
    !shadowHollowRoot.includes('with Hollow Stud"') ||
    !shadowSolidStud.includes("[ID=studC] [gender=M]") ||
    shadowSolidStud.includes("[ID=studO]") ||
    !shadowHollowStud.includes("[ID=studO] [gender=M]") ||
    shadowHollowStud.includes("[ID=studC]")
  ) {
    throw new Error(
      "LDCad shadow bytes no longer independently distinguish solid studC from open studO.",
    );
  }
  return deepFreeze({
    admitted: {
      suffix: "2453b",
      variant: "solid-stud",
      geometryPrimitive: "p/stud.dat",
      connectivityFamily: "studC",
    },
    excluded: {
      suffix: "2453a",
      variant: "hollow-stud",
      geometryPrimitive: "p/stud2a.dat",
      connectivityFamily: "studO",
    },
  });
}

function sha256Hex(parts) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function measuredNativeMesh(record, binary, pin) {
  const positionEnd = record.positionByteOffset + record.positionCount * 3 * 4;
  const indexEnd = record.indexByteOffset + record.indexCount * 4;
  if (
    record.positionByteOffset < 0 ||
    record.indexByteOffset < positionEnd ||
    indexEnd > binary.length ||
    record.positionCount < 3 ||
    record.indexCount % 3 !== 0
  ) {
    throw new Error("Native 2453 mesh slices are overlapping, unbounded, or not triangular.");
  }
  const positionBytes = binary.subarray(record.positionByteOffset, positionEnd);
  const indexBytes = binary.subarray(record.indexByteOffset, indexEnd);
  const recordSha256 = sha256Hex([positionBytes, indexBytes]);
  if (recordSha256 !== pin.recordSha256 || record.recordSha256 !== pin.recordSha256) {
    throw new Error("Native 2453 record SHA does not derive from its position and index slices.");
  }
  const positions = Array.from({ length: record.positionCount * 3 }, (_, index) =>
    positionBytes.readFloatLE(index * 4),
  );
  if (positions.some((value) => !Number.isFinite(value))) {
    throw new Error("Native 2453 positions must all be finite float32 values.");
  }
  const indices = Array.from({ length: record.indexCount }, (_, index) =>
    indexBytes.readUInt32LE(index * 4),
  );
  if (indices.some((index) => index >= record.positionCount)) {
    throw new Error("Native 2453 indices must remain inside the pinned vertex slice.");
  }
  if (new Set(indices).size !== record.positionCount) {
    throw new Error("Native 2453 mesh must retain evidence for every pinned vertex.");
  }
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index] * 3;
    const b = indices[index + 1] * 3;
    const c = indices[index + 2] * 3;
    const ab = [
      positions[b] - positions[a],
      positions[b + 1] - positions[a + 1],
      positions[b + 2] - positions[a + 2],
    ];
    const ac = [
      positions[c] - positions[a],
      positions[c + 1] - positions[a + 1],
      positions[c + 2] - positions[a + 2],
    ];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    if (cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2 <= 1e-12) {
      throw new Error(`Native 2453 triangle ${index / 3} is degenerate.`);
    }
  }
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (let index = 0; index < positions.length; index += 1) {
    const axis = index % 3;
    bounds.min[axis] = Math.min(bounds.min[axis], positions[index]);
    bounds.max[axis] = Math.max(bounds.max[axis], positions[index]);
  }
  bounds.min = bounds.min.map((value) => (value === 0 ? 0 : value));
  bounds.max = bounds.max.map((value) => (value === 0 ? 0 : value));
  assertSame(bounds, pin.boundsLdu, "Native 2453 binary bounds");
  return { bounds, indices, positions, recordSha256 };
}

export function assertNativePack(bytes, pins) {
  const pack = jsonArtifactFromBytes(bytes, "Builder native part pack").value;
  const fields = snapshotExactDataObject(pack, "Builder native part pack", [
    "binaryBase64",
    "binaryBytes",
    "binarySha256",
    "frameId",
    "partCount",
    "parts",
    "schemaVersion",
    "sourceAuditSha256",
    "sourceCacheReportSha256",
    "sourceCoverageSha256",
    "sourceManifestSha256",
    "triangleCount",
    "vertexCount",
  ]);
  for (const key of [
    "binaryBytes",
    "binarySha256",
    "frameId",
    "partCount",
    "schemaVersion",
    "sourceAuditSha256",
    "sourceCacheReportSha256",
    "sourceCoverageSha256",
    "sourceManifestSha256",
  ]) {
    assertSame(fields[key], pins.nativePack[key], `Builder native part pack.${key}`);
  }
  if (
    typeof fields.binaryBase64 !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(fields.binaryBase64)
  ) {
    throw new Error("Builder native part pack binary must be canonical base64 text.");
  }
  const binary = Buffer.from(fields.binaryBase64, "base64");
  if (
    binary.length !== pins.nativePack.binaryBytes ||
    binary.toString("base64") !== fields.binaryBase64 ||
    sha256Hex([binary]) !== pins.nativePack.binarySha256
  ) {
    throw new Error("Builder native part pack binary bytes drifted from their exact commitment.");
  }
  if (!Array.isArray(fields.parts) || fields.parts.length !== pins.nativePack.partCount) {
    throw new Error("Builder native part pack roster does not match its exact part count.");
  }
  const matches = fields.parts.filter(
    (record) =>
      record?.id === pins.nativeRecord.id && record?.revision === pins.nativeRecord.revision,
  );
  if (matches.length !== 1) {
    throw new Error("Builder native pack must contain exactly one 2453 revision I record.");
  }
  const record = matches[0];
  for (const key of [
    "id",
    "revision",
    "itemId",
    "name",
    "superDesign",
    "platform",
    "sourceUrl",
    "positionByteOffset",
    "positionCount",
    "indexByteOffset",
    "indexCount",
    "manifestMd5",
    "primitiveXmlSha256",
    "bundleSha256",
    "meshCanonicalSha256",
    "recordSha256",
  ]) {
    assertSame(record[key], pins.nativeRecord[key], `Builder native 2453 record.${key}`);
  }
  const expectedConnectivity = [
    {
      type: "23",
      transformation: "1,0,0,0,1,0,0,0,1,-0.4,4.8,-0.4",
      center: "0:4:1",
    },
    {
      type: "22",
      transformation: "1,0,0,0,1,0,0,0,1,-0.4,0,-0.4",
      center: "15:4:1",
    },
  ];
  if (!Array.isArray(record.connectivityPrimitives) || record.connectivityPrimitives.length !== 2) {
    throw new Error("Builder native 2453 must retain exactly two connectivity fields.");
  }
  for (const [index, expected] of expectedConnectivity.entries()) {
    const field = record.connectivityPrimitives[index];
    const cells =
      typeof field?.grid === "string" ? field.grid.split(",").map((cell) => cell.trim()) : [];
    if (
      field?.kind !== "Custom2DField" ||
      field.attributes?.type !== expected.type ||
      field.attributes?.width !== "2" ||
      field.attributes?.height !== "2" ||
      field.attributes?.transformation !== expected.transformation ||
      cells.length !== 9 ||
      cells[4] !== expected.center
    ) {
      throw new Error(
        `Builder native 2453 connectivity field ${index} lost its exact center family.`,
      );
    }
  }
  const mesh = measuredNativeMesh(record, binary, pins.nativeRecord);
  return { mesh, record };
}

export function assertRawBuilderEvidence(inputs, pins, nativeRecord) {
  const manifest = jsonArtifactFromBytes(inputs.builderManifestBytes, "Builder source manifest");
  const manifestFields = snapshotExactDataObject(manifest.value, "Builder source manifest", [
    "generated",
    "Bricks",
    "Decorations",
  ]);
  if (
    manifestFields.generated !== pins.builderManifest.generated ||
    !Array.isArray(manifestFields.Bricks) ||
    manifestFields.Bricks.length !== pins.builderManifest.brickCount ||
    !Array.isArray(manifestFields.Decorations) ||
    manifestFields.Decorations.length !== pins.builderManifest.decorationCount
  ) {
    throw new Error("Builder source manifest roster drifted from the exact reviewed manifest.");
  }
  const targets = manifestFields.Bricks.filter(
    (row) => row?.Id === pins.nativeRecord.id && row?.Revision === pins.nativeRecord.revision,
  );
  assertSame(
    targets,
    [
      {
        Id: pins.nativeRecord.id,
        Revision: pins.nativeRecord.revision,
        Platform: { Name: pins.nativeRecord.platform, Checksum: pins.nativeRecord.manifestMd5 },
      },
    ],
    "Builder source manifest 2453-I row",
  );
  if (
    manifest.digest.slice("sha256:".length) !== pins.nativePack.sourceManifestSha256 ||
    manifest.digest !== pins.builderManifest.digest
  ) {
    throw new Error("Builder native pack no longer derives from the exact raw manifest role.");
  }

  const proof = jsonArtifactFromBytes(
    inputs.builderBundleProofBytes,
    "Builder 2453 bundle proof",
  ).value;
  const fields = snapshotExactDataObject(proof, "Builder 2453 bundle proof", [
    "bundle",
    "conclusion",
    "environment",
    "partinfo",
    "primitive",
    "roster",
    "schemaVersion",
    "shell",
  ]);
  if (
    fields.schemaVersion !== pins.builderBundleProof.schemaVersion ||
    fields.conclusion !== "bounded-source-measurement-only-no-authority"
  ) {
    throw new Error("Builder 2453 bundle proof may carry measurement evidence only.");
  }
  assertSame(
    fields.environment,
    {
      contractSha256: pins.builderBundleProof.environmentContractSha256,
      unityPyVersion: pins.builderBundleProof.unityPyVersion,
    },
    "Builder 2453 isolated parser environment",
  );
  assertSame(fields.roster, pins.builderBundleProof.roster, "Builder 2453 raw bundle roster");
  assertSame(
    fields.bundle,
    { bytes: pins.builderBundle.bytes, sha256: pins.builderBundle.digest },
    "Builder 2453 raw bundle identity",
  );
  if (
    fields.bundle.sha256.slice("sha256:".length) !== nativeRecord.bundleSha256 ||
    sha256Hex([inputs.builderBundleBytes]) !== nativeRecord.bundleSha256
  ) {
    throw new Error("Builder native record does not derive from the exact raw bundle role.");
  }
  assertSame(
    fields.partinfo,
    {
      bytes: 87,
      pathId: pins.builderBundleProof.partinfoPathId,
      sha256: "sha256:8e289b0a0ac8f2238b4c27b3cae7f52bbfd8969da38befac60082bfc487e6d6c",
      value: {
        IsFoil: false,
        ItemId: nativeRecord.itemId,
        Name: nativeRecord.name,
        SuperDesign: nativeRecord.superDesign,
      },
    },
    "Builder 2453 raw partinfo",
  );
  if (
    fields.primitive?.bytes !== 3_078 ||
    fields.primitive?.pathId !== pins.builderBundleProof.primitivePathId ||
    fields.primitive?.sha256 !== `sha256:${nativeRecord.primitiveXmlSha256}`
  ) {
    throw new Error("Builder 2453 raw primitive commitment drifted.");
  }
  assertSame(
    fields.primitive.identity,
    {
      aliases: pins.nativeRecord.id,
      designname: "BRICK 1X1X5",
      revision: pins.nativeRecord.revision,
      superdesignid: pins.nativeRecord.superDesign,
    },
    "Builder 2453 raw primitive identity",
  );
  assertSame(
    fields.primitive.connectorSemantics,
    {
      familyContract: {
        female: { 15: "under-stud-clutch" },
        male: { 0: "solid-stud", 1: "open-stud" },
      },
      openMaleStudCount: 0,
      solidMaleStud: {
        axis: [0, 1, 0],
        centerBuilder: ["0", "24/5", "0"],
        code: "0:4:1",
        family: 0,
        fieldType: 23,
      },
      undersideClutch: {
        axis: [0, 1, 0],
        centerBuilder: ["0", "0", "0"],
        code: "15:4:1",
        family: 15,
        fieldType: 22,
      },
    },
    "Builder 2453 exact connector-family semantics",
  );
  const nativeConnectivity = nativeRecord.connectivityPrimitives.map((field) => {
    const cells = field.grid.split(",").map((cell) => cell.trim());
    return {
      centerFamily: cells[4],
      gridSha256: `sha256:${sha256Hex([Buffer.from(cells.join(","), "ascii")])}`,
      height: field.attributes.height,
      kind: field.kind,
      transformation: field.attributes.transformation,
      type: field.attributes.type,
      width: field.attributes.width,
    };
  });
  assertSame(
    fields.primitive.connectivity,
    nativeConnectivity,
    "Builder raw/native connectivity derivation",
  );
  if (
    fields.shell?.pathId !== pins.builderBundleProof.shellPathId ||
    fields.shell?.canonicalMeshSha256 !== `sha256:${nativeRecord.meshCanonicalSha256}` ||
    fields.shell?.canonicalVertices !== nativeRecord.positionCount ||
    fields.shell?.canonicalTriangles !== nativeRecord.indexCount / 3 ||
    fields.shell?.declaredVertices !== nativeRecord.positionCount ||
    fields.shell?.declaredTriangles !== nativeRecord.indexCount / 3
  ) {
    throw new Error("Builder raw Shell does not reproduce the native mesh commitment and counts.");
  }
  return deepFreeze({ manifestTarget: targets[0], proof: fields });
}

export function determinant(matrix) {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

export function multiplyMatrices(left, right) {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, inner) => sum + left[row * 3 + inner] * right[inner * 3 + column],
      0,
    );
  });
}

export function transformPoint(matrix, translation, point) {
  return [
    matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + translation[0],
    matrix[3] * point[0] + matrix[4] * point[1] + matrix[5] * point[2] + translation[1],
    matrix[6] * point[0] + matrix[7] * point[1] + matrix[8] * point[2] + translation[2],
  ];
}

export function boundsForMesh(mesh, indexLimit = mesh.indices.length) {
  const used = new Set(mesh.indices.slice(0, indexLimit));
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const vertex of used) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = mesh.positionsLdu[vertex * 3 + axis];
      bounds.min[axis] = Math.min(bounds.min[axis], value);
      bounds.max[axis] = Math.max(bounds.max[axis], value);
    }
  }
  return bounds;
}

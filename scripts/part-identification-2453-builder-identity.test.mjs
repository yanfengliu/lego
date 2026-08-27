import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  adjudicateBuilder2453Identity,
  compileBuilder2453IdentityProof,
  verifyBuilder2453IdentityArtifact,
} from "./part-identification-2453-builder-identity.mjs";
import {
  BUILDER_2453_IDENTITY_AUTHORITY,
  BUILDER_2453_IDENTITY_ROUTE,
  CURRENT_BUILDER_2453_IDENTITY_PINS,
} from "./part-identification-2453-builder-identity-source.mjs";

const pins = CURRENT_BUILDER_2453_IDENTITY_PINS;
const shadowRoot = "C:/tmp/ldcad-shadow-20260802";
const livePaths = [
  pins.officialModel.path,
  pins.builderManifest.path,
  pins.builderBundle.path,
  pins.builderBundleProof.path,
  pins.nativePack.path,
  pins.officialLdraw.archive.path,
  `${shadowRoot}/parts/2453b.dat`,
  `${shadowRoot}/parts/2453a.dat`,
  `${shadowRoot}/p/stud.dat`,
  `${shadowRoot}/p/stud2a.dat`,
];
const realEvidencePresent = livePaths.every(existsSync);

async function digestBoundedFile(path, expectedBytes) {
  if (statSync(path).size !== expectedBytes) {
    throw new Error(`${path} does not have the exact pinned byte count.`);
  }
  const hash = createHash("sha256");
  let observed = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 1024 * 1024 })) {
    observed += chunk.length;
    if (observed > expectedBytes) throw new Error(`${path} grew during its bounded digest read.`);
    hash.update(chunk);
  }
  if (observed !== expectedBytes) throw new Error(`${path} shrank during its bounded digest read.`);
  return `sha256:${hash.digest("hex")}`;
}

function extractOfficialMember(path) {
  const executable = process.platform === "win32" ? "tar.exe" : "tar";
  return execFileSync(executable, ["-xOf", pins.officialLdraw.archive.path, path], {
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
}

async function readCurrentEvidence() {
  expect(
    await digestBoundedFile(pins.officialLdraw.archive.path, pins.officialLdraw.archive.bytes),
  ).toBe(pins.officialLdraw.archive.digest);
  return {
    officialModelBytes: readFileSync(pins.officialModel.path),
    builderManifestBytes: readFileSync(pins.builderManifest.path),
    builderBundleBytes: readFileSync(pins.builderBundle.path),
    builderBundleProofBytes: readFileSync(pins.builderBundleProof.path),
    nativePackBytes: readFileSync(pins.nativePack.path),
    officialSolidRootBytes: extractOfficialMember(pins.officialLdraw.solidRoot.path),
    officialHollowRootBytes: extractOfficialMember(pins.officialLdraw.hollowRoot.path),
    officialSolidStudBytes: extractOfficialMember(pins.officialLdraw.solidStud.path),
    officialHollowStudBytes: extractOfficialMember(pins.officialLdraw.hollowStud.path),
    shadowSolidRootBytes: readFileSync(`${shadowRoot}/parts/2453b.dat`),
    shadowHollowRootBytes: readFileSync(`${shadowRoot}/parts/2453a.dat`),
    shadowSolidStudBytes: readFileSync(`${shadowRoot}/p/stud.dat`),
    shadowHollowStudBytes: readFileSync(`${shadowRoot}/p/stud2a.dat`),
  };
}

function clonedEvidence(input) {
  return Object.fromEntries(Object.entries(input).map(([key, bytes]) => [key, Buffer.from(bytes)]));
}

describe("2453 exact identity source boundary", () => {
  it("publishes only the narrow identity/local-frame authority", () => {
    expect(BUILDER_2453_IDENTITY_AUTHORITY).toEqual({
      identityAdjudication: true,
      localPartFrameRoute: true,
      sourceExecution: false,
      preparedRun: false,
      productionAssignment: false,
      printedIdentity: false,
      physicalFrame: false,
      action: false,
      placement: false,
      documentMutation: false,
      replay: false,
      acceptance: false,
      completion: false,
    });
    expect(Object.isFrozen(BUILDER_2453_IDENTITY_AUTHORITY)).toBe(true);
    expect(pins.builderScope).toMatchObject({ designRevision: "2453;I", itemNo: "6595205" });
    expect(pins.catalog).toMatchObject({
      partId: "builtin:brick-1x1x5-solid-stud",
      ldrawId: "2453b.dat",
    });
  });

  it("rejects caller-owned pins, forged tokens, accessors, and extra evidence roles", async () => {
    await expect(compileBuilder2453IdentityProof({}, { ...pins })).rejects.toThrow(
      "module-owned current pin object",
    );
    const forgedArtifactBytes = Buffer.from(
      `${JSON.stringify({
        schemaVersion: "lego.part-identification-2453-builder-identity/1",
        routeId: BUILDER_2453_IDENTITY_ROUTE,
        authority: BUILDER_2453_IDENTITY_AUTHORITY,
        scope: { catalogPartId: "builtin:forged", exactLdrawId: "2453a.dat" },
        localPartFrame: {
          matrix: [-1, 0, 0, 0, 1, 0, 0, 0, 1],
          translationLdu: [999, 999, 999],
        },
        conclusion: "forged",
      })}\n`,
    );
    const forgedPins = {
      ...pins,
      expectedArtifact: {
        bytes: forgedArtifactBytes.length,
        digest: `sha256:${createHash("sha256").update(forgedArtifactBytes).digest("hex")}`,
      },
    };
    expect(() => verifyBuilder2453IdentityArtifact(forgedArtifactBytes, forgedPins)).toThrow(
      "module-owned current pins",
    );
    expect(() =>
      adjudicateBuilder2453Identity(
        { routeId: BUILDER_2453_IDENTITY_ROUTE },
        { designRevision: "2453;I", itemNo: "6595205" },
      ),
    ).toThrow("opaque token");
    const accessor = {};
    Object.defineProperty(accessor, "officialModelBytes", {
      enumerable: true,
      get() {
        throw new Error("hostile getter ran");
      },
    });
    await expect(compileBuilder2453IdentityProof(accessor)).rejects.toThrow("contain exactly");
    const extra = Object.fromEntries(
      [
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
        "placementAuthority",
      ].map((key) => [key, Buffer.alloc(0)]),
    );
    await expect(compileBuilder2453IdentityProof(extra)).rejects.toThrow("contain exactly");
  });
});

describe.runIf(realEvidencePresent)("2453 exact live identity proof", () => {
  let evidence;
  let compiled;

  it("reproduces the immutable exact proof and independently binds solid versus hollow", async () => {
    evidence = await readCurrentEvidence();
    compiled = await compileBuilder2453IdentityProof(evidence);
    expect({ bytes: compiled.encoded.length, digest: compiled.encodedDigest }).toEqual(
      pins.expectedArtifact,
    );
    expect(compiled.artifact).toMatchObject({
      routeId: BUILDER_2453_IDENTITY_ROUTE,
      scope: {
        builder: { designRevision: "2453;I", itemNo: "6595205" },
        catalogPartId: "builtin:brick-1x1x5-solid-stud",
        exactLdrawId: "2453b.dat",
      },
      official: { materialId: "140", brickRecords: pins.builderScope.brickRecords },
      rawBuilder: {
        manifestTarget: {
          Id: "2453",
          Revision: "I",
          Platform: { Name: "Android", Checksum: "d424b52bf93cb9c1a8e887348ef221a5" },
        },
        bundle: { bytes: 82_073, sha256: pins.builderBundle.digest },
        parserEnvironment: {
          contractSha256: pins.builderBundleProof.environmentContractSha256,
          unityPyVersion: "1.25.3",
        },
        primitive: {
          bytes: 3_078,
          sha256: `sha256:${pins.nativeRecord.primitiveXmlSha256}`,
          pathId: pins.builderBundleProof.primitivePathId,
          identity: {
            aliases: "2453",
            designname: "BRICK 1X1X5",
            revision: "I",
            superdesignid: "11002453",
          },
          connectorSemantics: {
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
          },
        },
        shell: {
          canonicalMeshSha256: `sha256:${pins.nativeRecord.meshCanonicalSha256}`,
          canonicalVertices: 126,
          canonicalTriangles: 92,
        },
      },
      native: {
        recordSha256: pins.nativeRecord.recordSha256,
        bundleSha256: pins.nativeRecord.bundleSha256,
        meshCanonicalSha256: pins.nativeRecord.meshCanonicalSha256,
        vertices: 126,
        triangles: 92,
        connectivity: [
          {
            fieldType: "23",
            centerFamily: "0:4:1",
            gender: "male",
            role: "solid-stud",
          },
          {
            fieldType: "22",
            centerFamily: "15:4:1",
            gender: "female",
            role: "under-stud-clutch",
          },
        ],
      },
      variant: {
        admitted: { suffix: "2453b", geometryPrimitive: "p/stud.dat", connectivityFamily: "studC" },
        excluded: {
          suffix: "2453a",
          geometryPrimitive: "p/stud2a.dat",
          connectivityFamily: "studO",
        },
      },
      localPartFrame: {
        matrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
        translationLdu: [0, 60, 0],
        composition: {
          builderToLdraw: {
            matrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
            translationLdu: [0, 120, 0],
          },
          ldrawAssetToCatalog: {
            orientationId: "upright-yaw-0",
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            translationLdu: [0, -60, 0],
          },
        },
        determinant: 15_625,
        properNoReflection: true,
      },
    });
    expect(Object.isFrozen(compiled.artifact)).toBe(true);
    expect(verifyBuilder2453IdentityArtifact(compiled.encoded)).toEqual(compiled.artifact);
  });

  it("routes only the exact revision/item pair and grants no downstream authority", () => {
    const route = adjudicateBuilder2453Identity(compiled.token, {
      designRevision: "2453;I",
      itemNo: "6595205",
    });
    expect(route).toEqual({
      routeId: BUILDER_2453_IDENTITY_ROUTE,
      catalogPartId: "builtin:brick-1x1x5-solid-stud",
      exactLdrawId: "2453b.dat",
      localPartFrame: {
        matrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
        translationLdu: [0, 60, 0],
      },
      authority: BUILDER_2453_IDENTITY_AUTHORITY,
    });
    expect(Object.isFrozen(route)).toBe(true);
    for (const request of [
      { designRevision: "2453;I", itemNo: "4210690" },
      { designRevision: "2453;H", itemNo: "6595205" },
      { designRevision: "2453b;I", itemNo: "6595205" },
      { designRevision: "2453;I", itemNo: "6595205", suffix: "2453b" },
    ]) {
      expect(() => adjudicateBuilder2453Identity(compiled.token, request)).toThrow();
    }
    const verifiedArtifact = verifyBuilder2453IdentityArtifact(compiled.encoded);
    expect(() =>
      adjudicateBuilder2453Identity(verifiedArtifact, {
        designRevision: "2453;I",
        itemNo: "6595205",
      }),
    ).toThrow("opaque token");
  });

  it.each([
    ["officialModelBytes", 17],
    ["builderManifestBytes", 73],
    ["builderBundleBytes", 509],
    ["builderBundleProofBytes", 127],
    ["nativePackBytes", 101],
    ["officialSolidRootBytes", 9],
    ["shadowSolidStudBytes", 31],
  ])("rejects digest drift in %s", async (role, offset) => {
    const mutated = clonedEvidence(evidence);
    mutated[role][offset] ^= 1;
    await expect(compileBuilder2453IdentityProof(mutated)).rejects.toThrow("must be exact");
  });

  it("rejects hollow substitution, oversized bytes, and a reflected artifact mutation", async () => {
    const hollow = clonedEvidence(evidence);
    hollow.officialSolidRootBytes = Buffer.from(evidence.officialHollowRootBytes);
    await expect(compileBuilder2453IdentityProof(hollow)).rejects.toThrow(
      "expected 801 through 801",
    );

    const oversized = clonedEvidence(evidence);
    oversized.officialSolidRootBytes = Buffer.concat([
      oversized.officialSolidRootBytes,
      Buffer.from([0]),
    ]);
    await expect(compileBuilder2453IdentityProof(oversized)).rejects.toThrow(
      "expected 801 through 801",
    );

    const reflected = JSON.parse(compiled.encoded.toString("utf8"));
    reflected.localPartFrame.matrix[0] = -5;
    const reflectedBytes = Buffer.from(`${JSON.stringify(reflected)}\n`);
    expect(reflectedBytes.length).toBe(compiled.encoded.length);
    expect(() => verifyBuilder2453IdentityArtifact(reflectedBytes)).toThrow(
      "2453 identity artifact digest is",
    );
  });
});

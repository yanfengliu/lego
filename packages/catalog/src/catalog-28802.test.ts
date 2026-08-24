import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  COLLISION_MODEL_VERSION,
  PART_DEFINITIONS,
  getPartDefinition,
  resolvePartId,
} from "./index.js";
import {
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_CLOSURE_MANIFESTS,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";

const PART_ID = "builtin:bracket-1x2-1x4-rounded-bottom";

const EXPECTED_CLOSURE = [
  ["p/1-4chrd.dat", 743, "sha256:ccba3a97b5cc358754e476b78b4ce61cce5f404cd15e37471b73df3e81784aec"],
  [
    "p/1-4cyli.dat",
    1044,
    "sha256:5a7168952a5a3570327873b9a5802fa7b3be40967ab78c03b6a2bfd4419a1f10",
  ],
  ["p/1-4cylo.dat", 388, "sha256:792a01362608c3f385dd7f01a1bd7d19cf9ed8a40f793266345cc86d1d98f3af"],
  ["p/1-4edge.dat", 545, "sha256:9ce2de7e67bbac575d52cfdc771b9d00856efc9b88002d97db8e665e50f4d467"],
  [
    "p/4-4cyli.dat",
    2687,
    "sha256:4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
  ],
  [
    "p/4-4disc.dat",
    1137,
    "sha256:a00b5547776f61a7389d303616987c76b3c4de86ad8ec32f22857e1bd5e5e40f",
  ],
  [
    "p/4-4edge.dat",
    1084,
    "sha256:54a52196e421fd1717d291ff52ea57553b1fb238907c1678cc1f1a84c698b1da",
  ],
  [
    "p/4-4ring2.dat",
    1628,
    "sha256:6fb38804b1f5e9bee8c0b80caf1397b09454fc58b048dc19045b6f37c8762ab0",
  ],
  ["p/box3u5p.dat", 658, "sha256:0f52d5c372a303f508113ace2c7cba6d52b46171052e76a88266679a74f17ea5"],
  ["p/box4-1.dat", 973, "sha256:2ed58df5da841827dfc5f9ac11c0bd7ffd8a455e46f166638e635f61a014b44d"],
  [
    "p/box4-4a.dat",
    1067,
    "sha256:58c69e00462c0a74c1bd6d75d757d826ae13e98bd3928b0e685209003bfbee54",
  ],
  ["p/box5-1.dat", 655, "sha256:c23e2cb13761c0af92c930af610075d82370a7f2ea89194fa808f0c4cf877bf2"],
  ["p/rect2p.dat", 594, "sha256:faac2b36241a9de0c0108471e59c45734df6c79813332d9cacf97f6391886acc"],
  ["p/stud.dat", 698, "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4"],
  ["p/stud2.dat", 930, "sha256:5ed3702c7d7000bfac2906f12b74ae312c59194a8e3b504952820c826b51c810"],
  ["p/stud3.dat", 710, "sha256:d29e9160faeaf85b2b72a098e89a81f41e0082517a82065d7b1f149b5fd2addd"],
  [
    "p/stug-2x1.dat",
    341,
    "sha256:03d08cea230e892e1b6cbfe523c19b568a834c5888aac5c789d1fb8d6ee93d96",
  ],
  [
    "p/stug2-4x1.dat",
    424,
    "sha256:179d252971d76f12196c7c2c3b6f89bb6c7eab21d9df9625f44a8064e49e4996",
  ],
  [
    "parts/28802.dat",
    1634,
    "sha256:aaa44c27ae9885a6b463aa477fcd1b2b153fa540aba626823bc3bb0844b0780c",
  ],
] as const;

describe("28802 rounded-bottom bracket catalog truth", () => {
  it("is one distinct searchable bracket and never aliases Builder's contradictory 10201", () => {
    const part = getPartDefinition(PART_ID)!;
    expect(part).toMatchObject({
      id: PART_ID,
      family: "bracket",
      displayName: "Bracket 1 x 2 - 1 x 4 Rounded Bottom",
      dimensions: { widthStuds: 4, lengthStuds: 1, heightLdu: 20 },
      bodyBoundsLdu: { min: [-40, -10, -14], max: [40, 10, 10] },
      boundsLdu: { min: [-40, -14, -18], max: [40, 10, 10] },
    });
    expect(resolvePartId("28802.dat")).toBe(PART_ID);
    expect(resolvePartId("ldraw:28802.dat")).toBe(PART_ID);
    expect(part.aliases.map(({ value }) => value)).toContain("28802.dat");
    expect(resolvePartId("10201.dat")).not.toBe(PART_ID);
    expect(resolvePartId("2436b.dat")).not.toBe(PART_ID);
  });

  it("pins the exact official 19-file, 17,940-byte closure and source provenance", () => {
    const rows = BUNDLED_LDRAW_CLOSURES["28802"]!.map((index) => {
      const { path, bytes, sha256 } = BUNDLED_LDRAW_SOURCE_FILES[index]!;
      return [path, bytes, sha256] as const;
    });
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "28802")!;
    expect(rows).toEqual(EXPECTED_CLOSURE);
    expect(blueprint.ldrawSource).toEqual({
      title: "Bracket  1 x  2 -  1 x  4 with Rounded Bottom Corners",
      author: "Vincent Messenet [Cheenzo]",
      ldrawOrg: "Part UPDATE 2020-02",
      licenseExpression: "CC-BY-4.0",
      rootSha256: "sha256:aaa44c27ae9885a6b463aa477fcd1b2b153fa540aba626823bc3bb0844b0780c",
      closureFileCount: 19,
    });
    expect(BUNDLED_LDRAW_CLOSURE_MANIFESTS["28802"]).toEqual({
      bytes: 17_940,
      manifestSha256: "sha256:e8c326b7fe592ceb83142f62eca6ce3c74c60bad83d3b095a12c80ffece54806",
    });
    expect(Object.keys(BUNDLED_LDRAW_CLOSURES)).toHaveLength(35);
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(207);
    expect(new Set(BUNDLED_LDRAW_SOURCE_FILES.map(({ author }) => author))).toHaveLength(30);
  });

  it("carries six outward stud frames, two LDCad clutch cells, and no semantic bores", () => {
    const part = getPartDefinition(PART_ID)!;
    const blueprint = SET_6651557_MEASURED_BLUEPRINTS.find(({ designId }) => designId === "28802")!;
    if (!("ldcadShadowSource" in blueprint)) throw new Error("28802 has no pinned LDCad route");
    expect(blueprint.ldcadShadowSource).toEqual({
      libraryId: "ldcad-shadow-library",
      commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
      manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
      compositionId: "ldcad-shadow-composed-over-ldraw-tree/1",
      shadowFiles: ["p/stud.dat", "p/stud2.dat", "p/stud3.dat", "parts/28802.dat"],
    });
    expect(
      part.connectors.map(({ kind, positionLdu, normal, orientationId }) => ({
        kind,
        positionLdu,
        normal,
        orientationId,
      })),
    ).toEqual([
      {
        kind: "stud",
        positionLdu: [-30, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
      },
      {
        kind: "stud",
        positionLdu: [-10, -10, 0],
        normal: [0, -1, 0],
        orientationId: "connector-up",
      },
      {
        kind: "stud",
        positionLdu: [-10, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
      },
      {
        kind: "stud",
        positionLdu: [10, -10, 0],
        normal: [0, -1, 0],
        orientationId: "connector-up",
      },
      {
        kind: "stud",
        positionLdu: [10, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
      },
      {
        kind: "stud",
        positionLdu: [30, 0, -14],
        normal: [0, 0, -1],
        orientationId: "connector-z-negative",
      },
      {
        kind: "undersideClutch",
        positionLdu: [-10, -2, 0],
        normal: [0, 1, 0],
        orientationId: "connector-down",
      },
      {
        kind: "undersideClutch",
        positionLdu: [10, -2, 0],
        normal: [0, 1, 0],
        orientationId: "connector-down",
      },
    ]);
    expect(part.collision.primitives.filter(({ kind }) => kind === "cylinder")).toHaveLength(6);
    expect(
      part.collision.primitives.some(
        (primitive) => primitive.kind === "cylinder" && primitive.radiusLdu === 4,
      ),
    ).toBe(false);
  });

  it("binds the 618-triangle mesh and contains every collision primitive in visual bounds", () => {
    const part = getPartDefinition(PART_ID)!;
    const asset = SET_6651557_MESH_ASSETS["ldraw:official:28802.dat"]!;
    if (asset.indices === undefined) throw new Error("28802 mesh is unexpectedly unindexed");
    expect(asset.groups).toEqual([
      { role: "body", triangleStart: 0, triangleCount: 138 },
      { role: "stud", triangleStart: 138, triangleCount: 480 },
    ]);
    expect(asset.indices.length / 3).toBe(618);
    for (const primitive of part.collision.primitives) {
      if (primitive.kind === "box") {
        expect(primitive.minLdu.every((value, axis) => value >= part.boundsLdu.min[axis]!)).toBe(
          true,
        );
        expect(primitive.maxLdu.every((value, axis) => value <= part.boundsLdu.max[axis]!)).toBe(
          true,
        );
        continue;
      }
      if (primitive.kind !== "cylinder") continue;
      const axis = "xyz".indexOf(primitive.axis);
      const half = [primitive.radiusLdu, primitive.radiusLdu, primitive.radiusLdu];
      half[axis] = primitive.heightLdu / 2;
      expect(
        primitive.centerLdu.every(
          (value, coordinate) =>
            value - half[coordinate]! >= part.boundsLdu.min[coordinate]! &&
            value + half[coordinate]! <= part.boundsLdu.max[coordinate]!,
        ),
      ).toBe(true);
    }
  });

  it("keeps every /14 part payload byte unchanged after restoring its historical truth labels", () => {
    const priorParts = PART_DEFINITIONS.slice(0, 86);
    const priorDefinitionBytes = JSON.stringify(priorParts)
      .replaceAll("builtin.basic-parts/24", "builtin.basic-parts/14")
      .replaceAll("rectilinear-stud-clearance/3", "rectilinear-stud-clearance/2");
    const rows = priorParts.map(({ id, connectors, collision }) => ({ id, connectors, collision }));
    const collisionRows = priorParts.map(({ id, collision }) => ({ id, collision }));
    const priorConnectorCollisionBytes = JSON.stringify(rows).replaceAll(
      "rectilinear-stud-clearance/3",
      "rectilinear-stud-clearance/2",
    );
    const priorCollisionBytes = JSON.stringify(collisionRows).replaceAll(
      "rectilinear-stud-clearance/3",
      "rectilinear-stud-clearance/2",
    );
    expect(priorParts).toHaveLength(86);
    expect(priorDefinitionBytes).toHaveLength(1_472_505);
    expect(createHash("sha256").update(priorDefinitionBytes).digest("hex")).toBe(
      "a0802ceb4855d1cda11350f29f60d244592a9c3e6e8c835ff344a8a465a3e55a",
    );
    expect(createHash("sha256").update(priorConnectorCollisionBytes).digest("hex")).toBe(
      "53c64eda0142fcd996db02843998715d9569c06e7a112ff2e210f7e87ca165c2",
    );
    expect(createHash("sha256").update(priorCollisionBytes).digest("hex")).toBe(
      "9d23769d44b4bd8d9d96fcb41e6bb5d4162c2ef8bd32d78d16d02603cabc1549",
    );
    expect(COLLISION_MODEL_VERSION).toBe("rectilinear-stud-clearance/3");
    expect(
      priorParts.flatMap(({ id, collision }) =>
        collision.primitives
          .filter(
            (primitive) =>
              primitive.kind === "cylinder" && primitive.tag === "stud" && primitive.axis !== "y",
          )
          .map((primitive) => `${id}/${primitive.id}`),
      ),
    ).toEqual([]);
    expect(
      getPartDefinition(PART_ID)!.collision.primitives.filter(
        (primitive) =>
          primitive.kind === "cylinder" && primitive.tag === "stud" && primitive.axis !== "y",
      ),
    ).toHaveLength(4);
  });
});

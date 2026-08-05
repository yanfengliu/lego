import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  applyBuilderCanonicalCalibration,
  composeBuilderTransforms,
  parseOfficialModelIndex,
  resolveBuilderBoneTransform,
  validateOfficialModelAccounting,
} from "../e2e/real-build-official";
import { builderCuboidGeometry } from "./real-build-frame-test-fixture";

const identityBone = "1,0,0,0,1,0,0,0,1,0,0,0";
const liveOfficialModelPath = resolve(process.cwd(), "output/official-model/vx1087034_21066_a.xml");

function physicalBrickXml(
  brickRef: string,
  designRevision: string,
  transformation: string,
): string {
  return (
    `<Brick uuid="${brickRef}" designID="${designRevision}" itemNos="300501">` +
    `<Part uuid="part-${brickRef}" designID="${designRevision}" materials="1">` +
    `<Bone uuid="bone-${brickRef}" transformation="${transformation}"/>` +
    `</Part></Brick>`
  );
}

function builderInstructionsXml(
  directBrickRefs: readonly string[],
  copies: readonly { readonly source: string; readonly actual: string }[] = [],
): string {
  const renderSubBuild = (uuid: string, refs: readonly string[]): string =>
    `<SubBuild uuid="${uuid}"><Step uuid="step-${uuid}">${refs
      .map((brickRef) => `<In brickRef="${brickRef}"/>`)
      .join("")}</Step>` +
    `<CameraFittingRange range="0,1"/>` +
    `<StartImageView uuid="view-${uuid}"><Added/><Removed/></StartImageView></SubBuild>`;
  const remainingDirect = [...directBrickRefs];
  const masterDirect: string[] = [];
  for (const { source } of copies) {
    const index = remainingDirect.indexOf(source);
    if (index >= 0) masterDirect.push(...remainingDirect.splice(index, 1));
  }
  const subBuilds =
    copies.length === 0
      ? renderSubBuild("fixture-subbuild", remainingDirect)
      : renderSubBuild("fixture-master", masterDirect) +
        (remainingDirect.length === 0 ? "" : renderSubBuild("fixture-remainder", remainingDirect));
  const multiBuild =
    copies.length === 0
      ? ""
      : `<MultiBuild name="fixture-copy" masterSubBuildRef="fixture-master">${copies
          .map(
            ({ source, actual }) =>
              `<MultiBuildBrick originalBrickRef="${source}" actualBrickRef="${actual}"/>`,
          )
          .join("")}</MultiBuild>`;
  const aggregate = [...directBrickRefs, ...copies.map(({ actual }) => actual)]
    .map((brickRef) => `<In brickRef="${brickRef}"/>`)
    .join("");
  return (
    `<BuildingInstructions>` +
    `<BuildingInstruction name="Building Instruction ##B" uuid="fixture-instruction">` +
    `<Steps><Step uuid="fixture-root">${subBuilds}${multiBuild}` +
    `<EndOnHighView><Added/><Removed/></EndOnHighView>` +
    `</Step></Steps></BuildingInstruction>` +
    `<BuildingInstruction name="Group #IX" uuid="fixture-aggregate">` +
    `<Steps><Step uuid="fixture-aggregate-step">${aggregate}` +
    `<EndOnHighView><Added/><Removed/></EndOnHighView></Step></Steps>` +
    `</BuildingInstruction></BuildingInstructions>` +
    `<BIGraph><GraphNode uuid="fixture-graph">` +
    `<BINode uuid="fixture-primary-node" buildingInstructionRef="fixture-instruction"/>` +
    `<BINode uuid="fixture-aggregate-node" buildingInstructionRef="fixture-aggregate"/>` +
    `<Dependency predecessorRef="fixture-primary-node" successorRef="fixture-aggregate-node"/>` +
    `</GraphNode></BIGraph>`
  );
}

function exactAccountingXml(duplicateDirect = false): Uint8Array {
  const bricks = Array.from({ length: 1_465 }, (_, index) => {
    const design = index === 1_464 ? "31510" : "3005";
    return physicalBrickXml(`b${index}`, design, identityBone);
  });
  const directBrickRefs = Array.from({ length: 1_395 }, (_, index) => `b${index}`);
  if (duplicateDirect) directBrickRefs.push("b100");
  const copies = Array.from({ length: 69 }, (_, index) => ({
    source: `b${index}`,
    actual: `b${1_395 + index}`,
  }));
  return new TextEncoder().encode(
    `<Root><Bricks>${bricks.join("")}</Bricks>${builderInstructionsXml(directBrickRefs, copies)}</Root>`,
  );
}

describe("official Builder model truth", () => {
  it("independently derives the exact 1395 + 69 = 1464 accounting and unmatched separator", () => {
    const official = parseOfficialModelIndex(exactAccountingXml());

    expect(validateOfficialModelAccounting(official)).toEqual([]);
    expect(official.directBrickRefs.size).toBe(1_395);
    expect(official.multiBuildByActualRef.size).toBe(69);
    expect(official.unmatchedInventoryBrickRefs).toEqual(new Set(["b1464"]));
    expect(() => parseOfficialModelIndex(exactAccountingXml(true))).toThrow(
      /repeats direct In Brick b100/u,
    );
  });

  it("transposes LXF rotations, composes the discrete local frame, and rejects unrepresentable Bone data", () => {
    const xml = new TextEncoder().encode(
      `<Root><Bricks>` +
        physicalBrickXml("yaw-0", "3005;rev-a", identityBone) +
        physicalBrickXml("yaw-270", "3005;rev-a", "0,0,1,0,1,0,-1,0,0,0,0,0") +
        physicalBrickXml("yaw-180", "3005;rev-a", "-1,0,0,0,1,0,0,0,-1,0,0,0") +
        physicalBrickXml("yaw-90", "3005;rev-a", "0,0,-1,0,1,0,1,0,0,0,0,0") +
        physicalBrickXml("tilted", "3005;rev-a", "1,0,0,0,0,-1,0,1,0,0,0,0") +
        `</Bricks>` +
        builderInstructionsXml(["yaw-0", "tilted"]) +
        `</Root>`,
    );
    const raw = parseOfficialModelIndex(xml);
    expect(
      ["yaw-0", "yaw-90", "yaw-180", "yaw-270"].map(
        (brickRef) =>
          resolveBuilderBoneTransform(raw.bricks[brickRef]!.builderTransform!).transform
            ?.orientationId,
      ),
    ).toEqual(["upright-yaw-0", "upright-yaw-90", "upright-yaw-180", "upright-yaw-270"]);
    expect(
      composeBuilderTransforms(
        resolveBuilderBoneTransform(raw.bricks["yaw-0"]!.builderTransform!).transform!,
        { positionLdu: [30, -4, -30], orientationId: "upright-yaw-0" },
      ),
    ).toEqual({ positionLdu: [30, -4, -30], orientationId: "upright-yaw-0" });
    const tilted = resolveBuilderBoneTransform(raw.bricks.tilted!.builderTransform!);
    expect(tilted.transform).toBeNull();
    expect(tilted.failure).toContain("cannot be expressed");
  });

  it("rejects a synthetic model before its rehashed cuboid can cross the official-source pin", () => {
    const raw = parseOfficialModelIndex(
      new TextEncoder().encode(
        `<Root><Bricks>` +
          physicalBrickXml("yaw-0", "3005;rev-a", identityBone) +
          `</Bricks>` +
          builderInstructionsXml(["yaw-0"]) +
          `</Root>`,
      ),
    );
    const counterfeit = builderCuboidGeometry("builtin:brick-1x1", {
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-0",
    });
    const calibrationBytes = new TextEncoder().encode("{}");
    expect(() =>
      applyBuilderCanonicalCalibration(
        raw,
        calibrationBytes,
        sha256Digest(calibrationBytes),
        counterfeit.bytes,
        sha256Digest(counterfeit.bytes),
      ),
    ).toThrow(/pinned to official model/u);
  });

  it("preserves a composite Brick as one unresolved instruction identity", () => {
    const partDesigns = ["3814;X", "3818;P", "3819;R", "3820;G", "3820;G"];
    const composite =
      `<Brick uuid="composite" designID="76382;AO" itemNos="763821">` +
      partDesigns
        .map(
          (designRevision, index) =>
            `<Part uuid="composite-part-${index}" designID="${designRevision}" materials="1">` +
            `<Bone uuid="composite-bone-${index}" transformation="${identityBone}"/></Part>`,
        )
        .join("") +
      `</Brick>`;
    const official = parseOfficialModelIndex(
      new TextEncoder().encode(
        `<Root><Bricks>${composite}</Bricks>${builderInstructionsXml(["composite"])}</Root>`,
      ),
    );

    expect(official.bricks.composite).toMatchObject({
      designId: "76382",
      designRevision: "76382;AO",
      itemNos: ["763821"],
      builderTransform: null,
      canonicalTransform: null,
    });
    expect(official.bricks.composite!.parts.map(({ designRevision }) => designRevision)).toEqual(
      partDesigns,
    );
    expect(official.bricks.composite!.builderTransformFailure).toContain(
      "5 independently transformed Part leaves",
    );
  });

  it("rejects missing physical identities and concealed Builder actions", () => {
    const brick = physicalBrickXml("only", "3005", identityBone);
    const valid = `<Root><Bricks>${brick}</Bricks>${builderInstructionsXml(["only"])}</Root>`;
    const selfClosingBrick = valid.replace(brick, '<Brick uuid="only" designID="3005"/>');
    const missingItemNo = valid.replace(' itemNos="300501"', "");
    const mismatchedRevision = valid.replace(
      'Part uuid="part-only" designID="3005"',
      'Part uuid="part-only" designID="3004"',
    );
    const hiddenAction = valid.replace(
      '<CameraFittingRange range="0,1"/>',
      '<Explode><In brickRef="concealed"/></Explode><CameraFittingRange range="0,1"/>',
    );

    expect(() => parseOfficialModelIndex(new TextEncoder().encode(selfClosingBrick))).toThrow(
      /Brick starts but only 0 closed records/u,
    );
    expect(() => parseOfficialModelIndex(new TextEncoder().encode(missingItemNo))).toThrow(
      /needs one or more unique numeric itemNos/u,
    );
    expect(() => parseOfficialModelIndex(new TextEncoder().encode(mismatchedRevision))).toThrow(
      /design 3005 disagrees/u,
    );
    expect(() => parseOfficialModelIndex(new TextEncoder().encode(hiddenAction))).toThrow(
      /misplaced or unsupported/u,
    );
  });

  it.skipIf(!existsSync(liveOfficialModelPath))(
    "reparses the retained official source with exact ordered and composite invariants",
    () => {
      const bytes = readFileSync(liveOfficialModelPath);
      expect(sha256Digest(bytes)).toBe(
        "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
      );
      const official = parseOfficialModelIndex(bytes);

      expect(Object.keys(official.bricks)).toHaveLength(1_465);
      expect(Object.values(official.bricks).flatMap(({ parts }) => parts)).toHaveLength(1_469);
      expect(official.builderOrder.phases).toHaveLength(561);
      expect(official.directBrickRefs.size).toBe(1_395);
      expect(official.multiBuildByActualRef.size).toBe(69);
      expect(official.builderOrder.aggregateBrickRefs.size).toBe(1_464);
      expect(
        official.builderOrder.phases
          .slice(0, 3)
          .map((phase) => (phase.kind === "direct" ? phase.brickRefs : null)),
      ).toEqual([
        ["76092bf0-3d72-474a-baf3-06b837082f6a"],
        ["21288f64-b9d5-4efb-92b9-427a17832a45"],
        ["9d453fd1-adbe-44b8-ae21-d499a2c01e46"],
      ]);
      expect(official.bricks["2d36f089-87da-44d0-b2c6-85a3bcd459b8"]).toMatchObject({
        designRevision: "76382;AO",
        builderTransform: null,
      });
      expect(official.bricks["2d36f089-87da-44d0-b2c6-85a3bcd459b8"]!.parts).toHaveLength(5);
    },
  );
});

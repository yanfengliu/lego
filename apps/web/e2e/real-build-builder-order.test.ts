import { describe, expect, it } from "vitest";

import { parseOfficialBuilderOrder } from "./real-build-builder-order";

const view = (name: "StartImageView" | "EndOnHighView"): string =>
  `<${name}><Added/><Removed/></${name}>`;

function syntheticNestedBuilderXml(): Uint8Array {
  const identities = [
    "root-before",
    "outer-before",
    "nested-only",
    "outer-after",
    "root-after",
    "terminal-only",
  ];
  return new TextEncoder().encode(`
<Model>
 <BuildingInstruction name="Building Instruction ##B" uuid="primary-instruction">
  <Steps>
   <Step uuid="root-step">
    <SubBuild uuid="empty-before">
     <Step uuid="empty-before-step"></Step>
     ${view("StartImageView")}
    </SubBuild>
    <In brickRef="root-before"/>
    <SubBuild uuid="outer-child">
     <Step uuid="outer-child-step">
      <In brickRef="outer-before"/>
      <SubBuild uuid="nested-child">
       <Step uuid="nested-child-step"><In brickRef="nested-only"/></Step>
       ${view("StartImageView")}
      </SubBuild>
      <In brickRef="outer-after"/>
     </Step>
     ${view("StartImageView")}
    </SubBuild>
    <In brickRef="root-after"/>
    <SubBuild uuid="terminal-child">
     <Step uuid="terminal-child-step"><In brickRef="terminal-only"/></Step>
     ${view("StartImageView")}
    </SubBuild>
    ${view("EndOnHighView")}
   </Step>
  </Steps>
 </BuildingInstruction>
 <BuildingInstruction name="Group #IX" uuid="aggregate-instruction">
  <Steps>
   <Step uuid="aggregate-step">
    ${identities.map((brickRef) => `<In brickRef="${brickRef}"/>`).join("\n    ")}
    ${view("EndOnHighView")}
   </Step>
  </Steps>
 </BuildingInstruction>
 <BIGraph>
  <BINode uuid="primary-node" buildingInstructionRef="primary-instruction"/>
  <BINode uuid="aggregate-node" buildingInstructionRef="aggregate-instruction"/>
  <Dependency predecessorRef="primary-node" successorRef="aggregate-node"/>
 </BIGraph>
</Model>
`);
}

describe("official Builder structural order", () => {
  it("retains nested physical membership and exact before, between, and after phase boundaries", () => {
    const order = parseOfficialBuilderOrder(syntheticNestedBuilderXml());

    expect(order.phases.map(({ sequence, kind }) => ({ sequence, kind }))).toEqual(
      Array.from({ length: 6 }, (_, index) => ({ sequence: index + 1, kind: "direct" })),
    );
    expect(order.structuralEvents).toEqual([
      expect.objectContaining({
        kind: "sub-build-complete",
        sequence: 1,
        parentStepUuid: "root-step",
        parentSubBuildPath: [],
        childSubBuildUuid: "empty-before",
        childSubBuildPath: ["empty-before"],
        precedingPhaseSequence: null,
        followingPhaseSequence: 1,
        physicalBrickRefs: [],
      }),
      expect.objectContaining({
        kind: "sub-build-complete",
        sequence: 2,
        parentStepUuid: "outer-child-step",
        parentSubBuildPath: ["outer-child"],
        childSubBuildUuid: "nested-child",
        childSubBuildPath: ["outer-child", "nested-child"],
        precedingPhaseSequence: 3,
        followingPhaseSequence: 4,
        physicalBrickRefs: ["nested-only"],
      }),
      expect.objectContaining({
        kind: "sub-build-complete",
        sequence: 3,
        parentStepUuid: "root-step",
        parentSubBuildPath: [],
        childSubBuildUuid: "outer-child",
        childSubBuildPath: ["outer-child"],
        precedingPhaseSequence: 4,
        followingPhaseSequence: 5,
        physicalBrickRefs: ["outer-before", "nested-only", "outer-after"],
      }),
      expect.objectContaining({
        kind: "sub-build-complete",
        sequence: 4,
        parentStepUuid: "root-step",
        parentSubBuildPath: [],
        childSubBuildUuid: "terminal-child",
        childSubBuildPath: ["terminal-child"],
        precedingPhaseSequence: 6,
        followingPhaseSequence: null,
        physicalBrickRefs: ["terminal-only"],
      }),
    ]);
    expect(order.structuralDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});

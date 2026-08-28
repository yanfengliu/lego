import {
  OFFICIAL_BUILDER_AGGREGATE_NAME,
  OFFICIAL_BUILDER_INSTRUCTION_NAME,
  OFFICIAL_BUILDER_ORDER_SCHEMA,
  OFFICIAL_BUILDER_STRUCTURAL_ORDER_SCHEMA,
  SHA256,
  assertExplodeMetadata,
  assertOfficialBuilderXmlByteLength,
  assertViewMetadata,
  descendants,
  digest,
  oneChild,
  parseXmlTree,
  phaseSourceDigest,
  requiredAttribute,
  type OfficialBuilderOrder,
  type OfficialBuilderPhase,
  type OfficialBuilderSubBuildCompleteEvent,
  type XmlNode,
} from "./real-build-builder-order-support";

export {
  OFFICIAL_BUILDER_AGGREGATE_NAME,
  OFFICIAL_BUILDER_INSTRUCTION_NAME,
  OFFICIAL_BUILDER_ORDER_SCHEMA,
  OFFICIAL_BUILDER_STRUCTURAL_ORDER_SCHEMA,
} from "./real-build-builder-order-support";
export type {
  OfficialBuilderDirectPhase,
  OfficialBuilderMultiBuildPhase,
  OfficialBuilderOrder,
  OfficialBuilderPhase,
  OfficialBuilderStructuralEvent,
  OfficialBuilderSubBuildCompleteEvent,
} from "./real-build-builder-order-support";

/** Parses only the sequenced Builder program and independently checks its aggregate sibling. */
export function parseOfficialBuilderOrder(xmlBytes: Uint8Array): OfficialBuilderOrder {
  assertOfficialBuilderXmlByteLength(xmlBytes);
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
  const sourceDigest = digest(xmlBytes);
  const roots = parseXmlTree(xml);
  const instructions = descendants(roots, "BuildingInstruction");
  const primary = instructions.filter(
    (node) => node.attributes.name === OFFICIAL_BUILDER_INSTRUCTION_NAME,
  );
  const aggregate = instructions.filter(
    (node) => node.attributes.name === OFFICIAL_BUILDER_AGGREGATE_NAME,
  );
  if (primary.length !== 1 || aggregate.length !== 1) {
    throw new TypeError(
      `Official Builder XML requires exactly one ${OFFICIAL_BUILDER_INSTRUCTION_NAME} sequenced program and ` +
        `one ${OFFICIAL_BUILDER_AGGREGATE_NAME} aggregate; received ${primary.length}/${aggregate.length}.`,
    );
  }
  const instruction = primary[0]!;
  const instructionUuid = requiredAttribute(instruction, "uuid", OFFICIAL_BUILDER_INSTRUCTION_NAME);
  const aggregateInstructionUuid = requiredAttribute(
    aggregate[0]!,
    "uuid",
    OFFICIAL_BUILDER_AGGREGATE_NAME,
  );
  const stepsContainer = oneChild(instruction, "Steps", OFFICIAL_BUILDER_INSTRUCTION_NAME);
  const rootStep = oneChild(stepsContainer, "Step", `${OFFICIAL_BUILDER_INSTRUCTION_NAME} Steps`);
  const rootStepUuid = requiredAttribute(rootStep, "uuid", "Official Builder root Step");
  const phases: OfficialBuilderPhase[] = [];
  const pendingStructuralEvents: Omit<
    OfficialBuilderSubBuildCompleteEvent,
    "followingPhaseSequence"
  >[] = [];
  const directBrickRefs = new Set<string>();
  const multiBuildByActualRef = new Map<string, string>();
  const stepUuids = new Set<string>();
  const subBuildUuids = new Set<string>();
  const completedSubBuildUuids = new Set<string>();
  const directSourcePathByBrickRef = new Map<string, readonly string[]>();
  const directBrickRefsBySubBuild = new Map<string, string[]>();
  const physicalBrickRefsBySubBuild = new Map<string, string[]>();

  const appendPhysicalSubBuildMember = (
    brickRef: string,
    subBuildPath: readonly string[],
  ): void => {
    for (const subBuildRef of subBuildPath) {
      const members = physicalBrickRefsBySubBuild.get(subBuildRef) ?? [];
      members.push(brickRef);
      physicalBrickRefsBySubBuild.set(subBuildRef, members);
    }
  };

  const appendDirect = (
    nodes: readonly XmlNode[],
    stepUuid: string,
    subBuildPath: readonly string[],
    phaseOrdinal: number,
  ): void => {
    if (nodes.length === 0) return;
    const brickRefs = nodes.map((node) =>
      requiredAttribute(node, "brickRef", `Step ${stepUuid} In`),
    );
    for (const brickRef of brickRefs) {
      if (directBrickRefs.has(brickRef)) {
        throw new TypeError(`Sequenced Builder program repeats direct In Brick ${brickRef}.`);
      }
      directBrickRefs.add(brickRef);
      directSourcePathByBrickRef.set(brickRef, [...subBuildPath]);
      appendPhysicalSubBuildMember(brickRef, subBuildPath);
      for (const subBuildRef of subBuildPath) {
        const members = directBrickRefsBySubBuild.get(subBuildRef) ?? [];
        members.push(brickRef);
        directBrickRefsBySubBuild.set(subBuildRef, members);
      }
    }
    const sequence = phases.length + 1;
    const fragmentDigest = digest(nodes.map((node) => xml.slice(node.start, node.end)).join("\n"));
    const payload = { brickRefs };
    const source = phaseSourceDigest({
      sourceDigest,
      instructionUuid,
      sequence,
      kind: "direct",
      stepUuid,
      subBuildPath,
      phaseOrdinal,
      fragmentDigest,
      payload,
    });
    phases.push({
      kind: "direct",
      sequence,
      phaseId: `direct:${stepUuid}:${phaseOrdinal}`,
      sourceDigest: source,
      stepUuid,
      subBuildPath: [...subBuildPath],
      brickRefs,
    });
  };

  const appendMultiBuild = (
    node: XmlNode,
    stepUuid: string,
    subBuildPath: readonly string[],
    phaseOrdinal: number,
  ): void => {
    const multiBuildName = requiredAttribute(node, "name", `Step ${stepUuid} MultiBuild`);
    const masterSubBuildRef = requiredAttribute(
      node,
      "masterSubBuildRef",
      `Step ${stepUuid} MultiBuild`,
    );
    const copyNodes = node.children.filter((child) => child.name === "MultiBuildBrick");
    if (copyNodes.length < 1 || copyNodes.length !== node.children.length) {
      throw new TypeError(
        `Step ${stepUuid} MultiBuild ${multiBuildName} must contain only one or more direct MultiBuildBrick rows.`,
      );
    }
    if (!completedSubBuildUuids.has(masterSubBuildRef)) {
      throw new TypeError(
        `Step ${stepUuid} MultiBuild ${multiBuildName} references master SubBuild ${masterSubBuildRef} before it is complete.`,
      );
    }
    const copies = copyNodes.map((copy) => ({
      sourceBrickRef: requiredAttribute(
        copy,
        "originalBrickRef",
        `Step ${stepUuid} MultiBuildBrick`,
      ),
      actualBrickRef: requiredAttribute(copy, "actualBrickRef", `Step ${stepUuid} MultiBuildBrick`),
    }));
    const masterBrickRefs = directBrickRefsBySubBuild.get(masterSubBuildRef) ?? [];
    const copySourceRefs = new Set(copies.map((copy) => copy.sourceBrickRef));
    if (
      copies.length !== masterBrickRefs.length ||
      copySourceRefs.size !== copies.length ||
      masterBrickRefs.some((brickRef) => !copySourceRefs.has(brickRef))
    ) {
      throw new TypeError(
        `Step ${stepUuid} MultiBuild ${multiBuildName} must copy every Brick from completed master SubBuild ` +
          `${masterSubBuildRef} exactly once; received ${copies.length}/${masterBrickRefs.length}.`,
      );
    }
    for (const copy of copies) {
      if (!directBrickRefs.has(copy.sourceBrickRef)) {
        throw new TypeError(
          `Step ${stepUuid} MultiBuild actual ${copy.actualBrickRef} must copy an earlier direct Brick; source ${copy.sourceBrickRef} has not appeared.`,
        );
      }
      if (!directSourcePathByBrickRef.get(copy.sourceBrickRef)?.includes(masterSubBuildRef)) {
        throw new TypeError(
          `Step ${stepUuid} MultiBuild actual ${copy.actualBrickRef} source ${copy.sourceBrickRef} does not belong to completed master SubBuild ${masterSubBuildRef}.`,
        );
      }
      if (directBrickRefs.has(copy.actualBrickRef) || copy.actualBrickRef === copy.sourceBrickRef) {
        throw new TypeError(
          `Step ${stepUuid} MultiBuild actual ${copy.actualBrickRef} must be distinct from every direct Brick and its source ${copy.sourceBrickRef}.`,
        );
      }
      if (multiBuildByActualRef.has(copy.actualBrickRef)) {
        throw new TypeError(
          `Sequenced Builder program repeats MultiBuild actual Brick ${copy.actualBrickRef}.`,
        );
      }
      multiBuildByActualRef.set(copy.actualBrickRef, copy.sourceBrickRef);
      appendPhysicalSubBuildMember(copy.actualBrickRef, subBuildPath);
    }
    const sequence = phases.length + 1;
    const fragmentDigest = digest(xml.slice(node.start, node.end));
    const payload = { multiBuildName, masterSubBuildRef, copies };
    const source = phaseSourceDigest({
      sourceDigest,
      instructionUuid,
      sequence,
      kind: "multi-build-copy",
      stepUuid,
      subBuildPath,
      phaseOrdinal,
      fragmentDigest,
      payload,
    });
    phases.push({
      kind: "multi-build-copy",
      sequence,
      phaseId: `multi-build-copy:${stepUuid}:${phaseOrdinal}`,
      sourceDigest: source,
      stepUuid,
      subBuildPath: [...subBuildPath],
      multiBuildName,
      masterSubBuildRef,
      copies,
    });
  };

  const visitSubBuild = (
    node: XmlNode,
    parentPath: readonly string[],
  ): {
    readonly uuid: string;
    readonly path: readonly string[];
    readonly fragmentDigest: string;
    readonly physicalBrickRefs: readonly string[];
  } => {
    const uuid = requiredAttribute(node, "uuid", "Official Builder SubBuild");
    if (subBuildUuids.has(uuid)) {
      throw new TypeError(`Sequenced Builder program repeats SubBuild uuid ${uuid}.`);
    }
    subBuildUuids.add(uuid);
    const path = [...parentPath, uuid];
    const steps = node.children.filter((child) => child.name === "Step");
    if (steps.length < 1) {
      throw new TypeError(`Official Builder SubBuild ${uuid} contains no direct Step.`);
    }
    let metadataStarted = false;
    let startImageViews = 0;
    for (const child of node.children) {
      if (child.name === "Step" && !metadataStarted) visitStep(child, path, false);
      else if (child.name === "CameraFittingRange" && startImageViews === 0) {
        metadataStarted = true;
        assertViewMetadata(child, `Official Builder SubBuild ${uuid}`);
      } else if (child.name === "StartImageView" && startImageViews === 0) {
        metadataStarted = true;
        startImageViews += 1;
        assertViewMetadata(child, `Official Builder SubBuild ${uuid}`);
      } else {
        throw new TypeError(
          `Official Builder SubBuild ${uuid} must contain one or more Steps followed by CameraFittingRange metadata ` +
            `and exactly one final StartImageView; ${child.name} is misplaced or unsupported.`,
        );
      }
    }
    if (startImageViews !== 1 || node.children.at(-1)?.name !== "StartImageView") {
      throw new TypeError(
        `Official Builder SubBuild ${uuid} requires exactly one final StartImageView after all action Steps.`,
      );
    }
    completedSubBuildUuids.add(uuid);
    return {
      uuid,
      path,
      fragmentDigest: digest(xml.slice(node.start, node.end)),
      physicalBrickRefs: [...(physicalBrickRefsBySubBuild.get(uuid) ?? [])],
    };
  };

  const visitStep = (node: XmlNode, subBuildPath: readonly string[], root: boolean): void => {
    const stepUuid = requiredAttribute(node, "uuid", "Official Builder Step");
    if (stepUuids.has(stepUuid)) {
      throw new TypeError(`Sequenced Builder program repeats Step uuid ${stepUuid}.`);
    }
    stepUuids.add(stepUuid);
    const endViews = node.children.filter((child) => child.name === "EndOnHighView");
    if (
      (root && (endViews.length !== 1 || node.children.at(-1)?.name !== "EndOnHighView")) ||
      (!root && endViews.length > 0)
    ) {
      throw new TypeError(
        `Official Builder ${root ? "root " : ""}Step ${stepUuid} requires ${
          root ? "exactly one final" : "no"
        } EndOnHighView metadata element.`,
      );
    }
    let pending: XmlNode[] = [];
    let phaseOrdinal = 0;
    const flush = (): void => {
      if (pending.length === 0) return;
      phaseOrdinal += 1;
      appendDirect(pending, stepUuid, subBuildPath, phaseOrdinal);
      pending = [];
    };
    for (const child of node.children) {
      if (child.name === "In") {
        pending.push(child);
      } else if (child.name === "Explode") {
        assertExplodeMetadata(child, `Official Builder Step ${stepUuid}`);
        continue;
      } else if (child.name === "SubBuild") {
        flush();
        const completed = visitSubBuild(child, subBuildPath);
        const sequence = pendingStructuralEvents.length + 1;
        const precedingPhaseSequence = phases.length === 0 ? null : phases.length;
        const payload = {
          parentStepUuid: stepUuid,
          parentSubBuildPath: subBuildPath,
          childSubBuildUuid: completed.uuid,
          childSubBuildPath: completed.path,
          precedingPhaseSequence,
          physicalBrickRefs: completed.physicalBrickRefs,
        };
        pendingStructuralEvents.push({
          kind: "sub-build-complete",
          sequence,
          sourceDigest: digest(
            JSON.stringify({
              schemaVersion: OFFICIAL_BUILDER_STRUCTURAL_ORDER_SCHEMA,
              sourceDigest,
              instructionUuid,
              sequence,
              fragmentDigest: completed.fragmentDigest,
              payload,
            }),
          ),
          ...payload,
        });
      } else if (child.name === "MultiBuild") {
        flush();
        phaseOrdinal += 1;
        appendMultiBuild(child, stepUuid, subBuildPath, phaseOrdinal);
      } else if (root && child.name === "EndOnHighView") {
        flush();
        assertViewMetadata(child, `Official Builder Step ${stepUuid}`);
      } else {
        throw new TypeError(
          `Official Builder Step ${stepUuid} contains unsupported direct ${child.name}; source order is ambiguous.`,
        );
      }
    }
    flush();
  };

  visitStep(rootStep, [], true);
  if (phases.length < 1) {
    throw new TypeError("Sequenced Builder program contains no physical action phases.");
  }
  const aggregateSteps = oneChild(aggregate[0]!, "Steps", OFFICIAL_BUILDER_AGGREGATE_NAME);
  const aggregateStep = oneChild(
    aggregateSteps,
    "Step",
    `${OFFICIAL_BUILDER_AGGREGATE_NAME} Steps`,
  );
  const aggregateEndViews = aggregateStep.children.filter(
    (child) => child.name === "EndOnHighView",
  );
  if (
    aggregateSteps.children.length !== 1 ||
    aggregateEndViews.length !== 1 ||
    aggregateStep.children.some((child) => child.name !== "In" && child.name !== "EndOnHighView")
  ) {
    throw new TypeError(
      `${OFFICIAL_BUILDER_AGGREGATE_NAME} must contain exactly one Step with only direct In identities and one EndOnHighView.`,
    );
  }
  assertViewMetadata(aggregateEndViews[0]!, OFFICIAL_BUILDER_AGGREGATE_NAME);
  const aggregateBrickRefList = aggregateStep.children
    .filter((node) => node.name === "In")
    .map((node) => requiredAttribute(node, "brickRef", `${OFFICIAL_BUILDER_AGGREGATE_NAME} In`));
  const aggregateBrickRefs = new Set(aggregateBrickRefList);
  if (aggregateBrickRefs.size !== aggregateBrickRefList.length) {
    throw new TypeError(`${OFFICIAL_BUILDER_AGGREGATE_NAME} repeats a physical Brick identity.`);
  }
  const sequencedBrickRefs = new Set([...directBrickRefs, ...multiBuildByActualRef.keys()]);
  if (
    aggregateBrickRefs.size !== sequencedBrickRefs.size ||
    [...aggregateBrickRefs].some((brickRef) => !sequencedBrickRefs.has(brickRef))
  ) {
    throw new TypeError(
      `${OFFICIAL_BUILDER_AGGREGATE_NAME} must independently equal the sequenced direct + MultiBuild identity set; ` +
        `received ${aggregateBrickRefs.size}/${sequencedBrickRefs.size}.`,
    );
  }
  for (const [actualBrickRef, sourceBrickRef] of multiBuildByActualRef) {
    if (
      !directBrickRefs.has(sourceBrickRef) ||
      directBrickRefs.has(actualBrickRef) ||
      sourceBrickRef === actualBrickRef
    ) {
      throw new TypeError(
        `MultiBuild actual ${actualBrickRef} must copy a distinct earlier direct Brick; source is ${sourceBrickRef}.`,
      );
    }
  }
  const graphs = descendants(roots, "BIGraph");
  if (graphs.length !== 1) {
    throw new TypeError(
      `Official Builder XML requires exactly one BIGraph; received ${graphs.length}.`,
    );
  }
  const biNodes = descendants(graphs, "BINode");
  const primaryNodes = biNodes.filter(
    (node) => node.attributes.buildingInstructionRef === instructionUuid,
  );
  const aggregateNodes = biNodes.filter(
    (node) => node.attributes.buildingInstructionRef === aggregateInstructionUuid,
  );
  if (primaryNodes.length !== 1 || aggregateNodes.length !== 1) {
    throw new TypeError(
      `BIGraph must contain one node for sequenced instruction ${instructionUuid} and aggregate ${aggregateInstructionUuid}; ` +
        `received ${primaryNodes.length}/${aggregateNodes.length}.`,
    );
  }
  const primaryNodeRef = requiredAttribute(primaryNodes[0]!, "uuid", "BIGraph primary BINode");
  const aggregateNodeRef = requiredAttribute(
    aggregateNodes[0]!,
    "uuid",
    "BIGraph aggregate BINode",
  );
  const allDependencies = descendants(graphs, "Dependency");
  const dependencies = allDependencies.filter(
    (node) =>
      node.attributes.predecessorRef === primaryNodeRef &&
      node.attributes.successorRef === aggregateNodeRef,
  );
  if (biNodes.length !== 2 || allDependencies.length !== 1 || dependencies.length !== 1) {
    throw new TypeError(
      `BIGraph must contain only the sequenced and aggregate BI nodes and identify ${OFFICIAL_BUILDER_INSTRUCTION_NAME} ` +
        `as the unique predecessor of ${OFFICIAL_BUILDER_AGGREGATE_NAME}; received ${biNodes.length} nodes, ` +
        `${allDependencies.length} dependencies, and ${dependencies.length} matching dependencies.`,
    );
  }
  const phaseDigest = digest(
    JSON.stringify({
      schemaVersion: OFFICIAL_BUILDER_ORDER_SCHEMA,
      sourceDigest,
      buildingInstructionUuid: instructionUuid,
      rootStepUuid,
      phases,
    }),
  );
  if (!SHA256.test(phaseDigest)) throw new TypeError("Official Builder phase digest failed.");
  const structuralEvents = pendingStructuralEvents.map((event) => ({
    ...event,
    followingPhaseSequence:
      event.precedingPhaseSequence === null
        ? phases.length === 0
          ? null
          : 1
        : event.precedingPhaseSequence < phases.length
          ? event.precedingPhaseSequence + 1
          : null,
  }));
  const structuralDigest = digest(
    JSON.stringify({
      schemaVersion: OFFICIAL_BUILDER_STRUCTURAL_ORDER_SCHEMA,
      sourceDigest,
      buildingInstructionUuid: instructionUuid,
      rootStepUuid,
      structuralEvents,
    }),
  );
  if (!SHA256.test(structuralDigest)) {
    throw new TypeError("Official Builder structural-event digest failed.");
  }
  return {
    schemaVersion: OFFICIAL_BUILDER_ORDER_SCHEMA,
    sourceDigest,
    buildingInstructionName: OFFICIAL_BUILDER_INSTRUCTION_NAME,
    buildingInstructionUuid: instructionUuid,
    aggregateInstructionUuid,
    rootStepUuid,
    phaseDigest,
    phases,
    structuralDigest,
    structuralEvents,
    directBrickRefs,
    multiBuildByActualRef,
    aggregateBrickRefs,
  };
}

import { createHash } from "node:crypto";

export const OFFICIAL_BUILDER_ORDER_SCHEMA = "lego.official-builder-order/1" as const;
export const OFFICIAL_BUILDER_INSTRUCTION_NAME = "Building Instruction ##B" as const;
export const OFFICIAL_BUILDER_AGGREGATE_NAME = "Group #IX" as const;

const MAX_XML_BYTES = 16 * 1024 * 1024;
const MAX_XML_NODES = 200_000;
const MAX_XML_DEPTH = 128;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

interface XmlNode {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: XmlNode[];
  readonly start: number;
  end: number;
}

export interface OfficialBuilderDirectPhase {
  readonly kind: "direct";
  readonly sequence: number;
  readonly phaseId: string;
  readonly sourceDigest: string;
  readonly stepUuid: string;
  readonly subBuildPath: readonly string[];
  readonly brickRefs: readonly string[];
}

export interface OfficialBuilderMultiBuildPhase {
  readonly kind: "multi-build-copy";
  readonly sequence: number;
  readonly phaseId: string;
  readonly sourceDigest: string;
  readonly stepUuid: string;
  readonly subBuildPath: readonly string[];
  readonly multiBuildName: string;
  readonly masterSubBuildRef: string;
  readonly copies: readonly {
    readonly sourceBrickRef: string;
    readonly actualBrickRef: string;
  }[];
}

export type OfficialBuilderPhase = OfficialBuilderDirectPhase | OfficialBuilderMultiBuildPhase;

export interface OfficialBuilderOrder {
  readonly schemaVersion: typeof OFFICIAL_BUILDER_ORDER_SCHEMA;
  readonly sourceDigest: string;
  readonly buildingInstructionName: typeof OFFICIAL_BUILDER_INSTRUCTION_NAME;
  readonly buildingInstructionUuid: string;
  readonly aggregateInstructionUuid: string;
  readonly rootStepUuid: string;
  readonly phaseDigest: string;
  readonly phases: readonly OfficialBuilderPhase[];
  readonly directBrickRefs: ReadonlySet<string>;
  readonly multiBuildByActualRef: ReadonlyMap<string, string>;
  readonly aggregateBrickRefs: ReadonlySet<string>;
}

const digest = (value: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function parseAttributes(source: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s/u.test(source[cursor] ?? "")) cursor += 1;
    if (cursor >= source.length) break;
    const match = /^([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/u.exec(source.slice(cursor));
    if (match === null) {
      throw new TypeError(
        `Official Builder XML has malformed or non-double-quoted attributes near ${JSON.stringify(source.slice(cursor, cursor + 80))}.`,
      );
    }
    const name = match[1]!;
    if (Object.hasOwn(result, name)) {
      throw new TypeError(`Official Builder XML repeats attribute ${name}.`);
    }
    result[name] = match[2]!;
    cursor += match[0].length;
  }
  return result;
}

function parseXmlTree(xml: string): readonly XmlNode[] {
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<!--/iu.test(xml)) {
    throw new TypeError(
      "Official Builder XML may not contain doctypes, entities, CDATA, or comments.",
    );
  }
  const roots: XmlNode[] = [];
  const stack: XmlNode[] = [];
  const tags = /<[^>]+>/gu;
  let nodeCount = 0;
  let previousEnd = 0;
  for (const match of xml.matchAll(tags)) {
    if (xml.slice(previousEnd, match.index).trim().length > 0) {
      throw new TypeError(
        `Official Builder XML contains unsupported text outside elements near byte ${previousEnd}.`,
      );
    }
    const token = match[0];
    previousEnd = match.index! + token.length;
    if (token.startsWith("<?")) continue;
    if (token.startsWith("<!")) {
      throw new TypeError(`Official Builder XML contains unsupported declaration ${token}.`);
    }
    if (token.startsWith("</")) {
      const close = /^<\/\s*([A-Za-z_:][A-Za-z0-9_.:-]*)\s*>$/u.exec(token);
      const node = stack.pop();
      if (close === null || node === undefined || node.name !== close[1]) {
        throw new TypeError(
          `Official Builder XML closes ${close?.[1] ?? "a malformed tag"} while ${node?.name ?? "nothing"} is open.`,
        );
      }
      node.end = match.index! + token.length;
      continue;
    }
    const selfClosing = /\/\s*>$/u.test(token);
    const body = token.slice(1, selfClosing ? token.lastIndexOf("/") : -1).trim();
    const open = /^([A-Za-z_:][A-Za-z0-9_.:-]*)([\s\S]*)$/u.exec(body);
    if (open === null) {
      throw new TypeError(`Official Builder XML has malformed start tag ${token}.`);
    }
    const node: XmlNode = {
      name: open[1]!,
      attributes: parseAttributes(open[2]!),
      children: [],
      start: match.index!,
      end: match.index! + token.length,
    };
    nodeCount += 1;
    if (nodeCount > MAX_XML_NODES) {
      throw new TypeError(`Official Builder XML exceeds ${MAX_XML_NODES} bounded elements.`);
    }
    const parent = stack.at(-1);
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
    if (!selfClosing) {
      stack.push(node);
      if (stack.length > MAX_XML_DEPTH) {
        throw new TypeError(`Official Builder XML exceeds bounded depth ${MAX_XML_DEPTH}.`);
      }
    }
  }
  if (stack.length > 0) {
    throw new TypeError(`Official Builder XML leaves ${stack.at(-1)!.name} unclosed.`);
  }
  if (xml.slice(previousEnd).trim().length > 0) {
    throw new TypeError("Official Builder XML contains trailing text outside elements.");
  }
  return roots;
}

function descendants(nodes: readonly XmlNode[], name: string): XmlNode[] {
  const found: XmlNode[] = [];
  const visit = (node: XmlNode): void => {
    if (node.name === name) found.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return found;
}

function oneChild(node: XmlNode, name: string, owner: string): XmlNode {
  const matches = node.children.filter((child) => child.name === name);
  if (matches.length !== 1) {
    throw new TypeError(
      `${owner} must contain exactly one direct ${name}; received ${matches.length}.`,
    );
  }
  return matches[0]!;
}

function requiredAttribute(node: XmlNode, name: string, owner: string): string {
  const value = node.attributes[name];
  if (value === undefined || value.trim().length === 0 || value.includes("&")) {
    throw new TypeError(`${owner} requires a literal non-empty ${name} attribute.`);
  }
  return value;
}

function assertEmptyElement(node: XmlNode, owner: string): void {
  if (node.children.length > 0) {
    throw new TypeError(`${owner} ${node.name} must be an empty metadata element.`);
  }
}

function assertViewMetadata(node: XmlNode, owner: string): void {
  if (node.name === "CameraFittingRange") {
    assertEmptyElement(node, owner);
    return;
  }
  const childNames = node.children.map((child) => child.name);
  if (childNames.length !== 2 || childNames[0] !== "Added" || childNames[1] !== "Removed") {
    throw new TypeError(
      `${owner} ${node.name} must contain exactly empty Added then Removed view metadata.`,
    );
  }
  for (const child of node.children) assertEmptyElement(child, `${owner} ${node.name}`);
}

function assertExplodeMetadata(node: XmlNode, owner: string): void {
  const visit = (current: XmlNode): void => {
    for (const child of current.children) {
      if (child.name === "Explode") visit(child);
      else if (child.name === "Part" || child.name === "Arrow") {
        assertEmptyElement(child, `${owner} Explode`);
      } else {
        throw new TypeError(
          `${owner} Explode contains unsupported ${child.name}; only closed Explode/Part/Arrow visual metadata is allowed.`,
        );
      }
    }
  };
  visit(node);
}

function phaseSourceDigest(input: {
  readonly sourceDigest: string;
  readonly instructionUuid: string;
  readonly sequence: number;
  readonly kind: OfficialBuilderPhase["kind"];
  readonly stepUuid: string;
  readonly subBuildPath: readonly string[];
  readonly phaseOrdinal: number;
  readonly fragmentDigest: string;
  readonly payload: unknown;
}): string {
  return digest(JSON.stringify(input));
}

/** Parses only the sequenced Builder program and independently checks its aggregate sibling. */
export function parseOfficialBuilderOrder(xmlBytes: Uint8Array): OfficialBuilderOrder {
  if (xmlBytes.length < 1 || xmlBytes.length > MAX_XML_BYTES) {
    throw new TypeError(
      `Official Builder XML must contain 1..${MAX_XML_BYTES} bytes; received ${xmlBytes.length}.`,
    );
  }
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
  const directBrickRefs = new Set<string>();
  const multiBuildByActualRef = new Map<string, string>();
  const stepUuids = new Set<string>();
  const subBuildUuids = new Set<string>();
  const completedSubBuildUuids = new Set<string>();
  const directSourcePathByBrickRef = new Map<string, readonly string[]>();
  const directBrickRefsBySubBuild = new Map<string, string[]>();

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

  const visitSubBuild = (node: XmlNode, parentPath: readonly string[]): void => {
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
        visitSubBuild(child, subBuildPath);
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
  return {
    schemaVersion: OFFICIAL_BUILDER_ORDER_SCHEMA,
    sourceDigest,
    buildingInstructionName: OFFICIAL_BUILDER_INSTRUCTION_NAME,
    buildingInstructionUuid: instructionUuid,
    aggregateInstructionUuid,
    rootStepUuid,
    phaseDigest,
    phases,
    directBrickRefs,
    multiBuildByActualRef,
    aggregateBrickRefs,
  };
}

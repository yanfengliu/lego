import { createHash } from "node:crypto";

export const OFFICIAL_BUILDER_ORDER_SCHEMA = "lego.official-builder-order/1" as const;
export const OFFICIAL_BUILDER_STRUCTURAL_ORDER_SCHEMA =
  "lego.official-builder-structural-order/1" as const;
export const OFFICIAL_BUILDER_INSTRUCTION_NAME = "Building Instruction ##B" as const;
export const OFFICIAL_BUILDER_AGGREGATE_NAME = "Group #IX" as const;

const MAX_XML_BYTES = 16 * 1024 * 1024;
const MAX_XML_NODES = 200_000;
const MAX_XML_DEPTH = 128;
export const SHA256 = /^sha256:[0-9a-f]{64}$/u;

export interface XmlNode {
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

export interface OfficialBuilderSubBuildCompleteEvent {
  readonly kind: "sub-build-complete";
  readonly sequence: number;
  readonly sourceDigest: string;
  readonly parentStepUuid: string;
  readonly parentSubBuildPath: readonly string[];
  readonly childSubBuildUuid: string;
  readonly childSubBuildPath: readonly string[];
  readonly precedingPhaseSequence: number | null;
  readonly followingPhaseSequence: number | null;
  readonly physicalBrickRefs: readonly string[];
}

export type OfficialBuilderStructuralEvent = OfficialBuilderSubBuildCompleteEvent;

export interface OfficialBuilderOrder {
  readonly schemaVersion: typeof OFFICIAL_BUILDER_ORDER_SCHEMA;
  readonly sourceDigest: string;
  readonly buildingInstructionName: typeof OFFICIAL_BUILDER_INSTRUCTION_NAME;
  readonly buildingInstructionUuid: string;
  readonly aggregateInstructionUuid: string;
  readonly rootStepUuid: string;
  readonly phaseDigest: string;
  readonly phases: readonly OfficialBuilderPhase[];
  readonly structuralDigest: string;
  readonly structuralEvents: readonly OfficialBuilderStructuralEvent[];
  readonly directBrickRefs: ReadonlySet<string>;
  readonly multiBuildByActualRef: ReadonlyMap<string, string>;
  readonly aggregateBrickRefs: ReadonlySet<string>;
}

export const digest = (value: string | Uint8Array): string =>
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

export function parseXmlTree(xml: string): readonly XmlNode[] {
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

export function descendants(nodes: readonly XmlNode[], name: string): XmlNode[] {
  const found: XmlNode[] = [];
  const visit = (node: XmlNode): void => {
    if (node.name === name) found.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return found;
}

export function oneChild(node: XmlNode, name: string, owner: string): XmlNode {
  const matches = node.children.filter((child) => child.name === name);
  if (matches.length !== 1) {
    throw new TypeError(
      `${owner} must contain exactly one direct ${name}; received ${matches.length}.`,
    );
  }
  return matches[0]!;
}

export function requiredAttribute(node: XmlNode, name: string, owner: string): string {
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

export function assertViewMetadata(node: XmlNode, owner: string): void {
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

export function assertExplodeMetadata(node: XmlNode, owner: string): void {
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

export function phaseSourceDigest(input: {
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

export function assertOfficialBuilderXmlByteLength(xmlBytes: Uint8Array): void {
  if (xmlBytes.length < 1 || xmlBytes.length > MAX_XML_BYTES) {
    throw new TypeError(
      `Official Builder XML must contain 1..${MAX_XML_BYTES} bytes; received ${xmlBytes.length}.`,
    );
  }
}

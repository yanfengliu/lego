import {
  COLOR_DEFINITIONS,
  PART_DEFINITIONS,
  UPRIGHT_ORIENTATIONS,
  getPartDefinition,
  type LduVector3,
} from "@lego-studio/catalog";
import {
  validateBrickDocumentV1,
  type BrickDocumentV1,
  type ConnectionEdge,
  type EntityProvenance,
  type PartInstance,
} from "@lego-studio/protocol";

import { normalizeBrickDocument } from "./document.ts";
import { createEmptyBrickDocument } from "./factory.ts";
import { sha256Hex } from "./canonical.ts";
import { getConnectorWorldFrame } from "./transforms.ts";
import { validateBrickDocument } from "./validation.ts";

const FORMAT_VERSION = "lego.ldraw-subset/1";
const ENTRY_FILE_NAME = "main.ldr";
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const INTEGER_PATTERN = /^(?:0|-?[1-9][0-9]*)$/;
const NATURAL_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const IDENTITY_MATRIX = "1 0 0 0 1 0 0 0 1";

export const LDRAW_LIMITS = Object.freeze({
  maxBytes: 1_000_000,
  maxLines: 40_000,
  maxParts: 10_000,
  maxConnections: 10_000,
  maxSubmodels: 256,
  maxSteps: 10_000,
  maxRegions: 1_000,
});

export type LDrawInterchangeErrorCode =
  | "LIMIT_EXCEEDED"
  | "MALFORMED_INPUT"
  | "UNSUPPORTED_LINE"
  | "UNSUPPORTED_METADATA"
  | "UNSUPPORTED_REFERENCE"
  | "UNSUPPORTED_COLOR"
  | "UNSUPPORTED_MATRIX"
  | "CONNECTION_MISMATCH"
  | "UNSUPPORTED_DOCUMENT";

export class LDrawInterchangeError extends Error {
  readonly code: LDrawInterchangeErrorCode;
  readonly lineNumber: number | undefined;

  constructor(code: LDrawInterchangeErrorCode, message: string, lineNumber?: number) {
    super(lineNumber === undefined ? message : `Line ${lineNumber}: ${message}`);
    this.name = "LDrawInterchangeError";
    this.code = code;
    this.lineNumber = lineNumber;
  }
}

interface SubmodelHeader {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
}

interface StepHeader {
  readonly id: string;
  readonly index: number;
  readonly name: string;
}

interface RegionHeader {
  readonly id: string;
  readonly label: string;
  readonly partIds: readonly string[];
}

interface ConnectionHeader {
  readonly id: string;
  readonly aPartId: string;
  readonly aPortId: string;
  readonly bPartId: string;
  readonly bPortId: string;
  readonly provenance: EntityProvenance;
}

interface PartMetadata {
  readonly id: string;
  readonly provenance: EntityProvenance;
  readonly semanticTags: readonly string[];
}

interface InferredConnection {
  readonly key: string;
  readonly a: ConnectionEdge["a"];
  readonly b: ConnectionEdge["b"];
}

const ldrawAliasByPartId = new Map(
  PART_DEFINITIONS.map((part) => {
    const alias = part.aliases.find(({ namespace }) => namespace === "ldraw");
    if (!alias) {
      throw new Error(`Catalog part ${part.id} has no LDraw identifier alias`);
    }
    return [part.id, alias.value] as const;
  }),
);

const partIdByLdrawAlias = new Map(
  [...ldrawAliasByPartId].map(([partId, alias]) => [alias, partId] as const),
);
const colorById = new Map(COLOR_DEFINITIONS.map((color) => [color.id, color] as const));
const colorByLdrawCode = new Map(
  COLOR_DEFINITIONS.map((color) => [String(color.ldrawCode), color] as const),
);
const orientationByMatrix = new Map(
  UPRIGHT_ORIENTATIONS.map((orientation) => [orientation.matrix.join(" "), orientation] as const),
);

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: LDrawInterchangeErrorCode, message: string, lineNumber?: number): never {
  throw new LDrawInterchangeError(code, message, lineNumber);
}

function encodeText(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("UNSUPPORTED_DOCUMENT", "Text metadata contains a lone UTF-16 surrogate");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail("UNSUPPORTED_DOCUMENT", "Text metadata contains a lone UTF-16 surrogate");
    }
  }
  return `x${[...new TextEncoder().encode(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function decodeText(token: string, lineNumber: number): string {
  if (!/^x(?:[0-9a-f]{2})*$/.test(token)) {
    return fail("MALFORMED_INPUT", "Text metadata is not canonical UTF-8 hex", lineNumber);
  }
  const bytes = new Uint8Array((token.length - 1) / 2);
  for (let index = 1; index < token.length; index += 2) {
    bytes[(index - 1) / 2] = Number.parseInt(token.slice(index, index + 2), 16);
  }
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (encodeText(value) !== token) {
      return fail("MALFORMED_INPUT", "Text metadata has a non-canonical encoding", lineNumber);
    }
    return value;
  } catch {
    return fail("MALFORMED_INPUT", "Text metadata is not valid UTF-8", lineNumber);
  }
}

function requireIdentifier(token: string, label: string, lineNumber: number): string {
  if (!ID_PATTERN.test(token)) {
    return fail("MALFORMED_INPUT", `${label} is not a protocol identifier`, lineNumber);
  }
  return token;
}

function optionalIdentifier(token: string, label: string, lineNumber: number): string | undefined {
  return token === "~" ? undefined : requireIdentifier(token, label, lineNumber);
}

function parseNatural(token: string, label: string, maximum: number, lineNumber: number): number {
  if (!NATURAL_PATTERN.test(token)) {
    return fail("MALFORMED_INPUT", `${label} is not a canonical non-negative integer`, lineNumber);
  }
  const value = Number(token);
  if (!Number.isSafeInteger(value) || value > maximum) {
    return fail("LIMIT_EXCEEDED", `${label} exceeds the supported limit`, lineNumber);
  }
  return value;
}

function parseCoordinate(token: string, lineNumber: number): number {
  if (!INTEGER_PATTERN.test(token)) {
    return fail("MALFORMED_INPUT", "Part coordinates must be canonical integers", lineNumber);
  }
  const value = Number(token);
  if (!Number.isSafeInteger(value) || Math.abs(value) > 10_000_000) {
    return fail("LIMIT_EXCEEDED", "Part coordinate exceeds the protocol limit", lineNumber);
  }
  return value;
}

function parseIdList(
  token: string,
  label: string,
  maximumItems: number,
  lineNumber: number,
): string[] {
  if (token === "~") return [];
  const values = token.split(",");
  if (values.length > maximumItems) {
    return fail("LIMIT_EXCEEDED", `${label} list exceeds the supported limit`, lineNumber);
  }
  for (const value of values) requireIdentifier(value, label, lineNumber);
  const canonical = [...new Set(values)].sort(compareStrings);
  if (canonical.length !== values.length || canonical.join(",") !== token) {
    return fail("MALFORMED_INPUT", `${label} must be unique and canonically sorted`, lineNumber);
  }
  return values;
}

function encodeIdList(values: readonly string[]): string {
  const sorted = [...values].sort(compareStrings);
  return sorted.length === 0 ? "~" : sorted.join(",");
}

function provenance(
  source: EntityProvenance["source"],
  sourceId: string | undefined,
): EntityProvenance {
  return sourceId === undefined ? { source } : { source, sourceId };
}

function parseEntitySource(token: string, lineNumber: number): EntityProvenance["source"] {
  if (!["manual", "ai", "import", "template", "migration"].includes(token)) {
    return fail("MALFORMED_INPUT", "Unknown entity provenance source", lineNumber);
  }
  return token as EntityProvenance["source"];
}

function sourceIdToken(value: string | undefined): string {
  return value ?? "~";
}

class LineReader {
  private index = 0;
  private readonly lines: readonly string[];

  constructor(lines: readonly string[]) {
    this.lines = lines;
  }

  get done(): boolean {
    return this.index >= this.lines.length;
  }

  get nextLineNumber(): number {
    return this.index + 1;
  }

  peek(): string | undefined {
    return this.lines[this.index];
  }

  take(): string {
    const line = this.lines[this.index];
    if (line === undefined) {
      return fail("MALFORMED_INPUT", "Unexpected end of LDraw input", this.nextLineNumber);
    }
    this.index += 1;
    return line;
  }

  expect(line: string, code: LDrawInterchangeErrorCode = "MALFORMED_INPUT"): void {
    const lineNumber = this.nextLineNumber;
    const actual = this.take();
    if (actual !== line) fail(code, `Expected '${line}'`, lineNumber);
  }

  metadata(
    command: string,
    tokenCount: number,
  ): { readonly tokens: string[]; readonly line: number } {
    const line = this.nextLineNumber;
    const raw = this.take();
    const tokens = raw.split(" ");
    if (
      tokens.length !== tokenCount ||
      tokens.some((token) => token.length === 0) ||
      tokens[0] !== "0" ||
      tokens[1] !== "!BRICK-STUDIO" ||
      tokens[2] !== command
    ) {
      classifyUnexpectedLine(raw, line);
    }
    return { tokens, line };
  }
}

function classifyUnexpectedLine(line: string, lineNumber: number): never {
  if (/^[2345](?: |$)/.test(line)) {
    return fail("UNSUPPORTED_LINE", "Only LDraw line types 0 and 1 are supported", lineNumber);
  }
  if (/^0 !/.test(line)) {
    return fail("UNSUPPORTED_METADATA", "Unknown or misplaced LDraw metadata", lineNumber);
  }
  return fail("MALFORMED_INPUT", "Line is outside the strict LDraw subset", lineNumber);
}

function submodelFileName(index: number): string {
  return `submodel-${String(index).padStart(4, "0")}.ldr`;
}

function submodelReferenceLine(fileName: string): string {
  return `1 16 0 0 0 ${IDENTITY_MATRIX} ${fileName}`;
}

function endpointKey(partId: string, portId: string): string {
  return `${partId}\u0000${portId}`;
}

function connectionKey(a: ConnectionEdge["a"], b: ConnectionEdge["b"]): string {
  return [endpointKey(a.partId, a.portId), endpointKey(b.partId, b.portId)]
    .sort(compareStrings)
    .join("\u0001");
}

function frameKey(position: LduVector3, normal: LduVector3): string {
  return `${position.join(",")}|${normal.join(",")}`;
}

function inferConnections(parts: readonly PartInstance[]): InferredConnection[] {
  const studs = [] as Array<ReturnType<typeof getConnectorWorldFrame>>;
  const clutchesByFrame = new Map<string, Array<ReturnType<typeof getConnectorWorldFrame>>>();

  for (const part of [...parts].sort((left, right) => compareStrings(left.id, right.id))) {
    const definition = getPartDefinition(part.catalogPartId);
    if (!definition) fail("UNSUPPORTED_DOCUMENT", `Unsupported catalog part ${part.catalogPartId}`);
    for (const connector of definition.connectors) {
      const frame = getConnectorWorldFrame(part, connector.id);
      if (frame.kind === "stud") {
        studs.push(frame);
      } else {
        const key = frameKey(frame.positionLdu, frame.normal);
        const atFrame = clutchesByFrame.get(key) ?? [];
        atFrame.push(frame);
        clutchesByFrame.set(key, atFrame);
      }
    }
  }

  const inferred: InferredConnection[] = [];
  const useCounts = new Map<string, number>();
  for (const stud of studs) {
    const opposing: LduVector3 = [-stud.normal[0], -stud.normal[1], -stud.normal[2]];
    const clutches = clutchesByFrame.get(frameKey(stud.positionLdu, opposing)) ?? [];
    for (const clutch of clutches) {
      if (stud.partId === clutch.partId) continue;
      const a = { partId: stud.partId, portId: stud.portId };
      const b = { partId: clutch.partId, portId: clutch.portId };
      const aKey = endpointKey(a.partId, a.portId);
      const bKey = endpointKey(b.partId, b.portId);
      useCounts.set(aKey, (useCounts.get(aKey) ?? 0) + 1);
      useCounts.set(bKey, (useCounts.get(bKey) ?? 0) + 1);
      if (inferred.length >= LDRAW_LIMITS.maxConnections) {
        fail("LIMIT_EXCEEDED", "Inferred connection count exceeds the supported limit");
      }
      inferred.push({ key: connectionKey(a, b), a, b });
    }
  }

  if ([...useCounts.values()].some((count) => count > 1)) {
    fail("CONNECTION_MISMATCH", "Transforms produce an ambiguous multiply occupied port");
  }
  return inferred.sort((left, right) => compareStrings(left.key, right.key));
}

function verifyConnectionSet(
  parts: readonly PartInstance[],
  connections: readonly Pick<ConnectionEdge, "a" | "b">[],
): void {
  const inferred = inferConnections(parts).map(({ key }) => key);
  const declared = connections.map(({ a, b }) => connectionKey(a, b)).sort(compareStrings);
  if (
    inferred.length !== declared.length ||
    inferred.some((key, index) => key !== declared[index]) ||
    new Set(declared).size !== declared.length
  ) {
    fail(
      "CONNECTION_MISMATCH",
      "Declared connection edges do not exactly match deterministic port inference",
    );
  }
}

function requireSupportedDocument(document: BrickDocumentV1): BrickDocumentV1 {
  if (!validateBrickDocumentV1(document)) {
    fail("UNSUPPORTED_DOCUMENT", "Document does not satisfy the BrickDocument protocol schema");
  }
  const report = validateBrickDocument(document);
  if (!report.documentGloballyValid) {
    fail(
      "UNSUPPORTED_DOCUMENT",
      `Document is not globally valid: ${report.issues.map(({ code }) => code).join(", ")}`,
    );
  }
  if (
    document.parts.length > LDRAW_LIMITS.maxParts ||
    document.connections.length > LDRAW_LIMITS.maxConnections ||
    document.submodels.length > LDRAW_LIMITS.maxSubmodels ||
    document.steps.length > LDRAW_LIMITS.maxSteps ||
    document.semanticRegions.length > LDRAW_LIMITS.maxRegions
  ) {
    fail("LIMIT_EXCEEDED", "Document exceeds the strict LDraw subset limits");
  }
  const expectedPartIds = PART_DEFINITIONS.map(({ id }) => id).sort(compareStrings);
  const expectedColorIds = COLOR_DEFINITIONS.map(({ id }) => id).sort(compareStrings);
  if (
    [...document.constraints.allowedCatalogPartIds].sort(compareStrings).join("\u0000") !==
      expectedPartIds.join("\u0000") ||
    [...document.constraints.allowedColorIds].sort(compareStrings).join("\u0000") !==
      expectedColorIds.join("\u0000")
  ) {
    fail("UNSUPPORTED_DOCUMENT", "Only the complete pinned builtin catalog palette is supported");
  }
  verifyConnectionSet(document.parts, document.connections);
  return normalizeBrickDocument(document);
}

function exportPartLine(part: PartInstance): string {
  const alias = ldrawAliasByPartId.get(part.catalogPartId);
  const color = colorById.get(part.colorId);
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === part.transform.orientationId);
  if (!alias || !color || !orientation) {
    fail("UNSUPPORTED_DOCUMENT", `Part ${part.id} uses unsupported LDraw truth`);
  }
  return `1 ${color.ldrawCode} ${part.transform.positionLdu.join(" ")} ${orientation.matrix.join(" ")} ${alias}`;
}

export function exportBrickDocumentToLDraw(input: BrickDocumentV1): string {
  const document = requireSupportedDocument(input);
  const submodels = [...document.submodels].sort((left, right) =>
    compareStrings(left.id, right.id),
  );
  const steps = [...document.steps].sort(
    (left, right) => left.index - right.index || compareStrings(left.id, right.id),
  );
  const stepOrder = new Map(steps.map((step, index) => [step.id, index] as const));
  const connections = [...document.connections].sort((left, right) =>
    compareStrings(left.id, right.id),
  );
  const regions = [...document.semanticRegions].sort((left, right) =>
    compareStrings(left.id, right.id),
  );
  const lines = [
    `0 FILE ${ENTRY_FILE_NAME}`,
    `0 Name: ${ENTRY_FILE_NAME}`,
    `0 !BRICK-STUDIO FORMAT ${FORMAT_VERSION}`,
    `0 !BRICK-STUDIO DOCUMENT ${document.id} ${document.revision} ${document.provenance.origin} ${sourceIdToken(document.provenance.sourceId)} ${encodeText(document.name)}`,
    `0 !BRICK-STUDIO COUNTS ${submodels.length} ${steps.length} ${document.parts.length} ${connections.length} ${regions.length}`,
    `0 !BRICK-STUDIO CONSTRAINTS builtin ${document.constraints.maxParts}`,
  ];

  submodels.forEach((submodel, index) => {
    lines.push(
      `0 !BRICK-STUDIO SUBMODEL ${index} ${submodel.id} ${encodeText(submodel.name)} ${submodelFileName(index)}`,
    );
  });
  for (const step of steps) {
    lines.push(`0 !BRICK-STUDIO STEP ${step.index} ${step.id} ${encodeText(step.name)}`);
  }
  for (const region of regions) {
    lines.push(
      `0 !BRICK-STUDIO REGION ${region.id} ${encodeText(region.label)} ${encodeIdList(region.partIds)}`,
    );
  }
  for (const connection of connections) {
    lines.push(
      `0 !BRICK-STUDIO CONNECTION ${connection.id} ${connection.a.partId} ${connection.a.portId} ${connection.b.partId} ${connection.b.portId} ${connection.provenance.source} ${sourceIdToken(connection.provenance.sourceId)}`,
    );
  }
  submodels.forEach((_submodel, index) =>
    lines.push(submodelReferenceLine(submodelFileName(index))),
  );
  lines.push("0 NOFILE");

  for (let submodelIndex = 0; submodelIndex < submodels.length; submodelIndex += 1) {
    const submodel = submodels[submodelIndex]!;
    const fileName = submodelFileName(submodelIndex);
    lines.push(
      `0 FILE ${fileName}`,
      `0 Name: ${fileName}`,
      `0 !BRICK-STUDIO SUBMODEL-USE ${submodel.id}`,
    );
    const parts = document.parts
      .filter(({ submodelId }) => submodelId === submodel.id)
      .sort(
        (left, right) =>
          (stepOrder.get(left.stepId) ?? Number.MAX_SAFE_INTEGER) -
            (stepOrder.get(right.stepId) ?? Number.MAX_SAFE_INTEGER) ||
          compareStrings(left.id, right.id),
      );
    let currentStepId: string | undefined;
    for (const part of parts) {
      if (part.stepId !== currentStepId) {
        if (currentStepId !== undefined) lines.push("0 STEP");
        currentStepId = part.stepId;
        lines.push(`0 !BRICK-STUDIO STEP-USE ${part.stepId}`);
      }
      lines.push(
        `0 !BRICK-STUDIO PART ${part.id} ${part.provenance.source} ${sourceIdToken(part.provenance.sourceId)} ${encodeIdList(part.semanticTags)}`,
        exportPartLine(part),
      );
    }
    lines.push("0 NOFILE");
  }

  const output = `${lines.join("\n")}\n`;
  if (new TextEncoder().encode(output).byteLength > LDRAW_LIMITS.maxBytes) {
    fail("LIMIT_EXCEEDED", "LDraw export exceeds the byte limit");
  }
  if (lines.length > LDRAW_LIMITS.maxLines) {
    fail("LIMIT_EXCEEDED", "LDraw export exceeds the line limit");
  }
  return output;
}

function parseInputLines(input: string): string[] {
  if (new TextEncoder().encode(input).byteLength > LDRAW_LIMITS.maxBytes) {
    return fail("LIMIT_EXCEEDED", "LDraw input exceeds the byte limit");
  }
  if (input.startsWith("\uFEFF") || input.includes("\0") || /\r(?!\n)/.test(input)) {
    return fail("MALFORMED_INPUT", "LDraw input contains a forbidden control sequence");
  }
  const normalized = input.replaceAll("\r\n", "\n");
  if (!normalized.endsWith("\n")) {
    return fail("MALFORMED_INPUT", "LDraw input must end with one newline");
  }
  const lines = normalized.slice(0, -1).split("\n");
  if (lines.length > LDRAW_LIMITS.maxLines) {
    return fail("LIMIT_EXCEEDED", "LDraw input exceeds the line limit");
  }
  if (lines.some((line) => line.length === 0 || line.trim() !== line)) {
    return fail("MALFORMED_INPUT", "Blank lines and surrounding whitespace are unsupported");
  }
  return lines;
}

function parsePartLine(raw: string, metadata: PartMetadata, lineNumber: number): PartInstance {
  const tokens = raw.split(" ");
  if (tokens[0] !== "1") classifyUnexpectedLine(raw, lineNumber);
  if (tokens.length !== 15 || tokens.some((token) => token.length === 0)) {
    return fail("MALFORMED_INPUT", "Malformed LDraw type-1 part line", lineNumber);
  }
  const color = colorByLdrawCode.get(tokens[1]!);
  if (!color) fail("UNSUPPORTED_COLOR", `Unsupported LDraw color ${tokens[1]}`, lineNumber);
  const fileName = tokens[14]!;
  if (!/^[0-9]+\.dat$/.test(fileName) || !partIdByLdrawAlias.has(fileName)) {
    fail(
      "UNSUPPORTED_REFERENCE",
      `Unsupported or external LDraw reference ${fileName}`,
      lineNumber,
    );
  }
  const matrixToken = tokens.slice(5, 14).join(" ");
  const orientation = orientationByMatrix.get(matrixToken);
  if (!orientation)
    fail("UNSUPPORTED_MATRIX", "Matrix is not a supported upright rotation", lineNumber);
  return {
    id: metadata.id,
    catalogPartId: partIdByLdrawAlias.get(fileName)!,
    colorId: color.id,
    transform: {
      positionLdu: [
        parseCoordinate(tokens[2]!, lineNumber),
        parseCoordinate(tokens[3]!, lineNumber),
        parseCoordinate(tokens[4]!, lineNumber),
      ],
      orientationId: orientation.id,
    },
    submodelId: "",
    stepId: "",
    semanticTags: metadata.semanticTags,
    provenance: metadata.provenance,
  };
}

function parsePartMetadata(reader: LineReader): PartMetadata {
  const { tokens, line } = reader.metadata("PART", 7);
  const source = parseEntitySource(tokens[4]!, line);
  return {
    id: requireIdentifier(tokens[3]!, "Part ID", line),
    provenance: provenance(source, optionalIdentifier(tokens[5]!, "Part source ID", line)),
    semanticTags: parseIdList(tokens[6]!, "Semantic tag", 32, line),
  };
}

export function importBrickDocumentFromLDraw(input: string): BrickDocumentV1 {
  const importSourceId = `ldraw-import:${sha256Hex(input).slice(0, 24)}`;
  const importEntityProvenance: EntityProvenance = {
    source: "import",
    sourceId: importSourceId,
  };
  const reader = new LineReader(parseInputLines(input));
  reader.expect(`0 FILE ${ENTRY_FILE_NAME}`, "UNSUPPORTED_REFERENCE");
  reader.expect(`0 Name: ${ENTRY_FILE_NAME}`);
  reader.expect(`0 !BRICK-STUDIO FORMAT ${FORMAT_VERSION}`, "UNSUPPORTED_METADATA");

  const documentLine = reader.metadata("DOCUMENT", 8);
  const documentId = requireIdentifier(documentLine.tokens[3]!, "Document ID", documentLine.line);
  const revision = requireIdentifier(documentLine.tokens[4]!, "Revision", documentLine.line);
  const origin = documentLine.tokens[5];
  if (origin !== "manual" && origin !== "import" && origin !== "migration") {
    fail("MALFORMED_INPUT", "Unknown document provenance origin", documentLine.line);
  }
  optionalIdentifier(documentLine.tokens[6]!, "Document source ID", documentLine.line);
  const documentName = decodeText(documentLine.tokens[7]!, documentLine.line);

  const countsLine = reader.metadata("COUNTS", 8);
  const submodelCount = parseNatural(
    countsLine.tokens[3]!,
    "Submodel count",
    LDRAW_LIMITS.maxSubmodels,
    countsLine.line,
  );
  const stepCount = parseNatural(
    countsLine.tokens[4]!,
    "Step count",
    LDRAW_LIMITS.maxSteps,
    countsLine.line,
  );
  const partCount = parseNatural(
    countsLine.tokens[5]!,
    "Part count",
    LDRAW_LIMITS.maxParts,
    countsLine.line,
  );
  const connectionCount = parseNatural(
    countsLine.tokens[6]!,
    "Connection count",
    LDRAW_LIMITS.maxConnections,
    countsLine.line,
  );
  const regionCount = parseNatural(
    countsLine.tokens[7]!,
    "Region count",
    LDRAW_LIMITS.maxRegions,
    countsLine.line,
  );
  if (submodelCount === 0 || stepCount === 0) {
    fail("UNSUPPORTED_DOCUMENT", "The strict subset requires at least one submodel and step");
  }

  const constraintsLine = reader.metadata("CONSTRAINTS", 5);
  if (constraintsLine.tokens[3] !== "builtin") {
    fail(
      "UNSUPPORTED_METADATA",
      "Only builtin catalog constraints are supported",
      constraintsLine.line,
    );
  }
  const maxParts = parseNatural(
    constraintsLine.tokens[4]!,
    "Document part budget",
    LDRAW_LIMITS.maxParts,
    constraintsLine.line,
  );
  if (partCount > maxParts) fail("LIMIT_EXCEEDED", "Part count exceeds the document budget");

  const submodels: SubmodelHeader[] = [];
  for (let index = 0; index < submodelCount; index += 1) {
    const { tokens, line } = reader.metadata("SUBMODEL", 7);
    if (tokens[3] !== String(index) || tokens[6] !== submodelFileName(index)) {
      fail(
        "UNSUPPORTED_REFERENCE",
        "Submodel filenames must be generated internal references",
        line,
      );
    }
    submodels.push({
      id: requireIdentifier(tokens[4]!, "Submodel ID", line),
      name: decodeText(tokens[5]!, line),
      fileName: tokens[6]!,
    });
  }

  const steps: StepHeader[] = [];
  for (let index = 0; index < stepCount; index += 1) {
    const { tokens, line } = reader.metadata("STEP", 6);
    const stepIndex = parseNatural(tokens[3]!, "Step index", 9_999, line);
    if (index > 0 && stepIndex <= steps[index - 1]!.index) {
      fail("MALFORMED_INPUT", "Step indices must be strictly increasing", line);
    }
    steps.push({
      index: stepIndex,
      id: requireIdentifier(tokens[4]!, "Step ID", line),
      name: decodeText(tokens[5]!, line),
    });
  }

  const regions: RegionHeader[] = [];
  for (let index = 0; index < regionCount; index += 1) {
    const { tokens, line } = reader.metadata("REGION", 6);
    regions.push({
      id: requireIdentifier(tokens[3]!, "Region ID", line),
      label: decodeText(tokens[4]!, line),
      partIds: parseIdList(tokens[5]!, "Region part ID", LDRAW_LIMITS.maxParts, line),
    });
  }

  const connectionHeaders: ConnectionHeader[] = [];
  for (let index = 0; index < connectionCount; index += 1) {
    const { tokens, line } = reader.metadata("CONNECTION", 10);
    const source = parseEntitySource(tokens[8]!, line);
    connectionHeaders.push({
      id: requireIdentifier(tokens[3]!, "Connection ID", line),
      aPartId: requireIdentifier(tokens[4]!, "Connection part ID", line),
      aPortId: requireIdentifier(tokens[5]!, "Connection port ID", line),
      bPartId: requireIdentifier(tokens[6]!, "Connection part ID", line),
      bPortId: requireIdentifier(tokens[7]!, "Connection port ID", line),
      provenance: provenance(source, optionalIdentifier(tokens[9]!, "Connection source ID", line)),
    });
  }

  for (const submodel of submodels)
    reader.expect(submodelReferenceLine(submodel.fileName), "UNSUPPORTED_REFERENCE");
  reader.expect("0 NOFILE");

  const stepIndexById = new Map(steps.map((step, index) => [step.id, index] as const));
  const partIds = new Set<string>();
  const parts: PartInstance[] = [];
  for (const submodel of submodels) {
    reader.expect(`0 FILE ${submodel.fileName}`, "UNSUPPORTED_REFERENCE");
    reader.expect(`0 Name: ${submodel.fileName}`);
    const use = reader.metadata("SUBMODEL-USE", 4);
    if (use.tokens[3] !== submodel.id) {
      fail(
        "UNSUPPORTED_REFERENCE",
        "Submodel section does not match its declared reference",
        use.line,
      );
    }

    let priorStepOrder = -1;
    while (reader.peek() !== "0 NOFILE") {
      const stepUse = reader.metadata("STEP-USE", 4);
      const stepId = requireIdentifier(stepUse.tokens[3]!, "Step use ID", stepUse.line);
      const stepOrder = stepIndexById.get(stepId);
      if (stepOrder === undefined || stepOrder <= priorStepOrder) {
        fail("MALFORMED_INPUT", "Step uses must be declared once in global order", stepUse.line);
      }
      priorStepOrder = stepOrder;
      let groupPartCount = 0;
      while (reader.peek()?.startsWith("0 !BRICK-STUDIO PART ")) {
        const metadata = parsePartMetadata(reader);
        const partLineNumber = reader.nextLineNumber;
        const parsed = parsePartLine(reader.take(), metadata, partLineNumber);
        if (partIds.has(parsed.id)) {
          fail("MALFORMED_INPUT", `Duplicate part ID ${parsed.id}`, partLineNumber);
        }
        partIds.add(parsed.id);
        parts.push({ ...parsed, submodelId: submodel.id, stepId });
        groupPartCount += 1;
        if (parts.length > partCount) {
          fail(
            "LIMIT_EXCEEDED",
            "Parsed more parts than the declared bounded count",
            partLineNumber,
          );
        }
      }
      if (groupPartCount === 0) {
        const line = reader.peek() ?? "";
        if (line !== "0 STEP" && line !== "0 NOFILE") {
          classifyUnexpectedLine(line, reader.nextLineNumber);
        }
        fail(
          "MALFORMED_INPUT",
          "Every emitted step group must contain a part",
          reader.nextLineNumber,
        );
      }
      if (reader.peek() === "0 STEP") {
        reader.take();
        if (reader.peek() === "0 NOFILE") {
          fail(
            "MALFORMED_INPUT",
            "A trailing empty LDraw step is unsupported",
            reader.nextLineNumber,
          );
        }
      } else if (reader.peek() !== "0 NOFILE") {
        classifyUnexpectedLine(reader.peek() ?? "", reader.nextLineNumber);
      }
    }
    reader.expect("0 NOFILE");
  }
  if (!reader.done) classifyUnexpectedLine(reader.peek() ?? "", reader.nextLineNumber);
  if (parts.length !== partCount) {
    fail("MALFORMED_INPUT", "Parsed part count does not match the declared count");
  }

  for (const region of regions) {
    if (region.partIds.some((id) => !partIds.has(id))) {
      fail("UNSUPPORTED_DOCUMENT", `Region ${region.id} references an unknown part`);
    }
  }
  const inferredKeys = new Set(inferConnections(parts).map(({ key }) => key));
  const seenConnectionKeys = new Set<string>();
  const connections = connectionHeaders.map((header) => {
    const a = { partId: header.aPartId, portId: header.aPortId };
    const b = { partId: header.bPartId, portId: header.bPortId };
    const key = connectionKey(a, b);
    if (!inferredKeys.has(key) || seenConnectionKeys.has(key)) {
      fail("CONNECTION_MISMATCH", `Connection ${header.id} is not uniquely inferred`);
    }
    seenConnectionKeys.add(key);
    return { id: header.id, kind: "stud-tube" as const, a, b, provenance: importEntityProvenance };
  });
  if (seenConnectionKeys.size !== inferredKeys.size) {
    fail("CONNECTION_MISMATCH", "Connection metadata omits an inferred stud-tube edge");
  }

  const base = createEmptyBrickDocument({ id: documentId, name: documentName, revision, maxParts });
  const document: BrickDocumentV1 = {
    ...base,
    provenance: { origin: "import", sourceId: importSourceId },
    parts: parts.map((part) => ({ ...part, provenance: importEntityProvenance })),
    connections,
    submodels: submodels.map((submodel) => ({
      id: submodel.id,
      name: submodel.name,
      partIds: parts
        .filter(({ submodelId }) => submodelId === submodel.id)
        .map(({ id }) => id)
        .sort(compareStrings),
    })),
    steps: steps.map((step) => ({
      id: step.id,
      index: step.index,
      name: step.name,
      partIds: parts
        .filter(({ stepId }) => stepId === step.id)
        .map(({ id }) => id)
        .sort(compareStrings),
    })),
    semanticRegions: regions.map((region) => ({
      id: region.id,
      label: region.label,
      partIds: [...region.partIds],
    })),
  };
  return requireSupportedDocument(document);
}

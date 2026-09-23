import {
  AnswerKeyFormatError,
  childrenNamed,
  parseXmlTree,
  requireAttribute,
  type XmlElement,
} from "./xml-tree.ts";

/**
 * LEGO's official digital-instructions model of a set (LXFML), read as an
 * answer key: every brick with its element id and pose, and the build
 * sequence the printed booklet was laid out from.
 *
 * This is scoring data, never an input to a build. Product code
 * (packages/*\/src, apps/web/src) must not import anything under
 * tools/booklet — eslint.config.js enforces it — because a pipeline that could
 * read the answer key could not be scored by it.
 */
export const LXFML_LIMITS = Object.freeze({
  maxBytes: 32 * 1024 * 1024,
  maxElements: 400_000,
  maxDepth: 96,
  maxBricks: 20_000,
  maxPartsPerBrick: 64,
});

export interface LxfmlPart {
  readonly designRevision: string;
  readonly materialId: string;
  /** The Bone transformation as written: nine rotation terms, then x, y, z in LXFML units. */
  readonly transformation: readonly number[];
}

export interface LxfmlBrick {
  /** 1-based position in the Bricks inventory. */
  readonly row: number;
  readonly uuid: string;
  /** The design number, e.g. "3023" of "3023;S". */
  readonly designId: string;
  readonly designRevision: string;
  /** LEGO element ids, when the file carries them. */
  readonly itemNos: readonly string[];
  /** Material of the first part, the brick's colour for identity purposes. */
  readonly materialId: string;
  readonly parts: readonly LxfmlPart[];
}

export interface LxfmlMultiBuild {
  readonly name: string;
  /** Position of the MultiBuild element in the file; names the copy it makes. */
  readonly ordinal: number;
  readonly masterSubBuildRef: string;
  /** Each copy brick and the master brick it duplicates. */
  readonly copies: readonly { readonly original: string; readonly actual: string }[];
}

export interface LxfmlSubBuild {
  readonly uuid: string;
  readonly name: string;
  readonly steps: readonly LxfmlStep[];
}

export interface LxfmlStep {
  readonly name: string;
  readonly ordinal: number;
  /** Bricks this step adds directly, in document order. */
  readonly brickRefs: readonly string[];
  /** Sub-builds assembled separately and attached by this step. */
  readonly subBuilds: readonly LxfmlSubBuild[];
  /** Repeat copies of a sub-build attached by this step. */
  readonly multiBuilds: readonly LxfmlMultiBuild[];
}

export interface LxfmlInstruction {
  readonly name: string;
  readonly steps: readonly LxfmlStep[];
  /** How many BuildingInstruction elements the file had; the one with the most steps is used. */
  readonly candidates: number;
}

export interface LxfmlBag {
  readonly name: string;
  /** The number printed on the bag ("5CORE" is bag 5), or null for loose parts. */
  readonly bag: number | null;
}

export interface LxfmlModel {
  readonly bricks: readonly LxfmlBrick[];
  readonly instruction: LxfmlInstruction | null;
  /** Which packing bag each brick ships in, when the file says. */
  readonly bags: ReadonlyMap<string, LxfmlBag>;
}

const DESIGN_REVISION = /^(\d{1,9})(?:;[A-Za-z0-9]{1,8})?$/u;
const ITEM_NUMBER = /^\d{1,12}$/u;
const MATERIAL = /^(\d{1,6})(?::\d+)?$/u;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

function parseTransformation(value: string, label: string): readonly number[] {
  const tokens = value.split(",");
  if (tokens.length !== 12 || tokens.some((token) => !NUMBER.test(token.trim()))) {
    throw new AnswerKeyFormatError(
      `${label} transformation must be twelve comma-separated decimals (rotation then position); received ${JSON.stringify(value.slice(0, 80))}.`,
    );
  }
  const numbers = tokens.map((token) => Number(token));
  if (numbers.some((number) => !Number.isFinite(number) || Math.abs(number) > 1_000_000)) {
    throw new AnswerKeyFormatError(
      `${label} transformation contains a non-finite or out-of-range number.`,
    );
  }
  return Object.freeze(numbers);
}

function parseMaterial(value: string, label: string): string {
  const first = value.split(",")[0]!.trim();
  const match = MATERIAL.exec(first);
  if (!match) {
    throw new AnswerKeyFormatError(
      `${label} materials ${JSON.stringify(value)} does not start with a numeric material id.`,
    );
  }
  return match[1]!;
}

function parseBrick(element: XmlElement, row: number): LxfmlBrick {
  const label = `LXFML Brick ${row}`;
  const designRevision = requireAttribute(element, "designID", label);
  const design = DESIGN_REVISION.exec(designRevision);
  if (!design) {
    throw new AnswerKeyFormatError(
      `${label} has designID ${JSON.stringify(designRevision)}, which is not a design number.`,
    );
  }
  const uuid = element.attributes.uuid ?? element.attributes.refID;
  if (uuid === undefined || uuid === "") {
    throw new AnswerKeyFormatError(
      `${label} has neither a uuid nor a refID, so steps cannot reference it.`,
    );
  }
  const itemNos = (element.attributes.itemNos ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  if (itemNos.some((item) => !ITEM_NUMBER.test(item))) {
    throw new AnswerKeyFormatError(
      `${label} has itemNos ${JSON.stringify(element.attributes.itemNos)}, which are not element ids.`,
    );
  }
  const partElements = childrenNamed(element, "Part");
  if (partElements.length < 1 || partElements.length > LXFML_LIMITS.maxPartsPerBrick) {
    throw new AnswerKeyFormatError(
      `${label} has ${partElements.length} Part elements; a brick needs 1 to ${LXFML_LIMITS.maxPartsPerBrick}.`,
    );
  }
  const parts = partElements.map((part, index) => {
    const partLabel = `${label} Part ${index + 1}`;
    const bones = childrenNamed(part, "Bone");
    if (bones.length !== 1) {
      throw new AnswerKeyFormatError(
        `${partLabel} has ${bones.length} Bone elements; exactly one carries its pose.`,
      );
    }
    return Object.freeze({
      designRevision: requireAttribute(part, "designID", partLabel),
      materialId: parseMaterial(requireAttribute(part, "materials", partLabel), partLabel),
      transformation: parseTransformation(
        requireAttribute(bones[0]!, "transformation", partLabel),
        partLabel,
      ),
    });
  });
  return Object.freeze({
    row,
    uuid,
    designId: design[1]!,
    designRevision,
    itemNos: Object.freeze(itemNos),
    materialId: parts[0]!.materialId,
    parts: Object.freeze(parts),
  });
}

function parseMultiBuild(element: XmlElement): LxfmlMultiBuild {
  const label = `LXFML MultiBuild #${element.ordinal}`;
  return Object.freeze({
    name: element.attributes.name ?? "",
    ordinal: element.ordinal,
    masterSubBuildRef: requireAttribute(element, "masterSubBuildRef", label),
    copies: Object.freeze(
      childrenNamed(element, "MultiBuildBrick").map((copy) =>
        Object.freeze({
          original: requireAttribute(copy, "originalBrickRef", label),
          actual: requireAttribute(copy, "actualBrickRef", label),
        }),
      ),
    ),
  });
}

function parseStep(element: XmlElement): LxfmlStep {
  const label = `LXFML Step #${element.ordinal}`;
  return Object.freeze({
    name: element.attributes.name ?? "",
    ordinal: element.ordinal,
    brickRefs: Object.freeze(
      childrenNamed(element, "In").map((entry) => requireAttribute(entry, "brickRef", label)),
    ),
    subBuilds: Object.freeze(
      childrenNamed(element, "SubBuild").map((subBuild) =>
        Object.freeze({
          uuid: requireAttribute(subBuild, "uuid", `LXFML SubBuild #${subBuild.ordinal}`),
          name: subBuild.attributes.name ?? "",
          steps: Object.freeze(childrenNamed(subBuild, "Step").map(parseStep)),
        }),
      ),
    ),
    multiBuilds: Object.freeze(childrenNamed(element, "MultiBuild").map(parseMultiBuild)),
  });
}

function countSteps(element: XmlElement): number {
  return element.children.reduce(
    (total, child) => total + (child.name === "Step" ? 1 : 0) + countSteps(child),
    0,
  );
}

function parseInstruction(root: XmlElement): LxfmlInstruction | null {
  const candidates = childrenNamed(root, "BuildingInstructions").flatMap((container) =>
    childrenNamed(container, "BuildingInstruction"),
  );
  let best: { element: XmlElement; steps: number } | null = null;
  for (const candidate of candidates) {
    const steps = countSteps(candidate);
    if (!best || steps > best.steps) best = { element: candidate, steps };
  }
  if (!best || best.steps === 0) return null;
  const stepsContainers = childrenNamed(best.element, "Steps");
  if (stepsContainers.length !== 1) {
    throw new AnswerKeyFormatError(
      `LXFML BuildingInstruction ${JSON.stringify(best.element.attributes.name ?? "")} has ${stepsContainers.length} Steps containers; exactly one is read.`,
    );
  }
  return Object.freeze({
    name: best.element.attributes.name ?? "",
    steps: Object.freeze(childrenNamed(stepsContainers[0]!, "Step").map(parseStep)),
    candidates: candidates.length,
  });
}

function parseBags(
  root: XmlElement,
  known: ReadonlySet<string>,
  label: string,
): Map<string, LxfmlBag> {
  const bags = new Map<string, LxfmlBag>();
  for (const container of childrenNamed(root, "Bags")) {
    for (const bag of container.children) {
      if (bag.name !== "NumberedBag" && bag.name !== "LooseBag") continue;
      const name = bag.attributes.name ?? "";
      const number = bag.name === "NumberedBag" ? /^(\d{1,3})/u.exec(name) : null;
      const entry = Object.freeze({ name, bag: number ? Number(number[1]) : null });
      for (const brick of childrenNamed(bag, "Brick")) {
        const ref = requireAttribute(
          brick,
          "brickRef",
          `${label} <${bag.name}> ${JSON.stringify(name)}`,
        );
        if (!known.has(ref)) {
          throw new AnswerKeyFormatError(
            `${label} bag ${JSON.stringify(name)} lists brick ${ref}, which is not in the Bricks inventory.`,
          );
        }
        if (bags.has(ref)) {
          throw new AnswerKeyFormatError(
            `${label} packs brick ${ref} in two bags (${JSON.stringify(bags.get(ref)!.name)} and ${JSON.stringify(name)}).`,
          );
        }
        bags.set(ref, entry);
      }
    }
  }
  return bags;
}

/** Parses LXFML text. `label` names the file in every error. */
export function parseLxfml(source: string, label = "LXFML"): LxfmlModel {
  const root = parseXmlTree(source, label, LXFML_LIMITS);
  if (root.name !== "LXFML") {
    throw new AnswerKeyFormatError(
      `${label} has root <${root.name}>; an LXFML answer key has root <LXFML>.`,
    );
  }
  const containers = childrenNamed(root, "Bricks");
  if (containers.length !== 1) {
    throw new AnswerKeyFormatError(
      `${label} has ${containers.length} <Bricks> inventories; exactly one is expected.`,
    );
  }
  const brickElements = childrenNamed(containers[0]!, "Brick");
  if (brickElements.length === 0 || brickElements.length > LXFML_LIMITS.maxBricks) {
    throw new AnswerKeyFormatError(
      `${label} lists ${brickElements.length} bricks; an answer key needs 1 to ${LXFML_LIMITS.maxBricks}.`,
    );
  }
  const bricks = brickElements.map((element, index) => parseBrick(element, index + 1));
  const seen = new Set<string>();
  for (const brick of bricks) {
    if (seen.has(brick.uuid)) {
      throw new AnswerKeyFormatError(
        `${label} repeats brick uuid ${brick.uuid} (row ${brick.row}); every brick needs its own.`,
      );
    }
    seen.add(brick.uuid);
  }
  return Object.freeze({
    bricks: Object.freeze(bricks),
    instruction: parseInstruction(root),
    bags: parseBags(root, seen, label),
  });
}

/**
 * One LXFML part's pose in LDraw's convention: a row-major rotation acting on
 * column vectors and a position in LDU. LXFML stores the rotation transposed,
 * is Y-up and Z-toward-viewer where LDraw is Y-down and Z-away, and measures
 * in units of 25 LDU (0.8 per stud pitch of 20 LDU).
 */
export function lxfmlPoseInLdrawConvention(part: LxfmlPart): {
  readonly matrix: readonly number[];
  readonly positionLdu: readonly number[];
} {
  const signs = [1, -1, -1] as const;
  const t = part.transformation;
  const matrix = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return t[column * 3 + row]! * signs[row]! * signs[column]!;
  });
  const positionLdu = [0, 1, 2].map((axis) => t[9 + axis]! * 25 * signs[axis]!);
  return { matrix, positionLdu };
}

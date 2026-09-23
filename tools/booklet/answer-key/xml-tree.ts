/**
 * A strict, bounded reader for the attribute-only XML that LEGO's digital
 * instructions (LXFML) are written in.
 *
 * LXFML carries everything in attributes and nests elements; it has no text
 * content, no namespaces that matter here, and no entities beyond the five
 * predefined ones. So this reads exactly that and refuses everything else —
 * doctypes, CDATA, comments, processing instructions past the declaration, and
 * stray text — rather than guessing. The file is hostile input: bytes, element
 * count and depth are bounded before the work they gate is done.
 */
export interface XmlElement {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlElement[];
  /** Byte-free position for error messages: the 1-based index of the element's opening tag. */
  readonly ordinal: number;
}

export interface XmlLimits {
  readonly maxBytes: number;
  readonly maxElements: number;
  readonly maxDepth: number;
}

export class AnswerKeyFormatError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AnswerKeyFormatError";
  }
}

const TAG =
  /<(\/?)([A-Za-z][A-Za-z0-9_.-]*)((?:\s+[A-Za-z_][A-Za-z0-9_.:-]*\s*=\s*"[^"<]*")*)\s*(\/?)>/gu;
const ATTRIBUTE = /\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"<]*)"/gu;
const ENTITY = /&(amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/gu;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

const UNDEFINED_ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/u;

function decodeEntities(value: string, label: string): string {
  if (UNDEFINED_ENTITY.test(value)) {
    throw new AnswerKeyFormatError(
      `${label} contains an undefined XML entity; only &amp; &lt; &gt; &quot; &apos; and numeric references are read.`,
    );
  }
  return value.replace(ENTITY, (_, entity: string) => {
    const codePoint = entity.startsWith("#x")
      ? Number.parseInt(entity.slice(2), 16)
      : entity.startsWith("#")
        ? Number.parseInt(entity.slice(1), 10)
        : null;
    if (codePoint === null) return NAMED_ENTITIES[entity]!;
    if (codePoint > 0x10ffff) {
      throw new AnswerKeyFormatError(`${label} contains a character reference past U+10FFFF.`);
    }
    return String.fromCodePoint(codePoint);
  });
}

function parseAttributes(source: string, label: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    const [, name, value] = match;
    if (Object.hasOwn(attributes, name!)) {
      throw new AnswerKeyFormatError(
        `${label} repeats attribute ${name}; each attribute may appear once.`,
      );
    }
    attributes[name!] = decodeEntities(value!, `${label} attribute ${name}`);
  }
  return attributes;
}

interface OpenElement {
  readonly name: string;
  readonly attributes: Record<string, string>;
  readonly children: XmlElement[];
  readonly ordinal: number;
}

/**
 * Parses `source` into its single root element. `label` names the input in
 * every error, so a failure says which file broke and where.
 */
export function parseXmlTree(source: string, label: string, limits: XmlLimits): XmlElement {
  if (source.length > limits.maxBytes) {
    throw new AnswerKeyFormatError(
      `${label} is ${source.length} characters, over the ${limits.maxBytes}-character limit for an answer key.`,
    );
  }
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<!--/iu.test(source)) {
    throw new AnswerKeyFormatError(
      `${label} contains a doctype, entity declaration, CDATA section or comment; an LXFML answer key has none, so the file is refused rather than partially read.`,
    );
  }
  let body = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const declaration = /^\s*<\?xml[^?]*\?>/u.exec(body);
  if (declaration) body = body.slice(declaration[0].length);
  if (body.includes("<?")) {
    throw new AnswerKeyFormatError(
      `${label} contains a processing instruction after the XML declaration; remove it or re-export the file.`,
    );
  }

  const stack: OpenElement[] = [];
  let root: XmlElement | null = null;
  let cursor = 0;
  let ordinal = 0;
  for (const match of body.matchAll(TAG)) {
    const between = body.slice(cursor, match.index);
    if (between.trim() !== "") {
      throw new AnswerKeyFormatError(
        `${label} has text content near element ${ordinal} (${JSON.stringify(between.trim().slice(0, 40))}); LXFML carries data only in attributes.`,
      );
    }
    cursor = match.index + match[0].length;
    const [, closing, name, attributeSource, selfClosing] = match;
    if (closing) {
      const open = stack.pop();
      if (!open || open.name !== name) {
        throw new AnswerKeyFormatError(
          `${label} closes </${name}> near element ${ordinal} but the open element is ${open ? `<${open.name}>` : "none"}; the file is not well-formed.`,
        );
      }
      const element: XmlElement = {
        name: open.name,
        attributes: open.attributes,
        children: open.children,
        ordinal: open.ordinal,
      };
      if (stack.length === 0) {
        if (root) throw new AnswerKeyFormatError(`${label} has more than one root element.`);
        root = element;
      } else {
        stack.at(-1)!.children.push(element);
      }
      continue;
    }
    ordinal += 1;
    if (ordinal > limits.maxElements) {
      throw new AnswerKeyFormatError(
        `${label} has more than ${limits.maxElements} elements; an answer key that large is refused.`,
      );
    }
    const open: OpenElement = {
      name: name!,
      attributes: parseAttributes(attributeSource ?? "", `${label} <${name}> #${ordinal}`),
      children: [],
      ordinal,
    };
    if (selfClosing) {
      const element: XmlElement = { ...open };
      if (stack.length === 0) {
        if (root) throw new AnswerKeyFormatError(`${label} has more than one root element.`);
        root = element;
      } else {
        stack.at(-1)!.children.push(element);
      }
      continue;
    }
    if (stack.length >= limits.maxDepth) {
      throw new AnswerKeyFormatError(
        `${label} nests deeper than ${limits.maxDepth} elements at <${name}> #${ordinal}.`,
      );
    }
    stack.push(open);
  }
  if (body.slice(cursor).trim() !== "") {
    throw new AnswerKeyFormatError(
      `${label} has unparseable text after its last tag (${JSON.stringify(body.slice(cursor).trim().slice(0, 40))}).`,
    );
  }
  if (stack.length > 0) {
    throw new AnswerKeyFormatError(
      `${label} ends with <${stack.at(-1)!.name}> still open; the file is truncated.`,
    );
  }
  if (!root) throw new AnswerKeyFormatError(`${label} contains no XML element.`);
  return root;
}

export function childrenNamed(element: XmlElement, name: string): readonly XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

export function requireAttribute(element: XmlElement, name: string, label: string): string {
  const value = element.attributes[name];
  if (value === undefined) {
    throw new AnswerKeyFormatError(
      `${label} <${element.name}> #${element.ordinal} has no ${name} attribute, which the answer key needs.`,
    );
  }
  return value;
}

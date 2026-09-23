/**
 * A strict, bounded reader for the attribute-only XML that LEGO's digital
 * instructions (LXFML) are written in.
 *
 * LXFML carries everything in attributes and nests elements; it has no text
 * content, no namespaces that matter here, and no entities beyond the five
 * predefined ones. So this reads exactly that and refuses everything else —
 * doctypes, CDATA, comments, processing instructions past the declaration, and
 * stray text — rather than guessing. The file is hostile input: bytes, element
 * count, attributes per element and depth are bounded before the work they
 * gate is done, and the walk is iterative, so no input reaches the call stack.
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
  /** Attributes one element may carry; an LXFML element carries a handful. */
  readonly maxAttributes: number;
}

export class AnswerKeyFormatError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AnswerKeyFormatError";
  }
}

// Sticky patterns, each matched once at a known offset. The reader walks the
// text left to right and never hands a regular expression an unbounded
// repetition of groups, which is what overflowed V8's regexp stack on one
// element carrying 1.5 million attributes.
const NAME = /[A-Za-z][A-Za-z0-9_.-]*/uy;
const SPACE = /\s*/uy;
const ATTRIBUTE = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"<]*)"/uy;
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

function matchAt(pattern: RegExp, text: string, at: number): RegExpExecArray | null {
  pattern.lastIndex = at;
  return pattern.exec(text);
}

const excerpt = (text: string, at: number) => JSON.stringify(text.slice(at, at + 40));

interface OpenElement {
  readonly name: string;
  readonly attributes: Record<string, string>;
  readonly children: XmlElement[];
  readonly ordinal: number;
}

interface Tag {
  readonly closing: boolean;
  readonly selfClosing: boolean;
  readonly name: string;
  readonly attributes: Record<string, string>;
  /** Offset just past the tag's ">". */
  readonly end: number;
}

/** Reads the tag whose "<" is at `at`, one attribute at a time, at most `limits.maxAttributes`. */
function readTag(body: string, at: number, ordinal: number, label: string, limits: XmlLimits): Tag {
  let cursor = at + 1;
  const closing = body[cursor] === "/";
  if (closing) cursor += 1;
  const name = matchAt(NAME, body, cursor)?.[0];
  if (name === undefined) {
    throw new AnswerKeyFormatError(
      `${label} has a "<" after element ${ordinal} that opens no tag (${excerpt(body, at)}); the file is not well-formed XML.`,
    );
  }
  cursor += name.length;
  // A null prototype, so an attribute named __proto__ stays data instead of being dropped.
  const attributes = Object.create(null) as Record<string, string>;
  const tagLabel = `${label} <${closing ? "/" : ""}${name}> #${closing ? ordinal : ordinal + 1}`;
  let count = 0;
  for (;;) {
    const space = matchAt(SPACE, body, cursor)![0];
    cursor += space.length;
    if (!closing && body.startsWith("/>", cursor)) {
      return { closing, selfClosing: true, name, attributes, end: cursor + 2 };
    }
    if (body[cursor] === ">") {
      return { closing, selfClosing: false, name, attributes, end: cursor + 1 };
    }
    if (closing || space.length === 0 || cursor >= body.length) {
      const why =
        cursor >= body.length
          ? "the file is truncated"
          : closing
            ? "a closing tag carries no attributes"
            : "attributes need whitespace between them";
      throw new AnswerKeyFormatError(
        `${tagLabel} is not closed by ">"${closing ? "" : ' or "/>"'} at ${excerpt(body, cursor)}; ${why}.`,
      );
    }
    const attribute = matchAt(ATTRIBUTE, body, cursor);
    if (!attribute) {
      throw new AnswerKeyFormatError(
        `${tagLabel} has a malformed attribute at ${excerpt(body, cursor)}; an attribute is name="value" with no "<" in the value.`,
      );
    }
    count += 1;
    if (count > limits.maxAttributes) {
      throw new AnswerKeyFormatError(
        `${tagLabel} has more than ${limits.maxAttributes} attributes; an answer-key element that large is refused.`,
      );
    }
    const [whole, key, value] = attribute;
    if (Object.hasOwn(attributes, key!)) {
      throw new AnswerKeyFormatError(
        `${tagLabel} repeats attribute ${key}; each attribute may appear once.`,
      );
    }
    attributes[key!] = decodeEntities(value!, `${tagLabel} attribute ${key}`);
    cursor += whole.length;
  }
}

/**
 * Parses `source` into its single root element. `label` names the input in
 * every error, so a failure says which file broke and where. The walk is
 * linear in the input; nesting lives on an explicit stack bounded by
 * `limits.maxDepth`, never on the call stack.
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
  const roots: XmlElement[] = [];
  let cursor = 0;
  let ordinal = 0;
  const attach = (element: XmlElement) => {
    if (stack.length > 0) {
      stack.at(-1)!.children.push(element);
      return;
    }
    if (roots.length > 0)
      throw new AnswerKeyFormatError(`${label} has more than one root element.`);
    roots.push(element);
  };
  for (;;) {
    const open = body.indexOf("<", cursor);
    const text = body.slice(cursor, open < 0 ? body.length : open).trim();
    if (text !== "") {
      throw new AnswerKeyFormatError(
        open < 0
          ? `${label} has unparseable text after its last tag (${JSON.stringify(text.slice(0, 40))}).`
          : `${label} has text content near element ${ordinal} (${JSON.stringify(text.slice(0, 40))}); LXFML carries data only in attributes.`,
      );
    }
    if (open < 0) break;
    const tag = readTag(body, open, ordinal, label, limits);
    cursor = tag.end;
    if (tag.closing) {
      const element = stack.pop();
      if (!element || element.name !== tag.name) {
        throw new AnswerKeyFormatError(
          `${label} closes </${tag.name}> near element ${ordinal} but the open element is ${element ? `<${element.name}>` : "none"}; the file is not well-formed.`,
        );
      }
      attach(element);
      continue;
    }
    ordinal += 1;
    if (ordinal > limits.maxElements) {
      throw new AnswerKeyFormatError(
        `${label} has more than ${limits.maxElements} elements; an answer key that large is refused.`,
      );
    }
    // Checked for self-closing elements too: an element's depth counts whether or not it has children.
    if (stack.length >= limits.maxDepth) {
      throw new AnswerKeyFormatError(
        `${label} nests deeper than ${limits.maxDepth} elements at <${tag.name}> #${ordinal}.`,
      );
    }
    const element: OpenElement = {
      name: tag.name,
      attributes: tag.attributes,
      children: [],
      ordinal,
    };
    if (tag.selfClosing) attach(element);
    else stack.push(element);
  }
  if (stack.length > 0) {
    throw new AnswerKeyFormatError(
      `${label} ends with <${stack.at(-1)!.name}> still open; the file is truncated.`,
    );
  }
  const root = roots[0];
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

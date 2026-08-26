const MAX_JSON_DEPTH = 128;
const MAX_JSON_VALUES = 4_000_000;
const TextDecoderIntrinsic = globalThis.TextDecoder;
const Uint8ArrayIntrinsic = globalThis.Uint8Array;
const decoder = new TextDecoderIntrinsic("utf-8", { fatal: true, ignoreBOM: true });
const copyBytes = (bytes) => new Uint8ArrayIntrinsic(bytes);
const decodeUtf8 = Function.call.bind(TextDecoderIntrinsic.prototype.decode, decoder);
const defineProperty = Object.defineProperty;
const hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);
const jsonParse = JSON.parse;
const jsonStringify = JSON.stringify;
const numberIntrinsic = Number;
const numberIsFinite = Number.isFinite;
const objectCreate = Object.create;
const regexpTest = Function.call.bind(RegExp.prototype.test);
const stringCharCodeAt = Function.call.bind(String.prototype.charCodeAt);
const stringSlice = Function.call.bind(String.prototype.slice);

function validSimpleEscape(character) {
  return (
    character === '"' ||
    character === "\\" ||
    character === "/" ||
    character === "b" ||
    character === "f" ||
    character === "n" ||
    character === "r" ||
    character === "t"
  );
}

class StrictJsonParser {
  constructor(text) {
    this.text = text;
    this.index = 0;
    this.values = 0;
  }

  fail(message) {
    throw new SyntaxError(`${message} at UTF-16 offset ${this.index}`);
  }

  skipWhitespace() {
    while (
      this.index < this.text.length &&
      (this.text[this.index] === " " ||
        this.text[this.index] === "\t" ||
        this.text[this.index] === "\n" ||
        this.text[this.index] === "\r")
    ) {
      this.index += 1;
    }
  }

  countValue() {
    this.values += 1;
    if (this.values > MAX_JSON_VALUES) {
      this.fail(`JSON contains more than ${MAX_JSON_VALUES} values`);
    }
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail("JSON has trailing non-whitespace data");
    return value;
  }

  parseValue(depth) {
    if (depth > MAX_JSON_DEPTH) this.fail(`JSON nesting exceeds ${MAX_JSON_DEPTH} levels`);
    this.countValue();
    const character = this.text[this.index];
    if (character === "{") return this.parseObject(depth + 1);
    if (character === "[") return this.parseArray(depth + 1);
    if (character === '"') return this.parseString();
    if (character === "t") return this.parseLiteral("true", true);
    if (character === "f") return this.parseLiteral("false", false);
    if (character === "n") return this.parseLiteral("null", null);
    if (character === "-" || (character >= "0" && character <= "9")) {
      return this.parseNumber();
    }
    this.fail(`Expected a JSON value, received ${jsonStringify(character ?? "end of input")}`);
  }

  parseObject(depth) {
    this.index += 1;
    const result = {};
    const keys = objectCreate(null);
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return result;
    }
    for (;;) {
      if (this.text[this.index] !== '"') this.fail("Expected a quoted JSON object key");
      const key = this.parseString();
      if (hasOwn(keys, key)) this.fail(`JSON object repeats key ${jsonStringify(key)}`);
      keys[key] = true;
      this.skipWhitespace();
      if (this.text[this.index] !== ":") this.fail("Expected ':' after JSON object key");
      this.index += 1;
      this.skipWhitespace();
      const value = this.parseValue(depth);
      defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      this.skipWhitespace();
      if (this.text[this.index] === "}") {
        this.index += 1;
        return result;
      }
      if (this.text[this.index] !== ",") this.fail("Expected ',' or '}' in JSON object");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  parseArray(depth) {
    this.index += 1;
    const result = [];
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return result;
    }
    for (;;) {
      result[result.length] = this.parseValue(depth);
      this.skipWhitespace();
      if (this.text[this.index] === "]") {
        this.index += 1;
        return result;
      }
      if (this.text[this.index] !== ",") this.fail("Expected ',' or ']' in JSON array");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  parseString() {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const code = stringCharCodeAt(this.text, this.index);
      if (code === 0x22) {
        this.index += 1;
        return jsonParse(stringSlice(this.text, start, this.index));
      }
      if (code < 0x20) this.fail("JSON string contains an unescaped control character");
      if (code === 0x5c) {
        this.index += 1;
        const escaped = this.text[this.index];
        if (escaped === "u") {
          const digits = stringSlice(this.text, this.index + 1, this.index + 5);
          if (!regexpTest(/^[0-9a-fA-F]{4}$/u, digits))
            this.fail("JSON string has an invalid Unicode escape");
          this.index += 5;
          continue;
        }
        if (!validSimpleEscape(escaped)) {
          this.fail(`JSON string has invalid escape ${jsonStringify(escaped)}`);
        }
      }
      this.index += 1;
    }
    this.fail("JSON string is unterminated");
  }

  parseLiteral(token, value) {
    if (stringSlice(this.text, this.index, this.index + token.length) !== token) {
      this.fail(`Expected JSON literal ${token}`);
    }
    this.index += token.length;
    return value;
  }

  parseNumber() {
    const start = this.index;
    if (this.text[this.index] === "-") this.index += 1;
    if (this.text[this.index] === "0") {
      this.index += 1;
      if (regexpTest(/\d/u, this.text[this.index] ?? ""))
        this.fail("JSON number has a leading zero");
    } else if (regexpTest(/[1-9]/u, this.text[this.index] ?? "")) {
      while (regexpTest(/\d/u, this.text[this.index] ?? "")) this.index += 1;
    } else {
      this.fail("JSON number has no integer digits");
    }
    if (this.text[this.index] === ".") {
      this.index += 1;
      if (!regexpTest(/\d/u, this.text[this.index] ?? "")) this.fail("JSON fraction has no digits");
      while (regexpTest(/\d/u, this.text[this.index] ?? "")) this.index += 1;
    }
    if (this.text[this.index] === "e" || this.text[this.index] === "E") {
      this.index += 1;
      if (this.text[this.index] === "+" || this.text[this.index] === "-") this.index += 1;
      if (!regexpTest(/\d/u, this.text[this.index] ?? "")) this.fail("JSON exponent has no digits");
      while (regexpTest(/\d/u, this.text[this.index] ?? "")) this.index += 1;
    }
    const value = numberIntrinsic(stringSlice(this.text, start, this.index));
    if (!numberIsFinite(value)) this.fail("JSON number is outside the finite JavaScript range");
    return value;
  }
}

/** Decode exact UTF-8 and reject duplicate keys rather than silently replacing them. */
export function parseStrictJsonBytes(bytes) {
  const text = decodeUtf8(copyBytes(bytes));
  return new StrictJsonParser(text).parse();
}

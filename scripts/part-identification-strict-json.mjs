import { TextDecoder } from "node:util";

const MAX_JSON_DEPTH = 128;
const MAX_JSON_VALUES = 4_000_000;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

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
    this.fail(`Expected a JSON value, received ${JSON.stringify(character ?? "end of input")}`);
  }

  parseObject(depth) {
    this.index += 1;
    const result = {};
    const keys = new Set();
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return result;
    }
    for (;;) {
      if (this.text[this.index] !== '"') this.fail("Expected a quoted JSON object key");
      const key = this.parseString();
      if (keys.has(key)) this.fail(`JSON object repeats key ${JSON.stringify(key)}`);
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") this.fail("Expected ':' after JSON object key");
      this.index += 1;
      this.skipWhitespace();
      const value = this.parseValue(depth);
      Object.defineProperty(result, key, {
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
      result.push(this.parseValue(depth));
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
      const code = this.text.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        return JSON.parse(this.text.slice(start, this.index));
      }
      if (code < 0x20) this.fail("JSON string contains an unescaped control character");
      if (code === 0x5c) {
        this.index += 1;
        const escaped = this.text[this.index];
        if (escaped === "u") {
          const digits = this.text.slice(this.index + 1, this.index + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(digits))
            this.fail("JSON string has an invalid Unicode escape");
          this.index += 5;
          continue;
        }
        if (!['"', "\\", "/", "b", "f", "n", "r", "t"].includes(escaped)) {
          this.fail(`JSON string has invalid escape ${JSON.stringify(escaped)}`);
        }
      }
      this.index += 1;
    }
    this.fail("JSON string is unterminated");
  }

  parseLiteral(token, value) {
    if (this.text.slice(this.index, this.index + token.length) !== token) {
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
      if (/\d/u.test(this.text[this.index] ?? "")) this.fail("JSON number has a leading zero");
    } else if (/[1-9]/u.test(this.text[this.index] ?? "")) {
      while (/\d/u.test(this.text[this.index] ?? "")) this.index += 1;
    } else {
      this.fail("JSON number has no integer digits");
    }
    if (this.text[this.index] === ".") {
      this.index += 1;
      if (!/\d/u.test(this.text[this.index] ?? "")) this.fail("JSON fraction has no digits");
      while (/\d/u.test(this.text[this.index] ?? "")) this.index += 1;
    }
    if (this.text[this.index] === "e" || this.text[this.index] === "E") {
      this.index += 1;
      if (this.text[this.index] === "+" || this.text[this.index] === "-") this.index += 1;
      if (!/\d/u.test(this.text[this.index] ?? "")) this.fail("JSON exponent has no digits");
      while (/\d/u.test(this.text[this.index] ?? "")) this.index += 1;
    }
    const value = Number(this.text.slice(start, this.index));
    if (!Number.isFinite(value)) this.fail("JSON number is outside the finite JavaScript range");
    return value;
  }
}

/** Decode exact UTF-8 and reject duplicate keys rather than silently replacing them. */
export function parseStrictJsonBytes(bytes) {
  const text = decoder.decode(Buffer.from(bytes));
  return new StrictJsonParser(text).parse();
}

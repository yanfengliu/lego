import { describe, expect, it } from "vitest";

import {
  STRICT_JSON_SNAPSHOT_LIMITS,
  strictBoundedJsonSnapshot,
  strictBoundedJsonSnapshotReport,
} from "./callout-publication-json";

function snapshot<T>(value: unknown, maximumBytes = 1024 * 1024): T {
  return strictBoundedJsonSnapshot<T>(value, "Publication input", maximumBytes);
}

describe("strict bounded publication JSON snapshot", () => {
  it("returns detached plain JSON with the exact source key order and values", () => {
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      ok: true,
    });
    const source = {
      text: "booklet",
      count: 881,
      negativeZero: -0,
      nested: [{ nil: null }, nullPrototype],
    };
    const captured = snapshot<typeof source>(source);

    source.text = "mutated";
    (source.nested as unknown[])[0] = { nil: "changed" };
    nullPrototype.ok = false;

    expect(captured).toEqual({
      text: "booklet",
      count: 881,
      negativeZero: 0,
      nested: [{ nil: null }, { ok: true }],
    });
    expect(Object.getPrototypeOf(captured)).toBe(null);
    expect(Object.getPrototypeOf(captured.nested)).toBe(Array.prototype);
    expect(Object.getPrototypeOf(captured.nested[0])).toBe(null);
    expect(Object.getOwnPropertyDescriptor(captured.nested, "toJSON")).toEqual({
      value: undefined,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    expect(JSON.stringify(captured)).toBe(
      '{"text":"booklet","count":881,"negativeZero":0,"nested":[{"nil":null},{"ok":true}]}',
    );
  });
  it("preserves dangerous property names as inert own data", () => {
    const source = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(source, "__proto__", {
      value: { polluted: false },
      enumerable: true,
    });
    Object.defineProperty(source, "constructor", { value: "data", enumerable: true });

    const captured = snapshot<Record<string, unknown>>(source);
    expect(Object.prototype.hasOwnProperty.call(captured, "__proto__")).toBe(true);
    expect(captured.__proto__).toEqual({ polluted: false });
    expect(captured.constructor).toBe("data");
    expect(JSON.stringify(captured)).toBe('{"__proto__":{"polluted":false},"constructor":"data"}');
  });
  it("never invokes toJSON, accessors, or array iterators", () => {
    let toJsonCalls = 0;
    expect(() =>
      snapshot({
        toJSON: () => {
          toJsonCalls += 1;
          return {};
        },
      }),
    ).toThrow(/unsupported function/);
    expect(toJsonCalls).toBe(0);

    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      },
    });
    expect(() => snapshot(accessor)).toThrow(/accessor/);
    expect(getterCalls).toBe(0);

    let iteratorCalls = 0;
    const array = [1, 2, 3];
    Object.defineProperty(array, Symbol.iterator, {
      value: () => {
        iteratorCalls += 1;
        return [][Symbol.iterator]();
      },
    });
    Object.defineProperty(array, "toJSON", {
      enumerable: true,
      value: () => {
        toJsonCalls += 1;
        return ["forged"];
      },
    });
    Object.defineProperty(array, "extra", {
      enumerable: true,
      get: () => {
        iteratorCalls += 1;
        return "forged-extra";
      },
    });
    Object.defineProperty(array, "01", {
      get: () => {
        iteratorCalls += 1;
        return "forged-index";
      },
    });
    const arraySnapshot = snapshot(array);
    expect(arraySnapshot).toEqual([1, 2, 3]);
    expect(JSON.stringify(arraySnapshot)).toBe("[1,2,3]");
    expect(toJsonCalls).toBe(0);
    expect(iteratorCalls).toBe(0);
  });
  it("rejects proxies before invoking any proxy trap, including when revoked", () => {
    const trapCalls: string[] = [];
    const proxy = new Proxy(
      { value: 1 },
      {
        get: () => {
          trapCalls.push("get");
          return 1;
        },
        getOwnPropertyDescriptor: () => {
          trapCalls.push("getOwnPropertyDescriptor");
          return undefined;
        },
        getPrototypeOf: () => {
          trapCalls.push("getPrototypeOf");
          return Object.prototype;
        },
        ownKeys: () => {
          trapCalls.push("ownKeys");
          return [];
        },
      },
    );
    expect(() => snapshot(proxy)).toThrow(/rejects Proxy values before reflection/);
    expect(trapCalls).toEqual([]);

    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    expect(() => snapshot(revocable.proxy)).toThrow(/rejects Proxy values before reflection/);
  });

  it("rejects proxies reached through an ordinary data descriptor without traps", () => {
    let trapCalls = 0;
    const child = new Proxy(
      { value: 1 },
      {
        ownKeys: () => {
          trapCalls += 1;
          return ["value"];
        },
      },
    );
    expect(() => snapshot({ child })).toThrow(/rejects Proxy values before reflection/);
    expect(trapCalls).toBe(0);
  });

  it("rejects sparse, oversized, and decorated arrays before stringification", () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = 1;
    expect(() => snapshot(sparse)).toThrow(/Publication input\[0\].*sparse/);

    const oversized: unknown[] = [];
    oversized.length = STRICT_JSON_SNAPSHOT_LIMITS.maxArrayLength + 1;
    let toJsonCalls = 0;
    Object.defineProperty(oversized, "toJSON", {
      value: () => {
        toJsonCalls += 1;
        return [];
      },
    });
    expect(() => snapshot(oversized)).toThrow(/array length exceeds/);
    expect(toJsonCalls).toBe(0);

    const decorated = [1];
    Object.defineProperty(decorated, "extra", { value: 2, enumerable: true });
    expect(snapshot(decorated)).toEqual([1]);
  });

  it("ignores symbol and non-enumerable properties that JSON cannot see", () => {
    const symbol = Symbol("hidden");
    let getterCalls = 0;
    const symbolSource = {};
    Object.defineProperty(symbolSource, symbol, {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      },
    });
    expect(snapshot(symbolSource)).toEqual({});

    const hidden = {};
    Object.defineProperty(hidden, "value", {
      get: () => {
        getterCalls += 1;
        return 1;
      },
    });
    expect(snapshot(hidden)).toEqual({});
    expect(getterCalls).toBe(0);
  });

  it("uses captured intrinsics instead of caller-replaced static and prototype hooks", () => {
    const originalDefineProperty = Object.defineProperty;
    const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    const restores: (() => void)[] = [];
    let hookCalls = 0;
    const poison = () => {
      hookCalls += 1;
      throw new Error("ambient hook executed");
    };
    const replace = (target: object, key: PropertyKey): void => {
      const descriptor = originalGetOwnPropertyDescriptor(target, key);
      if (descriptor === undefined) throw new Error(`Missing intrinsic ${String(key)}.`);
      originalDefineProperty(target, key, { ...descriptor, value: poison });
      restores.push(() => originalDefineProperty(target, key, descriptor));
    };

    let captured: unknown;
    let diagnostic = "";
    try {
      replace(Object, "getOwnPropertyDescriptor");
      replace(Object, "getPrototypeOf");
      replace(Object, "hasOwn");
      replace(Object, "defineProperty");
      replace(Object, "is");
      replace(Array, "isArray");
      replace(Buffer, "byteLength");
      replace(JSON, "stringify");
      replace(Number, "isFinite");
      replace(Number, "isSafeInteger");
      replace(String.prototype, "charCodeAt");
      replace(String.prototype, "slice");
      replace(WeakSet.prototype, "has");
      replace(WeakSet.prototype, "add");
      replace(WeakSet.prototype, "delete");

      captured = snapshot({ name: "brick", negativeZero: -0, rows: [1, 2] });
      try {
        snapshot({ "not.valid": undefined });
      } catch (error) {
        diagnostic = (error as Error).message;
      }
    } finally {
      for (let index = restores.length - 1; index >= 0; index -= 1) restores[index]!();
    }

    expect(captured).toEqual({ name: "brick", negativeZero: 0, rows: [1, 2] });
    expect(diagnostic).toMatch(/Publication input\["not\.valid"\].*unsupported undefined/u);
    expect(hookCalls).toBe(0);
  });

  it("reports exact descriptor-derived paths without invoking a nested accessor", () => {
    expect(() =>
      strictBoundedJsonSnapshot({ heightPt: undefined }, "Callout crop 0 metadata", 1024),
    ).toThrow(/Callout crop 0 metadata\.heightPt.*unsupported undefined/);

    expect(() => snapshot({ callouts: [{ heightPt: 8 }, { heightPt: Number.NaN }] })).toThrow(
      /Publication input\.callouts\[1\]\.heightPt.*non-finite number/,
    );

    let getterCalls = 0;
    const metadata = {};
    Object.defineProperty(metadata, "heightPt", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 8;
      },
    });
    expect(() => snapshot({ crops: [{ metadata }] })).toThrow(
      /Publication input\.crops\[0\]\.metadata\.heightPt.*accessor/,
    );
    expect(getterCalls).toBe(0);

    expect(() => snapshot({ "not.valid": undefined })).toThrow(
      /Publication input\["not\.valid"\].*unsupported undefined/,
    );
  });

  it("shadows ambient prototype toJSON hooks in detached output", () => {
    let objectCalls = 0;
    let arrayCalls = 0;
    const observed = (() => {
      try {
        Object.defineProperty(Object.prototype, "toJSON", {
          configurable: true,
          value: () => {
            objectCalls += 1;
            return { forged: "object" };
          },
        });
        Object.defineProperty(Array.prototype, "toJSON", {
          configurable: true,
          value: () => {
            arrayCalls += 1;
            return ["forged-array"];
          },
        });
        const captured = snapshot<{ records: { quantity: number }[] }>({
          records: [{ quantity: 2 }],
        });
        return {
          objectPrototype: Object.getPrototypeOf(captured) as object | null,
          arrayPrototype: Object.getPrototypeOf(captured.records) as object | null,
          encoded: JSON.stringify(captured),
        };
      } finally {
        delete (Object.prototype as { toJSON?: unknown }).toJSON;
        delete (Array.prototype as { toJSON?: unknown }).toJSON;
      }
    })();

    expect(observed.objectPrototype).toBe(null);
    expect(observed.arrayPrototype).toBe(Array.prototype);
    expect(observed.encoded).toBe('{"records":[{"quantity":2}]}');
    expect(objectCalls).toBe(0);
    expect(arrayCalls).toBe(0);
  });

  it("rejects every non-JSON primitive instead of silently coercing or dropping it", () => {
    for (const value of [
      undefined,
      1n,
      Symbol("value"),
      () => 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => snapshot({ value })).toThrow(/unsupported|non-finite/);
    }
  });

  it("rejects class instances and exotic containers", () => {
    class RecordLike {
      readonly value = 1;
    }
    for (const value of [new RecordLike(), new Date(0), new Map(), /x/u, new Uint8Array([1])]) {
      expect(() => snapshot(value)).toThrow(/only plain objects/);
    }

    const arraySubclass = new (class extends Array<number> {})(1, 2);
    expect(() => snapshot(arraySubclass)).toThrow(/only plain arrays/);
  });

  it("rejects cycles but snapshots repeated acyclic data as a detached tree", () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(() => snapshot(cycle)).toThrow(/contains a cycle/);

    const shared = { value: 1 };
    const captured = snapshot<{ left: { value: number }; right: { value: number } }>({
      left: shared,
      right: shared,
    });
    expect(captured).toEqual({ left: { value: 1 }, right: { value: 1 } });
    expect(captured.left).not.toBe(captured.right);
  });

  it("enforces the caller's exact aggregate UTF-8 byte ceiling", () => {
    const source = { emoji: "\ud83e\uddf1", escaped: "\n" };
    const exactBytes = Buffer.byteLength(JSON.stringify(source));
    expect(snapshot(source, exactBytes)).toEqual(source);
    expect(() => snapshot(source, exactBytes - 1)).toThrow(
      new RegExp(`${exactBytes - 1}-byte UTF-8 ceiling`, "u"),
    );
  });

  it("counts every JSON string escape and Unicode form exactly", () => {
    const values = [
      'quote"slash\\',
      "\b\t\n\f\r",
      "\u0000\u0001\u001f",
      "ascii \u00a2 \u20ac \ud83e\uddf1",
      "\ud800",
      "\udc00",
      "\u2028\u2029",
    ];
    for (const value of values) {
      const exactBytes = Buffer.byteLength(JSON.stringify(value));
      expect(snapshot(value, exactBytes)).toBe(value);
      expect(() => snapshot(value, exactBytes - 1)).toThrow(/byte UTF-8 ceiling/);
    }
  });

  it("bounds depth, node count, object enumeration, and string bytes", () => {
    let deep: unknown = null;
    for (let index = 0; index <= STRICT_JSON_SNAPSHOT_LIMITS.maxDepth; index += 1) {
      deep = [deep];
    }
    expect(() => snapshot(deep, STRICT_JSON_SNAPSHOT_LIMITS.maxBytes)).toThrow(/exceeds depth/);

    const wide: Record<string, null> = {};
    for (let index = 0; index <= STRICT_JSON_SNAPSHOT_LIMITS.maxPropertiesPerObject; index += 1) {
      wide[`k${index}`] = null;
    }
    expect(() => snapshot(wide, STRICT_JSON_SNAPSHOT_LIMITS.maxBytes)).toThrow(
      /object enumeration exceeds .* properties/,
    );

    const nodeGroupLength = STRICT_JSON_SNAPSHOT_LIMITS.maxArrayLength;
    const tooManyNodes = Array.from(
      { length: Math.ceil(STRICT_JSON_SNAPSHOT_LIMITS.maxNodes / nodeGroupLength) },
      () => Array.from({ length: nodeGroupLength }, () => null),
    );
    expect(() => snapshot(tooManyNodes, STRICT_JSON_SNAPSHOT_LIMITS.maxBytes)).toThrow(
      /exceeds .* nodes/,
    );

    expect(() =>
      snapshot(
        "x".repeat(STRICT_JSON_SNAPSHOT_LIMITS.maxStringBytes + 1),
        STRICT_JSON_SNAPSHOT_LIMITS.maxBytes,
      ),
    ).toThrow(/JSON value exceeds/);

    const hostileKey = "\0".repeat(STRICT_JSON_SNAPSHOT_LIMITS.maxKeyBytes + 1);
    let keyError = "";
    try {
      snapshot({ [hostileKey]: true }, STRICT_JSON_SNAPSHOT_LIMITS.maxBytes);
    } catch (error) {
      keyError = String(error);
    }
    expect(keyError).toMatch(/Publication input strict JSON key exceeds/u);
    expect(keyError.length).toBeLessThan(300);

    const boundedDiagnosticKey = "x".repeat(STRICT_JSON_SNAPSHOT_LIMITS.maxKeyBytes);
    let boundedDiagnostic = "";
    try {
      snapshot({ [boundedDiagnosticKey]: undefined }, STRICT_JSON_SNAPSHOT_LIMITS.maxBytes);
    } catch (error) {
      boundedDiagnostic = String(error);
    }
    expect(boundedDiagnostic).toContain("…");
    expect(boundedDiagnostic.length).toBeLessThan(800);
  });

  it("validates the label and caller byte ceiling before reading the value", () => {
    let traps = 0;
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          traps += 1;
          return [];
        },
      },
    );
    expect(() => strictBoundedJsonSnapshot(proxy, "", 1)).toThrow(/label must contain/);
    expect(() => strictBoundedJsonSnapshot(proxy, "Publication\ninput", 1)).toThrow(
      /printable ASCII/,
    );
    expect(() => strictBoundedJsonSnapshot(proxy, "Publication input", 0)).toThrow(
      /byte ceiling must be a safe integer/,
    );
    expect(() =>
      strictBoundedJsonSnapshot(
        proxy,
        "Publication input",
        STRICT_JSON_SNAPSHOT_LIMITS.maxBytes + 1,
      ),
    ).toThrow(/byte ceiling must be a safe integer/);
    expect(() => strictBoundedJsonSnapshotReport(proxy, "Publication input", 1, 0)).toThrow(
      /node ceiling must be a safe integer/,
    );
    expect(() =>
      strictBoundedJsonSnapshotReport(
        proxy,
        "Publication input",
        1,
        STRICT_JSON_SNAPSHOT_LIMITS.maxNodes + 1,
      ),
    ).toThrow(/node ceiling must be a safe integer/);
    expect(traps).toBe(0);
  });

  it("reports exact cumulative work and enforces a caller node remainder", () => {
    const report = strictBoundedJsonSnapshotReport({ rows: [1, 2] }, "Publication input", 1024, 4);
    expect(report.value).toEqual({ rows: [1, 2] });
    expect(report.encodedBytes).toBe(Buffer.byteLength(JSON.stringify({ rows: [1, 2] })));
    expect(report.nodes).toBe(4);
    expect(report.properties).toBe(3);
    expect(() =>
      strictBoundedJsonSnapshotReport({ rows: [1, 2] }, "Publication input", 1024, 3),
    ).toThrow(/exceeds 3 nodes/u);
  });
});

import { describe, expect, it } from "vitest";

import {
  boundedStringWithoutLivePrototype,
  nativeErrorOwnData,
  normalizeThrownWithoutProbing,
} from "../e2e/non-probing-error";

describe("non-probing host error normalization", () => {
  it("rejects inherited descriptor data and Proxy errors without invoking caller code", () => {
    const traps = { inheritedValue: 0, accessor: 0, proxy: 0 };
    const accessorError = new Error("replaced detail");
    Object.defineProperty(accessorError, "message", {
      configurable: true,
      get: () => {
        traps.accessor += 1;
        throw new Error("must not invoke the message accessor");
      },
    });
    const proxiedError = new Proxy(new Error("proxied detail"), {
      get: () => {
        traps.proxy += 1;
        throw new Error("must not read the Proxy error");
      },
      getOwnPropertyDescriptor: () => {
        traps.proxy += 1;
        throw new Error("must not inspect the Proxy error");
      },
      getPrototypeOf: () => {
        traps.proxy += 1;
        throw new Error("must not traverse the Proxy error");
      },
    });
    const inheritedValueDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "value");
    let accessorData: ReturnType<typeof nativeErrorOwnData>;
    try {
      Object.defineProperty(Object.prototype, "value", {
        configurable: true,
        get: () => {
          traps.inheritedValue += 1;
          return "forged inherited detail";
        },
      });
      accessorData = nativeErrorOwnData(accessorError);
    } finally {
      if (inheritedValueDescriptor === undefined) {
        Reflect.deleteProperty(Object.prototype, "value");
      } else {
        Object.defineProperty(Object.prototype, "value", inheritedValueDescriptor);
      }
    }

    expect(accessorData).toMatchObject({
      name: "Error",
      message: "A native error was retained without readable own data properties.",
    });
    expect(
      normalizeThrownWithoutProbing(proxiedError, "hostile non-primitive fallback").message,
    ).toBe("hostile non-primitive fallback");
    expect(traps).toEqual({ inheritedValue: 0, accessor: 0, proxy: 0 });
  });

  it("uses module-captured Error and string intrinsics after live replacements", () => {
    const NativeError = Error;
    const globalErrorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Error");
    const stringSliceDescriptor = Object.getOwnPropertyDescriptor(String.prototype, "slice");
    if (globalErrorDescriptor === undefined || stringSliceDescriptor === undefined) {
      throw new TypeError("Expected host Error and String.prototype.slice descriptors.");
    }
    const calls = { globalError: 0, stringSlice: 0 };
    const longPrimitive = "primitive detail".repeat(200);
    let normalized: Error;
    let boundedPrimitive: string;
    try {
      Object.defineProperty(globalThis, "Error", {
        configurable: globalErrorDescriptor.configurable === true,
        enumerable: globalErrorDescriptor.enumerable === true,
        get: () => {
          calls.globalError += 1;
          return NativeError;
        },
      });
      Object.defineProperty(String.prototype, "slice", {
        ...stringSliceDescriptor,
        value: () => {
          calls.stringSlice += 1;
          throw new NativeError("must use captured String.prototype.slice");
        },
      });
      normalized = normalizeThrownWithoutProbing(new NativeError("native detail"), "fallback");
      boundedPrimitive = boundedStringWithoutLivePrototype(longPrimitive, 32);
    } finally {
      Object.defineProperty(globalThis, "Error", globalErrorDescriptor);
      Object.defineProperty(String.prototype, "slice", stringSliceDescriptor);
    }

    expect(normalized.message).toBe("native detail");
    expect(boundedPrimitive).toBe(longPrimitive.slice(0, 32));
    expect(calls).toEqual({ globalError: 0, stringSlice: 0 });
  });

  it("does not invoke a replaced Number global or an inherited Error name setter", () => {
    const NativeError = Error;
    const NativeNumber = Number;
    const thrownNaN = NativeNumber.NaN;
    const globalNumberDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Number");
    const errorNameDescriptor = Object.getOwnPropertyDescriptor(Error.prototype, "name");
    if (globalNumberDescriptor === undefined || errorNameDescriptor === undefined) {
      throw new TypeError("Expected host Number and Error.prototype.name descriptors.");
    }
    const calls = { globalNumber: 0, inheritedNameSetter: 0 };
    let normalizedNative: Error;
    let normalizedNaN: Error;
    try {
      Object.defineProperty(globalThis, "Number", {
        configurable: globalNumberDescriptor.configurable === true,
        enumerable: globalNumberDescriptor.enumerable === true,
        get: () => {
          calls.globalNumber += 1;
          return NativeNumber;
        },
      });
      Object.defineProperty(Error.prototype, "name", {
        configurable: errorNameDescriptor.configurable === true,
        enumerable: errorNameDescriptor.enumerable === true,
        set: () => {
          calls.inheritedNameSetter += 1;
        },
      });
      normalizedNative = normalizeThrownWithoutProbing(
        new NativeError("native detail"),
        "fallback",
      );
      normalizedNaN = normalizeThrownWithoutProbing(thrownNaN, "fallback");
    } finally {
      Object.defineProperty(globalThis, "Number", globalNumberDescriptor);
      Object.defineProperty(Error.prototype, "name", errorNameDescriptor);
    }

    expect(normalizedNative.message).toBe("native detail");
    expect(Object.getOwnPropertyDescriptor(normalizedNative, "name")?.value).toBe("Error");
    expect(normalizedNaN.message).toBe("NaN");
    expect(calls).toEqual({ globalNumber: 0, inheritedNameSetter: 0 });
  });
});

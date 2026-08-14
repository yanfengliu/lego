import { describe, expect, it } from "vitest";

import { snapshotBoundedBuffer } from "./callout-publication-buffer";

describe("callout publication Buffer snapshot", () => {
  it("detaches exact intrinsic bytes without consulting iteration hooks", () => {
    const source = Buffer.from([1, 2, 3]);
    let iteratorCalls = 0;
    Object.defineProperty(source, Symbol.iterator, {
      value: () => {
        iteratorCalls += 1;
        throw new Error("caller iterator ran");
      },
    });
    const snapshot = snapshotBoundedBuffer(source, "Crop PNG", 3);
    expect(snapshot).toEqual(Buffer.from([1, 2, 3]));
    expect(iteratorCalls).toBe(0);
    source[0] = 9;
    expect(snapshot).toEqual(Buffer.from([1, 2, 3]));
  });

  it("rejects a Proxy before consulting its traps", () => {
    let traps = 0;
    const source = new Proxy(Buffer.from([1]), {
      get: (target, property, receiver) => {
        traps += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => snapshotBoundedBuffer(source, "Crop PNG", 1)).toThrow(/non-Proxy Buffer/u);
    expect(traps).toBe(0);
  });

  it("rejects an own length accessor without invoking it", () => {
    const source = Buffer.from([1, 2, 3]);
    let reads = 0;
    Object.defineProperty(source, "length", {
      get: () => {
        reads += 1;
        return 1_000_000_000;
      },
    });
    expect(() => snapshotBoundedBuffer(source, "Crop PNG", 3)).toThrow(
      /must not decorate its intrinsic byte length/u,
    );
    expect(reads).toBe(0);
  });

  it("refuses non-Buffers, empty bytes, and invalid limits", () => {
    expect(() => snapshotBoundedBuffer(new Uint8Array([1]), "Crop PNG", 1)).toThrow(/Buffer/u);
    expect(() => snapshotBoundedBuffer(Buffer.alloc(0), "Crop PNG", 1)).toThrow(/1\.\.1/u);
    expect(() => snapshotBoundedBuffer(Buffer.from([1, 2]), "Crop PNG", 1)).toThrow(/1\.\.1/u);
    expect(() => snapshotBoundedBuffer(Buffer.from([1]), "Crop PNG", 0)).toThrow(
      /positive safe integer/u,
    );
  });

  it("runs the aggregate precharge before allocating or copying", () => {
    expect(() =>
      snapshotBoundedBuffer(Buffer.from([1, 2, 3]), "Crop PNG", 3, (byteLength) => {
        expect(byteLength).toBe(3);
        throw new Error("aggregate exhausted before copy");
      }),
    ).toThrow(/aggregate exhausted before copy/u);
  });
});

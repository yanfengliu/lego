import { describe, expect, it } from "vitest";

import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  createLegacyRecutSemanticCliWorkflowLedger,
  runLegacyRecutSemanticCliWorkflow,
} from "./part-identification-legacy-recut-semantic-cli.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  LEGACY_RECUT_SEMANTIC_MAX_ARTIFACT_BYTES,
  compilePartIdentificationLegacyRecutSemantic,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";

describe("bounded MJS input snapshots", () => {
  it("rejects Proxy and accessor containers without invoking caller code", () => {
    let traps = 0;
    const proxy = new Proxy(
      { bytes: Buffer.from([1]) },
      {
        get() {
          traps += 1;
          throw new Error("must not get through Proxy");
        },
        getOwnPropertyDescriptor() {
          traps += 1;
          throw new Error("must not inspect through Proxy");
        },
        ownKeys() {
          traps += 1;
          throw new Error("must not enumerate through Proxy");
        },
      },
    );
    expect(() => snapshotExactDataObject(proxy, "Input", ["bytes"])).toThrow(/Proxy/);
    expect(traps).toBe(0);

    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "bytes", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must not call accessor");
      },
    });
    expect(() => snapshotExactDataObject(accessor, "Input", ["bytes"])).toThrow(
      /enumerable own data property/,
    );
    expect(getterCalls).toBe(0);
  });

  it("rejects coercible objects, subclasses, shared backing, and oversize before copying", () => {
    let coercions = 0;
    const coercible = {
      valueOf() {
        coercions += 1;
        return Buffer.from([1]);
      },
      [Symbol.toPrimitive]() {
        coercions += 1;
        return 1;
      },
    };
    expect(() =>
      snapshotBoundedUint8Array(coercible, {
        label: "Bytes",
        minimumBytes: 1,
        maximumBytes: 8,
      }),
    ).toThrow(/ordinary Buffer or Uint8Array/);
    expect(coercions).toBe(0);

    class ByteSubclass extends Uint8Array {}
    expect(() =>
      snapshotBoundedUint8Array(new ByteSubclass([1]), {
        label: "Bytes",
        minimumBytes: 1,
        maximumBytes: 8,
      }),
    ).toThrow(/ordinary Buffer or Uint8Array/);

    if (typeof SharedArrayBuffer !== "undefined") {
      expect(() =>
        snapshotBoundedUint8Array(new Uint8Array(new SharedArrayBuffer(1)), {
          label: "Bytes",
          minimumBytes: 1,
          maximumBytes: 8,
        }),
      ).toThrow(/SharedArrayBuffer/);
    }
    expect(() =>
      snapshotBoundedUint8Array(new Uint8Array(9), {
        label: "Bytes",
        minimumBytes: 1,
        maximumBytes: 8,
      }),
    ).toThrow(/has 9 bytes/);
  });

  it("closes the semantic compiler's top-level container without invoking traps", async () => {
    const dummyInput = () => ({
      calloutRoot: "output/callout-thumbnails",
      currentManifestBytes: Buffer.from([1]),
      legacyManifestBytes: Buffer.from([1]),
      legacyRecutArtifactBytes: Buffer.from([1]),
      officialModelBytes: Buffer.from([1]),
      truthBytes: Buffer.from([1]),
    });
    let proxyTraps = 0;
    const proxy = new Proxy(dummyInput(), {
      get() {
        proxyTraps += 1;
        throw new Error("must not get through Proxy");
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error("must not inspect through Proxy");
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error("must not enumerate through Proxy");
      },
    });
    await expect(compilePartIdentificationLegacyRecutSemantic(proxy)).rejects.toThrow(/Proxy/);
    expect(proxyTraps).toBe(0);

    let accessorCalls = 0;
    const accessor = dummyInput();
    Object.defineProperty(accessor, "currentManifestBytes", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("must not call input accessor");
      },
    });
    await expect(compilePartIdentificationLegacyRecutSemantic(accessor)).rejects.toThrow(
      /enumerable own data property/,
    );
    expect(accessorCalls).toBe(0);

    let byteTraps = 0;
    const proxiedBytes = dummyInput();
    proxiedBytes.currentManifestBytes = new Proxy(Buffer.from([1]), {
      get() {
        byteTraps += 1;
        throw new Error("must not read byte Proxy");
      },
      getPrototypeOf() {
        byteTraps += 1;
        throw new Error("must not inspect byte Proxy");
      },
    });
    await expect(compilePartIdentificationLegacyRecutSemantic(proxiedBytes)).rejects.toThrow(
      /may not be a Proxy/,
    );
    expect(byteTraps).toBe(0);

    await expect(
      verifyPartIdentificationLegacyRecutSemantic({
        ...dummyInput(),
        artifactBytes: new Uint8Array(LEGACY_RECUT_SEMANTIC_MAX_ARTIFACT_BYTES + 1),
      }),
    ).rejects.toThrow(/262145 bytes/);
  });
});

describe("legacy-recut semantic CLI work caps", () => {
  it("discloses work from three actual protected reservations", async () => {
    const ledger = createLegacyRecutSemanticCliWorkflowLedger(
      CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
    );
    await ledger.run("compile", () => undefined);
    await ledger.run("verify", () => undefined);
    await ledger.run("published-byte-rebound", () => undefined);
    expect(ledger.report()).toEqual({
      compilePasses: 3,
      cropImages: 510,
      cropImageLimit: 510,
      decodePixels: 43_833_660,
      decodePixelLimit: 50_331_648,
      officialModelIndexCalls: 3,
      officialModelIndexCallLimit: 3,
      officialModelInputBytes: 5_709_507,
      officialModelInputByteLimit: 6_291_456,
      officialXmlFullDecodes: 6,
      officialXmlFullDecodeLimit: 6,
      officialXmlDecodedBytes: 11_419_014,
      officialXmlDecodeByteLimit: 12_582_912,
    });
  });

  it("refuses a fourth actual reservation before its callback and preflights cap overflow", async () => {
    const ledger = createLegacyRecutSemanticCliWorkflowLedger(
      CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
    );
    await ledger.run("compile", () => undefined);
    await ledger.run("verify", () => undefined);
    await ledger.run("published-byte-rebound", () => undefined);
    let fourthCalls = 0;
    await expect(
      ledger.run("fourth-operation", () => {
        fourthCalls += 1;
      }),
    ).rejects.toThrow(/fourth protected operation is forbidden/);
    expect(fourthCalls).toBe(0);

    expect(() =>
      createLegacyRecutSemanticCliWorkflowLedger({
        ...CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
        legacyRecutCropImages: 171,
      }),
    ).toThrow(/exceeds its fixed/);
    expect(() =>
      createLegacyRecutSemanticCliWorkflowLedger({
        ...CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
        officialXmlDecodeByteLimit: 4_194_305,
      }),
    ).toThrow(/exceeds its fixed/);
  });

  it("wraps the real CLI call graph so dependency injection observes exactly three operations", async () => {
    const calls = { compile: 0, inputReads: 0, verify: 0, writes: 0 };
    const published = Buffer.from("{}\n");
    const dependencies = {
      inputBytes() {
        calls.inputReads += 1;
        return { syntheticRole: Buffer.from([1]) };
      },
      async compile() {
        calls.compile += 1;
        return { synthetic: true };
      },
      encode() {
        return published;
      },
      async verify() {
        calls.verify += 1;
        return Object.freeze({ syntheticVerified: calls.verify });
      },
      isVerified() {
        return true;
      },
      verifiedBytes() {
        return published;
      },
      inspect() {
        return Object.freeze({
          artifact: Object.freeze({
            perCompileWork: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
          }),
          digest: `sha256:${"0".repeat(64)}`,
        });
      },
      writePublishedBytes() {
        calls.writes += 1;
      },
      readPublishedBytes() {
        return published;
      },
    };
    const result = await runLegacyRecutSemanticCliWorkflow(dependencies);
    expect(calls).toEqual({ compile: 1, inputReads: 3, verify: 2, writes: 1 });
    expect(result.workflow.compilePasses).toBe(3);
    expect(result.workflow.officialXmlFullDecodes).toBe(6);
  });
});

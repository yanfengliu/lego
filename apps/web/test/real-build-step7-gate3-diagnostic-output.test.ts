import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { removeContainedDirectoryTree } from "../e2e/contained-directory";
import {
  retainStep7Gate3DiagnosticOutput,
  retainStep7Gate3UnverifiedFailureEnvelope,
  type Step7Gate3DiagnosticOutputTestHooks,
} from "../e2e/real-build-step7-gate3-diagnostic-output";

const sha256 = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const taskOwnedOutputRoots = new Set<string>();

function taskOwnedOutputRoot(): string {
  const relative = `output/gate3-diagnostic-output-test-${randomUUID()}`;
  taskOwnedOutputRoots.add(relative);
  return relative;
}

function validRetentionInput(outputRoot: string, hooks?: Step7Gate3DiagnosticOutputTestHooks) {
  const panelPngBytes = Buffer.from("panel");
  const traceBase = Object.freeze({
    schemaVersion: "test.trace/1",
    outputPanel: Object.freeze({
      file: "step-007-panel.png",
      bytes: panelPngBytes.length,
      digest: sha256(panelPngBytes),
    }),
  });
  return {
    outputRoot,
    trace: Object.freeze({
      ...traceBase,
      traceDigest: sha256(JSON.stringify(traceBase)),
    }),
    panelPngBytes,
    summary: { status: "complete" },
    ...(hooks === undefined ? {} : { __testHooks: hooks }),
  };
}

function runDirectoryEntries(outputRoot: string): readonly string[] {
  const runs = resolve(process.cwd(), outputRoot, "runs");
  return existsSync(runs)
    ? readdirSync(runs).filter((name) => !name.startsWith(".lego-contained-guard-"))
    : [];
}

function onlyRunDirectoryEntry(outputRoot: string): string {
  const entries = runDirectoryEntries(outputRoot);
  if (entries.length !== 1) {
    throw new TypeError(`Expected one Gate-3 run directory; observed ${entries.length}.`);
  }
  return entries[0]!;
}

afterEach(() => {
  for (const outputRoot of taskOwnedOutputRoots) {
    if (!existsSync(resolve(process.cwd(), outputRoot))) continue;
    removeContainedDirectoryTree(
      process.cwd(),
      outputRoot,
      "Gate-3 diagnostic output test cleanup",
    );
  }
  taskOwnedOutputRoots.clear();
});

describe("step-7 Gate-3 diagnostic retention", () => {
  it("refuses a caller-supplied trace digest that does not hash the exact trace body", () => {
    expect(() =>
      retainStep7Gate3DiagnosticOutput({
        outputRoot: "output/gate3-step7-diagnostic-output-test-never-created",
        trace: Object.freeze({
          schemaVersion: "test.trace/1",
          traceDigest: `sha256:${"0".repeat(64)}`,
        }),
        panelPngBytes: Buffer.from("panel"),
        summary: {},
      }),
    ).toThrow(/exact trace body hashes/u);
  });

  it("refuses panel bytes that do not match the trace outputPanel binding", () => {
    const traceBase = Object.freeze({
      schemaVersion: "test.trace/1",
      outputPanel: Object.freeze({
        file: "step-007-panel.png",
        bytes: 5,
        digest: sha256("other"),
      }),
    });
    expect(() =>
      retainStep7Gate3DiagnosticOutput({
        outputRoot: "output/gate3-step7-diagnostic-output-test-never-created",
        trace: Object.freeze({
          ...traceBase,
          traceDigest: sha256(JSON.stringify(traceBase)),
        }),
        panelPngBytes: Buffer.from("panel"),
        summary: {},
      }),
    ).toThrow(/does not bind the exact supplied/u);
  });

  it("retains authority-none staging counterevidence when an artifact write fails", () => {
    const outputRoot = taskOwnedOutputRoot();
    expect(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, {
          beforeArtifactWrite: (file) => {
            if (file === "summary.json") throw new Error("injected staging failure");
          },
        }),
      ),
    ).toThrow("injected staging failure");

    expect(runDirectoryEntries(outputRoot)).toHaveLength(1);
    expect(runDirectoryEntries(outputRoot)[0]).toMatch(/^\.tmp-/u);
    expect(readdirSync(resolve(process.cwd(), outputRoot, "unverified"))).toHaveLength(1);
  });

  it("rejects and retains a staging bundle silently mutated before its rename", () => {
    const outputRoot = taskOwnedOutputRoot();
    expect(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, {
          beforeDirectoryPublish: () => {
            const staging = onlyRunDirectoryEntry(outputRoot);
            writeFileSync(
              resolve(process.cwd(), outputRoot, "runs", staging, "trace.json"),
              "silently mutated staging trace",
            );
          },
        }),
      ),
    ).toThrow(/failed bounded sequential read-back/u);

    expect(runDirectoryEntries(outputRoot)).toHaveLength(1);
  });

  it("rejects and retains a silently mutated staged manifest before its final rename", () => {
    const outputRoot = taskOwnedOutputRoot();
    expect(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, {
          beforeDirectoryPublish: () => {
            const staging = onlyRunDirectoryEntry(outputRoot);
            writeFileSync(
              resolve(process.cwd(), outputRoot, "runs", staging, "artifact-manifest.json"),
              "silently mutated staged manifest",
            );
          },
        }),
      ),
    ).toThrow(/failed bounded sequential read-back/u);

    expect(runDirectoryEntries(outputRoot)).toHaveLength(1);
  });

  it("rejects an unexpected file before the final rename", () => {
    const outputRoot = taskOwnedOutputRoot();
    expect(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, {
          beforeDirectoryPublish: () => {
            const staging = onlyRunDirectoryEntry(outputRoot);
            writeFileSync(
              resolve(process.cwd(), outputRoot, "runs", staging, "unexpected.txt"),
              "not in the complete-bundle manifest",
            );
          },
        }),
      ),
    ).toThrow(/failed bounded sequential read-back/u);

    expect(runDirectoryEntries(outputRoot)).toHaveLength(1);
  });

  it("keeps the final path absent until the verified staging rename commits", () => {
    const outputRoot = taskOwnedOutputRoot();
    let entriesBeforeCommit: readonly string[] = [];
    const retained = retainStep7Gate3DiagnosticOutput(
      validRetentionInput(outputRoot, {
        beforeDirectoryPublish: () => {
          entriesBeforeCommit = runDirectoryEntries(outputRoot);
        },
      }),
    );
    expect(entriesBeforeCommit).toHaveLength(1);
    expect(entriesBeforeCommit[0]).toMatch(/^\.tmp-/u);
    expect(runDirectoryEntries(outputRoot)).toEqual([retained.runRelative.split("/").at(-1)]);
  });

  it("retains staging after a hostile native Error without probing its Proxy prototype", () => {
    const outputRoot = taskOwnedOutputRoot();
    let prototypeProbes = 0;
    const refuseProbe = () => {
      prototypeProbes += 1;
      throw new Error("hostile publication Error prototype was probed");
    };
    const failure = new Error("injected prepublication failure");
    Object.setPrototypeOf(
      failure,
      new Proxy(Error.prototype, {
        get: refuseProbe,
        getOwnPropertyDescriptor: refuseProbe,
        getPrototypeOf: refuseProbe,
      }),
    );

    expect(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, {
          beforeDirectoryPublish: () => {
            throw failure;
          },
        }),
      ),
    ).toThrow("injected prepublication failure");
    expect(prototypeProbes).toBe(0);
    expect(runDirectoryEntries(outputRoot)).toHaveLength(1);
  });

  it("refuses a source substituted at the final rename and preserves both observed paths", () => {
    const outputRoot = taskOwnedOutputRoot();
    let displacedRelative = "";
    let finalRelative = "";

    expect(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, {
          beforeFinalDirectoryRename: ({ stagingRelative, runRelative }) => {
            displacedRelative = `${stagingRelative}-displaced`;
            finalRelative = runRelative;
            renameSync(
              resolve(process.cwd(), stagingRelative),
              resolve(process.cwd(), displacedRelative),
            );
            cpSync(
              resolve(process.cwd(), displacedRelative),
              resolve(process.cwd(), stagingRelative),
              { recursive: true },
            );
          },
        }),
      ),
    ).toThrow(/identity=false/u);

    expect(existsSync(resolve(process.cwd(), displacedRelative))).toBe(true);
    expect(existsSync(resolve(process.cwd(), finalRelative))).toBe(true);
    const envelopeFile = readdirSync(resolve(process.cwd(), outputRoot, "unverified"))[0]!;
    const envelope = JSON.parse(
      readFileSync(resolve(process.cwd(), outputRoot, "unverified", envelopeFile), "utf8"),
    ) as {
      authority: string;
      counterevidence: {
        runRelative: string;
        finalReadBack: { directoryIdentityVerified: boolean; complete: boolean };
      };
    };
    expect(envelope.authority).toBe("none");
    expect(envelope.counterevidence.runRelative).toBe(finalRelative);
    expect(envelope.counterevidence.finalReadBack).toMatchObject({
      directoryIdentityVerified: false,
      complete: false,
    });
  });

  it("publishes one complete final bundle with no visible staging sibling", () => {
    const outputRoot = taskOwnedOutputRoot();
    const retentionInput = validRetentionInput(outputRoot);
    const retained = retainStep7Gate3DiagnosticOutput(retentionInput);
    const directoryName = retained.runRelative.split("/").at(-1);

    expect(directoryName).toBeDefined();
    expect(runDirectoryEntries(outputRoot)).toEqual([directoryName]);
    expect(
      readdirSync(resolve(process.cwd(), retained.runRelative))
        .filter((name) => !name.startsWith(".lego-"))
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(["artifact-manifest.json", "step-007-panel.png", "summary.json", "trace.json"]);
    expect(readFileSync(resolve(process.cwd(), retained.runRelative, "trace.json"))).toEqual(
      Buffer.from(`${JSON.stringify(retentionInput.trace)}\n`),
    );
    expect(
      sha256(readFileSync(resolve(process.cwd(), retained.runRelative, "artifact-manifest.json"))),
    ).toBe(retained.manifestDigest);
    expect(retained.publicationReadBack).toMatchObject({
      verification: "bounded-sequential-read-back",
      complete: true,
      simultaneousAtReturnProved: false,
      storageSealed: false,
      crashDurabilityProved: false,
    });
  });

  it("rejects nested stateful toJSON in complete trace and summary inputs without invoking it", () => {
    const outputRoot = taskOwnedOutputRoot();
    let calls = 0;
    const stateful = {
      toJSON: () => {
        calls += 1;
        return { changed: calls };
      },
    };
    const valid = validRetentionInput(outputRoot);

    expect(() =>
      retainStep7Gate3DiagnosticOutput({
        ...valid,
        trace: {
          ...valid.trace,
          nested: stateful,
        },
      }),
    ).toThrow(/finite own-data JSON/u);
    expect(() =>
      retainStep7Gate3DiagnosticOutput({
        ...valid,
        summary: { nested: stateful },
      }),
    ).toThrow(/finite own-data JSON/u);
    expect(calls).toBe(0);
    expect(existsSync(resolve(process.cwd(), outputRoot))).toBe(false);
  });

  it("retains failure counterevidence only in an explicitly unverified raw envelope", () => {
    const outputRoot = taskOwnedOutputRoot();
    const retained = retainStep7Gate3UnverifiedFailureEnvelope({
      outputRoot,
      stage: "verification",
      failure: new TypeError("injected verification failure"),
      counterevidence: Object.freeze({ parentAttempts: 3, completeRun: false }),
      capturedAt: "2026-08-23T12:34:56.789Z",
    });
    const parsed = JSON.parse(
      readFileSync(resolve(process.cwd(), retained.fileRelative), "utf8"),
    ) as Record<string, unknown>;

    expect(retained.fileRelative).toContain("/unverified/");
    expect(parsed).toMatchObject({
      schemaVersion: "lego.step7-gate3-unverified-raw-envelope/1",
      verification: "unverified-raw-counterevidence",
      completeRun: false,
      publicationEligible: false,
      authority: "none",
      stage: "verification",
      failure: {
        kind: "error",
        name: "Error",
        message: "injected verification failure",
      },
      counterevidence: { parentAttempts: 3, completeRun: false },
    });
    expect(existsSync(resolve(process.cwd(), outputRoot, "runs"))).toBe(false);
  });

  it("describes a hostile non-Error failure without probing its properties", () => {
    const outputRoot = taskOwnedOutputRoot();
    let propertyProbes = 0;
    const refuseProbe = () => {
      propertyProbes += 1;
      throw new Error("hostile failure property was probed");
    };
    const hostileFailure = new Proxy(Object.create(null) as object, {
      get: refuseProbe,
      getOwnPropertyDescriptor: refuseProbe,
      getPrototypeOf: refuseProbe,
      ownKeys: refuseProbe,
    });

    const retained = retainStep7Gate3UnverifiedFailureEnvelope({
      outputRoot,
      stage: "execution",
      failure: hostileFailure,
      counterevidence: null,
      capturedAt: "2026-08-23T12:34:56.789Z",
    });

    expect(propertyProbes).toBe(0);
    expect(retained.envelope.failure).toEqual({
      kind: "object",
      name: "non-Error",
      message: "A thrown object was retained without accessing attacker-controlled properties.",
    });
  });

  it("retains a native Error using only its own data descriptors", () => {
    const outputRoot = taskOwnedOutputRoot();
    let prototypeProbes = 0;
    const refusePrototypeProbe = () => {
      prototypeProbes += 1;
      throw new Error("hostile Error prototype was probed");
    };
    const hostilePrototype = new Proxy(Error.prototype, {
      get: refusePrototypeProbe,
      getOwnPropertyDescriptor: refusePrototypeProbe,
      getPrototypeOf: refusePrototypeProbe,
    });
    const nativeFailure = new Error("native failure with a hostile prototype");
    Object.setPrototypeOf(nativeFailure, hostilePrototype);

    const retained = retainStep7Gate3UnverifiedFailureEnvelope({
      outputRoot,
      stage: "publication",
      failure: nativeFailure,
      counterevidence: null,
      capturedAt: "2026-08-23T12:34:56.789Z",
    });

    expect(prototypeProbes).toBe(0);
    expect(retained.envelope.failure).toEqual({
      kind: "error",
      name: "Error",
      message: "native failure with a hostile prototype",
    });
  });

  it("rejects stateful nested toJSON in failure counterevidence without invoking it", () => {
    const outputRoot = taskOwnedOutputRoot();
    let calls = 0;
    const counterevidence = {
      nested: {
        toJSON: () => {
          calls += 1;
          return { changed: calls };
        },
      },
    };

    expect(() =>
      retainStep7Gate3UnverifiedFailureEnvelope({
        outputRoot,
        stage: "verification",
        failure: new Error("failure"),
        counterevidence,
        capturedAt: "2026-08-23T12:34:56.789Z",
      }),
    ).toThrow(/finite own-data JSON/u);
    expect(calls).toBe(0);
    expect(existsSync(resolve(process.cwd(), outputRoot))).toBe(false);
  });
});

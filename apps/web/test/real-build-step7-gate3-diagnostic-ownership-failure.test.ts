import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { removeContainedDirectoryTree } from "../e2e/contained-directory";
import { retainStep7Gate3DiagnosticOutput } from "../e2e/real-build-step7-gate3-diagnostic-output";
import {
  createStep7Gate3NoDeleteStagingDirectory,
  isStep7Gate3OwnershipCreationFailure,
  type Step7Gate3OwnershipFailureStage,
} from "../e2e/real-build-step7-gate3-no-delete-filesystem";

const sha256 = (value: Uint8Array | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const FAILURE_STAGES = [
  "marker-creation",
  "marker-write",
  "marker-fsync",
  "marker-verification",
] as const satisfies readonly Step7Gate3OwnershipFailureStage[];

const taskOwnedOutputRoots = new Set<string>();

function taskOwnedOutputRoot(): string {
  const relative = `output/gate3-diagnostic-ownership-failure-test-${randomUUID()}`;
  taskOwnedOutputRoots.add(relative);
  return relative;
}

function validRetentionInput(
  outputRoot: string,
  directoryOwnershipFailureStage: Step7Gate3OwnershipFailureStage,
  beforeOwnershipFailureEnvelopeRetention?: (paths: {
    readonly stagingRelative: string;
    readonly runRelative: string;
  }) => void,
) {
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
    __testHooks: {
      directoryOwnershipFailureStage,
      ...(beforeOwnershipFailureEnvelopeRetention === undefined
        ? {}
        : { beforeOwnershipFailureEnvelopeRetention }),
    },
  };
}

function captureThrown(action: () => unknown): {
  readonly threw: boolean;
  readonly value: unknown;
} {
  try {
    action();
    return { threw: false, value: undefined };
  } catch (value) {
    return { threw: true, value };
  }
}

function stagingEntries(outputRoot: string): readonly string[] {
  const runs = resolve(process.cwd(), outputRoot, "runs");
  return readdirSync(runs).filter((name) => !name.startsWith(".lego-contained-guard-"));
}

afterEach(() => {
  for (const outputRoot of taskOwnedOutputRoots) {
    if (!existsSync(resolve(process.cwd(), outputRoot))) continue;
    removeContainedDirectoryTree(
      process.cwd(),
      outputRoot,
      "Gate-3 diagnostic ownership failure test cleanup",
    );
  }
  taskOwnedOutputRoots.clear();
});

describe("step-7 Gate-3 unverified staging ownership retention", () => {
  it("cannot forge a brand through post-initialization WeakSet.has or Reflect.apply poisoning", () => {
    const hasDescriptor = Object.getOwnPropertyDescriptor(WeakSet.prototype, "has");
    const applyDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply");
    if (hasDescriptor === undefined || applyDescriptor === undefined) {
      throw new TypeError("Expected configurable WeakSet.has and Reflect.apply descriptors.");
    }
    let observed: boolean | undefined;
    try {
      Object.defineProperty(WeakSet.prototype, "has", {
        ...hasDescriptor,
        value: () => true,
      });
      Object.defineProperty(Reflect, "apply", {
        ...applyDescriptor,
        value: () => {
          throw new Error("poisoned Reflect.apply was invoked");
        },
      });
      observed = isStep7Gate3OwnershipCreationFailure(Object.freeze({ forged: true }));
    } finally {
      Object.defineProperty(Reflect, "apply", applyDescriptor);
      Object.defineProperty(WeakSet.prototype, "has", hasDescriptor);
    }

    expect(observed).toBe(false);
  });

  it("cannot suppress a brand through post-initialization WeakSet.add/has or Reflect.apply poisoning", () => {
    const outputRoot = taskOwnedOutputRoot();
    const addDescriptor = Object.getOwnPropertyDescriptor(WeakSet.prototype, "add");
    const hasDescriptor = Object.getOwnPropertyDescriptor(WeakSet.prototype, "has");
    const applyDescriptor = Object.getOwnPropertyDescriptor(Reflect, "apply");
    if (
      addDescriptor === undefined ||
      hasDescriptor === undefined ||
      applyDescriptor === undefined
    ) {
      throw new TypeError("Expected configurable WeakSet and Reflect.apply descriptors.");
    }
    let failure: unknown;
    let branded = false;
    try {
      Object.defineProperty(WeakSet.prototype, "add", {
        ...addDescriptor,
        value: function suppressedAdd(this: WeakSet<object>): WeakSet<object> {
          return this;
        },
      });
      Object.defineProperty(WeakSet.prototype, "has", {
        ...hasDescriptor,
        value: () => false,
      });
      Object.defineProperty(Reflect, "apply", {
        ...applyDescriptor,
        value: () => {
          throw new Error("poisoned Reflect.apply was invoked");
        },
      });
      try {
        createStep7Gate3NoDeleteStagingDirectory({
          root: process.cwd(),
          relativePath: `${outputRoot}/runs/unverified-brand`,
          label: "suppressed ownership brand control",
          failureStage: "marker-creation",
        });
      } catch (error) {
        failure = error;
        branded = isStep7Gate3OwnershipCreationFailure(error);
      }
    } finally {
      Object.defineProperty(Reflect, "apply", applyDescriptor);
      Object.defineProperty(WeakSet.prototype, "has", hasDescriptor);
      Object.defineProperty(WeakSet.prototype, "add", addDescriptor);
    }

    expect(failure).toBeDefined();
    expect(branded).toBe(true);
  });

  it.each(FAILURE_STAGES)(
    "retains authority-none evidence when ownership fails at %s",
    (failureStage) => {
      const outputRoot = taskOwnedOutputRoot();

      const observed = captureThrown(() =>
        retainStep7Gate3DiagnosticOutput(validRetentionInput(outputRoot, failureStage)),
      );

      expect(observed.threw).toBe(true);
      const entries = stagingEntries(outputRoot);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatch(/^\.tmp-/u);
      const stagingRelative = `${outputRoot}/runs/${entries[0]}`;
      expect(existsSync(resolve(process.cwd(), stagingRelative))).toBe(true);
      expect((observed.value as Error).message).toContain(stagingRelative);

      const envelopeFiles = readdirSync(resolve(process.cwd(), outputRoot, "unverified"));
      expect(envelopeFiles).toHaveLength(1);
      const envelopeBytes = readFileSync(
        resolve(process.cwd(), outputRoot, "unverified", envelopeFiles[0]!),
      );
      expect(envelopeBytes.length).toBeLessThan(64 * 1024);
      const envelope = JSON.parse(envelopeBytes.toString("utf8")) as {
        readonly authority: string;
        readonly stage: string;
        readonly counterevidence: {
          readonly stagingRelative: string;
          readonly ownershipVerified: boolean;
          readonly directoryOwnershipVerified: boolean;
          readonly ownerTokenVerified: boolean;
          readonly ownerMarkerVerified: boolean;
          readonly automaticPathnameDeletionAttempted: boolean;
        };
      };
      expect(envelope).toMatchObject({ authority: "none", stage: "publication" });
      expect(envelope.counterevidence).toMatchObject({
        stagingRelative,
        ownershipVerified: false,
        directoryOwnershipVerified: false,
        ownerTokenVerified: false,
        ownerMarkerVerified: false,
        automaticPathnameDeletionAttempted: false,
      });
    },
  );

  it("exposes the exact retained staging path when envelope retention also fails", () => {
    const outputRoot = taskOwnedOutputRoot();
    let stagingRelative = "";

    const observed = captureThrown(() =>
      retainStep7Gate3DiagnosticOutput(
        validRetentionInput(outputRoot, "marker-creation", (paths) => {
          stagingRelative = paths.stagingRelative;
          throw new Error("injected ownership-envelope retention failure");
        }),
      ),
    );

    expect(observed.threw).toBe(true);
    expect(observed.value).toBeInstanceOf(AggregateError);
    expect((observed.value as AggregateError).message).toContain(stagingRelative);
    expect(stagingRelative).toMatch(/^output\/gate3-.+\/runs\/\.tmp-/u);
    expect(existsSync(resolve(process.cwd(), stagingRelative))).toBe(true);
    expect(existsSync(resolve(process.cwd(), outputRoot, "unverified"))).toBe(false);
  });
});

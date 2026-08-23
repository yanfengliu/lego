import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createContainedDirectoryExclusive,
  ensureContainedDirectoryTree,
  removeContainedDirectoryTree,
  renameContainedDirectoryAtomic,
  withContainedDirectory,
  withExistingContainedDirectory,
} from "../e2e/contained-directory";
import { CONTAINED_DIRECTORY_OWNER_MARKER } from "../e2e/contained-directory-ownership";

const taskOwnedRoots = new Set<string>();

function taskOwnedRoot(): string {
  const root = `output/contained-directory-owned-test-${randomUUID()}`;
  taskOwnedRoots.add(root);
  return root;
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

afterEach(() => {
  for (const root of taskOwnedRoots) {
    if (!existsSync(resolve(process.cwd(), root))) continue;
    removeContainedDirectoryTree(process.cwd(), root, "contained-directory owner test cleanup");
  }
  taskOwnedRoots.clear();
});

describe("contained directory ownership", () => {
  it("preserves a null failure thrown after a public directory-tree mutation", () => {
    const root = taskOwnedRoot();
    const rootAbsolute = resolve(process.cwd(), root);
    mkdirSync(rootAbsolute, { recursive: true });

    const observed = captureThrown(() =>
      ensureContainedDirectoryTree(rootAbsolute, "partial-null", "null failure control", {
        afterMutation: () => {
          throw null;
        },
      }),
    );

    expect(observed).toEqual({ threw: true, value: null });
    expect(existsSync(resolve(rootAbsolute, "partial-null"))).toBe(true);
  });

  it("preserves an undefined failure thrown by a partially mutating public action", () => {
    const root = taskOwnedRoot();

    const observed = captureThrown(() =>
      withContainedDirectory(
        process.cwd(),
        `${root}/action`,
        "undefined failure control",
        (dir) => {
          writeFileSync(resolve(dir, "partial.txt"), "mutation before undefined failure");
          throw undefined;
        },
      ),
    );

    expect(observed).toEqual({ threw: true, value: undefined });
    expect(readFileSync(resolve(process.cwd(), root, "action", "partial.txt"), "utf8")).toBe(
      "mutation before undefined failure",
    );
  });

  it("creates and pins only the exact directory identity", () => {
    const root = taskOwnedRoot();
    const candidate = `${root}/runs/owned`;
    const identity = createContainedDirectoryExclusive(
      process.cwd(),
      candidate,
      "owned directory fixture",
    );

    withExistingContainedDirectory(
      process.cwd(),
      candidate,
      "owned directory pin",
      (directory) => writeFileSync(resolve(directory, "artifact.txt"), "owned"),
      identity,
    );
    expect(
      withExistingContainedDirectory(
        process.cwd(),
        candidate,
        "owned directory read pin",
        (directory) => readFileSync(resolve(directory, "artifact.txt"), "utf8"),
        identity,
      ),
    ).toBe("owned");
    expect(() =>
      withExistingContainedDirectory(
        process.cwd(),
        candidate,
        "wrong directory pin",
        () => undefined,
        { dev: identity.dev, ino: identity.ino + 1n, ownerToken: identity.ownerToken },
      ),
    ).toThrow(/not the exact directory identity/u);

    expect(existsSync(resolve(process.cwd(), candidate))).toBe(true);
  });

  it("rejects simulated identity reuse when the retained owner token differs", () => {
    const root = taskOwnedRoot();
    const candidate = `${root}/runs/owned`;
    const identity = createContainedDirectoryExclusive(
      process.cwd(),
      candidate,
      "owner-token fixture",
    );
    const simulatedReuse = { ...identity, ownerToken: randomUUID() };

    expect(() =>
      withExistingContainedDirectory(
        process.cwd(),
        candidate,
        "owner-token pin",
        () => undefined,
        simulatedReuse,
      ),
    ).toThrow(/exact retained owner token/u);
    expect(existsSync(resolve(process.cwd(), candidate))).toBe(true);
  });

  it("rejects an otherwise matching filesystem identity whose owner marker is missing", () => {
    const root = taskOwnedRoot();
    const candidate = `${root}/runs/owned`;
    const identity = createContainedDirectoryExclusive(
      process.cwd(),
      candidate,
      "missing owner-marker fixture",
    );
    unlinkSync(resolve(process.cwd(), candidate, CONTAINED_DIRECTORY_OWNER_MARKER));

    expect(() =>
      withExistingContainedDirectory(
        process.cwd(),
        candidate,
        "missing owner-marker pin",
        () => undefined,
        identity,
      ),
    ).toThrow(/exact retained owner token/u);
    expect(existsSync(resolve(process.cwd(), candidate))).toBe(true);
  });

  it("refuses a path replacement and retains both observed identities", () => {
    const root = taskOwnedRoot();
    const parent = `${root}/runs`;
    const candidate = `${parent}/owned`;
    const displaced = `${parent}/displaced`;
    const identity = createContainedDirectoryExclusive(
      process.cwd(),
      candidate,
      "replacement fixture",
    );
    writeFileSync(resolve(process.cwd(), candidate, "artifact.txt"), "owned");
    renameSync(resolve(process.cwd(), candidate), resolve(process.cwd(), displaced));
    mkdirSync(resolve(process.cwd(), candidate));
    writeFileSync(resolve(process.cwd(), candidate, "replacement.txt"), "replacement");

    expect(() =>
      withExistingContainedDirectory(
        process.cwd(),
        candidate,
        "replacement pin refusal",
        () => undefined,
        identity,
      ),
    ).toThrow(/not the exact directory identity/u);
    expect(existsSync(resolve(process.cwd(), displaced))).toBe(true);
    expect(readFileSync(resolve(process.cwd(), candidate, "replacement.txt"), "utf8")).toBe(
      "replacement",
    );
  });

  it("retains a quarantine path when the test-only retention seam runs", () => {
    const root = taskOwnedRoot();
    const candidate = `${root}/runs/owned`;
    ensureContainedDirectoryTree(process.cwd(), candidate, "child quarantine fixture");
    writeFileSync(resolve(process.cwd(), candidate, "artifact.txt"), "owned artifact");
    let replacementPath = "";
    let displacedOwnedPath = "";

    expect(() =>
      removeContainedDirectoryTree(process.cwd(), candidate, "child quarantine cleanup", {
        beforeQuarantinedEntryDelete: ({ originalName, quarantinedPath }) => {
          if (originalName !== "artifact.txt") return;
          replacementPath = quarantinedPath;
          displacedOwnedPath = `${quarantinedPath}-displaced-owned`;
          renameSync(quarantinedPath, displacedOwnedPath);
          writeFileSync(quarantinedPath, "replacement owner");
        },
      }),
    ).toThrow(/retained its quarantined entry/u);

    expect(readFileSync(replacementPath, "utf8")).toBe("replacement owner");
    expect(readFileSync(displacedOwnedPath, "utf8")).toBe("owned artifact");
  });

  it("retains a guard path when the test-only retention seam runs", () => {
    const root = taskOwnedRoot();
    const rootAbsolute = resolve(process.cwd(), root);
    mkdirSync(resolve(rootAbsolute, "source"), { recursive: true });
    let replacementPath = "";
    let displacedGuardPath = "";

    expect(() =>
      renameContainedDirectoryAtomic(
        rootAbsolute,
        "source",
        "target",
        "last-instruction guard replacement",
        {
          beforeGuardCleanupUnlink: (guardPath) => {
            replacementPath = guardPath;
            displacedGuardPath = `${guardPath}-displaced-owned`;
            renameSync(guardPath, displacedGuardPath);
            writeFileSync(guardPath, "replacement guard owner");
          },
        },
      ),
    ).toThrow(/retained its guard pathname/u);

    expect(readFileSync(replacementPath, "utf8")).toBe("replacement guard owner");
    expect(readFileSync(displacedGuardPath)).toEqual(Buffer.alloc(0));
    unlinkSync(replacementPath);
    unlinkSync(displacedGuardPath);
  });

  it("combines hostile native failures without probing their Proxy prototypes", () => {
    const root = taskOwnedRoot();
    const rootAbsolute = resolve(process.cwd(), root);
    mkdirSync(rootAbsolute, { recursive: true });
    createContainedDirectoryExclusive(rootAbsolute, "source", "hostile failure source");
    let prototypeProbes = 0;
    const refuseProbe = () => {
      prototypeProbes += 1;
      throw new Error("hostile contained-directory Error prototype was probed");
    };
    const primary = new Error("injected contained-directory primary failure");
    Object.setPrototypeOf(
      primary,
      new Proxy(Error.prototype, {
        get: refuseProbe,
        getOwnPropertyDescriptor: refuseProbe,
        getPrototypeOf: refuseProbe,
      }),
    );

    let failure: unknown = null;
    try {
      renameContainedDirectoryAtomic(
        rootAbsolute,
        "source",
        "target",
        "hostile failure combination",
        {
          afterPreflight: () => {
            throw primary;
          },
          beforeGuardCleanupUnlink: () => {
            throw new Error("injected guard cleanup failure");
          },
        },
      );
    } catch (error) {
      failure = error;
    } finally {
      for (const name of readdirSync(rootAbsolute)) {
        if (name.startsWith(".lego-contained-guard-")) unlinkSync(resolve(rootAbsolute, name));
      }
    }

    expect(failure).toBeInstanceOf(AggregateError);
    expect(prototypeProbes).toBe(0);
    expect((failure as AggregateError).errors[0]).toMatchObject({
      name: "Error",
      message: "injected contained-directory primary failure",
    });
  });
});

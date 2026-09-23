import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX } from "../e2e/real-build-bootstrap-source";
import { realBuildGlobalTeardownWithEnvironment } from "../e2e/real-build-global-teardown";
import {
  REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY,
  REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER,
  realBuildViteShutdownPreservationDecision,
} from "../e2e/real-build-vite-shutdown-preservation";
import { listenWithCloseOnFailure } from "../e2e/vite-server-lifecycle";

const directories: string[] = [];
const PLAYWRIGHT_CONFIG_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "playwright.config.ts"),
  "utf8",
);

function bootstrapEnvironment(): {
  readonly directory: string;
  readonly releasePath: string;
  readonly environment: NodeJS.ProcessEnv;
} {
  const directory = realpathSync.native(
    mkdtempSync(join(tmpdir(), REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX)),
  );
  directories.push(directory);
  const releasePath = join(directory, "release.txt");
  return {
    directory,
    releasePath,
    environment: {
      LEGO_REAL_BUILD_REQUIRED: "1",
      LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY: directory,
      LEGO_REAL_BUILD_BOOTSTRAP_RELEASE: releasePath,
      LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID: "2147483647",
    },
  };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("Vite server startup lifecycle", () => {
  it("finishes closing a partially started server before rejecting the listen failure", async () => {
    const primary = new Error("listen failed");
    const events: string[] = [];

    await expect(
      listenWithCloseOnFailure({
        listen: async () => {
          events.push("listen");
          throw primary;
        },
        close: async () => {
          events.push("close-start");
          await Promise.resolve();
          events.push("close-complete");
        },
      }),
    ).rejects.toBe(primary);
    expect(events).toEqual(["listen", "close-start", "close-complete"]);
  });

  it("hands a failed listen rollback to global teardown without releasing or removing evidence", async () => {
    const primary = new Error("listen failed");
    const cleanup = new Error("close failed");
    const { directory, releasePath, environment } = bootstrapEnvironment();
    let thrown: unknown = null;

    try {
      await listenWithCloseOnFailure(
        {
          listen: async () => {
            throw primary;
          },
          close: async () => {
            throw cleanup;
          },
        },
        { environment },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toEqual([primary, cleanup]);
    expect(environment[REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY]).toBe("1");
    expect(existsSync(join(directory, REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER))).toBe(true);
    await expect(realBuildGlobalTeardownWithEnvironment(environment)).rejects.toThrow(
      /Refusing to release or remove.*unconfirmed Vite shutdown/u,
    );
    expect(existsSync(releasePath)).toBe(false);
    expect(existsSync(directory)).toBe(true);
  });

  it("publishes the same preservation evidence when the returned teardown close rejects", async () => {
    const cleanup = new Error("close failed");
    const { directory, environment } = bootstrapEnvironment();
    const teardown = await listenWithCloseOnFailure(
      {
        listen: async () => undefined,
        close: async () => {
          throw cleanup;
        },
      },
      { environment },
    );

    await expect(teardown()).rejects.toBe(cleanup);
    expect(environment[REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY]).toBe("1");
    expect(existsSync(join(directory, REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER))).toBe(true);
  });

  it("keeps normal teardown confirmed and leaves the exit decision releasable", async () => {
    const { directory, environment } = bootstrapEnvironment();
    let closeCount = 0;
    const teardown = await listenWithCloseOnFailure(
      {
        listen: async () => undefined,
        close: async () => {
          closeCount += 1;
        },
      },
      { environment },
    );

    await teardown();
    expect(closeCount).toBe(1);
    expect(environment[REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY]).toBeUndefined();
    expect(realBuildViteShutdownPreservationDecision({ directory, environment })).toEqual({
      preserve: false,
      reason: null,
    });
  });

  it("makes the config exit decision fail closed on malformed marker counterevidence", () => {
    const { directory, environment } = bootstrapEnvironment();
    writeFileSync(join(directory, REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER), "malformed\n", {
      flag: "wx",
    });

    const decision = realBuildViteShutdownPreservationDecision({ directory, environment });
    expect(decision.preserve).toBe(true);
    expect(decision.reason).toMatch(/not the fixed ordinary file/u);
  });

  it("keeps the pre-lock config Node-built-in-only and its exit decision ahead of release", () => {
    const imports = [...PLAYWRIGHT_CONFIG_SOURCE.matchAll(/^import[\s\S]*?from "([^"]+)";/gmu)].map(
      (match) => match[1],
    );
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((specifier) => specifier?.startsWith("node:"))).toBe(true);
    expect(PLAYWRIGHT_CONFIG_SOURCE).toContain(
      `"${REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_ENVIRONMENT_KEY}" as const`,
    );
    expect(PLAYWRIGHT_CONFIG_SOURCE).toContain(
      `"${REAL_BUILD_VITE_SHUTDOWN_UNCONFIRMED_MARKER}" as const`,
    );
    const decision = PLAYWRIGHT_CONFIG_SOURCE.indexOf(
      "const preservationReason = realBuildBootstrapExitPreservationReason",
    );
    const release = PLAYWRIGHT_CONFIG_SOURCE.indexOf('writeFileSync(releasePath, "RELEASE\\n"');
    expect(decision).toBeGreaterThan(0);
    expect(release).toBeGreaterThan(decision);
  });
});

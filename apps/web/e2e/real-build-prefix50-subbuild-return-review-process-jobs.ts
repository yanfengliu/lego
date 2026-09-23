export const REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS = [
  "static-app-server",
  "playwright-browser-worker",
  "containment-transient-parent",
  "containment-hold",
] as const;

export type RealBuildPrefix50Step44OwnedProcessJob =
  | Readonly<{
      jobKind: "static-app-server";
      port: number;
    }>
  | Readonly<{
      jobKind: "playwright-browser-worker";
    }>
  | Readonly<{
      jobKind: "containment-transient-parent";
      detachGrandchild: boolean;
    }>
  | Readonly<{
      jobKind: "containment-hold";
    }>;

const MAXIMUM_JOB_BYTES = 512;
const FORBIDDEN_NODE_ENVIRONMENT_NAMES = new Set(["NODE_OPTIONS", "NODE_PATH"]);

export function scrubRealBuildPrefix50Step44OwnedProcessEnvironment(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const scrubbed: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(environment))
    if (!FORBIDDEN_NODE_ENVIRONMENT_NAMES.has(name.toUpperCase()) && value !== undefined)
      scrubbed[name] = value;
  return scrubbed;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function requireJob(value: unknown): RealBuildPrefix50Step44OwnedProcessJob {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Step-44 owned-process job must be one exact object.");
  const job = value as Readonly<Record<string, unknown>>;
  switch (job.jobKind) {
    case "static-app-server":
      if (
        !exactKeys(job, ["jobKind", "port"]) ||
        !Number.isSafeInteger(job.port) ||
        Number(job.port) < 1 ||
        Number(job.port) > 65_535
      )
        throw new TypeError(
          "Step-44 static-app-server job requires only an integer port from 1 through 65535.",
        );
      return Object.freeze({
        jobKind: job.jobKind,
        port: Number(job.port),
      });
    case "playwright-browser-worker":
      if (!exactKeys(job, ["jobKind"]))
        throw new TypeError("Step-44 playwright-browser-worker job accepts no payload fields.");
      return Object.freeze({ jobKind: job.jobKind });
    case "containment-transient-parent":
      if (
        !exactKeys(job, ["jobKind", "detachGrandchild"]) ||
        typeof job.detachGrandchild !== "boolean"
      )
        throw new TypeError(
          "Step-44 containment-transient-parent job requires only a boolean detachGrandchild field.",
        );
      return Object.freeze({
        jobKind: job.jobKind,
        detachGrandchild: job.detachGrandchild,
      });
    case "containment-hold":
      if (!exactKeys(job, ["jobKind"]))
        throw new TypeError("Step-44 containment-hold job accepts no payload fields.");
      return Object.freeze({ jobKind: job.jobKind });
    default:
      throw new TypeError(
        `Step-44 owned-process job kind must be one of ${REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS.join(
          ", ",
        )}.`,
      );
  }
}

export function encodeRealBuildPrefix50Step44OwnedProcessJob(
  value: RealBuildPrefix50Step44OwnedProcessJob,
): string {
  const bytes = Buffer.from(JSON.stringify(requireJob(value)), "utf8");
  if (bytes.byteLength > MAXIMUM_JOB_BYTES)
    throw new RangeError("Step-44 owned-process job exceeded 512 bytes.");
  return bytes.toString("base64url");
}

export function decodeRealBuildPrefix50Step44OwnedProcessJob(
  encoded: string | undefined,
): RealBuildPrefix50Step44OwnedProcessJob {
  if (
    encoded === undefined ||
    encoded.length === 0 ||
    encoded.length > 768 ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded)
  )
    throw new TypeError("Step-44 owned-process bootstrap requires one bounded base64url job.");
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.byteLength > MAXIMUM_JOB_BYTES || bytes.toString("base64url") !== encoded)
    throw new RangeError(
      "Step-44 owned-process bootstrap job exceeded its canonical 512-byte bound.",
    );
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new TypeError("Step-44 owned-process bootstrap job must be canonical JSON.", {
      cause: error,
    });
  }
  const job = requireJob(value);
  if (!bytes.equals(Buffer.from(JSON.stringify(job), "utf8")))
    throw new TypeError("Step-44 owned-process bootstrap job must use canonical exact-key JSON.");
  return job;
}

import { fileURLToPath } from "node:url";

import {
  REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS,
  type RealBuildPrefix50Step44OwnedProcessJob,
} from "./real-build-prefix50-subbuild-return-review-process-jobs.ts";

type JobKind = RealBuildPrefix50Step44OwnedProcessJob["jobKind"];
type LaunchArgument =
  | Readonly<{ kind: "target" }>
  | Readonly<{ kind: "literal"; value: string }>
  | Readonly<{ kind: "decimal-port"; jobKind: "static-app-server" }>
  | Readonly<{
      kind: "attachment-mode";
      jobKind: "containment-transient-parent";
      whenTrue: "detached";
      whenFalse: "attached";
    }>;

interface LaunchDefinition {
  readonly relativeTarget: string;
  readonly targetClass: "local-script" | "trusted-dependency-script";
  readonly testOnly: boolean;
  readonly arguments: readonly LaunchArgument[];
}

export const REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE = Object.freeze({
  "static-app-server": Object.freeze({
    relativeTarget: "./real-build-prefix50-subbuild-return-review-static-app-server.ts",
    targetClass: "local-script",
    testOnly: false,
    arguments: Object.freeze([
      Object.freeze({ kind: "literal", value: "--experimental-strip-types" }),
      Object.freeze({ kind: "target" }),
      Object.freeze({ kind: "decimal-port", jobKind: "static-app-server" }),
    ]),
  }),
  "playwright-browser-worker": Object.freeze({
    relativeTarget: "./real-build-prefix50-subbuild-return-review-browser-worker.ts",
    targetClass: "local-script",
    testOnly: false,
    arguments: Object.freeze([
      Object.freeze({ kind: "literal", value: "--experimental-strip-types" }),
      Object.freeze({ kind: "target" }),
    ]),
  }),
  "containment-transient-parent": Object.freeze({
    relativeTarget: "./real-build-prefix50-subbuild-return-review-process-containment-probe.ts",
    targetClass: "local-script",
    testOnly: true,
    arguments: Object.freeze([
      Object.freeze({ kind: "literal", value: "--experimental-strip-types" }),
      Object.freeze({ kind: "target" }),
      Object.freeze({
        kind: "attachment-mode",
        jobKind: "containment-transient-parent",
        whenTrue: "detached",
        whenFalse: "attached",
      }),
    ]),
  }),
  "containment-hold": Object.freeze({
    relativeTarget:
      "./real-build-prefix50-subbuild-return-review-process-containment-grandchild.ts",
    targetClass: "local-script",
    testOnly: true,
    arguments: Object.freeze([
      Object.freeze({ kind: "literal", value: "--experimental-strip-types" }),
      Object.freeze({ kind: "target" }),
    ]),
  }),
} satisfies Readonly<Record<JobKind, LaunchDefinition>>);

function materializeArgument(input: {
  readonly argument: LaunchArgument;
  readonly job: RealBuildPrefix50Step44OwnedProcessJob;
  readonly target: string;
}): string {
  if (input.argument.kind === "target") return input.target;
  if (input.argument.kind === "literal") return input.argument.value;
  if (input.argument.kind === "decimal-port") {
    if (input.job.jobKind !== input.argument.jobKind)
      throw new TypeError("Step-44 launch-table port field crossed its finite job kind.");
    return String(input.job.port);
  }
  if (input.argument.kind === "attachment-mode") {
    if (input.job.jobKind !== input.argument.jobKind)
      throw new TypeError("Step-44 launch-table attachment field crossed its finite job kind.");
    return input.job.detachGrandchild ? input.argument.whenTrue : input.argument.whenFalse;
  }
  throw new TypeError("Step-44 launch table contains an unsupported argument atom.");
}

export function materializeRealBuildPrefix50Step44ProcessLaunch(
  job: RealBuildPrefix50Step44OwnedProcessJob,
): Readonly<{
  target: string;
  targetClass: "local-script" | "trusted-dependency-script";
  testOnly: boolean;
  arguments: readonly string[];
}> {
  if (
    Object.keys(REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE).join("\n") !==
    REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_JOB_KINDS.join("\n")
  )
    throw new TypeError("Step-44 process launch table does not equal its finite job-kind roster.");
  const definition = REAL_BUILD_PREFIX50_STEP44_PROCESS_LAUNCH_TABLE[job.jobKind];
  const target = fileURLToPath(new URL(definition.relativeTarget, import.meta.url));
  return Object.freeze({
    target,
    targetClass: definition.targetClass,
    testOnly: definition.testOnly,
    arguments: Object.freeze(
      definition.arguments.map((argument) => materializeArgument({ argument, job, target })),
    ),
  });
}

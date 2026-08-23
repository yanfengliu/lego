import type { Gate3BoundaryResourceKind } from "./real-build-step7-gate3-source-evidence";
import { step7Gate3SourcePathForViteUrl } from "./real-build-step7-gate3-source-policy";
import {
  STEP7_GATE3_CLOSE_TIME_COMPANION_PATH,
  STEP7_GATE3_CLOSE_TIME_CONTROL_PATH,
} from "./real-build-step7-gate3-synthetic-source";
import { STEP7_GATE3_WORKER_CONTROL_PATH } from "./real-build-step7-gate3-worker-policy";

const STEP7_GATE3_BLANK_RUNNER_PATH = "/__real_build_runner__";

export function classifyStep7Gate3RequestResource(input: {
  readonly url: URL;
  readonly relativeRequestUrl: string;
  readonly repoRoot: string;
  readonly allowedSourcePaths: ReadonlySet<string>;
  readonly requiredPdfRelativeUrl: string | null;
  readonly requiredWorkerRelativeUrl: string | null;
  readonly requiredCloseTimeControlRelativeUrl: string | null;
}): {
  readonly isRunner: boolean;
  readonly isWorkerControl: boolean;
  readonly isCloseTimeControl: boolean;
  readonly isCloseTimeCompanion: boolean;
  readonly isPdfWorker: boolean;
  readonly isPdf: boolean;
  readonly sourcePath: string | null;
  readonly resourceKind: Gate3BoundaryResourceKind;
} {
  const isRunner = input.relativeRequestUrl === STEP7_GATE3_BLANK_RUNNER_PATH;
  const isWorkerControl =
    input.requiredWorkerRelativeUrl !== null &&
    input.relativeRequestUrl === STEP7_GATE3_WORKER_CONTROL_PATH;
  const isCloseTimeControl =
    input.requiredCloseTimeControlRelativeUrl !== null &&
    input.relativeRequestUrl === STEP7_GATE3_CLOSE_TIME_CONTROL_PATH;
  const isCloseTimeCompanion =
    input.requiredCloseTimeControlRelativeUrl !== null &&
    input.relativeRequestUrl === STEP7_GATE3_CLOSE_TIME_COMPANION_PATH;
  const isPdfWorker =
    input.requiredWorkerRelativeUrl !== null &&
    input.relativeRequestUrl === input.requiredWorkerRelativeUrl;
  const isPdf =
    input.requiredPdfRelativeUrl !== null &&
    input.relativeRequestUrl === input.requiredPdfRelativeUrl;
  const sourcePath =
    isRunner || isWorkerControl || isCloseTimeControl || isCloseTimeCompanion || isPdf
      ? null
      : step7Gate3SourcePathForViteUrl(input.url, input.repoRoot, input.allowedSourcePaths);
  const resourceKind: Gate3BoundaryResourceKind = isRunner
    ? "runner"
    : isWorkerControl
      ? "worker-control"
      : isCloseTimeControl
        ? "close-time-control"
        : isCloseTimeCompanion
          ? "close-time-companion"
          : isPdfWorker
            ? "pdf-worker"
            : isPdf
              ? "input-pdf"
              : "locked-source";
  return {
    isRunner,
    isWorkerControl,
    isCloseTimeControl,
    isCloseTimeCompanion,
    isPdfWorker,
    isPdf,
    sourcePath,
    resourceKind,
  };
}

import type { RealBuildSourceSnapshot } from "./real-build-replay-files";

export const REAL_BUILD_REPLAY_CLOSURE_SCHEMA = "lego.real-build-replay-closure/3" as const;

export interface RealBuildReplayClosureManifest {
  readonly schemaVersion: typeof REAL_BUILD_REPLAY_CLOSURE_SCHEMA;
  readonly authority: "local-diagnostic";
  readonly authenticated: false;
  readonly replayLevel: "downstream-only" | "metadata-only";
  readonly earliestBoundary: "browser-output" | "input-rejection";
  readonly roles: readonly {
    readonly role: string;
    readonly digest: string;
    readonly bytes: number;
    readonly casPath: string;
  }[];
  readonly sourceBundle: {
    readonly files: readonly RealBuildSourceSnapshot[];
    readonly digest: string;
  };
  readonly environmentDigest: string;
  readonly manifestDigest: string;
}

export interface VerifiedRealBuildReplayClosure {
  readonly manifest: RealBuildReplayClosureManifest;
  readonly roleBytes: ReadonlyMap<string, Buffer>;
}

export interface RealBuildReplayInspection {
  readonly authority: "local-diagnostic";
  readonly authenticated: false;
  readonly replayLevel: RealBuildReplayClosureManifest["replayLevel"];
  readonly contractDigest: string | null;
  readonly roleTrace: readonly {
    readonly role: string;
    readonly digest: string;
    readonly bytes: number;
  }[];
  readonly sourceTrace: readonly RealBuildSourceSnapshot[];
}

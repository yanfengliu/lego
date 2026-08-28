import type { BuilderDesignSourcePin } from "../apps/web/e2e/real-build-builder-source-contract";

export interface ConsumedBuilder2453DiagnosticRegistryRoute {
  readonly route: {
    readonly routeId: "builder-2453-I-6595205-to-2453b/1";
    readonly catalogPartId: "builtin:brick-1x1x5-solid-stud";
    readonly exactLdrawId: "2453b.dat";
    readonly localPartFrame: {
      readonly matrix: readonly [25, 0, 0, 0, -25, 0, 0, 0, -25];
      readonly translationLdu: readonly [0, 60, 0];
    };
    readonly authority: Readonly<Record<string, boolean>>;
  };
  readonly source: BuilderDesignSourcePin;
}

export function consumeBuilder2453DiagnosticRegistryRoute(
  token: unknown,
): Promise<ConsumedBuilder2453DiagnosticRegistryRoute>;

export function isConsumedBuilder2453DiagnosticRegistryRoute(
  value: unknown,
): value is ConsumedBuilder2453DiagnosticRegistryRoute;

export function verifyBuilder2453RegistryProofBytes(bytes: Uint8Array): unknown;

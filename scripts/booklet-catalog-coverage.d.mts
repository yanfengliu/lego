export function compileBookletCatalogCoverageClosure(input: {
  readonly manifestBytes: Uint8Array;
  readonly featuresArtifact: unknown;
  readonly matchArtifact: unknown;
  readonly distancesArtifact: unknown;
  readonly cardsArtifact: unknown;
  readonly cardImagesArtifact: unknown;
  readonly answersArtifact: unknown;
  readonly pairJudgedArtifact: unknown;
  readonly elementsArtifact: unknown;
  readonly source: "deterministic" | "adjudicated";
  readonly model: string | null;
  readonly assignment: "nearest" | "one-to-one" | "quantity-informed";
  readonly lastStep: number;
}): unknown;

export function verifyBookletCatalogCoverageClosure(input: {
  readonly coverageBytes: Uint8Array;
  readonly manifestBytes: Uint8Array;
  readonly featuresArtifact: unknown;
  readonly matchArtifact: unknown;
  readonly distancesArtifact: unknown;
  readonly cardsArtifact: unknown;
  readonly cardImagesArtifact: unknown;
  readonly answersArtifact: unknown;
  readonly pairJudgedArtifact: unknown;
  readonly elementsArtifact: unknown;
  readonly source: "deterministic" | "adjudicated";
  readonly model: string | null;
  readonly assignment: "nearest" | "one-to-one" | "quantity-informed";
  readonly lastStep: number;
}): unknown;

export function buildBookletCatalogCoverageReport(input: {
  readonly manifestBytes: Uint8Array;
  readonly features: {
    readonly callouts: readonly unknown[];
    readonly inputDigests: { readonly pdf: string; readonly calloutManifest: string };
  };
  readonly claims: ReadonlyMap<number, unknown>;
  readonly judgedVerdicts?: ReadonlyMap<number, unknown>;
  readonly elements: Readonly<Record<string, unknown>>;
  readonly source: "deterministic" | "adjudicated";
  readonly model: string | null;
  readonly assignment: "nearest" | "one-to-one" | "quantity-informed";
  readonly lastStep: number;
  readonly identificationDigests?: Readonly<Record<string, string>>;
}): unknown;

export const __testOnly: Readonly<{
  readonly buildBookletCatalogCoverageReport: (
    input: unknown,
    manifestExpectation: unknown,
  ) => unknown;
  readonly compileBookletCatalogCoverageClosure: (
    input: unknown,
    manifestExpectation: unknown,
  ) => unknown;
  readonly verifyBookletCatalogCoverageClosure: (
    input: unknown,
    manifestExpectation: unknown,
  ) => unknown;
}>;

export function bookletCatalogCoverageUsage(): string;

export function runBookletCatalogCoverageCli(
  argv?: readonly string[],
  context?: { readonly stdout?: (text: string) => void },
): unknown;

export function compileBookletCatalogCoverageClosure(input: {
  readonly manifestBytes: Uint8Array;
  readonly featuresArtifact: unknown;
  readonly matchArtifact: unknown;
  readonly distancesArtifact: unknown;
  readonly cardsArtifact: unknown;
  readonly cardImagesArtifact: unknown;
  readonly answersArtifact: unknown;
  readonly pairJudgedArtifact: unknown;
  readonly sourceArtReboundArtifact: unknown;
  readonly elementsArtifact: unknown;
  readonly pdfBytes: Uint8Array;
  readonly source: "deterministic" | "adjudicated";
  readonly model: string | null;
  readonly assignment: "nearest" | "one-to-one" | "quantity-informed";
  readonly lastStep: number;
}): Promise<unknown>;

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
  readonly sourceArtReboundArtifact: unknown;
  readonly elementsArtifact: unknown;
  readonly pdfBytes: Uint8Array;
  readonly source: "deterministic" | "adjudicated";
  readonly model: string | null;
  readonly assignment: "nearest" | "one-to-one" | "quantity-informed";
  readonly lastStep: number;
}): Promise<unknown>;

export function verifyBookletCatalogCoverageClosureV2(input: {
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
}): Promise<unknown>;

export const __testOnly: Readonly<{
  readonly buildBookletCatalogCoverageReport: (
    input: unknown,
    manifestExpectation: unknown,
  ) => unknown;
  readonly compileBookletCatalogCoverageClosure: (
    input: unknown,
    manifestExpectation: unknown,
    sourceArtReboundVerifier?: unknown,
  ) => Promise<unknown>;
  readonly compileBookletCatalogCoverageClosureV2: (
    input: unknown,
    manifestExpectation: unknown,
  ) => Promise<unknown>;
  readonly verifyBookletCatalogCoverageClosure: (
    input: unknown,
    manifestExpectation: unknown,
    sourceArtReboundVerifier?: unknown,
  ) => Promise<unknown>;
  readonly verifyBookletCatalogCoverageClosureV2: (
    input: unknown,
    manifestExpectation: unknown,
  ) => Promise<unknown>;
}>;

export function bookletCatalogCoverageUsage(): string;

export function runBookletCatalogCoverageCli(
  argv?: readonly string[],
  context?: { readonly stdout?: (text: string) => void },
): Promise<unknown>;

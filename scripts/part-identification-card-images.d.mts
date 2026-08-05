export const PART_CARD_IMAGES_SCHEMA: "lego.part-identification-card-images/1";
export const MAX_CARD_IMAGE_COUNT: 4096;
export const MAX_CARD_IMAGE_BUNDLE_BYTES: number;
export const MAX_CARD_IMAGE_TOTAL_PIXELS: number;

export interface CardImageManifest {
  readonly imagesFile?: string;
  readonly cards: Readonly<Record<string, { readonly file?: string; readonly sha256: string }>>;
}

export interface CardImageBundleArtifact {
  readonly bytes: Uint8Array;
  readonly digest?: `sha256:${string}`;
}

export interface AuthenticatedCardImageBundle {
  readonly bytes: Buffer;
  readonly digest: `sha256:${string}`;
  readonly images: ReadonlyMap<string, Buffer>;
}

export function readCardImages(
  cardsRoot: string,
  manifest: CardImageManifest,
): ReadonlyMap<string, Buffer>;
export function encodeCardImageBundle(
  manifest: CardImageManifest,
  cardBytes: ReadonlyMap<string, Uint8Array> | Readonly<Record<string, Uint8Array>>,
): Buffer;
export function cardImageBundleArtifact(bytes: Uint8Array): {
  readonly bytes: Buffer;
  readonly digest: `sha256:${string}`;
};
export function authenticateCardImageBundle(
  artifact: CardImageBundleArtifact,
  manifest: CardImageManifest,
): AuthenticatedCardImageBundle;
export function readCardImageBundle(
  path: string,
  manifest: CardImageManifest,
): AuthenticatedCardImageBundle;
export function readCardImageBundleFromRoot(
  cardsRoot: string,
  manifest: CardImageManifest,
): AuthenticatedCardImageBundle;
export function assertCardImageFilesAndBundle(
  cardsRoot: string,
  artifact: CardImageBundleArtifact,
  manifest: CardImageManifest,
): AuthenticatedCardImageBundle;

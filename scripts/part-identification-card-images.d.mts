export const PART_CARD_IMAGES_SCHEMA: "lego.part-identification-card-images/1";
export const MAX_CARD_IMAGE_COUNT: 4096;
export const MAX_CARD_IMAGE_BUNDLE_BYTES: number;
export const MAX_CARD_IMAGE_SET_PIXELS: number;
export const MAX_CARD_IMAGE_CLOSURE_PIXELS: number;

export interface CardImageDecodeBudget {
  charge(cardId: string, bytes: Uint8Array): { readonly width: number; readonly height: number };
  readonly usedPixels: number;
}

export function createCardImageDecodeBudget(
  maxPixels?: number,
  label?: string,
): CardImageDecodeBudget;

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
  budget?: CardImageDecodeBudget,
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
  budget?: CardImageDecodeBudget,
): AuthenticatedCardImageBundle;
export function readCardImageBundle(
  path: string,
  manifest: CardImageManifest,
  budget?: CardImageDecodeBudget,
): AuthenticatedCardImageBundle;
export function readCardImageBundleFromRoot(
  cardsRoot: string,
  manifest: CardImageManifest,
  budget?: CardImageDecodeBudget,
): AuthenticatedCardImageBundle;
export function assertCardImageFilesAndBundle(
  cardsRoot: string,
  artifact: CardImageBundleArtifact,
  manifest: CardImageManifest,
  budget?: CardImageDecodeBudget,
): AuthenticatedCardImageBundle;
export function verifyRetainedCardImageClosure(
  cardsRoot: string,
  manifest: CardImageManifest,
  budget?: CardImageDecodeBudget,
): AuthenticatedCardImageBundle;

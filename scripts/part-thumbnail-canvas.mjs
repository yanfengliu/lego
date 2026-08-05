let canvasModule = null;

export async function canvasApi() {
  if (canvasModule) return canvasModule;
  try {
    canvasModule = await import("@napi-rs/canvas");
  } catch (cause) {
    throw new Error(
      "@napi-rs/canvas is required to decode the booklet thumbnails and could not be resolved. " +
        "It is not a declared dependency of this workspace — it arrives only under pdfjs-dist — so " +
        "declare it in package.json devDependencies and record it in docs/dependency-data-bom.md " +
        "before anything in the gate depends on it.",
      { cause },
    );
  }
  return canvasModule;
}

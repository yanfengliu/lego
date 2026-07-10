export class StaleFileImportError extends Error {
  public constructor() {
    super("The import was cancelled because the document changed");
    this.name = "StaleFileImportError";
  }
}

export async function readBoundedFileText(
  file: Pick<File, "size" | "text">,
  maxBytes: number,
  isCurrent: () => boolean,
): Promise<string> {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > maxBytes) {
    throw new RangeError(`Import exceeds the ${maxBytes.toLocaleString()} byte limit`);
  }
  const text = await file.text();
  if (!isCurrent()) throw new StaleFileImportError();
  return text;
}

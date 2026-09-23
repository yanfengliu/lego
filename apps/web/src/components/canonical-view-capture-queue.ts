/**
 * Serializes renderer captures without coalescing callers that requested
 * different scenes. A WebGL renderer is mutable while a capture temporarily
 * changes its size and scene visibility, so overlapping captures would corrupt
 * one another.
 */
export class CanonicalViewCaptureQueue {
  private tail: Promise<void> = Promise.resolve();

  public run<T>(
    requestedScene: unknown,
    capture: (scene: "presentation" | "model-only") => Promise<T>,
  ): Promise<T> {
    const scene = requestedScene ?? "presentation";
    if (scene !== "presentation" && scene !== "model-only") {
      throw new RangeError(
        `Canonical view capture scene must be presentation or model-only; received ${String(requestedScene)}.`,
      );
    }
    const result = this.tail.then(() => capture(scene));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

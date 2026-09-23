import { describe, expect, it } from "vitest";

import { CanonicalViewCaptureQueue } from "./canonical-view-capture-queue";

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("canonical view capture queue", () => {
  it("serializes distinct capture requests without returning the first caller's result", async () => {
    const queue = new CanonicalViewCaptureQueue();
    const firstGate = deferred();
    const events: string[] = [];

    const presentation = queue.run("presentation", async (scene) => {
      expect(scene).toBe("presentation");
      events.push("presentation:start");
      await firstGate.promise;
      events.push("presentation:end");
      return "presentation-result";
    });
    const modelOnly = queue.run("model-only", async (scene) => {
      expect(scene).toBe("model-only");
      events.push("model-only:start");
      events.push("model-only:end");
      return "model-only-result";
    });

    await Promise.resolve();
    expect(events).toEqual(["presentation:start"]);
    expect(modelOnly).not.toBe(presentation);

    firstGate.resolve();
    await expect(Promise.all([presentation, modelOnly])).resolves.toEqual([
      "presentation-result",
      "model-only-result",
    ]);
    expect(events).toEqual([
      "presentation:start",
      "presentation:end",
      "model-only:start",
      "model-only:end",
    ]);
  });

  it("continues with the next capture after an earlier capture rejects", async () => {
    const queue = new CanonicalViewCaptureQueue();
    const failed = queue.run("presentation", async () => {
      throw new Error("capture failed");
    });
    const recovered = queue.run("model-only", async () => "recovered");

    await expect(failed).rejects.toThrow("capture failed");
    await expect(recovered).resolves.toBe("recovered");
  });

  it("serializes a canonical request and a fixed instruction request on the shared queue", async () => {
    const queue = new CanonicalViewCaptureQueue();
    const firstGate = deferred();
    const events: string[] = [];
    const canonical = queue.run("model-only", async () => {
      events.push("canonical:start");
      await firstGate.promise;
      events.push("canonical:end");
      return "seven canonical views";
    });
    const instruction = queue.run("model-only", async () => {
      events.push("instruction:start");
      events.push("instruction:end");
      return "page-45 fixed view";
    });

    await Promise.resolve();
    expect(events).toEqual(["canonical:start"]);
    firstGate.resolve();
    await expect(Promise.all([canonical, instruction])).resolves.toEqual([
      "seven canonical views",
      "page-45 fixed view",
    ]);
    expect(events).toEqual([
      "canonical:start",
      "canonical:end",
      "instruction:start",
      "instruction:end",
    ]);
  });

  it("rejects an invalid mode before it can join an in-flight capture", async () => {
    const queue = new CanonicalViewCaptureQueue();
    const firstGate = deferred();
    const presentation = queue.run("presentation", async () => {
      await firstGate.promise;
      return "presentation-result";
    });
    let invalidCaptureRan = false;

    expect(() =>
      queue.run("wireframe", async () => {
        invalidCaptureRan = true;
        return "invalid-result";
      }),
    ).toThrow(RangeError);
    expect(invalidCaptureRan).toBe(false);

    firstGate.resolve();
    await expect(presentation).resolves.toBe("presentation-result");
  });
});

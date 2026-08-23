const sorted = (values: readonly string[]): readonly string[] =>
  values.slice().sort((left, right) => left.localeCompare(right));

const sameMultiset = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export async function drainStep7Gate3ObserverFrontier(input: {
  readonly requestBoundary: {
    drainExecutableResponseUrls(): Promise<readonly string[]>;
  };
  readonly responseCapture: {
    drain(): Promise<readonly string[]>;
  };
}): Promise<void> {
  const deadline = Date.now() + 5_000;
  let stablePasses = 0;
  let routed: readonly string[] = [];
  let captured: readonly string[] = [];
  while (Date.now() < deadline) {
    const [routedUrls, capturedUrls] = await Promise.all([
      input.requestBoundary.drainExecutableResponseUrls(),
      input.responseCapture.drain(),
    ]);
    routed = sorted(routedUrls);
    captured = sorted(capturedUrls);
    if (sameMultiset(routed, captured)) {
      stablePasses += 1;
      if (stablePasses === 2) return;
    } else {
      stablePasses = 0;
    }
    await new Promise<void>((resolveTurn) => setTimeout(resolveTurn, 10));
  }
  const mismatchIndex =
    Array.from({ length: Math.max(routed.length, captured.length) }, (_value, index) => index).find(
      (index) => routed[index] !== captured[index],
    ) ?? 0;
  throw new TypeError(
    `Gate-3 request and response observers did not reach an exact duplicate-preserving frontier within 5 seconds: ` +
      `${routed.length} routed, ${captured.length} captured, first mismatch ` +
      `${JSON.stringify(routed[mismatchIndex] ?? null)} versus ${JSON.stringify(captured[mismatchIndex] ?? null)}.`,
  );
}

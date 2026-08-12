const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Exact evidence closure for a failed current-generation browser envelope. */
export function failedBrowserOutputEnvelopeDefect(
  value: Record<string, unknown>,
  expectedPdfDigest: string,
): string | null {
  const reports = value.reports as readonly unknown[];
  const bindings = value.identityBindings as readonly unknown[];
  const preExecution = reports.length === 0 && bindings.length === 0;
  const evidenceBoundaryValid = preExecution
    ? value.documentJson === null && value.fetchedPdfDigest === null
    : typeof value.documentJson === "string" &&
      value.documentJson.length > 0 &&
      value.fetchedPdfDigest === expectedPdfDigest;
  const failure = isRecord(value.failure) ? value.failure : null;
  if (
    evidenceBoundaryValid &&
    typeof failure?.code === "string" &&
    typeof failure.stage === "string" &&
    typeof failure.message === "string" &&
    failure.message.length > 0
  ) {
    return null;
  }
  return preExecution
    ? "Failed pre-execution browser-output must retain no reports or bindings and exactly null PDF/document evidence."
    : "Failed browser-output with retained reports or bindings must retain nonempty canonical document bytes and the exact fetched PDF digest.";
}

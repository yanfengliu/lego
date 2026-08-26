type ReplayInspector = (directory: string) => unknown | Promise<unknown>;

export async function rejectAuthoritativeReplay(
  directory: string,
  inspect: ReplayInspector,
): Promise<never> {
  await inspect(directory);
  throw new TypeError(
    "Authoritative real-build replay is unavailable: this repository has no released companion-broker " +
      "trust root or namespace-bound signature verifier. The retained closure can be inspected only as " +
      "unauthenticated data; self-rehashed manifests are not authority.",
  );
}

export async function rejectExecutableDiagnosticReplay(
  directory: string,
  inspect: ReplayInspector,
): Promise<never> {
  await inspect(directory);
  throw new TypeError(
    "Diagnostic real-build execution is unavailable: retained source is untrusted and is never " +
      "loaded or executed. Use inspectRealBuildReplayClosure only for data-only CAS, role, source, " +
      "and run-contract diagnostics.",
  );
}

type ReplayInspector = (directory: string) => unknown;

export function rejectAuthoritativeReplay(
  directory: string,
  inspect: ReplayInspector,
): Promise<never> {
  inspect(directory);
  return Promise.reject(
    new TypeError(
      "Authoritative real-build replay is unavailable: this repository has no released companion-broker " +
        "trust root or namespace-bound signature verifier. The retained closure can be inspected only as " +
        "unauthenticated data; self-rehashed manifests are not authority.",
    ),
  );
}

export function rejectExecutableDiagnosticReplay(
  directory: string,
  inspect: ReplayInspector,
): Promise<never> {
  inspect(directory);
  return Promise.reject(
    new TypeError(
      "Diagnostic real-build execution is unavailable: retained source is untrusted and is never " +
        "loaded or executed. Use inspectRealBuildReplayClosure only for data-only CAS, role, source, " +
        "and run-contract diagnostics.",
    ),
  );
}

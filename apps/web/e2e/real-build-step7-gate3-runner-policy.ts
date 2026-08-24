export const STEP7_GATE3_BLANK_RUNNER_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "child-src 'none'",
  "connect-src 'self'",
  "font-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'none'",
  "manifest-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "script-src-elem 'self'",
  "style-src 'none'",
  "worker-src 'self'",
].join("; ");

export const STEP7_GATE3_BLANK_RUNNER_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>LEGO Gate-3 Blank Runner</title></head><body></body></html>';

export interface Step7Gate3InvocationPolicyInput {
  readonly diagnostic: boolean;
  readonly parentOnly: boolean;
  readonly prewarm: boolean;
  readonly sampleBookletAvailable: boolean;
}

export type Step7Gate3InvocationPolicy =
  { readonly status: "run" } | { readonly status: "skip"; readonly reason: string };

export function resolveStep7Gate3InvocationPolicy(
  input: Step7Gate3InvocationPolicyInput,
): Step7Gate3InvocationPolicy {
  const selectedModes = [
    input.diagnostic ? "diagnostic" : null,
    input.parentOnly ? "parent-only" : null,
    input.prewarm ? "prewarm" : null,
  ].filter((mode): mode is string => mode !== null);
  if (selectedModes.length > 1) {
    throw new Error(
      `Gate-3 invocation selected conflicting modes ${selectedModes.join(", ")}; set exactly one of LEGO_GATE3_STEP7_DIAGNOSTIC, LEGO_GATE3_STEP7_PARENT_ONLY, or LEGO_GATE3_STEP7_PREWARM to 1.`,
    );
  }
  if (!input.diagnostic && !input.parentOnly && !input.prewarm) {
    return {
      status: "skip",
      reason:
        "set LEGO_GATE3_STEP7_DIAGNOSTIC=1 or LEGO_GATE3_STEP7_PARENT_ONLY=1 for a Gate-3 control",
    };
  }
  if (!input.sampleBookletAvailable && (input.diagnostic || input.parentOnly)) {
    const requestedMode = input.parentOnly ? "parent-only control" : "diagnostic";
    throw new Error(
      `Gate-3 ${requestedMode} was requested, but recipes/6651557.pdf was not found in this checkout or its parent directories; provide that exact sample booklet or unset the Gate-3 mode.`,
    );
  }
  return { status: "run" };
}

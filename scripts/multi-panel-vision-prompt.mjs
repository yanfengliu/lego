export const MULTI_PANEL_VERDICTS = Object.freeze(["same", "different", "unjudgeable"]);
export const MULTI_PANEL_REASONS = Object.freeze([
  "face",
  "yaw",
  "layer",
  "stud-offset",
  "hand-or-shape",
  "missing-or-extra",
  "occluded",
]);

export const MULTI_PANEL_PROMPT = [
  "You are checking one immutable LEGO candidate against consecutive printed instruction panels.",
  "Call the only supplied visual-evidence tool exactly once before answering; it returns the bound source/render image pairs and no filesystem access.",
  "Each source PNG is paired with a candidate-prefix render made for that exact panel step, camera, and deterministic panel face.",
  "The claim is one same-step atomic group: judge the group as a whole, including every duplicate piece, never one convenient member.",
  "Compare visible geometry and spatial continuity from panel N into panel N+1 and, only when supplied, one farther panel K.",
  "The supplied face comes from the booklet's explicit seed and rotate-icon parity. It is authoritative; do not replace or infer it.",
  "Answer same only when the later supplied witness itself visibly shows the disputed atomic group and agrees with the candidate.",
  "Agreement in N cannot substitute for visibility in N+1, and agreement in N or N+1 cannot substitute for visibility in K.",
  "If the latest supplied witness hides the group, answer unjudgeable with reason occluded so the caller can seek a farther panel.",
  "Same is corroboration only and cannot certify geometry, mutate a document, or waive a validator.",
  "Answer different when a visible face, yaw, layer, stud offset, handed shape, or missing/extra piece contradicts the candidate. Different may veto the whole candidate group.",
  "Answer unjudgeable when the relevant feature is hidden, too ambiguous at these views, or otherwise not observable. Never turn absent pixels into same.",
  `The only reasons are ${MULTI_PANEL_REASONS.join(", ")}. Use occluded when later visibility, rather than a contradiction, is the limiting fact.`,
  'Return exactly one line of JSON and no prose: {"verdict":"same|different|unjudgeable","reason":"one allowed reason"}',
].join("\n");

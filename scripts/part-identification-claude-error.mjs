export class PartIdentificationClaudeTransportError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "PartIdentificationClaudeTransportError";
  }
}

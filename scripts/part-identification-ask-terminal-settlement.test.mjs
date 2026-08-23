import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  output: null,
  release: vi.fn(),
  settle: vi.fn(),
}));

vi.mock("./part-identification-claude-transport.mjs", () => ({
  assertProductionPartIdentificationTransport: (value) => value,
  createPartIdentificationProofBudget: vi.fn(),
  runPartIdentificationClaudeTransport: vi.fn(async () => boundary.output),
}));

vi.mock("./part-identification-gate0-store.mjs", () => ({
  openPartIdentificationGate0Admission: vi.fn(),
  settlePartIdentificationGate0Launch: boundary.settle,
}));

import { askBatch } from "./part-identification-ask.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";

const gate0Ticket = Object.freeze(Object.create(null));
const validAnswer =
  'card-0000 {"kind":"brick","studsLong":1,"studsWide":1,"colour":"black","pick":1,"alsoCouldBe":0,"differsFromPick":"nothing","confidence":0.9}';

function output(terminalResult, modelIdentity) {
  return {
    terminalResult,
    modelIdentity,
    reservationTicket: { release: boundary.release },
    gate0Ticket,
  };
}

beforeEach(() => {
  boundary.output = null;
  boundary.release.mockReset();
  boundary.settle.mockReset();
});

describe("part-identification terminal Gate-0 settlement", () => {
  it("settles and releases a malformed terminal answer", async () => {
    boundary.output = output("malformed provider terminal", {
      requestedModelId: PART_IDENTIFICATION_MODEL_ID,
      responseModelId: PART_IDENTIFICATION_MODEL_ID,
      canonicalModel: PART_IDENTIFICATION_MODEL_ID,
      provider: "anthropic",
    });

    await expect(askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID)).rejects.toThrow();
    expect(boundary.release).toHaveBeenCalledOnce();
    expect(boundary.settle).toHaveBeenCalledWith(gate0Ticket, {
      status: "failure",
      evidence: "provider-terminal",
    });
  });

  it("settles and releases a changed model identity", async () => {
    boundary.output = output(validAnswer, {
      requestedModelId: PART_IDENTIFICATION_MODEL_ID,
      responseModelId: "claude-opus-5-substituted",
      canonicalModel: PART_IDENTIFICATION_MODEL_ID,
      provider: "anthropic",
    });

    await expect(askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID)).rejects.toThrow(
      /model identity changed/u,
    );
    expect(boundary.release).toHaveBeenCalledOnce();
    expect(boundary.settle).toHaveBeenCalledWith(gate0Ticket, {
      status: "failure",
      evidence: "provider-terminal",
    });
  });
});

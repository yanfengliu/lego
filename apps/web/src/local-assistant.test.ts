import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";

import { compileLocalPromptPreview, createLocalPromptPlan } from "./local-assistant";

describe("local prompt planning preview", () => {
  it("turns a bounded height request into a closed declarative BuildProgram", () => {
    const plan = createLocalPromptPlan("Build a 3 level red and yellow tower");
    expect(plan.summary).toBe("3-level alternating-color tower");
    expect(plan.program.operations.filter(({ kind }) => kind === "placePart")).toHaveLength(3);
    expect(plan.program.operations.filter(({ kind }) => kind === "attach")).toHaveLength(4);
  });

  it("compiles the preview deterministically into a hard-valid candidate", () => {
    const document = createEmptyBrickDocument({ id: "assistant", name: "Assistant" });
    const left = compileLocalPromptPreview(document, "Build a 4 level tower");
    const right = compileLocalPromptPreview(document, "Build a 4 level tower");
    expect(left).toEqual(right);
    if (!left.result.ok) throw new Error(JSON.stringify(left.result.issues));
    expect(left.result.document.parts).toHaveLength(4);
    expect(left.result.document.connections).toHaveLength(6);
    expect(left.result.validationReport.documentGloballyValid).toBe(true);
  });

  it("fails closed instead of silently replacing a non-empty document", () => {
    const document = createEmptyBrickDocument({ id: "assistant", name: "Assistant" });
    const first = compileLocalPromptPreview(document, "Build a 2 level tower");
    if (!first.result.ok) throw new Error(JSON.stringify(first.result.issues));
    const second = compileLocalPromptPreview(first.result.document, "Build another tower");
    expect(second.result.ok).toBe(false);
  });
});

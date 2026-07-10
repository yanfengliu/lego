import { describe, expect, it } from "vitest";

import { keyboardSelection } from "./viewport-navigation";

describe("viewport keyboard selection", () => {
  const partIds = ["part-a", "part-b", "part-c"];

  it("cycles in both directions and wraps", () => {
    expect(keyboardSelection("part-c", partIds, "ArrowRight")).toBe("part-a");
    expect(keyboardSelection("part-a", partIds, "ArrowLeft")).toBe("part-c");
  });

  it("supports endpoints, clearing, and ignores unrelated keys", () => {
    expect(keyboardSelection("part-b", partIds, "Home")).toBe("part-a");
    expect(keyboardSelection("part-b", partIds, "End")).toBe("part-c");
    expect(keyboardSelection("part-b", partIds, "Escape")).toBeNull();
    expect(keyboardSelection("part-b", partIds, "Enter")).toBeUndefined();
  });
});

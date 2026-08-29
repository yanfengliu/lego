import { getPartDefinition } from "@lego-studio/catalog";
import { createPartInstance } from "@lego-studio/brick-kernel";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InspectorPanel } from "./InspectorPanel";
import { LegalOrientationSelect } from "./LegalOrientationSelect";

function definition(id: string) {
  const result = getPartDefinition(id);
  if (!result) throw new Error(`Missing fixture ${id}`);
  return result;
}

describe("part-scoped orientation controls", () => {
  it("offers every axle frame and no axle-only frame for an upright-only brick", () => {
    const axleMarkup = renderToStaticMarkup(
      <LegalOrientationSelect
        definition={definition("builtin:axle-1x3")}
        value="proper-m-00pp000p0"
        onChange={() => undefined}
        ariaLabel="Placement orientation"
      />,
    );
    expect(axleMarkup.match(/<option/g) ?? []).toHaveLength(5);
    expect(axleMarkup).toContain('value="proper-m-00pp000p0" selected=""');

    const brickMarkup = renderToStaticMarkup(
      <LegalOrientationSelect
        definition={definition("builtin:brick-1x1")}
        value="proper-m-00pp000p0"
        onChange={() => undefined}
        ariaLabel="Placement orientation"
      />,
    );
    expect(brickMarkup.match(/<option/g) ?? []).toHaveLength(4);
    expect(brickMarkup).not.toContain("proper-m-00pp000p0");
  });

  it("exposes the selected axle's complete legal list in the precise-edit inspector", () => {
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [0, -18, 0], orientationId: "proper-m-00pp000p0" },
    });
    const markup = renderToStaticMarkup(
      <InspectorPanel
        part={axle}
        connected={false}
        onApply={() => undefined}
        onDelete={() => undefined}
      />,
    );
    expect(markup).toContain("Legal orientation");
    expect(markup).toContain('value="proper-m-00pp000p0" selected=""');
    const orientationSelect = markup.match(
      /<select aria-label="Legal orientation"[\s\S]*?<\/select>/,
    )?.[0];
    expect(orientationSelect?.match(/<option/g) ?? []).toHaveLength(5);
  });
});

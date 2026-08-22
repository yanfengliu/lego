import { beforeAll, describe, expect, it } from "vitest";

import { inspectRealBuildBrowserOutputV4 } from "../e2e/real-build-browser-output-v4-reader";
import { realBuildBrowserOutputV4SelectedTupleFixture } from "./real-build-browser-output-v4-reader-selected.fixture";

let fixture: ReturnType<typeof realBuildBrowserOutputV4SelectedTupleFixture>;

beforeAll(() => {
  fixture = realBuildBrowserOutputV4SelectedTupleFixture();
});

describe("browser-output /4 selected placement complete-tuple integration", () => {
  it("refuses complete replay after source finish if array or encoder primordials drift", () => {
    const originalFilter = Array.prototype.filter;
    Array.prototype.filter = function <T>(
      this: T[],
      predicate: (value: T, index: number, array: T[]) => unknown,
      thisArg?: unknown,
    ): T[] {
      return Reflect.apply(originalFilter, this, [predicate, thisArg]) as T[];
    };
    try {
      expect(() => inspectRealBuildBrowserOutputV4(fixture.tuple)).toThrow(
        /derivation primordials changed.*Array\.prototype descriptor filter/iu,
      );
    } finally {
      Array.prototype.filter = originalFilter;
    }

    const originalEncode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function (input?: string): ReturnType<typeof originalEncode> {
      return Reflect.apply(originalEncode, this, [input]) as ReturnType<typeof originalEncode>;
    };
    try {
      expect(() => inspectRealBuildBrowserOutputV4(fixture.tuple)).toThrow(
        /derivation primordials changed.*TextEncoder.*descriptor encode/iu,
      );
    } finally {
      TextEncoder.prototype.encode = originalEncode;
    }
  });

  it("replays exact source, D4 camera, convergent multi-root branch, report, identity, and terminal bytes", () => {
    const inspected = inspectRealBuildBrowserOutputV4(fixture.tuple);

    expect(fixture.compiled.lineage.rootCandidates[0]!.identities).toHaveLength(8);
    expect(fixture.compiled.lineage.lineageEdges).toHaveLength(8);
    expect(fixture.camera.cameraInspection.manifest.rows).toHaveLength(1);
    expect(inspected).toMatchObject({
      status: "failed",
      retainedReports: 2,
      completedSteps: 1,
      throughStepNumber: 1,
      branchSteps: 1,
      transitionSteps: 0,
      derivationReproducible: true,
      sourceExecutionProvenanceAuthority: "absent",
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
    });
    expect(inspected.terminalDocument.canonicalBytes).toBe(fixture.childSnapshot.canonicalBytes);
    expect(inspected.identityBindings).toEqual(fixture.tuple.browserOutput.identityBindings);
    expect(inspected.completionAuthority.authorized).toBe(false);
  });

  it("rejects an envelope identity that drifts from the selected compiled child", () => {
    const output = fixture.tuple.browserOutput;
    const drifted = {
      ...fixture.tuple,
      browserOutput: {
        ...output,
        identityBindings: [
          { ...output.identityBindings[0]!, partId: "selected-reader-cross-role-drift" },
        ],
      },
    };

    expect(() => inspectRealBuildBrowserOutputV4(drifted)).toThrow(
      /identity bindings.*exact selected placement replay/iu,
    );
  });

  it("rejects a selected branch report that borrows a fixed-action mechanism", () => {
    const output = fixture.tuple.browserOutput;
    const completed = output.reports[0]!;
    const drifted = {
      ...fixture.tuple,
      browserOutput: {
        ...output,
        reports: [
          {
            ...completed,
            outcome: { status: "complete", mechanism: "official-ledger", failure: null },
          },
          output.reports[1]!,
        ],
      },
    };

    expect(() => inspectRealBuildBrowserOutputV4(drifted)).toThrow(
      /cannot claim official-ledger.*fixed-action or transition authority/iu,
    );
  });

  it("rejects camera or legacy-diagnostic claims that drift from the external selected row", () => {
    const output = fixture.tuple.browserOutput;
    const completed = output.reports[0]!;
    const drifted = {
      ...fixture.tuple,
      browserOutput: {
        ...output,
        reports: [
          {
            ...completed,
            fit: { ...completed.fit, azimuthDegrees: completed.fit.azimuthDegrees! + 1 },
          },
          output.reports[1]!,
        ],
      },
    };

    expect(() => inspectRealBuildBrowserOutputV4(drifted)).toThrow(
      /project its exact selected external camera.*legacy evidence fields neutral/iu,
    );
  });

  it("rejects a selected report that launders a blocking prerequisite", () => {
    const output = fixture.tuple.browserOutput;
    const completed = output.reports[0]!;
    const drifted = {
      ...fixture.tuple,
      browserOutput: {
        ...output,
        reports: [
          {
            ...completed,
            prerequisites: { ...completed.prerequisites, blockingStep: 1 },
          },
          output.reports[1]!,
        ],
      },
    };

    expect(() => inspectRealBuildBrowserOutputV4(drifted)).toThrow(
      /does not equal its selected exact child and independent validation/iu,
    );
  });
});

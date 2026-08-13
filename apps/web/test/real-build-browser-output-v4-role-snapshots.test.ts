import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  inspectRealBuildBrowserBranchEvidenceV1,
  readRealBuildBrowserBranchStepEvidenceBytes,
} from "../e2e/real-build-browser-output-v4-role";
import * as roleSnapshots from "../e2e/real-build-browser-output-v4-role-snapshots";

const encoder = new TextEncoder();

const digest = (value: Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function concatenate(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function fixture() {
  const compiledLineage = encoder.encode('{"lineage":1}');
  const observationClosure = encoder.encode('{"closure":1}');
  const observations = Uint8Array.of(0x80, 0x40, 0x20);
  const compiledRole = concatenate(compiledLineage, observationClosure);
  const index = encoder.encode(
    JSON.stringify({
      schemaVersion: "lego.real-build-browser-branch-evidence/1",
      compiledBranchRole: {
        role: "compiled-branch-evidence-bytes",
        bytes: compiledRole.length,
        digest: digest(compiledRole),
      },
      observationRole: {
        role: "branch-observation-bytes",
        bytes: observations.length,
        digest: digest(observations),
      },
      steps: [
        {
          stepNumber: 1,
          compiledLineage: {
            role: "compiled-branch-evidence-bytes",
            offset: 0,
            bytes: compiledLineage.length,
            digest: digest(compiledLineage),
            encoding: "utf8-json/1",
          },
          observationClosure: {
            role: "compiled-branch-evidence-bytes",
            offset: compiledLineage.length,
            bytes: observationClosure.length,
            digest: digest(observationClosure),
            encoding: "utf8-json/1",
          },
          observations: {
            role: "branch-observation-bytes",
            offset: 0,
            bytes: observations.length,
            digest: digest(observations),
            encoding: "raw-bytes/1",
          },
        },
      ],
    }),
  );
  return { index, compiledLineage, observationClosure, compiledRole, observations };
}

describe("browser-output /4 verified role snapshots", () => {
  it("reads from the one retained role copy after caller storage mutates and detaches", () => {
    const source = fixture();
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      source.index,
      source.compiledRole,
      source.observations,
    );
    const expectedLineage = new Uint8Array(source.compiledLineage);
    const expectedClosure = new Uint8Array(source.observationClosure);
    const expectedObservations = new Uint8Array(source.observations);

    source.compiledRole.fill(0xff);
    structuredClone(source.compiledRole.buffer, { transfer: [source.compiledRole.buffer] });
    source.observations.fill(0xff);
    structuredClone(source.observations.buffer, { transfer: [source.observations.buffer] });

    const retained = readRealBuildBrowserBranchStepEvidenceBytes(inspected, 1);
    expect(retained.compiledLineage).toEqual(expectedLineage);
    expect(retained.observationClosure).toEqual(expectedClosure);
    expect(retained.observations).toEqual(expectedObservations);
  });

  it("returns fresh step storage and refuses unbranded or missing-step reads", () => {
    const source = fixture();
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      source.index,
      source.compiledRole,
      source.observations,
    );
    const first = readRealBuildBrowserBranchStepEvidenceBytes(inspected, 1);
    first.compiledLineage.fill(0);
    first.observationClosure!.fill(0);
    first.observations!.fill(0);

    const second = readRealBuildBrowserBranchStepEvidenceBytes(inspected, 1);
    expect(second.compiledLineage).toEqual(source.compiledLineage);
    expect(second.observationClosure).toEqual(source.observationClosure);
    expect(second.observations).toEqual(source.observations);
    expect(() => readRealBuildBrowserBranchStepEvidenceBytes({ ...inspected }, 1)).toThrow(
      /exact result of role transport inspection/u,
    );
    expect(() => readRealBuildBrowserBranchStepEvidenceBytes(inspected, 2)).toThrow(
      /no indexed step 2/u,
    );
    expect(roleSnapshots).not.toHaveProperty("retainRealBuildBrowserBranchRoleSnapshots");
    expect(roleSnapshots).not.toHaveProperty("readRealBuildBrowserBranchStepEvidenceBytes");
    const isolated = roleSnapshots.createRealBuildBrowserBranchRoleSnapshotRegistry();
    const forged = { ...inspected };
    isolated.retain(forged, source.compiledRole, source.observations);
    expect(isolated.read(forged, 1).compiledLineage).toEqual(source.compiledLineage);
    expect(() => readRealBuildBrowserBranchStepEvidenceBytes(forged, 1)).toThrow(
      /exact result of role transport inspection/u,
    );
  });
});

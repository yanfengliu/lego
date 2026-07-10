import { describe, expect, it } from "vitest";

import {
  SCHEMA_IDS,
  TEMPLATE_SNAPSHOT_ADMISSION_REQUIREMENT,
  templateSnapshotContentHash,
  validateBuildProgramV1,
  validateTemplateSnapshotV1,
  type BuildProgramV1,
  type TemplateSnapshotV1,
} from "./index.js";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;

function withContentHash(
  value: Omit<TemplateSnapshotV1, "contentHash"> & { readonly contentHash?: string },
): TemplateSnapshotV1 {
  const provisional = { ...value, contentHash: HASH_A } as TemplateSnapshotV1;
  return { ...provisional, contentHash: templateSnapshotContentHash(provisional) };
}

function validSnapshot(): TemplateSnapshotV1 {
  return withContentHash({
    schemaVersion: "lego.template-snapshot/1",
    id: "builtin:two-brick-column",
    version: 1,
    status: "stable",
    catalogHash: HASH_A,
    truthSnapshotHash: HASH_B,
    admissionPolicyHash: HASH_A,
    parameters: [
      {
        kind: "color-enum",
        name: "accent-color",
        allowedColorIds: ["builtin:red", "builtin:blue"],
        defaultColorId: "builtin:red",
      },
    ],
    parts: [
      {
        localPartId: "base",
        catalogPartId: "builtin:brick-1x2",
        color: { kind: "literal", colorId: "builtin:black" },
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        semanticTags: ["body", "base"],
      },
      {
        localPartId: "top",
        catalogPartId: "builtin:brick-1x2",
        color: { kind: "parameter", parameterName: "accent-color" },
        transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
        semanticTags: ["body", "top"],
      },
    ],
    internalConnections: [
      {
        localConnectionId: "stack-connection",
        kind: "stud-tube",
        a: { localPartId: "base", portId: "stud:0:0" },
        b: { localPartId: "top", portId: "undersideClutch:0:0" },
      },
    ],
    externalPorts: [
      {
        name: "bottom-attachment",
        endpoint: { localPartId: "base", portId: "undersideClutch:0:1" },
      },
      {
        name: "top-attachment",
        endpoint: { localPartId: "top", portId: "stud:0:1" },
      },
    ],
    clearanceVolume: { minLdu: [-20, -48, -10], maxLdu: [20, 24, 10] },
    evidenceRunIds: ["run-z", "run-a"],
    counterexampleRunIds: ["run-counterexample"],
    benchmarkReportIds: ["benchmark-z", "benchmark-a"],
    provenance: {
      origin: "project",
      sourceId: "template-source-1",
      sourceHash: HASH_A,
    },
    license: {
      spdxExpression: "MIT",
      attribution: "Copyright 2026 Lego Studio contributors",
      redistribution: "allowed",
    },
  });
}

function rehash(snapshot: TemplateSnapshotV1): TemplateSnapshotV1 {
  return { ...snapshot, contentHash: templateSnapshotContentHash(snapshot) };
}

describe("TemplateSnapshotV1", () => {
  it("exports standalone types and accepts a bounded immutable fixed graph", () => {
    const snapshot = validSnapshot();

    expect(SCHEMA_IDS.templateSnapshotV1).toMatch(/#\/definitions\/TemplateSnapshotV1$/);
    expect(TEMPLATE_SNAPSHOT_ADMISSION_REQUIREMENT).toBe(
      "pinned-catalog-truth-and-admission-policy-validation-required/1",
    );
    expect(validateTemplateSnapshotV1(snapshot)).toBe(true);
    expect(snapshot.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const parameter = snapshot.parameters[0]!;
    expect(
      validateTemplateSnapshotV1(
        rehash({
          ...snapshot,
          parameters: [
            {
              kind: parameter.kind,
              name: parameter.name,
              allowedColorIds: parameter.allowedColorIds,
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("hashes canonical normalized content while excluding contentHash", () => {
    const snapshot = validSnapshot();
    const reordered = {
      ...snapshot,
      contentHash: HASH_B,
      parameters: snapshot.parameters.map((parameter) => ({
        ...parameter,
        allowedColorIds: [...parameter.allowedColorIds].reverse(),
      })),
      parts: [...snapshot.parts]
        .reverse()
        .map((part) => ({ ...part, semanticTags: [...part.semanticTags].reverse() })),
      internalConnections: snapshot.internalConnections.map((connection) => ({
        ...connection,
        a: connection.b,
        b: connection.a,
      })),
      externalPorts: [...snapshot.externalPorts].reverse(),
      evidenceRunIds: [...snapshot.evidenceRunIds].reverse(),
      counterexampleRunIds: [...snapshot.counterexampleRunIds].reverse(),
      benchmarkReportIds: [...snapshot.benchmarkReportIds].reverse(),
    } satisfies TemplateSnapshotV1;

    expect(templateSnapshotContentHash(reordered)).toBe(snapshot.contentHash);
    expect(templateSnapshotContentHash({ ...snapshot, status: "deprecated" })).not.toBe(
      snapshot.contentHash,
    );
    const child = rehash({
      ...snapshot,
      id: "builtin:two-brick-column-v2",
      version: 2,
      parentId: snapshot.id,
      benchmarkReportIds: ["benchmark-child"],
    });
    expect(validateTemplateSnapshotV1(child)).toBe(true);
    expect(child.contentHash).not.toBe(snapshot.contentHash);
    expect(validateTemplateSnapshotV1({ ...reordered, contentHash: snapshot.contentHash })).toBe(
      true,
    );
    expect(validateTemplateSnapshotV1(reordered)).toBe(false);
    expect(validateTemplateSnapshotV1.errors?.[0]).toMatchObject({
      instancePath: "/contentHash",
    });
  });

  it("requires unique local identities, names, and unoccupied port endpoints", () => {
    const snapshot = validSnapshot();
    const cases: TemplateSnapshotV1[] = [
      rehash({ ...snapshot, parts: [snapshot.parts[0]!, snapshot.parts[0]!] }),
      rehash({ ...snapshot, parameters: [snapshot.parameters[0]!, snapshot.parameters[0]!] }),
      rehash({
        ...snapshot,
        internalConnections: [
          snapshot.internalConnections[0]!,
          { ...snapshot.internalConnections[0]!, a: { localPartId: "base", portId: "stud:0:1" } },
        ],
      }),
      rehash({
        ...snapshot,
        internalConnections: [
          {
            ...snapshot.internalConnections[0]!,
            localConnectionId: snapshot.parts[0]!.localPartId,
          },
        ],
      }),
      rehash({
        ...snapshot,
        externalPorts: [snapshot.externalPorts[0]!, snapshot.externalPorts[0]!],
      }),
      rehash({
        ...snapshot,
        externalPorts: [
          {
            ...snapshot.externalPorts[0]!,
            endpoint: snapshot.internalConnections[0]!.a,
          },
        ],
      }),
    ];

    for (const candidate of cases) {
      expect(validateTemplateSnapshotV1(candidate)).toBe(false);
      expect(validateTemplateSnapshotV1.errors?.[0]?.keyword).toBe("semantic");
    }
  });

  it("rejects unresolved part, parameter, and external-port references", () => {
    const snapshot = validSnapshot();
    const cases: TemplateSnapshotV1[] = [
      rehash({
        ...snapshot,
        parts: snapshot.parts.map((part) =>
          part.localPartId === "top"
            ? { ...part, color: { kind: "parameter", parameterName: "missing-color" } }
            : part,
        ),
      }),
      rehash({
        ...snapshot,
        internalConnections: [
          {
            ...snapshot.internalConnections[0]!,
            b: { localPartId: "missing-part", portId: "undersideClutch:0:0" },
          },
        ],
      }),
      rehash({
        ...snapshot,
        externalPorts: [
          {
            ...snapshot.externalPorts[0]!,
            endpoint: { localPartId: "missing-part", portId: "stud:0:0" },
          },
        ],
      }),
      rehash({
        ...snapshot,
        parameters: [{ ...snapshot.parameters[0]!, defaultColorId: "builtin:not-allowed" }],
      }),
    ];

    for (const candidate of cases) {
      expect(validateTemplateSnapshotV1(candidate)).toBe(false);
      expect(validateTemplateSnapshotV1.errors?.[0]?.keyword).toBe("semantic");
    }
  });

  it("rejects unknown or executable fields at every fixed-graph boundary", () => {
    const snapshot = validSnapshot();
    expect(validateTemplateSnapshotV1(new Proxy(snapshot, {}))).toBe(false);
    expect(validateTemplateSnapshotV1({ ...snapshot, script: "while (true) {}" })).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        parts: [{ ...snapshot.parts[0]!, operations: [{ kind: "execute" }] }],
      }),
    ).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        parts: [
          {
            ...snapshot.parts[0]!,
            color: { kind: "literal", colorId: "builtin:red", expression: "parameter('x')" },
          },
        ],
      }),
    ).toBe(false);
  });

  it("enforces collection and clearance bounds", () => {
    const snapshot = validSnapshot();
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        parameters: Array.from({ length: 17 }, (_, index) => ({
          kind: "color-enum",
          name: `color-${index}`,
          allowedColorIds: ["builtin:red"],
        })),
      }),
    ).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        parameters: [
          {
            kind: "color-enum",
            name: "too-many-colors",
            allowedColorIds: Array.from({ length: 33 }, (_, index) => `builtin:color-${index}`),
          },
        ],
      }),
    ).toBe(false);
    expect(validateTemplateSnapshotV1({ ...snapshot, parts: [] })).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        parts: Array.from({ length: 257 }, () => snapshot.parts[0]!),
      }),
    ).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        internalConnections: Array.from({ length: 1025 }, () => snapshot.internalConnections[0]!),
      }),
    ).toBe(false);
    expect(validateTemplateSnapshotV1({ ...snapshot, externalPorts: [] })).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        externalPorts: Array.from({ length: 65 }, () => snapshot.externalPorts[0]!),
      }),
    ).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        evidenceRunIds: Array.from({ length: 257 }, (_, index) => `run-${index}`),
      }),
    ).toBe(false);
    expect(
      validateTemplateSnapshotV1({
        ...snapshot,
        benchmarkReportIds: Array.from({ length: 257 }, (_, index) => `benchmark-${index}`),
      }),
    ).toBe(false);
    const invertedClearance = rehash({
      ...snapshot,
      clearanceVolume: { minLdu: [10, 0, 0], maxLdu: [0, 10, 10] },
    });
    expect(validateTemplateSnapshotV1(invertedClearance)).toBe(false);
    expect(validateTemplateSnapshotV1.errors?.[0]).toMatchObject({
      keyword: "semantic",
      instancePath: "/clearanceVolume",
    });
  });

  it("allows optional pinned template version and hash on instantiation", () => {
    const baseOperation = {
      kind: "instantiateTemplate",
      operationId: "instantiate-1",
      instanceLocalId: "instance-1",
      templateId: "builtin:two-brick-column",
      parameters: [{ name: "accent-color", value: "builtin:blue" }],
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      submodelId: "root",
      stepId: "step-1",
    } as const;
    const unpinned = {
      schemaVersion: "lego.build-program/1",
      operations: [baseOperation],
    } satisfies BuildProgramV1;
    const pinned = {
      schemaVersion: "lego.build-program/1",
      operations: [
        { ...baseOperation, templateVersion: 1, templateHash: validSnapshot().contentHash },
      ],
    } satisfies BuildProgramV1;

    expect(validateBuildProgramV1(unpinned)).toBe(true);
    expect(validateBuildProgramV1(pinned)).toBe(true);
    expect(
      validateBuildProgramV1({
        ...pinned,
        operations: [
          {
            ...baseOperation,
            templateVersion: 1,
          },
        ],
      }),
    ).toBe(false);
    expect(validateBuildProgramV1.errors?.[0]).toMatchObject({
      keyword: "semantic",
      instancePath: "/operations/0",
    });
    expect(
      validateBuildProgramV1({
        ...pinned,
        operations: [
          {
            ...baseOperation,
            templateHash: validSnapshot().contentHash,
          },
        ],
      }),
    ).toBe(false);
    expect(validateBuildProgramV1.errors?.[0]).toMatchObject({
      keyword: "semantic",
      instancePath: "/operations/0",
    });
    expect(
      validateBuildProgramV1({
        ...pinned,
        operations: [
          {
            ...pinned.operations[0]!,
            parameters: [
              { name: "accent-color", value: "builtin:red" },
              { name: "accent-color", value: "builtin:blue" },
            ],
          },
        ],
      }),
    ).toBe(false);
    expect(validateBuildProgramV1.errors?.[0]).toMatchObject({
      keyword: "semantic",
      instancePath: "/operations/0/parameters",
    });
    expect(
      validateBuildProgramV1({
        ...pinned,
        operations: [{ ...pinned.operations[0]!, templateVersion: 0 }],
      }),
    ).toBe(false);
    expect(
      validateBuildProgramV1({
        ...pinned,
        operations: [{ ...pinned.operations[0]!, templateHash: "not-a-hash" }],
      }),
    ).toBe(false);
  });
});

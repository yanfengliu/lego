import { describe, expect, it } from "vitest";

import { templateSnapshotContentHash, type TemplateSnapshotV1 } from "@lego-studio/protocol";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";
import {
  MAX_TEMPLATE_ADMISSION_ISSUES,
  TEMPLATE_ADMISSION_MANIFEST,
  TEMPLATE_ADMISSION_SNAPSHOT_HASH,
  validateTemplateSnapshotAgainstTruth,
} from "./template-admission.ts";

const PLACEHOLDER_HASH = `sha256:${"a".repeat(64)}` as const;

function rehash(snapshot: TemplateSnapshotV1): TemplateSnapshotV1 {
  return { ...snapshot, contentHash: templateSnapshotContentHash(snapshot) };
}

function validSnapshot(): TemplateSnapshotV1 {
  const truth = createBuiltinTruthSnapshot();
  return rehash({
    schemaVersion: "lego.template-snapshot/1",
    id: "builtin:two-brick-column",
    version: 1,
    contentHash: PLACEHOLDER_HASH,
    status: "stable",
    admissionPolicyHash: TEMPLATE_ADMISSION_SNAPSHOT_HASH,
    catalogHash: truth.catalog.hash,
    truthSnapshotHash: canonicalDigest(truth),
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
        semanticTags: ["base", "body"],
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
        localConnectionId: "stack-connection-0",
        kind: "stud-tube",
        a: { localPartId: "base", portId: "stud:0:0" },
        b: { localPartId: "top", portId: "undersideClutch:0:0" },
      },
      {
        localConnectionId: "stack-connection-1",
        kind: "stud-tube",
        a: { localPartId: "base", portId: "stud:0:1" },
        b: { localPartId: "top", portId: "undersideClutch:0:1" },
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
    clearanceVolume: { minLdu: [-100, -100, -100], maxLdu: [100, 100, 100] },
    evidenceRunIds: ["run-accepted"],
    counterexampleRunIds: [],
    benchmarkReportIds: ["benchmark-accepted"],
    provenance: { origin: "project", sourceId: "template-source" },
    license: {
      spdxExpression: "MIT",
      attribution: "Copyright 2026 Lego Studio contributors",
      redistribution: "allowed",
    },
  });
}

function issueCodes(snapshot: TemplateSnapshotV1): string[] {
  return validateTemplateSnapshotAgainstTruth(snapshot).issues.map(({ code }) => code);
}

function projectedValidationCodes(snapshot: TemplateSnapshotV1): string[] {
  return validateTemplateSnapshotAgainstTruth(snapshot).issues.flatMap((issue) =>
    issue.validationCode === undefined ? [] : [issue.validationCode],
  );
}

describe("validateTemplateSnapshotAgainstTruth", () => {
  it("admits a detached fixed graph pinned to the active catalog and truth", () => {
    const snapshot = validSnapshot();
    const result = validateTemplateSnapshotAgainstTruth(snapshot);

    expect(result).toMatchObject({ ok: true, issues: [] });
    expect(result.snapshot?.contentHash).toBe(snapshot.contentHash);
    expect(result.snapshot?.parameters[0]?.allowedColorIds).toEqual([
      "builtin:blue",
      "builtin:red",
    ]);
    expect(result.snapshot).not.toBe(snapshot);
    expect(result.validationReport).toMatchObject({ documentGloballyValid: true, issues: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot?.parts)).toBe(true);

    const reordered = rehash({
      ...snapshot,
      parameters: snapshot.parameters.map((parameter) => ({
        ...parameter,
        allowedColorIds: [...parameter.allowedColorIds].reverse(),
      })),
      parts: [...snapshot.parts].reverse().map((part) => ({
        ...part,
        transform: {
          ...part.transform,
          positionLdu: [-0, part.transform.positionLdu[1], part.transform.positionLdu[2]],
        },
        semanticTags: [...part.semanticTags].reverse(),
      })),
      internalConnections: [...snapshot.internalConnections].reverse().map((connection) => ({
        ...connection,
        a: connection.b,
        b: connection.a,
      })),
      externalPorts: [...snapshot.externalPorts].reverse(),
      provenance: {
        sourceId: snapshot.provenance.sourceId,
        origin: snapshot.provenance.origin,
      },
      license: {
        redistribution: snapshot.license.redistribution,
        attribution: snapshot.license.attribution,
        spdxExpression: snapshot.license.spdxExpression,
      },
    });
    expect(reordered.contentHash).toBe(snapshot.contentHash);
    const reorderedResult = validateTemplateSnapshotAgainstTruth(reordered);
    expect(reorderedResult).toEqual(result);
    expect(JSON.stringify(reorderedResult)).toBe(JSON.stringify(result));
    expect(Object.is(reorderedResult.snapshot?.parts[0]?.transform.positionLdu[0], -0)).toBe(false);
  });

  it("binds admission semantics and limits without changing BrickDocument truth", () => {
    const truth = createBuiltinTruthSnapshot();
    const documentValidatorManifest = getBuiltinTruthDigestInputs().validatorSet;

    expect(truth.validatorSet.version).toBe("lego.kernel-validators/1");
    expect(documentValidatorManifest).not.toHaveProperty("templateAdmissionPolicyVersion");
    expect(TEMPLATE_ADMISSION_MANIFEST).toMatchObject({
      policyVersion: "lego.template-admission/1",
      limits: {
        maxIssues: MAX_TEMPLATE_ADMISSION_ISSUES,
        maxDataDepth: 32,
        maxDataNodes: 50_000,
      },
    });
    expect(TEMPLATE_ADMISSION_MANIFEST.rules).toEqual(
      expect.arrayContaining([
        "data-only-descriptor-preflight-before-clone",
        "active-admission-policy-catalog-and-truth-pins",
        "projected-document-connection-graph-collision-validity",
      ]),
    );
    expect(TEMPLATE_ADMISSION_SNAPSHOT_HASH).toBe(canonicalDigest(TEMPLATE_ADMISSION_MANIFEST));
    expect(Object.isFrozen(TEMPLATE_ADMISSION_MANIFEST)).toBe(true);
    expect(Object.isFrozen(TEMPLATE_ADMISSION_MANIFEST.rules)).toBe(true);
    expect(Object.isFrozen(TEMPLATE_ADMISSION_MANIFEST.limits)).toBe(true);
    expect(
      canonicalDigest({
        ...TEMPLATE_ADMISSION_MANIFEST,
        limits: {
          ...TEMPLATE_ADMISSION_MANIFEST.limits,
          maxIssues: MAX_TEMPLATE_ADMISSION_ISSUES + 1,
        },
      }),
    ).not.toBe(TEMPLATE_ADMISSION_SNAPSHOT_HASH);
    expect(validateTemplateSnapshotAgainstTruth(validSnapshot()).admissionPolicyHash).toBe(
      TEMPLATE_ADMISSION_SNAPSHOT_HASH,
    );

    const snapshot = validSnapshot();
    const stalePolicy = rehash({
      ...snapshot,
      admissionPolicyHash: PLACEHOLDER_HASH,
      parts: [{ ...snapshot.parts[0]!, catalogPartId: "builtin:not-a-part" }, snapshot.parts[1]!],
    });
    expect(issueCodes(stalePolicy)).toEqual(["TEMPLATE_ADMISSION_POLICY_HASH_MISMATCH"]);
  });

  it("requires intrinsic protocol validity before consulting active truth", () => {
    const snapshot = validSnapshot();
    const result = validateTemplateSnapshotAgainstTruth({
      ...snapshot,
      contentHash: PLACEHOLDER_HASH,
      catalogHash: PLACEHOLDER_HASH,
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "TEMPLATE_PROTOCOL_INVALID", path: "/contentHash" }],
    });
    expect(result.issues).toHaveLength(1);
    expect(validateTemplateSnapshotAgainstTruth(new Proxy(snapshot, {})).issues[0]?.code).toBe(
      "TEMPLATE_PROTOCOL_INVALID",
    );

    let getterReads = 0;
    const accessorInput = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return "lego.template-snapshot/1";
      },
    });
    expect(validateTemplateSnapshotAgainstTruth(accessorInput).issues[0]?.code).toBe(
      "TEMPLATE_PROTOCOL_INVALID",
    );
    expect(getterReads).toBe(0);
  });

  it("requires both the active catalog hash and the canonical truth digest", () => {
    const snapshot = rehash({
      ...validSnapshot(),
      catalogHash: PLACEHOLDER_HASH,
      truthSnapshotHash: `sha256:${"b".repeat(64)}`,
    });

    expect(issueCodes(snapshot)).toEqual([
      "TEMPLATE_CATALOG_HASH_MISMATCH",
      "TEMPLATE_TRUTH_HASH_MISMATCH",
    ]);
  });

  it("rejects unknown catalog parts, color-domain values, orientations, and ports", () => {
    const base = validSnapshot();
    const unknownPart = rehash({
      ...base,
      parts: [{ ...base.parts[0]!, catalogPartId: "builtin:not-a-part" }, base.parts[1]!],
    });
    const unknownDomainColor = rehash({
      ...base,
      parameters: [
        {
          ...base.parameters[0]!,
          allowedColorIds: ["builtin:red", "builtin:not-a-color"],
          defaultColorId: "builtin:red",
        },
      ],
    });
    const unknownLiteralColor = rehash({
      ...base,
      parts: [
        {
          ...base.parts[0]!,
          color: { kind: "literal", colorId: "builtin:not-a-color" },
        },
        base.parts[1]!,
      ],
    });
    const illegalOrientation = rehash({
      ...base,
      parts: [
        {
          ...base.parts[0]!,
          transform: { ...base.parts[0]!.transform, orientationId: "upright-pitch-90" },
        },
        base.parts[1]!,
      ],
    });
    const unknownPort = rehash({
      ...base,
      externalPorts: [
        {
          ...base.externalPorts[0]!,
          endpoint: { ...base.externalPorts[0]!.endpoint, portId: "stud:99:99" },
        },
        base.externalPorts[1]!,
      ],
    });

    expect(issueCodes(unknownPart)).toContain("TEMPLATE_PART_UNKNOWN");
    expect(issueCodes(unknownDomainColor)).toContain("TEMPLATE_COLOR_UNKNOWN");
    expect(issueCodes(unknownLiteralColor)).toContain("TEMPLATE_COLOR_UNKNOWN");
    expect(issueCodes(illegalOrientation)).toContain("TEMPLATE_ORIENTATION_ILLEGAL");
    expect(issueCodes(unknownPort)).toContain("TEMPLATE_PORT_UNKNOWN");
  });

  it("uses kernel connection, graph, and collision truth for the projected fixed graph", () => {
    const base = validSnapshot();
    const transformMismatch = rehash({
      ...base,
      parts: [
        base.parts[0]!,
        {
          ...base.parts[1]!,
          transform: { ...base.parts[1]!.transform, positionLdu: [0, -23, 0] },
        },
      ],
    });
    const incompatiblePorts = rehash({
      ...base,
      internalConnections: [
        {
          ...base.internalConnections[0]!,
          b: { localPartId: "top", portId: "stud:0:0" },
        },
      ],
    });
    const overlappingAndDisconnected = rehash({
      ...base,
      parts: [
        base.parts[0]!,
        {
          ...base.parts[1]!,
          transform: { ...base.parts[1]!.transform, positionLdu: [0, 0, 0] },
        },
      ],
      internalConnections: [],
    });

    expect(projectedValidationCodes(transformMismatch)).toContain("CONNECTION_TRANSFORM_MISMATCH");
    expect(projectedValidationCodes(incompatiblePorts)).toContain("INCOMPATIBLE_CONNECTION_PORTS");
    expect(projectedValidationCodes(overlappingAndDisconnected)).toEqual(
      expect.arrayContaining(["DISCONNECTED_ASSEMBLY", "PART_BODY_COLLISION"]),
    );
  });

  it("requires clearance to contain each part's authoritative transformed catalog bounds", () => {
    const base = validSnapshot();
    const snapshot = rehash({
      ...base,
      parts: base.parts.map((part) => ({
        ...part,
        transform: { ...part.transform, orientationId: "upright-yaw-90" },
      })),
      clearanceVolume: { minLdu: [-20, -100, -10], maxLdu: [20, 100, 10] },
    });
    expect(validateTemplateSnapshotAgainstTruth(snapshot).ok).toBe(true);

    const tooSmall = rehash({
      ...snapshot,
      clearanceVolume: { minLdu: [-10, -100, -20], maxLdu: [10, 100, 20] },
    });
    const result = validateTemplateSnapshotAgainstTruth(tooSmall);

    expect(result.issues.filter(({ code }) => code === "TEMPLATE_CLEARANCE_EXCEEDED")).toHaveLength(
      2,
    );
  });

  it("sorts and bounds hostile catalog failures with an explicit omission issue", () => {
    const base = validSnapshot();
    const parts = Array.from({ length: 256 }, (_, index) => ({
      ...base.parts[0]!,
      localPartId: `unknown-part-${String(index).padStart(3, "0")}`,
      catalogPartId: `builtin:unknown-${String(index).padStart(3, "0")}`,
    }));
    const snapshot = rehash({
      ...base,
      parts,
      internalConnections: [],
      externalPorts: [
        {
          name: "only-port",
          endpoint: { localPartId: parts[0]!.localPartId, portId: "stud:0:0" },
        },
      ],
    });
    const result = validateTemplateSnapshotAgainstTruth(snapshot);
    const reordered = rehash({ ...snapshot, parts: [...parts].reverse() });

    expect(result.issues).toHaveLength(MAX_TEMPLATE_ADMISSION_ISSUES);
    expect(issueCodes(snapshot)).toContain("TEMPLATE_ADMISSION_ISSUE_BUDGET_EXCEEDED");
    expect(result.issues.map(({ code, path }) => `${code}\u0000${path}`)).toEqual(
      [...result.issues]
        .sort(
          (left, right) =>
            left.code.localeCompare(right.code) || left.path.localeCompare(right.path),
        )
        .map(({ code, path }) => `${code}\u0000${path}`),
    );
    expect(reordered.contentHash).toBe(snapshot.contentHash);
    expect(validateTemplateSnapshotAgainstTruth(reordered).issues).toEqual(result.issues);
  });
});

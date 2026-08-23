import { readFileSync } from "node:fs";

import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import {
  SCHEMA_IDS,
  validateNativeSealedRunManifestV1,
  validateValidationIssue,
  type NativeSealedRunManifestV1,
} from "./index.js";

const HASH = `sha256:${"a".repeat(64)}`;
const LINE_TERMINATORS = ["\n", "\r", "\u000b", "\u000c", "\u0085", "\u2028", "\u2029"];
const LINE_TERMINATOR_GUARD = "[\\r\\n\\u000B\\u000C\\u0085\\u2028\\u2029]";

function excludesLineTerminatorsInEveryContext(pattern: string): boolean {
  const guardPattern = new RegExp(pattern, "u");
  return LINE_TERMINATORS.every((terminator) =>
    [terminator, `A${terminator}`, `${terminator}A`].every((sample) => guardPattern.test(sample)),
  );
}

function hasEffectiveLineTerminatorGuard(node: Record<string, unknown>): boolean {
  if (typeof node.not !== "object" || node.not === null || !("pattern" in node.not)) return false;
  const guard = (node.not as Record<string, unknown>).pattern;
  return typeof guard === "string" && excludesLineTerminatorsInEveryContext(guard);
}
const artifact = {
  artifactId: "artifact-1",
  kind: "input",
  mediaType: "application/json",
  sha256: HASH,
  byteLength: 1,
  casKey: HASH,
} as const;
const manifest = {
  schemaVersion: "lego.native-run-manifest/1",
  namespace: "test",
  runId: "run-1",
  terminalState: "succeeded",
  baseDocumentHash: HASH,
  truthSnapshotHash: HASH,
  applicationBuildHash: HASH,
  brokerBuildHash: HASH,
  harnessBuildHash: HASH,
  lockfileHash: HASH,
  runtimeHash: HASH,
  briefHash: HASH,
  scopeDigest: HASH,
  budgets: {
    maxCandidates: 1,
    maxRepairs: 0,
    maxProviderCalls: 1,
    maxTokens: 1,
    maxCostMicros: 1,
    maxWallTimeMs: 1,
    maxRenders: 1,
    maxStoredBytes: 1,
  },
  candidateIds: [],
  eventCount: 1,
  eventRoot: HASH,
  artifacts: [artifact],
  replayClosure: {
    sealedReplayLevel: "downstream-only",
    earliestRetainedBoundary: "program",
    artifactRoot: HASH,
    requiredArtifactHashes: [],
    verifierVersion: "verifier-1",
  },
  finalizedAt: "2026-08-22T20:30:00.000Z",
  seal: {
    algorithm: "Ed25519",
    keyId: "key-1",
    keyEpoch: 1,
    signature: "A".repeat(86),
  },
} satisfies NativeSealedRunManifestV1;

describe("signed scalar cross-engine canonicality", () => {
  it("closes every common final-line alias in shared identifiers and hashes", () => {
    const exportedSchema = JSON.parse(
      readFileSync(new URL(import.meta.resolve("@lego-studio/protocol/schema")), "utf8"),
    ) as { definitions: Record<string, Record<string, unknown>> };
    expect(exportedSchema.definitions.Identifier).toMatchObject({
      not: { pattern: LINE_TERMINATOR_GUARD },
    });
    expect(exportedSchema.definitions.Hash).toMatchObject({
      minLength: 71,
      maxLength: 71,
      not: { pattern: LINE_TERMINATOR_GUARD },
    });
    const artifactRef = exportedSchema.definitions.ArtifactRefV1 as {
      properties: { mediaType: Record<string, unknown> };
    };
    expect(artifactRef.properties.mediaType).toMatchObject({
      not: { pattern: "[^a-z0-9.+/\\-]" },
    });

    const externalAjv = new Ajv({ strict: true });
    externalAjv.addSchema(exportedSchema);
    const externalValidate = externalAjv.getSchema(SCHEMA_IDS.nativeSealedRunManifestV1)!;
    for (const terminator of LINE_TERMINATORS) {
      expect(validateNativeSealedRunManifestV1({ ...manifest, runId: `run-1${terminator}` })).toBe(
        false,
      );
      expect(externalValidate({ ...manifest, eventRoot: `${HASH}${terminator}` })).toBe(false);
      const artifacts = [{ ...artifact, mediaType: `${artifact.mediaType}${terminator}` }];
      expect(validateNativeSealedRunManifestV1({ ...manifest, artifacts })).toBe(false);
      expect(externalValidate({ ...manifest, artifacts })).toBe(false);
    }
  });

  it("gates every anchored wire scalar without a Unicode exception", () => {
    expect(excludesLineTerminatorsInEveryContext(LINE_TERMINATOR_GUARD)).toBe(true);
    expect(excludesLineTerminatorsInEveryContext(`^${LINE_TERMINATOR_GUARD}`)).toBe(false);
    expect(excludesLineTerminatorsInEveryContext(`${LINE_TERMINATOR_GUARD}$`)).toBe(false);
    const exportedSchema = JSON.parse(
      readFileSync(new URL(import.meta.resolve("@lego-studio/protocol/schema")), "utf8"),
    ) as Record<string, unknown>;
    const unguarded: string[] = [];
    const visit = (value: unknown, path: string): void => {
      if (value === null || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      if (
        node.type === "string" &&
        typeof node.pattern === "string" &&
        node.pattern.endsWith("$") &&
        !hasEffectiveLineTerminatorGuard(node)
      ) {
        unguarded.push(path);
      }
      for (const [key, child] of Object.entries(node)) visit(child, `${path}/${key}`);
    };
    visit(exportedSchema, "");
    expect(unguarded).toStrictEqual([]);
  });

  it("keeps JSON Pointer Unicode tokens without accepting a bare line alias", () => {
    const issue = {
      issueId: "issue-1",
      validatorId: "validator-1",
      code: "INVALID_POINTER",
      severity: "blocking",
      message: "The path is invalid.",
      path: "",
      partIds: [],
      connectionIds: [],
      scope: "document",
    } as const;
    expect(validateValidationIssue(issue)).toBe(true);
    expect(validateValidationIssue({ ...issue, path: "\n" })).toBe(false);
    expect(validateValidationIssue({ ...issue, path: "/\n" })).toBe(true);
    expect(validateValidationIssue({ ...issue, path: "/bad~" })).toBe(false);
    expect(validateValidationIssue({ ...issue, path: "/bad~2" })).toBe(false);
    expect(validateValidationIssue({ ...issue, path: "/good~0~1" })).toBe(true);
  });
});

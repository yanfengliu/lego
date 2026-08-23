import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const childBoundary = vi.hoisted(() => ({
  spawn: vi.fn(() => {
    throw new Error("proposal-only workflow attempted to spawn a child");
  }),
}));

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal()),
  spawn: childBoundary.spawn,
}));

vi.mock("./part-identification-mcp-server.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    partIdentificationMcpVerifiedRequestArtifact: (value) => ({
      bytes: Buffer.from(JSON.stringify(value), "utf8"),
      byteLength: 1_810_180,
      digest: "sha256:8984c336ad8b8afa39bf929fe4239ae17433190fb8560fd65375c08d6c4f23ec",
    }),
    verifyPartIdentificationMcpRequest: (value) => value,
  };
});
vi.mock("./part-identification-proof-reservation.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, estimatePartIdentificationProofReservation: () => 2_088_511 };
});

import { PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE } from "./part-identification-gate0-workflow.mjs";
import {
  PART_IDENTIFICATION_GATE0_DEFAULT_ROOT,
  __testOnly as preparedTestOnly,
} from "./part-identification-gate0-prepared.mjs";
import {
  claimPartIdentificationGate0Launch,
  consumePartIdentificationGate0Admission,
  settlePartIdentificationGate0Launch,
  __testOnly as storeTestOnly,
} from "./part-identification-gate0-store.mjs";
import { gate0TestRequest } from "./part-identification-gate0-test-fixture.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

function stateRoot() {
  const root = join(tmpdir(), `lego-gate0-workflow-${process.pid}-${Date.now()}-${roots.length}`);
  roots.push(root);
  return root;
}

function officialResponse(url, byte) {
  const response = new Response(Buffer.alloc(4_096, byte), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

async function preparedCapability(root, responseByte = 80) {
  let responseIndex = 0;
  const prepared = await preparedTestOnly.prepare({
    root,
    request: gate0TestRequest(),
    fetchImpl: async (url) => officialResponse(url, responseByte + responseIndex++),
  });
  const authorized = storeTestOnly.authorizePrepared(
    {
      proposalDigest: prepared.proposal.proposalDigest,
      approval: PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE,
    },
    { root },
  );
  return {
    prepared,
    authorized,
    capability: storeTestOnly.openRaw(
      { authorizationDigest: authorized.authorizationDigest },
      { root },
    ),
  };
}

describe("Gate-0 proposal and trusted-local authorization workflow", () => {
  it("stops after proposal, then consumes one approval claim into one reservation", async () => {
    childBoundary.spawn.mockClear();
    const root = stateRoot();
    let responseIndex = 0;
    const prepared = await preparedTestOnly.prepare({
      root,
      request: gate0TestRequest(),
      fetchImpl: async (url) => officialResponse(url, 65 + responseIndex++),
    });
    expect(readFileSync(join(root, prepared.reference.path))).toHaveLength(
      prepared.reference.byteLength,
    );
    expect(() => readdirSync(join(root, "reservations"))).toThrow();
    expect(() => readdirSync(join(root, "approval-claims"))).toThrow();

    expect(() =>
      storeTestOnly.authorizePrepared(
        { proposalDigest: prepared.proposal.proposalDigest, approval: "approved" },
        { root },
      ),
    ).toThrow(/exact trusted-local-caller assertion phrase/u);
    expect(() => readdirSync(join(root, "reservations"))).toThrow();

    const input = {
      proposalDigest: prepared.proposal.proposalDigest,
      approval: PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE,
    };
    const first = storeTestOnly.authorizePrepared(input, { root });
    const second = storeTestOnly.authorizePrepared(input, { root });
    expect(second).toEqual(first);
    expect(readdirSync(join(root, "reservations"))).toHaveLength(1);
    expect(readdirSync(join(root, "approval-claims"))).toHaveLength(1);
    expect(
      readFileSync(join(root, ...preparedTestOnly.approvalPath(first.proposalDigest).split("/"))),
    ).not.toContain(PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE);
    expect(childBoundary.spawn).not.toHaveBeenCalled();
  });

  it("has no direct Claude executable or model-child import path", () => {
    const source = readFileSync(
      new URL("./part-identification-gate0-workflow.mjs", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/runPartIdentificationClaudeTransport|runBoundedChild/u);
  });

  it("anchors the production state namespace to the real checkout across cwd changes", () => {
    const moduleUrl = new URL("./part-identification-gate0-prepared.mjs", import.meta.url).href;
    const code = `
      process.chdir(${JSON.stringify(tmpdir())});
      const prepared = await import(${JSON.stringify(moduleUrl)});
      process.stdout.write(prepared.PART_IDENTIFICATION_GATE0_DEFAULT_ROOT);
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      windowsHide: true,
    });
    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout).toBe(PART_IDENTIFICATION_GATE0_DEFAULT_ROOT);
  });

  it("atomically permits only one pilot launch across distinct prepared proposals", async () => {
    const root = stateRoot();
    let responseIndex = 0;
    const prepare = () =>
      preparedTestOnly.prepare({
        root,
        request: gate0TestRequest(),
        fetchImpl: async (url) => officialResponse(url, 70 + responseIndex++),
      });
    const firstPrepared = await prepare();
    const secondPrepared = await prepare();
    expect(secondPrepared.proposal.proposalDigest).not.toBe(firstPrepared.proposal.proposalDigest);
    const authorize = (proposalDigest) =>
      storeTestOnly.authorizePrepared(
        { proposalDigest, approval: PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE },
        { root },
      );
    const first = authorize(firstPrepared.proposal.proposalDigest);
    const second = authorize(secondPrepared.proposal.proposalDigest);
    const open = (authorizationDigest) => storeTestOnly.openRaw({ authorizationDigest }, { root });
    const firstCapability = open(first.authorizationDigest);
    const secondCapability = open(second.authorizationDigest);

    const ticket = consumePartIdentificationGate0Admission(firstCapability);
    const claimed = claimPartIdentificationGate0Launch(ticket);
    expect(claimed.pilotSlot.pilotLaunchOrdinal).toBe(1);
    expect(claimed.launch.pilotSlotDigest).toBe(claimed.pilotSlot.pilotSlotDigest);
    const terminal = settlePartIdentificationGate0Launch(ticket, {
      status: "failure",
      evidence: "provider-launch",
    });
    expect(terminal.pilotSlotDigest).toBe(claimed.pilotSlot.pilotSlotDigest);
    expect(() => consumePartIdentificationGate0Admission(secondCapability)).toThrow(
      /global pilot launch slot.*already exists/u,
    );
    expect(readdirSync(join(root, "pilot-launch-slots"))).toHaveLength(1);
    expect(readdirSync(join(root, "launches"))).toHaveLength(1);
  });

  it("refuses provider claim after the global slot is deleted or replaced", async () => {
    for (const [index, mutation] of ["delete", "replace"].entries()) {
      const root = stateRoot();
      const { prepared, authorized, capability } = await preparedCapability(root, 90 + index * 5);
      const paths = storeTestOnly.statePaths(
        authorized.authorizationDigest,
        prepared.proposal.request.artifactDigest,
      );
      const ticket = consumePartIdentificationGate0Admission(capability);
      const slot = join(root, paths.pilotSlot);
      if (mutation === "delete") rmSync(slot);
      else writeFileSync(slot, "tampered");
      expect(() => claimPartIdentificationGate0Launch(ticket)).toThrow(
        /global pilot launch slot|contained file/u,
      );
    }
  });

  it("refuses terminal settlement after the claimed global slot changes", async () => {
    const root = stateRoot();
    const { prepared, authorized, capability } = await preparedCapability(root, 105);
    const paths = storeTestOnly.statePaths(
      authorized.authorizationDigest,
      prepared.proposal.request.artifactDigest,
    );
    const ticket = consumePartIdentificationGate0Admission(capability);
    claimPartIdentificationGate0Launch(ticket);
    writeFileSync(join(root, paths.pilotSlot), "tampered");
    expect(() =>
      settlePartIdentificationGate0Launch(ticket, {
        status: "failure",
        evidence: "provider-launch",
      }),
    ).toThrow(/global pilot launch slot/u);
  });
});

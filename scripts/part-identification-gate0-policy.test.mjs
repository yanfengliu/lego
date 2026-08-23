import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  retrievePartIdentificationGate0PolicyEvidence,
  verifyRetainedPartIdentificationGate0PolicyEvidence,
  __testOnly,
} from "./part-identification-gate0-policy.mjs";
import { PART_IDENTIFICATION_GATE0_POLICY_SOURCES } from "./part-identification-gate0.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

function stateRoot() {
  const root = mkdtempSync(join(tmpdir(), "lego-gate0-policy-"));
  roots.push(root);
  return root;
}

function officialResponse(url, byte = 65) {
  const response = new Response(Buffer.alloc(4_096, byte), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("Gate-0 retained official policy evidence", () => {
  it("fetches only exact public articles without credentials and verifies retained bodies", async () => {
    const root = stateRoot();
    const fetchImpl = vi.fn(async (url) => officialResponse(url, 65 + fetchImpl.mock.calls.length));
    const retained = await retrievePartIdentificationGate0PolicyEvidence({ root, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (let index = 0; index < fetchImpl.mock.calls.length; index += 1) {
      const [url, options] = fetchImpl.mock.calls[index];
      expect(url).toBe(PART_IDENTIFICATION_GATE0_POLICY_SOURCES[index].officialUrl);
      expect(options).toMatchObject({
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
    }
    expect(
      verifyRetainedPartIdentificationGate0PolicyEvidence(
        retained.reference,
        retained.policyReview.reviewedAtMs,
        { root },
      ),
    ).toEqual(retained.policyReview);

    const firstDigest = retained.policyReview.sources[0].contentDigest;
    const firstPath = join(root, ...__testOnly.bodyPath(firstDigest).split("/"));
    const original = readFileSync(firstPath);
    writeFileSync(firstPath, Buffer.alloc(original.length, 90));
    expect(() =>
      verifyRetainedPartIdentificationGate0PolicyEvidence(
        retained.reference,
        retained.policyReview.reviewedAtMs,
        { root },
      ),
    ).toThrow(/retained policy bytes changed/u);
  });

  it("rejects redirects or aliases before retaining an evidence review", async () => {
    const root = stateRoot();
    const fetchImpl = vi.fn(async (url) => officialResponse(`${url}/alias`));
    await expect(
      retrievePartIdentificationGate0PolicyEvidence({ root, fetchImpl }),
    ).rejects.toThrow(/exact official URL/u);
  });
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ActionLedgerVerificationError,
  canonicalValidationFailureCode,
} from "./part-identification-action-ledger-verifier.mjs";
import { sha256Digest } from "./part-identification-artifacts.mjs";
import { writePythonReportContractFixture } from "./part-identification-report-contract-fixture.mjs";
import { dispatch } from "./part-identification-report-verifier.mjs";

const artifact = (path) => {
  const bytes = readFileSync(path);
  return { path, digest: sha256Digest(bytes) };
};

const actionRequest = (root) => ({
  schemaVersion: "lego.part-identification-report-verification/1",
  kind: "action-ledger",
  artifacts: Object.fromEntries(
    Object.entries({
      actionLedger: "output/real-build/action-ledger.json",
      coverage: "output/real-build/catalog-coverage.json",
      features: "output/part-identification/features.json",
      calloutManifest: "output/callout-thumbnails/manifest.json",
      builderCalibration: "output/real-build/builder-canonical-calibration.json",
      transitionClassifications: "output/real-build/transition-classifications.json",
      officialModel: "output/official-model/vx1087034_21066_a.xml",
      bookletPdf: "recipes/6651557.pdf",
      builderGeometry: "output/real-build/builder-shell-geometry.bin",
    }).map(([role, path]) => [role, artifact(join(root, path))]),
  ),
});

describe("production Python report verifier", () => {
  it("does not activate a synthetic coverage expectation from public content or paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "lego-report-verifier-production-"));
    try {
      writeFileSync(
        join(root, ".lego-report-contract-fixture-root"),
        "lego-report-contract-fixture/1\n",
      );
      await writePythonReportContractFixture(root);
      const cardsPath = join(root, "output/part-identification/cards/manifest.json");
      const cards = JSON.parse(readFileSync(cardsPath, "utf8"));
      const request = {
        schemaVersion: "lego.part-identification-report-verification/1",
        kind: "coverage",
        artifacts: {
          coverage: artifact(join(root, "output/real-build/catalog-coverage.json")),
          features: artifact(join(root, "output/part-identification/features.json")),
          match: artifact(join(root, "output/part-identification/match.json")),
          distances: artifact(join(root, "output/part-identification/distances.json")),
          elementResolution: artifact(
            join(root, "output/part-identification/element-resolution.json"),
          ),
          calloutManifest: artifact(join(root, "output/callout-thumbnails/manifest.json")),
          pairJudged: artifact(
            join(root, "scripts/fixtures/part-identification-truth-first50.json"),
          ),
          cards: artifact(cardsPath),
          cardImages: artifact(join(dirname(cardsPath), cards.imagesFile)),
          answers: artifact(join(root, "output/part-identification/answers-claude-opus-5.json")),
        },
      };
      await expect(dispatch(request, root)).rejects.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("distinguishes exact-byte drift from bounded canonical validation categories", async () => {
    const root = mkdtempSync(join(tmpdir(), "lego-report-verifier-category-"));
    try {
      writeFileSync(
        join(root, ".lego-report-contract-fixture-root"),
        "lego-report-contract-fixture/1\n",
      );
      await writePythonReportContractFixture(root);
      const validationCode = canonicalValidationFailureCode([
        ...Array.from({ length: 24 }, () => ({ code: "official-frame-calibration-missing" })),
        ...Array.from({ length: 73 }, () => ({ code: "action-ledger-incomplete" })),
      ]);
      expect(validationCode).toBe(
        "canonical-validation-97-official-frame-calibration-missing-24-action-ledger-incomplete-73",
      );
      for (const code of ["exact-bytes", validationCode]) {
        await expect(
          dispatch(actionRequest(root), root, {
            actionLedgerVerifier: async () => {
              throw new ActionLedgerVerificationError(code);
            },
          }),
        ).rejects.toMatchObject({ code: `action-ledger-${code}` });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

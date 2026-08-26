import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assertVerifiedPartIdentificationSourceArtReboundClosure,
  compilePartIdentificationSourceArtRebound,
  inspectVerifiedPartIdentificationSourceArtRebound,
  verifyPartIdentificationSourceArtReboundClosure,
} from "./part-identification-source-art-rebound.mjs";

const PDF_PATH = "recipes/6651557.pdf";
const MANIFEST_PATH = "output/callout-thumbnails/manifest.json";
const ARTIFACT_SHA256 = "sha256:a58a55e65c19e2771defe02fc9d37e24c00246bbed9dd375d8d0a2f16382897d";
const realIt = existsSync(PDF_PATH) && existsSync(MANIFEST_PATH) ? it : it.skip;

const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

describe("part-identification source-art rebound closure", () => {
  realIt(
    "recomputes the exact 859-row class, three members, and four suffix counterexamples",
    async () => {
      const pdfBytes = readFileSync(PDF_PATH);
      const manifestBytes = readFileSync(MANIFEST_PATH);
      const artifactBytes = await compilePartIdentificationSourceArtRebound({
        manifestBytes,
        pdfBytes,
      });
      const artifact = JSON.parse(Buffer.from(artifactBytes).toString("utf8"));
      expect(digest(artifactBytes)).toBe(ARTIFACT_SHA256);

      expect(artifact.inputDigests).toEqual({
        manifestSha256: "sha256:c8d20cfe87ef9d21488725b393b94e61870fcc82b26bb497ea734fc7b97a67bf",
        pdfSha256: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
      });
      expect(artifact.scan).toEqual({
        fixedGeometryRows: 7,
        genericContainmentAmbiguities: 18,
        outcomeDigest: "sha256:11974807e0e4604fc215820d3798495d189a7bdcc5c09bbbf3e3faeb08ca7cb7",
        physicalRowsScanned: 859,
      });
      expect(artifact.sourceArtClass.normalizedProgramSha256).toBe(
        "sha256:6328de6ee88bd0074974cd657bf2e6ceb5ac8c931148eb9fbcc0635bf326ef75",
      );
      expect(artifact.sourceArtClass.classDigest).toBe(
        "sha256:2b609c6d364f1c6a55891246dd59a6bbe80bb309793dfc72ff310c73a0ab22fe",
      );
      expect(
        artifact.sourceArtClass.members.map(({ identity, stepNumber }) => ({
          identity,
          stepNumber,
        })),
      ).toEqual([
        { identity: "p11|q1|x90.511|y212.112", stepNumber: 2 },
        { identity: "p11|q1|x506.064|y212.112", stepNumber: 4 },
        { identity: "p20|q1|x36.320|y430.691", stepNumber: 16 },
      ]);
      expect(artifact.sourceArtClass.counterevidence.map(({ stepNumber }) => stepNumber)).toEqual([
        108, 119, 134, 145,
      ]);
      expect(
        artifact.sourceArtClass.members.every(
          ({ renderProof }) =>
            renderProof.noOutsidePaintInterference === true &&
            renderProof.fullRgbaSha256 === renderProof.isolatedRgbaSha256,
        ),
      ).toBe(true);
      expect(artifact.authority).toEqual({
        catalogAdmission: "absent",
        completion: "absent",
        placement: "absent",
        semanticIdentity: "absent",
      });

      const verified = await verifyPartIdentificationSourceArtReboundClosure({
        artifactBytes,
        manifestBytes,
        pdfBytes,
      });
      const inspected = inspectVerifiedPartIdentificationSourceArtRebound(verified);
      expect(inspected.artifactSha256).toBe(ARTIFACT_SHA256);
      expect(inspected.reference).toEqual(inspected.members[1]);
      expect(
        assertVerifiedPartIdentificationSourceArtReboundClosure(verified, {
          artifactBytes,
          manifestBytes,
          pdfBytes,
        }),
      ).toBe(inspected);

      const tamperedArtifact = Uint8Array.from(artifactBytes);
      tamperedArtifact[0] ^= 1;
      expect(() =>
        assertVerifiedPartIdentificationSourceArtReboundClosure(verified, {
          artifactBytes: tamperedArtifact,
          manifestBytes,
          pdfBytes,
        }),
      ).toThrow(/changed from/u);
      expect(() => inspectVerifiedPartIdentificationSourceArtRebound(artifact)).toThrow(
        /opaque result/u,
      );
    },
    30_000,
  );
});

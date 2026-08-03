import { describe, expect, it } from "vitest";

import { inspectAppPackageSourceBytes } from "./check-bom-source-policy.mjs";

const inspectText = (relativeFile, source) =>
  inspectAppPackageSourceBytes(relativeFile, Buffer.from(source, "utf8"));

describe("BOM app/package source policy", () => {
  it("accepts bounded UTF-8 source and known digest metadata", () => {
    const digests = ["a".repeat(32), "b".repeat(64)].map((digest) => `"${digest}"`).join(",");
    expect(
      inspectText("packages/example/src/metadata.ts", `export const digests=[${digests}];`),
    ).toEqual([]);
    expect(
      inspectAppPackageSourceBytes(
        "packages/example/src/nul-separator.ts",
        Buffer.from("export const key = `part\0port`;", "utf8"),
      ),
    ).toEqual([]);
  });

  it("rejects unreviewed extensions and binary content renamed as text", () => {
    expect(inspectText("packages/example/src/page.pdf", "%PDF-1.7")[0]).toMatch(
      /file type that is not reviewed/,
    );
    expect(inspectText("packages/example/src/page.txt", "%PDF-1.7")[0]).toMatch(
      /PDF binary signature/,
    );
    expect(
      inspectAppPackageSourceBytes(
        "packages/example/src/page.ts",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )[0],
    ).toMatch(/PNG binary signature/);
    expect(
      inspectAppPackageSourceBytes("packages/example/src/invalid.ts", Buffer.from([0xc3, 0x28]))[0],
    ).toMatch(/not valid UTF-8/);
  });

  it("rejects source payload split below the single-run threshold", () => {
    const chunks = Array.from({ length: 140 }, () => `"${"A".repeat(31)}"`).join(",");
    const issues = inspectText(
      "packages/example/src/chunked.ts",
      `export const bytes=[${chunks}];`,
    );
    expect(issues).toEqual([expect.stringMatching(/long or aggregate base64-like content/)]);
  });

  it("does not treat source words as weak binary signatures", () => {
    expect(inspectText("packages/example/src/bmp.ts", "BMP metadata")).toEqual([]);
    expect(inspectText("packages/example/src/ftyp.ts", "let ftyp = 1;")).toEqual([]);
  });

  it("rejects excessive binary controls without banning deliberate NUL separators", () => {
    expect(
      inspectAppPackageSourceBytes(
        "packages/example/src/binary.txt",
        Buffer.concat([Buffer.from("text"), Buffer.alloc(9)]),
      )[0],
    ).toMatch(/9 binary control bytes/);
  });
});

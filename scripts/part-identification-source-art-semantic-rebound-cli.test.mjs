import { describe, expect, it } from "vitest";

import { createSourceArtSemanticReboundCliWorkflowLedger } from "./part-identification-source-art-semantic-rebound-cli.mjs";
import {
  SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
  SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
} from "./part-identification-source-art-semantic-rebound-source.mjs";

function perCompileWork() {
  return {
    componentPixelLimit: SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS,
    componentPixels: 100,
    decodedByteLimit: SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES,
    decodedBytes: 300,
    decodedPixelLimit: SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS,
    decodedPixels: 100,
    fullPageRenders: 1,
    isolatedControlRenders: 1,
    isolatedImageRenders: 1,
    officialModelIndexCalls: 1,
    officialModelInputByteLimit: 2 * 1024 * 1024,
    officialModelInputBytes: 100,
    officialXmlDecodeByteLimit: 4 * 1024 * 1024,
    officialXmlDecodedBytes: 200,
    officialXmlFullDecodes: 2,
    pdfFetchRenderDisposeDestroyCycles: 1,
  };
}

describe("source-art semantic rebound CLI workflow", () => {
  it("accounts both real passes and refuses an extra pass before its callback", async () => {
    const ledger = createSourceArtSemanticReboundCliWorkflowLedger();
    await ledger.run("compile", async () => ({ result: "compiled", work: perCompileWork() }));
    await ledger.run("verify", async () => ({ result: "verified", work: perCompileWork() }));
    expect(ledger.report()).toMatchObject({
      compilePasses: 2,
      componentPixels: 200,
      decodedBytes: 600,
      decodedPixels: 200,
      fullPageRenders: 2,
      isolatedControlRenders: 2,
      isolatedImageRenders: 2,
      officialModelIndexCalls: 2,
      officialModelInputBytes: 200,
      officialXmlDecodedBytes: 400,
      officialXmlFullDecodes: 4,
      pdfFetchRenderDisposeDestroyCycles: 2,
    });
    let invoked = false;
    await expect(
      ledger.run("compile", async () => {
        invoked = true;
        return { result: null, work: perCompileWork() };
      }),
    ).rejects.toThrow(/before it can read source inputs/u);
    expect(invoked).toBe(false);
  });
});

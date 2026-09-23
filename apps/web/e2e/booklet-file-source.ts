import {
  INSTRUCTION_PDF_LIMITS,
  type InstructionSourceV1,
} from "../src/instructions/instruction-source.ts";

import { readBoundedRegularFile } from "./bounded-file-read.ts";
import { ingestSampleBookletBytes } from "./booklet-fixture.ts";
import { SAMPLE_BOOKLET_PATH } from "./sample-booklet.ts";

/** Legacy/manual probe file access, intentionally separate from byte-only booklet parsing. */
export interface SampleBooklet {
  readonly bytes: Buffer;
  readonly source: InstructionSourceV1;
}

export const SAMPLE_BOOKLET_MAXIMUM_BYTES = INSTRUCTION_PDF_LIMITS.maxBytes;

export function readSampleBookletBytes(path: string): Buffer {
  return readBoundedRegularFile(path, {
    label: "Sample instruction booklet 6651557.pdf",
    maximumBytes: SAMPLE_BOOKLET_MAXIMUM_BYTES,
  });
}

export async function readSampleBooklet(): Promise<SampleBooklet> {
  if (SAMPLE_BOOKLET_PATH === null) {
    throw new Error(
      "readSampleBooklet needs recipes/6651557.pdf, which is uncommitted and absent from this checkout; guard the caller with hasSampleBooklet.",
    );
  }
  const bytes = readSampleBookletBytes(SAMPLE_BOOKLET_PATH);
  const source = await ingestSampleBookletBytes(bytes);
  return { bytes, source };
}

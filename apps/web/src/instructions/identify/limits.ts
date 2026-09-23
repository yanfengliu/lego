import { INSTRUCTION_PDF_LIMITS } from "../instruction-source";

/**
 * Every bound identification puts on a PDF, which is hostile input.
 *
 * The byte, page, page-size and text limits are the app's own instruction-PDF
 * limits. The rest bound the work one page can cause. The peaks measured on the
 * sample booklet 6651557.pdf (224 pages) at 7181ae7 are given beside each, so the
 * headroom is visible: a real booklet sits far inside every one of them.
 */
export const IDENTIFY_LIMITS = Object.freeze({
  maxBytes: INSTRUCTION_PDF_LIMITS.maxBytes,
  maxPages: INSTRUCTION_PDF_LIMITS.maxPages,
  /** Page width and height in points (sample: 765 x 544). */
  maxPageExtentPt: INSTRUCTION_PDF_LIMITS.maxPageExtentPt,
  /** Characters of text on one page (sample: 1,350). */
  maxTextCharsPerPage: INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage,
  /** Characters of text in the whole booklet (sample: 14,228). */
  maxTotalTextChars: INSTRUCTION_PDF_LIMITS.maxTotalTextChars,
  /** Drawing operators on one page (sample: 2,666). */
  maxOperatorsPerPage: 500_000,
  /** Image paints on one page (sample: 153). */
  maxImagePaintsPerPage: 10_000,
  /** Filled paths on one page, which callout boxes are found among (sample: 258). */
  maxFilledPathsPerPage: 20_000,
  /** Pixels of one image; pdf.js drops a larger one before decoding it (sample: 2,079,948). */
  maxImagePixels: 16 * 1024 * 1024,
  /** Decoded pixels of the images one page's pictures are cut from (sample: 517,094). */
  maxDecodedPixelsPerPage: 64 * 1024 * 1024,
  /** Count labels ("2x") on one page (sample: 152, an inventory page). */
  maxCountLabelsPerPage: 1_000,
  /** Count labels in the whole booklet (sample: 1,140). */
  maxCountLabels: 10_000,
  /** Pixels of one composited region (sample: 124,032). */
  maxRegionPixels: 4_000_000,
  /** Pixels painted into one region, summed over its images (sample: 1.02 times the region). */
  maxPaintedPixelsPerRegion: 32_000_000,
  /** Separate pieces of ink in one region (sample: 10). */
  maxComponentsPerRegion: 10_000,
  /** How long one image may take to arrive from pdf.js. */
  imageWaitMs: 10_000,
  /** Default time limit for a whole run (sample: about 17 s). */
  timeLimitMs: 10 * 60 * 1000,
});

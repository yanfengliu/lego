import { createHash } from "node:crypto";

export const PART_IDENTIFICATION_PROMPT = [
  "Each image shows one LEGO part drawing from an instruction booklet (QUERY), and",
  "numbered CANDIDATE drawings taken from the same booklet's own parts list.",
  "Every drawing uses the same viewing angle and drawing style; only the printed size differs.",
  "The parts list contains every part in the set, so the query part is usually among the",
  "candidates — answer 0 only when none of them could be the same part.",
  "First describe the QUERY part on its own, then say which candidate is the same part.",
  "For curved, corner, L-shaped, wedge, or cutout parts, studsLong and studsWide are the maximum",
  "stud-grid bounding-box dimensions, not the number of occupied studs along one narrow arm.",
  'Reply with one line of JSON per image: {"kind":"<brick|plate|tile|slope|wedge|arch|round|technic|other>",',
  '"studsLong":<integer or 0>,"studsWide":<integer or 0>,"colour":"<plain colour name>",',
  '"pick":<candidate number, or 0>,"confidence":<0..1>}',
  "Shape, bounding stud dimensions, and colour must all match for a candidate to be the same part.",
].join(" ");

export const PART_IDENTIFICATION_PROMPT_DIGEST = `sha256:${createHash("sha256").update(PART_IDENTIFICATION_PROMPT).digest("hex")}`;

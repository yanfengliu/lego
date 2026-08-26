import { isDeepStrictEqual } from "node:util";

import { canonicalSourceArtJson as canonicalJson } from "./part-identification-source-art-contribution.mjs";
import { sha256Digest } from "./part-identification-legacy-recut-source.mjs";
import { digestPdfSourceArtImageContribution } from "./part-identification-source-art-semantic-rebound-program.mjs";

export function tally(rows) {
  return {
    relations: rows.length,
    pieces: rows.reduce((total, row) => total + row.quantity, 0),
  };
}

export function exactPinnedBytes(bytes, pin, label) {
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte source at ${pin.digest}; received ${bytes.length} bytes at ${digest}. Restore the retained source instead of sliding the evidence class.`,
    );
  }
}

export function relationOrder(left, right) {
  return (
    left.stepNumber - right.stepNumber ||
    left.pageNumber - right.pageNumber ||
    (left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0)
  );
}

function milli(value) {
  if (!Number.isFinite(value)) throw new Error("Source-art class transform must be finite.");
  const result = Math.round(value * 1_000);
  return Object.is(result, -0) ? 0 : result;
}

export function linearTransformMilli(transform) {
  if (!Array.isArray(transform) || transform.length !== 6) {
    throw new Error("Source-art class requires one exact six-operand PDF CTM.");
  }
  return transform.slice(0, 4).map(milli);
}

export function commitmentFor(schema, rows) {
  let canonical;
  try {
    canonical = canonicalJson(rows);
  } catch (cause) {
    throw new Error(`${schema} roster cannot be canonicalized.`, { cause });
  }
  const bytes = Buffer.from(`${schema}\0${canonical}`);
  return Object.freeze({ rows: rows.length, bytes: bytes.length, digest: sha256Digest(bytes) });
}

function digestFor(schema, value) {
  return sha256Digest(Buffer.from(`${schema}\0${canonicalJson(value)}`));
}

export function compactManifestRow(row) {
  return {
    identity: row.identity,
    pageNumber: row.pageNumber,
    stepNumber: row.stepNumber,
    quantity: row.quantity,
  };
}

export function classImage(decoded, operator) {
  return {
    decodedPixelSha256: decoded.decodedPixelSha256,
    height: decoded.height,
    kind: decoded.kind,
    linearTransformMilli: linearTransformMilli(operator.transform),
    width: decoded.width,
  };
}

export function broadClassDigest(image) {
  return digestFor("lego.part-identification-source-art-broad-class/1", image);
}

export function exactClassDigest(image, normalizedProgramSha256) {
  return digestFor("lego.part-identification-source-art-exact-class/1", {
    ...image,
    normalizedProgramSha256,
  });
}

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function assertExactProof(proof) {
  const expectedProgramDigest = digestPdfSourceArtImageContribution(proof.normalizedProgram);
  const expectedClassDigest = exactClassDigest(proof.decodedImage, proof.normalizedProgramSha256);
  if (
    proof.normalizedProgramSha256 !== expectedProgramDigest ||
    proof.exactClassDigest !== expectedClassDigest
  ) {
    throw new Error(
      `Source-art proof ${proof.row.identity} does not reproduce its exact normalized program/class digest.`,
    );
  }
  const rendered = proof.proof;
  if (
    rendered?.isolatedAndFullRenderProof !== true ||
    !SHA256_PATTERN.test(rendered.imageSupportMaskSha256) ||
    !SHA256_PATTERN.test(rendered.isolatedImageSupportRgbaSha256) ||
    !SHA256_PATTERN.test(rendered.fullImageSupportRgbaSha256) ||
    !Number.isSafeInteger(rendered.imageSupportPixels) ||
    rendered.imageSupportPixels < 1 ||
    !Number.isSafeInteger(rendered.imageSupportInterferencePixels) ||
    rendered.imageSupportInterferencePixels < 0 ||
    !Number.isSafeInteger(rendered.outsideImageDifferencePixels) ||
    rendered.outsideImageDifferencePixels < 0 ||
    !Number.isSafeInteger(rendered.operationClosureCount) ||
    rendered.operationClosureCount < 1
  ) {
    throw new Error(`Source-art proof ${proof.row.identity} has malformed exact raster evidence.`);
  }
  return (
    rendered.imageSupportInterferencePixels === 0 &&
    rendered.fullImageSupportRgbaSha256 === rendered.isolatedImageSupportRgbaSha256
  );
}

export function semanticIdentityRows(semanticInspection, authority, semanticCommitment) {
  const artifact = semanticInspection.artifact;
  if (
    artifact?.schemaVersion !== "lego.part-identification-legacy-recut-semantic/1" ||
    !isDeepStrictEqual(artifact.authority, authority) ||
    !isDeepStrictEqual(artifact.semanticCommitment, semanticCommitment) ||
    artifact.accounting?.semanticIdentityRelations !== 70 ||
    artifact.accounting?.semanticIdentityPieces !== 107 ||
    !Array.isArray(artifact.semanticIdentityRelations) ||
    artifact.semanticIdentityRelations.length !== 70
  ) {
    throw new Error(
      "Source-art semantic rebound requires the exact verified 70-relation/107-piece semantic handle with closed identity-only authority.",
    );
  }
  const rows = artifact.semanticIdentityRelations.map((row) => ({
    elementId: row.elementId,
    identity: row.identity,
    officialDesignId: row.officialDesignId,
    pageNumber: row.pageNumber,
    quantity: row.quantity,
    stepNumber: row.stepNumber,
  }));
  rows.sort(relationOrder);
  return rows;
}

export function exactPrefix(manifest, expectation) {
  const physical = manifest.callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  const semantic = manifest.callouts.filter(({ evidenceKind }) => evidenceKind !== "part-art");
  if (
    manifest.callouts.length !== expectation.callouts ||
    physical.length !== expectation.partArt ||
    semantic.length !== expectation.semantic ||
    manifest.pagesCropped !== expectation.pagesCropped
  ) {
    throw new Error(
      `Source-art semantic rebound requires the full 359-step 881/859/22 source index; received ${manifest.callouts.length}/${physical.length}/${semantic.length}.`,
    );
  }
  const prefix = physical.filter(({ stepNumber }) => stepNumber <= expectation.lastStep);
  const pieces = prefix.reduce((total, row) => total + row.quantity, 0);
  if (prefix.length !== expectation.prefixRows || pieces !== expectation.prefixPieces) {
    throw new Error(
      `Source-art semantic rebound may measure only the exact step-1-${expectation.lastStep} 187-row/320-piece part-art prefix; received ${prefix.length}/${pieces}.`,
    );
  }
  return { physical, prefix, semantic };
}

export function classifyExactClasses(proofs, semanticByIdentity) {
  const byClass = new Map();
  for (const proof of proofs) {
    if (!assertExactProof(proof)) continue;
    const rows = byClass.get(proof.exactClassDigest) ?? [];
    rows.push(proof);
    byClass.set(proof.exactClassDigest, rows);
  }
  const classes = [];
  const candidates = [];
  for (const [exactDigest, rows] of [...byClass.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    rows.sort((left, right) => relationOrder(left.row, right.row));
    const anchors = rows
      .map(({ row }) => semanticByIdentity.get(row.identity))
      .filter((row) => row !== undefined);
    if (anchors.length === 0) continue;
    const elements = new Set(anchors.map(({ elementId }) => elementId));
    const designs = new Set(anchors.map(({ officialDesignId }) => officialDesignId));
    if (elements.size !== 1 || designs.size !== 1) {
      throw new Error(
        `Exact source-art class ${exactDigest} has ${elements.size}/${designs.size} semantic element/design claims; an image class cannot choose among conflicting anchors.`,
      );
    }
    const elementId = [...elements][0];
    const officialDesignId = [...designs][0];
    const anchorIdentities = anchors.map(({ identity }) => identity).sort();
    const members = rows.map(({ row }) => row.identity);
    classes.push({
      anchorIdentities,
      exactClassDigest: exactDigest,
      contributionCommitment: commitmentFor(
        "lego.part-identification-source-art-image-contributions/1",
        rows.map(({ normalizedProgramSha256, row }) => ({
          identity: row.identity,
          normalizedProgramSha256,
        })),
      ),
      decodedImage: rows[0].decodedImage,
      elementId,
      memberIdentities: members,
      officialDesignId,
    });
    for (const proof of rows) {
      if (semanticByIdentity.has(proof.row.identity)) continue;
      candidates.push({
        exactClassDigest: exactDigest,
        elementId,
        identity: proof.row.identity,
        officialDesignId,
        pageNumber: proof.row.pageNumber,
        quantity: proof.row.quantity,
        stepNumber: proof.row.stepNumber,
      });
    }
  }
  candidates.sort(relationOrder);
  classes.sort((left, right) =>
    left.exactClassDigest < right.exactClassDigest
      ? -1
      : left.exactClassDigest > right.exactClassDigest
        ? 1
        : 0,
  );
  return { candidates, classes };
}

export function applyOfficialCapacity(candidates, semanticRows, availability) {
  const consumed = new Map();
  for (const row of semanticRows) {
    const key = `${row.stepNumber}\0${row.elementId}`;
    consumed.set(key, (consumed.get(key) ?? 0) + row.quantity);
  }
  const groups = new Map();
  for (const row of candidates) {
    const key = `${row.stepNumber}\0${row.elementId}`;
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  const accepted = [];
  const refused = [];
  for (const [key, rows] of [...groups.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    rows.sort(relationOrder);
    const baselineQuantity = consumed.get(key) ?? 0;
    const candidateQuantity = rows.reduce((total, row) => total + row.quantity, 0);
    const official = availability.get(key);
    const officialQuantity = official?.quantity ?? 0;
    const claimedDesigns = new Set(rows.map(({ officialDesignId }) => officialDesignId));
    if (claimedDesigns.size !== 1) {
      throw new Error(
        `Source-art semantic rebound capacity group ${JSON.stringify(key)} contains ${claimedDesigns.size} official design claims; no row may be chosen from a conflicted group.`,
      );
    }
    const claimedDesignId = [...claimedDesigns][0];
    if (officialQuantity < baselineQuantity) {
      throw new Error(
        `Source-art semantic rebound official capacity ${officialQuantity} for ${JSON.stringify(key)} is below the opaque semantic baseline ${baselineQuantity}. Restore the exact official cut instead of retracting verified identity.`,
      );
    }
    const designMatches = official?.designId === claimedDesignId;
    const disposition = designMatches && officialQuantity >= baselineQuantity + candidateQuantity;
    for (const row of rows) {
      const published = {
        ...row,
        baselineSemanticQuantity: baselineQuantity,
        candidateGroupQuantity: candidateQuantity,
        officialStepElementQuantity: officialQuantity,
      };
      if (disposition) accepted.push(published);
      else
        refused.push({
          ...published,
          refusalReason: designMatches
            ? "official-step-element-capacity-insufficient"
            : "official-step-element-design-conflict",
        });
    }
  }
  accepted.sort(relationOrder);
  refused.sort(relationOrder);
  return { accepted, refused };
}

export function safeRow(row, evidenceMethod) {
  return {
    elementId: row.elementId,
    evidenceMethod,
    identity: row.identity,
    officialDesignId: row.officialDesignId,
    pageNumber: row.pageNumber,
    quantity: row.quantity,
    stepNumber: row.stepNumber,
  };
}

export function rosterCommitments(rosters) {
  return Object.fromEntries(
    Object.entries(rosters).map(([name, rows]) => [
      name,
      commitmentFor(`lego.part-identification-source-art-semantic-rebound-${name}/1`, rows),
    ]),
  );
}

export function publishedRosters(
  scan,
  classification,
  capacity,
  semanticRows,
  safeIdentity,
  residual,
) {
  const byIdentity = (left, right) =>
    left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0;
  return {
    acceptedSourceArt: capacity.accepted.map(({ identity }) => ({ identity })),
    candidateSourceArt: classification.candidates,
    exactClassProofs: scan.proofs
      .map((row) => ({
        exactClassDigest: row.exactClassDigest,
        fullImageSupportRgbaSha256: row.proof.fullImageSupportRgbaSha256,
        identity: row.row.identity,
        imageSupportInterferencePixels: row.proof.imageSupportInterferencePixels,
        imageSupportMaskSha256: row.proof.imageSupportMaskSha256,
        imageSupportPixels: row.proof.imageSupportPixels,
        isolatedImageSupportRgbaSha256: row.proof.isolatedImageSupportRgbaSha256,
        normalizedProgramSha256: row.normalizedProgramSha256,
        operationClosureCount: row.proof.operationClosureCount,
        outsideImageDifferencePixels: row.proof.outsideImageDifferencePixels,
      }))
      .sort(byIdentity),
    refusedSourceArt: capacity.refused,
    residual,
    safeIdentity,
    scan: scan.scans
      .map((row) => ({
        broadClassDigest: row.broadClassDigest,
        containmentCandidateCount: row.containmentCandidateCount,
        identity: row.identity,
        labelCount: row.labelCount,
        operatorIndex: row.operatorIndex,
      }))
      .sort(byIdentity),
    semanticAnchors: semanticRows,
  };
}

export function assertPinnedResult(accounting, commitments, pins) {
  if (!isDeepStrictEqual(accounting, pins.expectedAccounting)) {
    throw new Error(
      `Source-art semantic rebound accounting moved from ${JSON.stringify(pins.expectedAccounting)} to ${JSON.stringify(accounting)}. Re-review the complete rosters rather than preserving aggregate counts.`,
    );
  }
  if (!isDeepStrictEqual(commitments, pins.expectedCommitments)) {
    throw new Error(
      `Source-art semantic rebound complete roster pins moved from ${JSON.stringify(pins.expectedCommitments)} to ${JSON.stringify(commitments)}. Re-review exact membership instead of preserving counts.`,
    );
  }
}

function exactRows(artifact, name, keys) {
  const expected = [...keys].sort().join(",");
  for (const [index, row] of artifact.rosters[name].entries()) {
    if (Object.keys(row).sort().join(",") !== expected) {
      throw new Error(
        `Source-art semantic rebound ${name} row ${index} must contain exactly [${expected}]; assignment, transform, catalog, document, placement, and completion fields are forbidden.`,
      );
    }
  }
}

export function assertAuthorityAndRowKeys(artifact, authority) {
  if (!isDeepStrictEqual(artifact.authority, authority)) {
    throw new Error("Source-art semantic rebound authority must retain its exact closed object.");
  }
  exactRows(artifact, "acceptedSourceArt", ["identity"]);
  exactRows(artifact, "candidateSourceArt", [
    "elementId",
    "exactClassDigest",
    "identity",
    "officialDesignId",
    "pageNumber",
    "quantity",
    "stepNumber",
  ]);
  exactRows(artifact, "exactClassProofs", [
    "exactClassDigest",
    "fullImageSupportRgbaSha256",
    "identity",
    "imageSupportInterferencePixels",
    "imageSupportMaskSha256",
    "imageSupportPixels",
    "isolatedImageSupportRgbaSha256",
    "normalizedProgramSha256",
    "operationClosureCount",
    "outsideImageDifferencePixels",
  ]);
  exactRows(artifact, "refusedSourceArt", [
    "baselineSemanticQuantity",
    "candidateGroupQuantity",
    "elementId",
    "exactClassDigest",
    "identity",
    "officialDesignId",
    "officialStepElementQuantity",
    "pageNumber",
    "quantity",
    "refusalReason",
    "stepNumber",
  ]);
  exactRows(artifact, "residual", ["identity", "pageNumber", "quantity", "stepNumber"]);
  exactRows(artifact, "safeIdentity", [
    "elementId",
    "evidenceMethod",
    "identity",
    "officialDesignId",
    "pageNumber",
    "quantity",
    "stepNumber",
  ]);
  exactRows(artifact, "scan", [
    "broadClassDigest",
    "containmentCandidateCount",
    "identity",
    "labelCount",
    "operatorIndex",
  ]);
  exactRows(artifact, "semanticAnchors", [
    "elementId",
    "identity",
    "officialDesignId",
    "pageNumber",
    "quantity",
    "stepNumber",
  ]);
  const classKeys = [
    "anchorIdentities",
    "contributionCommitment",
    "decodedImage",
    "elementId",
    "exactClassDigest",
    "memberIdentities",
    "officialDesignId",
  ]
    .sort()
    .join(",");
  for (const [index, row] of artifact.exactClasses.entries()) {
    if (Object.keys(row).sort().join(",") !== classKeys) {
      throw new Error(`Source-art semantic rebound exact class ${index} has forbidden fields.`);
    }
  }
}

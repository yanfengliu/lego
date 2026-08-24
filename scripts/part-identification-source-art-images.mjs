import { createHash } from "node:crypto";

export const PDF_EMBEDDED_SOURCE_ART_MEASUREMENT_SCHEMA =
  "lego.pdf-embedded-source-art-measurement/1";

const EXPECTED_PDFJS_VERSION = "5.4.149";
const RASTER_SCALE = 8;
const MAX_WITNESSES = 16;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const IMAGE_WAIT_MS = 5_000;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function exactKeys(value, keys) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",")
  );
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertInclusiveBounds(value, label) {
  if (
    !exactKeys(value, ["bottom", "left", "right", "top"]) ||
    Object.values(value).some(
      (coordinate) => !Number.isSafeInteger(coordinate) || coordinate < 0,
    ) ||
    value.left > value.right ||
    value.top > value.bottom
  ) {
    throw new Error(`${label} must be an exact nonnegative inclusive pixel rectangle.`);
  }
  return value;
}

function canonicalIdentity(witness) {
  return `p${witness.pageNumber}|q${witness.quantity}|x${witness.xPt.toFixed(3)}|y${witness.yPt.toFixed(3)}`;
}

function assertWitnesses(witnesses) {
  if (!Array.isArray(witnesses) || witnesses.length < 1 || witnesses.length > MAX_WITNESSES) {
    throw new Error(
      `Embedded-source-art measurement requires 1..${MAX_WITNESSES} bounded PDF image witnesses; received ${Array.isArray(witnesses) ? witnesses.length : typeof witnesses}.`,
    );
  }
  const keys = new Set();
  const identities = new Set();
  const operators = new Set();
  for (const [position, witness] of witnesses.entries()) {
    if (
      !exactKeys(witness, [
        "componentBoundsPxAtScale8",
        "expectedOperatorIndex",
        "identity",
        "key",
        "pageNumber",
        "quantity",
        "xPt",
        "yPt",
      ]) ||
      typeof witness.key !== "string" ||
      witness.key.length < 1 ||
      witness.key.length > 96 ||
      typeof witness.identity !== "string" ||
      witness.identity.length < 1 ||
      witness.identity.length > 128 ||
      !Number.isSafeInteger(witness.expectedOperatorIndex) ||
      witness.expectedOperatorIndex < 0 ||
      witness.expectedOperatorIndex > 100_000 ||
      !Number.isSafeInteger(witness.pageNumber) ||
      witness.pageNumber < 1 ||
      witness.pageNumber > 1_000 ||
      !Number.isSafeInteger(witness.quantity) ||
      witness.quantity < 1 ||
      witness.quantity > 999 ||
      !finiteNumber(witness.xPt) ||
      !finiteNumber(witness.yPt)
    ) {
      throw new Error(
        `Embedded-source-art witness at position ${position} must contain exactly a bounded key, identity, pageNumber, expectedOperatorIndex, quantity, xPt, yPt, and componentBoundsPxAtScale8.`,
      );
    }
    assertInclusiveBounds(
      witness.componentBoundsPxAtScale8,
      `Embedded-source-art witness ${JSON.stringify(witness.key)} componentBoundsPxAtScale8`,
    );
    const expectedIdentity = canonicalIdentity(witness);
    if (witness.identity !== expectedIdentity) {
      throw new Error(
        `Embedded-source-art witness ${JSON.stringify(witness.key)} identity was ${JSON.stringify(witness.identity)}; exact one-based PDF identity is ${JSON.stringify(expectedIdentity)}.`,
      );
    }
    const operatorKey = `${witness.pageNumber}:${witness.expectedOperatorIndex}`;
    if (keys.has(witness.key) || identities.has(witness.identity) || operators.has(operatorKey)) {
      throw new Error(
        `Embedded-source-art witness ${JSON.stringify(witness.key)} duplicates a key, callout identity, or page/operator pin.`,
      );
    }
    keys.add(witness.key);
    identities.add(witness.identity);
    operators.add(operatorKey);
  }
  return witnesses;
}

async function resolvedPageImage(page, objectId, witnessKey) {
  if (page.objs.has(objectId)) return page.objs.get(objectId);
  if (page.commonObjs.has(objectId)) return page.commonObjs.get(objectId);
  const store = objectId.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (outcome, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome(value);
    };
    const timer = setTimeout(
      () =>
        finish(
          reject,
          new Error(
            `Embedded-source-art witness ${JSON.stringify(witnessKey)} image object ${JSON.stringify(objectId)} did not resolve within ${IMAGE_WAIT_MS} ms.`,
          ),
        ),
      IMAGE_WAIT_MS,
    );
    try {
      store.get(objectId, (value) => finish(resolve, value));
    } catch (cause) {
      finish(
        reject,
        new Error(
          `Embedded-source-art witness ${JSON.stringify(witnessKey)} could not read image object ${JSON.stringify(objectId)}.`,
          { cause },
        ),
      );
    }
  });
}

function embeddedSourceArtDigest(image) {
  return sha256(
    Buffer.from(
      `lego.pdf-embedded-source-art/1\0${JSON.stringify({
        decodedBytes: image.decodedBytes,
        decodedPixelSha256: image.decodedPixelSha256,
        height: image.height,
        kind: image.kind,
        linearTransform: image.transform.slice(0, 4),
        width: image.width,
      })}`,
    ),
  );
}

function projectedBounds(transform, pageHeightPt, scale = RASTER_SCALE) {
  const [a, b, c, d, e, f] = transform;
  if (
    !transform.every(finiteNumber) ||
    !finiteNumber(pageHeightPt) ||
    pageHeightPt <= 0 ||
    !Number.isSafeInteger(scale) ||
    scale < 1 ||
    b !== 0 ||
    c !== 0 ||
    a <= 0 ||
    d <= 0
  ) {
    return null;
  }
  return {
    left: Math.floor(e * scale),
    top: Math.floor((pageHeightPt - (f + d)) * scale),
    right: Math.ceil((e + a) * scale) - 1,
    bottom: Math.ceil((pageHeightPt - f) * scale) - 1,
  };
}

function contains(outer, inner) {
  return (
    outer !== null &&
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

function enumerateImageOperators(pdfjs, operatorList, pageHeightPt, witnessKey) {
  let transform = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    if (fn === pdfjs.OPS.save) stack.push([...transform]);
    else if (fn === pdfjs.OPS.restore) {
      if (stack.length === 0) {
        throw new Error(
          `Embedded-source-art witness ${JSON.stringify(witnessKey)} encountered an unmatched PDF restore at operator ${index}.`,
        );
      }
      transform = stack.pop();
    } else if (fn === pdfjs.OPS.transform) {
      if (!Array.isArray(args) || args.length !== 6 || args.some((value) => !finiteNumber(value))) {
        throw new Error(
          `Embedded-source-art witness ${JSON.stringify(witnessKey)} encountered an invalid PDF transform at operator ${index}.`,
        );
      }
      transform = pdfjs.Util.transform(transform, args);
    } else if (fn === pdfjs.OPS.paintImageXObject) {
      const objectId = args?.[0];
      if (typeof objectId !== "string" || objectId.length < 1 || objectId.length > 128) {
        throw new Error(
          `Embedded-source-art witness ${JSON.stringify(witnessKey)} image operator ${index} has no bounded object id.`,
        );
      }
      images.push({
        objectId,
        operatorIndex: index,
        projectedBoundsPxAtScale8: projectedBounds(transform, pageHeightPt),
        transform: [...transform],
      });
    }
  }
  if (stack.length !== 0) {
    throw new Error(
      `Embedded-source-art witness ${JSON.stringify(witnessKey)} ended with ${stack.length} unmatched PDF save operators.`,
    );
  }
  return images;
}

function selectImageOperator(images, witness) {
  const candidates = images.filter((image) =>
    contains(image.projectedBoundsPxAtScale8, witness.componentBoundsPxAtScale8),
  );
  if (candidates.length !== 1) {
    throw new Error(
      `Embedded-source-art witness ${JSON.stringify(witness.key)} geometry selected ${candidates.length} image paints for component ${JSON.stringify(witness.componentBoundsPxAtScale8)}; expected exactly one. Candidate operators: ${JSON.stringify(candidates.map(({ operatorIndex }) => operatorIndex))}.`,
    );
  }
  const selected = candidates[0];
  if (selected.operatorIndex !== witness.expectedOperatorIndex) {
    throw new Error(
      `Embedded-source-art witness ${JSON.stringify(witness.key)} geometry selected operator ${selected.operatorIndex}, not pinned control ${witness.expectedOperatorIndex}. Re-measure the exact source instead of sliding to a nearby image.`,
    );
  }
  return selected;
}

function assertExactLabel(pdfjs, textContent, witness) {
  const expected = `${witness.quantity}x`;
  const exact = textContent.items.filter(
    (item) =>
      item?.str === expected &&
      Array.isArray(item.transform) &&
      Math.abs(Number(item.transform[4]) - witness.xPt) < 0.001 &&
      Math.abs(Number(item.transform[5]) - witness.yPt) < 0.001,
  );
  if (exact.length !== 1) {
    throw new Error(
      `Embedded-source-art witness ${JSON.stringify(witness.key)} expected exactly one PDF text ${JSON.stringify(expected)} at ${witness.xPt},${witness.yPt}; found ${exact.length}.`,
    );
  }
  const identity = pdfjs.Util.transform([1, 0, 0, 1, 0, 0], exact[0].transform);
  if (identity[4] !== exact[0].transform[4] || identity[5] !== exact[0].transform[5]) {
    throw new Error(
      `Embedded-source-art witness ${JSON.stringify(witness.key)} text transform control failed.`,
    );
  }
}

function assertDecodedImage(image, witnessKey) {
  const width = image?.width;
  const height = image?.height;
  const kind = image?.kind;
  const data = image?.data;
  const expectedBytes =
    kind === 2 && Number.isSafeInteger(width) && Number.isSafeInteger(height)
      ? width * height * 3
      : null;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_IMAGE_PIXELS ||
    expectedBytes === null ||
    !ArrayBuffer.isView(data) ||
    data.BYTES_PER_ELEMENT !== 1 ||
    data.byteLength !== expectedBytes ||
    data.byteLength > MAX_IMAGE_BYTES
  ) {
    throw new Error(
      `Embedded-source-art witness ${JSON.stringify(witnessKey)} resolved an unbounded image or unsupported decoded kind/stride.`,
    );
  }
  return { data, height, kind, width };
}

export async function measurePdfSourceArtImages({ pdfBytes, expectedPdfSha256, witnesses }) {
  assertWitnesses(witnesses);
  if (!(pdfBytes instanceof Uint8Array) || pdfBytes.byteLength < 1) {
    throw new Error("Embedded-source-art measurement requires nonempty authenticated PDF bytes.");
  }
  if (typeof expectedPdfSha256 !== "string" || !SHA256.test(expectedPdfSha256)) {
    throw new Error(
      "Embedded-source-art measurement requires an expected sha256:<64 lowercase hex> PDF digest.",
    );
  }

  // Own the measured bytes before the first await so caller mutation cannot swap
  // the authenticated source while pdfjs is loading or decoding it.
  const authenticatedPdfBytes = Uint8Array.from(pdfBytes);
  const authenticatedWitnesses = witnesses.map((witness) => ({
    ...witness,
    componentBoundsPxAtScale8: { ...witness.componentBoundsPxAtScale8 },
  }));
  const observedPdfSha256 = sha256(authenticatedPdfBytes);
  if (observedPdfSha256 !== expectedPdfSha256) {
    throw new Error(
      `Embedded-source-art measurement read PDF ${observedPdfSha256}, not exact expected source ${expectedPdfSha256}.`,
    );
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (pdfjs.version !== EXPECTED_PDFJS_VERSION) {
    throw new Error(
      `Embedded-source-art measurement loaded pdfjs ${JSON.stringify(pdfjs.version)}, not pinned ${EXPECTED_PDFJS_VERSION}.`,
    );
  }
  const documentHandle = await pdfjs.getDocument({
    data: authenticatedPdfBytes,
    isEvalSupported: false,
  }).promise;
  const byKey = new Map();
  try {
    const pageNumbers = [
      ...new Set(authenticatedWitnesses.map(({ pageNumber }) => pageNumber)),
    ].sort((left, right) => left - right);
    for (const pageNumber of pageNumbers) {
      const page = await documentHandle.getPage(pageNumber);
      try {
        const pageWitnesses = authenticatedWitnesses.filter(
          (witness) => witness.pageNumber === pageNumber,
        );
        const [operatorList, textContent] = await Promise.all([
          page.getOperatorList(),
          page.getTextContent(),
        ]);
        const pageHeightPt = page.getViewport({ scale: 1 }).height;
        const images = enumerateImageOperators(
          pdfjs,
          operatorList,
          pageHeightPt,
          pageWitnesses[0].key,
        );
        for (const witness of pageWitnesses) {
          assertExactLabel(pdfjs, textContent, witness);
          const operator = selectImageOperator(images, witness);
          const image = assertDecodedImage(
            await resolvedPageImage(page, operator.objectId, witness.key),
            witness.key,
          );
          const decodedBytes = Buffer.from(
            image.data.buffer,
            image.data.byteOffset,
            image.data.byteLength,
          );
          const measured = {
            componentBoundsPxAtScale8: witness.componentBoundsPxAtScale8,
            decodedBytes: decodedBytes.length,
            decodedPixelSha256: sha256(decodedBytes),
            height: image.height,
            identity: witness.identity,
            key: witness.key,
            kind: image.kind,
            label: `${witness.quantity}x`,
            labelTransformPt: [witness.xPt, witness.yPt],
            operatorIndex: operator.operatorIndex,
            pageNumber,
            projectedBoundsPxAtScale8: operator.projectedBoundsPxAtScale8,
            transform: operator.transform,
            width: image.width,
          };
          byKey.set(witness.key, {
            ...measured,
            embeddedSourceArtSha256: embeddedSourceArtDigest(measured),
          });
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await documentHandle.destroy();
  }

  return {
    admissionAuthority: "none",
    claim: "embedded-source-art-only",
    observedPdfSha256,
    pageNumberConvention: "pdf-one-based",
    pdfjsVersion: pdfjs.version,
    schemaVersion: PDF_EMBEDDED_SOURCE_ART_MEASUREMENT_SCHEMA,
    semanticIdentityClaimed: false,
    witnesses: authenticatedWitnesses.map(({ key }) => byKey.get(key)),
  };
}

export const __testOnly = Object.freeze({
  assertDecodedImage,
  assertWitnesses,
  embeddedSourceArtDigest,
  enumerateImageOperators,
  projectedBounds,
  selectImageOperator,
});

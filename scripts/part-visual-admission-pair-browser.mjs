function dataUrl(bytes) {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export async function createAndVerifyPair(page, sourceBytes, candidateBytes, label, layout) {
  return page.evaluate(
    async ({ sourceUrl, candidateUrl, label, panelWidth, panelHeight, header, gutter }) => {
      const load = (url) =>
        new Promise((accept, reject) => {
          const image = new globalThis.Image();
          image.onload = () => accept(image);
          image.onerror = () => reject(new Error(`Could not decode ${label}.`));
          image.src = url;
        });
      const digest = async (bytes) => {
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        return `sha256:${[...new Uint8Array(hash)]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")}`;
      };
      const source = await load(sourceUrl);
      const candidate = await load(candidateUrl);
      if (
        source.naturalWidth !== panelWidth ||
        source.naturalHeight !== panelHeight ||
        candidate.naturalWidth !== panelWidth ||
        candidate.naturalHeight !== panelHeight
      ) {
        throw new Error(`${label} source/candidate must both decode to 640x640.`);
      }
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = panelWidth * 2 + gutter;
      canvas.height = panelHeight + header;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error(`${label} has no 2D canvas context.`);
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111111";
      context.font = "16px sans-serif";
      context.textBaseline = "middle";
      context.fillText(`${label} - source`, 8, header / 2);
      context.fillText("candidate", panelWidth + gutter + 8, header / 2);
      context.drawImage(source, 0, header);
      context.drawImage(candidate, panelWidth + gutter, header);
      const pairUrl = canvas.toDataURL("image/png");
      const pair = await load(pairUrl);
      const verify = globalThis.document.createElement("canvas");
      verify.width = canvas.width;
      verify.height = canvas.height;
      const verifyContext = verify.getContext("2d", { willReadFrequently: true });
      if (verifyContext === null) throw new Error(`${label} has no verification context.`);
      verifyContext.imageSmoothingEnabled = false;
      verifyContext.drawImage(pair, 0, 0);
      const original = globalThis.document.createElement("canvas");
      original.width = panelWidth;
      original.height = panelHeight;
      const originalContext = original.getContext("2d", { willReadFrequently: true });
      if (originalContext === null) throw new Error(`${label} has no original-image context.`);
      originalContext.imageSmoothingEnabled = false;
      const exactRegion = async (image, x) => {
        originalContext.clearRect(0, 0, panelWidth, panelHeight);
        originalContext.drawImage(image, 0, 0);
        const expected = originalContext.getImageData(0, 0, panelWidth, panelHeight).data;
        const observed = verifyContext.getImageData(x, header, panelWidth, panelHeight).data;
        if (expected.length !== observed.length) return null;
        for (let index = 0; index < expected.length; index += 1) {
          if (expected[index] !== observed[index]) return null;
        }
        return digest(expected);
      };
      const sourceDecodedRgbaSha256 = await exactRegion(source, 0);
      const candidateDecodedRgbaSha256 = await exactRegion(candidate, panelWidth + gutter);
      if (sourceDecodedRgbaSha256 === null || candidateDecodedRgbaSha256 === null) {
        throw new Error(`${label} pair regions do not exactly reproduce their bound PNG pixels.`);
      }
      return {
        pairUrl,
        width: pair.naturalWidth,
        height: pair.naturalHeight,
        sourceDecodedRgbaSha256,
        candidateDecodedRgbaSha256,
      };
    },
    {
      sourceUrl: dataUrl(sourceBytes),
      candidateUrl: dataUrl(candidateBytes),
      label,
      panelWidth: layout.panelWidth,
      panelHeight: layout.panelHeight,
      header: layout.headerHeight,
      gutter: layout.gutterWidth,
    },
  );
}

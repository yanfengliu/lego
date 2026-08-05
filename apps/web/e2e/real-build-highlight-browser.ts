import { createHash } from "node:crypto";

import type { Page } from "@playwright/test";

import {
  HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY,
  HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION,
  HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA,
  HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS,
  parseHighlightExclusivityRenderCases,
} from "./real-build-highlight-compatibility";

export interface HighlightExclusivityBrowserUrls {
  readonly contractUrl: string;
  readonly kernelUrl: string;
  readonly commandsUrl: string;
  readonly renderingUrl: string;
}

interface BrowserPackedCase {
  readonly caseId: string;
  readonly pieceKeys: readonly string[];
  readonly highlightMaskBase64: string;
  readonly pieceMaskBase64: readonly string[];
}

const digest = (value: Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function packedMask(data: string, pixelCount: number) {
  const bytes = Buffer.from(data, "base64");
  const expectedBytes = Math.ceil(pixelCount / 8);
  if (bytes.length !== expectedBytes || bytes.toString("base64") !== data) {
    throw new TypeError(
      `Browser highlight mask must be canonical base64 for exactly ${expectedBytes} packed bytes; received ${bytes.length}.`,
    );
  }
  return {
    encoding: "base64-lsb0-bitset/1" as const,
    byteLength: bytes.length,
    digest: digest(bytes),
    data,
  };
}

/** Captures fixed policy-compatibility cases through the same browser renderer as the build. */
export async function captureHighlightExclusivityRenderCases(
  page: Page,
  urls: HighlightExclusivityBrowserUrls,
): Promise<Uint8Array> {
  const captured = (await page.evaluate(
    async ({ caseRegistry, layouts, renderSettings, urls: browserUrls }) => {
      const kernel = await import(/* @vite-ignore */ browserUrls.kernelUrl);
      const commands = await import(/* @vite-ignore */ browserUrls.commandsUrl);
      const rendering = await import(/* @vite-ignore */ browserUrls.renderingUrl);
      const contract = await import(/* @vite-ignore */ browserUrls.contractUrl);

      const encodePackedBase64 = (mask: Uint8Array): string => {
        const packed = new Uint8Array(Math.ceil(mask.length / 8));
        for (let index = 0; index < mask.length; index += 1) {
          if (mask[index] === 1) packed[index >> 3]! |= 1 << (index & 7);
        }
        let binary = "";
        const chunkSize = 16_384;
        for (let offset = 0; offset < packed.length; offset += chunkSize) {
          binary += String.fromCharCode(...packed.subarray(offset, offset + chunkSize));
        }
        return btoa(binary);
      };

      const renderMask = (
        document: { readonly parts: readonly { readonly id: string }[] },
        highlightedPartIds: readonly string[],
      ): Uint8Array => {
        const highlighted = new Set(highlightedPartIds);
        const painted = {
          ...document,
          parts: document.parts.map((part) =>
            highlighted.has(part.id) ? { ...part, colorId: "builtin:magenta" } : part,
          ),
        };
        const scene = rendering.deriveBrickScene(painted, { finish: renderSettings.finish });
        let renderer: ReturnType<typeof rendering.createInstructionRenderer> | null = null;
        try {
          renderer = rendering.createInstructionRenderer({
            width: renderSettings.width,
            height: renderSettings.height,
          });
          rendering.setInstructionSilhouetteMode(scene.root, renderSettings.silhouetteMode);
          const camera = rendering.createOrthographicViewCamera(
            {
              azimuthDegrees: renderSettings.azimuthDegrees,
              elevationDegrees: renderSettings.elevationDegrees,
              pixelsPerUnit: renderSettings.pixelsPerUnit,
              centerXPx: renderSettings.centerXPx,
              centerYPx: renderSettings.centerYPx,
            },
            {
              widthPx: renderSettings.width,
              heightPx: renderSettings.height,
              target: [0, 0, 0],
              sceneRadius: 60,
            },
          );
          const pixels = renderer.render(scene.root, camera);
          return contract.instructionSilhouetteMasks(
            pixels,
            renderSettings.width,
            renderSettings.height,
            Number.parseInt(renderSettings.probeHex, 16),
          ).probe;
        } finally {
          try {
            renderer?.dispose();
          } finally {
            scene.dispose();
          }
        }
      };

      const results: BrowserPackedCase[] = [];
      for (let caseIndex = 0; caseIndex < caseRegistry.length; caseIndex += 1) {
        const registered = caseRegistry[caseIndex]!;
        const layout = layouts[caseIndex]!;
        if (registered.caseId !== layout.caseId) {
          throw new TypeError(
            `Browser compatibility layout ${layout.caseId} does not match fixed registry ${registered.caseId}.`,
          );
        }
        let document = kernel.createEmptyBrickDocument({
          id: `highlight-compatibility-${registered.caseId}`,
          name: `Highlight compatibility ${registered.caseId}`,
        });
        const placedPartIds: string[] = [];
        for (const placement of [
          { part: "builtin:plate-6x6", at: [0, 8, 0] },
          ...layout.positions.map((at) => ({ part: "builtin:plate-1x1", at })),
        ]) {
          const prior = new Set(
            (document.parts as readonly { readonly id: string }[]).map(({ id }) => id),
          );
          const transaction = commands.createPlacePartTransaction(document, {
            catalogPartId: placement.part,
            colorId: "builtin:black",
            transform: { positionLdu: placement.at, orientationId: "upright-yaw-0" },
          });
          document = kernel.applyBuildOperations(document, transaction.operations);
          const added = (document.parts as readonly { readonly id: string }[]).filter(
            ({ id }) => !prior.has(id),
          );
          if (added.length !== 1) {
            throw new TypeError(
              `Compatibility case ${registered.caseId} placement must add one part; received ${added.length}.`,
            );
          }
          if (placement.part === "builtin:plate-1x1") placedPartIds.push(added[0]!.id);
        }
        const validation = kernel.validateBrickDocument(document);
        const blocking = validation.issues.filter(
          ({ severity }: { readonly severity: string }) => severity === "error",
        );
        if (blocking.length > 0 || placedPartIds.length !== registered.pieceKeys.length) {
          throw new TypeError(
            `Compatibility case ${registered.caseId} must be a valid two-piece-on-base document; received ${blocking.length} errors and ${placedPartIds.length} measured pieces.`,
          );
        }
        const highlightMask = renderMask(document, placedPartIds);
        const pieceMasks = placedPartIds.map((partId) => renderMask(document, [partId]));
        results.push({
          caseId: registered.caseId,
          pieceKeys: [...registered.pieceKeys],
          highlightMaskBase64: encodePackedBase64(highlightMask),
          pieceMaskBase64: pieceMasks.map(encodePackedBase64),
        });
      }
      return results;
    },
    {
      caseRegistry: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY,
      layouts: [
        {
          caseId: "adjacent-small-pieces",
          positions: [
            [-10, 0, -10],
            [10, 0, -10],
          ],
        },
        {
          caseId: "separated-small-pieces",
          positions: [
            [-30, 0, -10],
            [30, 0, -10],
          ],
        },
      ],
      renderSettings: HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS,
      urls,
    },
  )) as BrowserPackedCase[];

  const pixelCount =
    HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.width * HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.height;
  const value = {
    schemaVersion: HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA,
    registryVersion: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION,
    render: HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS,
    cases: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY.map((registered, index) => {
      const entry = captured[index];
      if (
        entry?.caseId !== registered.caseId ||
        JSON.stringify(entry.pieceKeys) !== JSON.stringify(registered.pieceKeys) ||
        entry.pieceMaskBase64.length !== registered.pieceKeys.length
      ) {
        throw new TypeError(
          `Browser highlight capture ${index} must reproduce fixed case ${registered.caseId} and its ordered piece registry.`,
        );
      }
      return {
        caseId: registered.caseId,
        width: HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.width,
        height: HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.height,
        pieceKeys: [...registered.pieceKeys],
        highlightMask: packedMask(entry.highlightMaskBase64, pixelCount),
        pieceMasks: entry.pieceMaskBase64.map((data) => packedMask(data, pixelCount)),
      };
    }),
  };
  const bytes = new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  parseHighlightExclusivityRenderCases(bytes);
  return bytes;
}

import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  BRICK_KERNEL_MODULE_URL,
  CATALOG_MODULE_URL,
  RENDERING_MODULE_URL,
} from "./workspace-module";

const OUT = "output/playwright/proper-orientation-runtime";
const WIDTH = 640;
const HEIGHT = 480;
const RAPIER_MODULE_URL: string = "/src/physics/rapier-world.ts";
const EXPECTED_VIEWS = ["back", "front", "isometric", "left", "right", "top", "underside"] as const;

test("proper orientations preserve collision and compound semantics in real browser renders", async ({
  page,
}) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(String(error)));

  await page.goto("/visual-admission.html");
  const observation = await page.evaluate(
    async ({ catalogUrl, height, kernelUrl, rapierUrl, renderingUrl, width }) => {
      const catalog = await import(/* @vite-ignore */ catalogUrl);
      const kernel = await import(/* @vite-ignore */ kernelUrl);
      const rapier = await import(/* @vite-ignore */ rapierUrl);
      const rendering = await import(/* @vite-ignore */ renderingUrl);

      type Part = {
        readonly id: string;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly transform: {
          readonly positionLdu: readonly [number, number, number];
          readonly orientationId: string;
        };
        readonly submodelId: string;
        readonly stepId: string;
        readonly semanticTags: readonly string[];
        readonly provenance: { readonly source: "manual" };
      };
      type Edge = {
        readonly id: string;
        readonly kind: "stud-tube";
        readonly a: { readonly partId: string; readonly portId: string };
        readonly b: { readonly partId: string; readonly portId: string };
        readonly provenance: { readonly source: "manual" };
      };

      const part = (
        id: string,
        catalogPartId: string,
        positionLdu: readonly [number, number, number],
        colorId = "builtin:light-bluish-gray",
      ): Part => ({
        id,
        catalogPartId,
        colorId,
        transform: { positionLdu, orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: [],
        provenance: { source: "manual" },
      });
      const edge = (id: string, lowerPartId: string, upperPartId: string): Edge => ({
        id,
        kind: "stud-tube",
        a: { partId: lowerPartId, portId: "stud:0:0" },
        b: { partId: upperPartId, portId: "undersideClutch:0:0" },
        provenance: { source: "manual" },
      });
      const documentOf = (
        id: string,
        parts: readonly Part[],
        connections: readonly Edge[] = [],
      ) => {
        const base = kernel.createEmptyBrickDocument({ id, name: id });
        return {
          ...base,
          parts: [...parts],
          connections: [...connections],
          submodels: [{ ...base.submodels[0], partIds: parts.map(({ id: partId }) => partId) }],
          steps: [{ ...base.steps[0], partIds: parts.map(({ id: partId }) => partId) }],
        };
      };
      const rotate = (orientationId: string, source: Part): Part => ({
        ...source,
        transform: kernel.composeRigidTransforms(
          { positionLdu: [0, 0, 0], orientationId },
          source.transform,
        ),
      });
      const codes = (parts: readonly Part[]) =>
        kernel.findCatalogCollisions(parts, []).map(({ code }: { readonly code: string }) => code);
      const requireCondition = (condition: boolean, message: string): void => {
        if (!condition) throw new TypeError(message);
      };

      const basePlates = [
        part("lower", "builtin:plate-1x1", [0, 0, 0]),
        part("middle", "builtin:plate-1x1", [0, -8, 0]),
        part("upper", "builtin:plate-1x1", [0, -16, 0]),
      ];
      const plateEdges = [
        edge("lower-middle", "lower", "middle"),
        edge("middle-upper", "middle", "upper"),
      ];
      const wedge = part("wedge", "builtin:wedge-plate-2x4-left", [0, 0, 0], "builtin:yellow");
      const wedgeClear = part("clear", "builtin:brick-1x1", [20, -8, -30], "builtin:green");
      const wedgeSolid = part("solid", "builtin:brick-1x1", [-10, -8, -30], "builtin:red");
      const ring = part(
        "ring",
        "builtin:corner-plate-5x5-quarter-ring",
        [0, 0, 0],
        "builtin:yellow",
      );
      const ringClear = part("clear", "builtin:brick-1x1", [20, -8, -20], "builtin:green");
      const ringSolid = part("solid", "builtin:brick-1x1", [50, -8, -50], "builtin:red");
      const allOrientationRows: {
        orientationId: string;
        platePartIssues: readonly string[];
        wedgeShapeKinds: readonly string[];
        ringShapeKinds: readonly string[];
        rapierPoseCount: number;
      }[] = [];
      let rapierCreated = 0;
      let rapierDisposed = 0;

      for (const orientation of catalog.PROPER_ORIENTATIONS as readonly {
        readonly id: string;
        readonly matrix: readonly number[];
      }[]) {
        const plateParts = basePlates.map((source) => rotate(orientation.id, source));
        const plateDocument = documentOf(`plate-${orientation.id}`, plateParts, plateEdges);
        const plateReport = kernel.validateBrickDocument(plateDocument);
        const partIssueCodes = plateReport.issues
          .map(({ code }: { readonly code: string }) => code)
          .filter((code: string) => code.startsWith("PART_"));
        requireCondition(
          partIssueCodes.length === 0,
          `${orientation.id} changed the plate collision verdict: ${partIssueCodes.join(",")}`,
        );
        const indexedPlateIssues = kernel
          .createCollisionWorld(plateParts.slice(0, 2))
          .findCollisionsWith(plateParts[2], [plateEdges[1]])
          .map(({ code }: { readonly code: string }) => code);
        requireCondition(
          indexedPlateIssues.length === 0,
          `${orientation.id} changed the indexed plate allowance: ${indexedPlateIssues.join(",")}`,
        );

        const rotatedWedge = rotate(orientation.id, wedge);
        const rotatedWedgeClear = rotate(orientation.id, wedgeClear);
        const rotatedWedgeSolid = rotate(orientation.id, wedgeSolid);
        requireCondition(
          codes([rotatedWedge, rotatedWedgeClear]).length === 0,
          `${orientation.id} filled the wedge's clear corner`,
        );
        requireCondition(
          codes([rotatedWedge, rotatedWedgeSolid]).includes("PART_BODY_COLLISION"),
          `${orientation.id} lost the wedge's solid corner`,
        );
        const wedgeWorld = kernel.createCollisionWorld([rotatedWedge]);
        requireCondition(
          wedgeWorld.findCollisionsWith(rotatedWedgeClear, []).length === 0,
          `${orientation.id} indexed wedge filled the clear corner`,
        );
        requireCondition(
          wedgeWorld
            .findCollisionsWith(rotatedWedgeSolid, [])
            .some(({ code }: { readonly code: string }) => code === "PART_BODY_COLLISION"),
          `${orientation.id} indexed wedge lost the solid corner`,
        );

        const rotatedRing = rotate(orientation.id, ring);
        const rotatedRingClear = rotate(orientation.id, ringClear);
        const rotatedRingSolid = rotate(orientation.id, ringSolid);
        requireCondition(
          codes([rotatedRing, rotatedRingClear]).length === 0,
          `${orientation.id} filled the quarter-ring hole`,
        );
        requireCondition(
          codes([rotatedRing, rotatedRingSolid]).includes("PART_BODY_COLLISION"),
          `${orientation.id} lost the quarter-ring arc`,
        );
        const ringWorld = kernel.createCollisionWorld([rotatedRing]);
        requireCondition(
          ringWorld.findCollisionsWith(rotatedRingClear, []).length === 0,
          `${orientation.id} indexed ring filled the hole`,
        );
        requireCondition(
          ringWorld
            .findCollisionsWith(rotatedRingSolid, [])
            .some(({ code }: { readonly code: string }) => code === "PART_BODY_COLLISION"),
          `${orientation.id} indexed ring lost the arc`,
        );

        const physicsWedge = rotate(
          orientation.id,
          part("physics-wedge", "builtin:wedge-plate-2x4-left", [-200, -100, 0]),
        );
        const physicsRing = rotate(
          orientation.id,
          part("physics-ring", "builtin:corner-plate-5x5-quarter-ring", [200, -100, 0]),
        );
        const physicsDocument = documentOf(`physics-${orientation.id}`, [
          physicsWedge,
          physicsRing,
        ]);
        const graph = kernel.deriveAssemblies(physicsDocument, { validConnections: [] });
        const physicsScene = kernel.derivePhysicsScene(physicsDocument, graph, {
          validConnections: [],
        });
        const wedgeBody = physicsScene.bodies.find(
          ({ partIds }: { readonly partIds: readonly string[] }) =>
            partIds.includes("physics-wedge"),
        );
        const ringBody = physicsScene.bodies.find(
          ({ partIds }: { readonly partIds: readonly string[] }) =>
            partIds.includes("physics-ring"),
        );
        requireCondition(
          wedgeBody !== undefined && ringBody !== undefined,
          `${orientation.id} lost a compound body`,
        );
        const wedgeShapeKinds = wedgeBody.shapes.map(({ kind }: { readonly kind: string }) => kind);
        const ringShapeKinds = ringBody.shapes.map(({ kind }: { readonly kind: string }) => kind);
        const wedgeSectionKinds = wedgeShapeKinds.filter((kind: string) => kind !== "cylinder");
        const ringSectionKinds = ringShapeKinds.filter((kind: string) => kind !== "cylinder");
        const wedgeStudKinds = wedgeShapeKinds.filter((kind: string) => kind === "cylinder");
        const ringStudKinds = ringShapeKinds.filter((kind: string) => kind === "cylinder");
        const verticalExtrusion = Math.abs(orientation.matrix[4] ?? 0) === 1;
        requireCondition(
          wedgeSectionKinds.length === 1 &&
            wedgeSectionKinds[0] === (verticalExtrusion ? "wedge" : "convex-hull"),
          `${orientation.id} degraded the wedge compound shape: ${wedgeShapeKinds.join(",")}`,
        );
        requireCondition(
          ringSectionKinds.length === 14 &&
            ringSectionKinds.every(
              (kind: string) => kind === (verticalExtrusion ? "convex-prism" : "convex-hull"),
            ),
          `${orientation.id} degraded the ring compound shapes: ${ringShapeKinds.join(",")}`,
        );
        requireCondition(
          wedgeStudKinds.length === 4 && ringStudKinds.length === 5,
          `${orientation.id} degraded compound studs: wedge=${wedgeStudKinds.length},ring=${ringStudKinds.length}`,
        );
        let simulation: { poses(): ReadonlyMap<string, unknown>; dispose(): void } | null = null;
        try {
          const createdSimulation = await rapier.createSimulation(physicsScene, {
            fixedBodyIds: physicsScene.bodies.map(({ id }: { readonly id: string }) => id),
          });
          simulation = createdSimulation;
          rapierCreated += 1;
          requireCondition(
            createdSimulation.poses().size === 2,
            `${orientation.id} Rapier did not retain two compound bodies`,
          );
          allOrientationRows.push({
            orientationId: orientation.id,
            platePartIssues: partIssueCodes,
            wedgeShapeKinds,
            ringShapeKinds,
            rapierPoseCount: createdSimulation.poses().size,
          });
        } finally {
          if (simulation !== null) {
            simulation.dispose();
            rapierDisposed += 1;
          }
        }
      }

      const subjects = [
        {
          slug: "plate-chain",
          orientationId: "proper-m-p0000p0n0",
          document: documentOf(
            "visual-plate-chain",
            basePlates.map((source) => rotate("proper-m-p0000p0n0", source)),
            plateEdges,
          ),
        },
        {
          slug: "wedge-clear-corner",
          orientationId: "proper-m-0p000pp00",
          document: documentOf(
            "visual-wedge-clear",
            [wedge, wedgeClear].map((source) => rotate("proper-m-0p000pp00", source)),
          ),
        },
        {
          slug: "quarter-ring-hole",
          orientationId: "proper-m-00nn000p0",
          document: documentOf(
            "visual-ring-hole",
            [ring, ringClear].map((source) => rotate("proper-m-00nn000p0", source)),
          ),
        },
      ];
      const contact = document.createElement("section");
      contact.dataset.properOrientationContactSheet = "true";
      contact.style.cssText =
        "display:grid;grid-template-columns:repeat(3,640px);gap:12px;padding:12px;background:#101410;color:white;font:16px sans-serif;width:max-content";
      document.body.replaceChildren(contact);
      const renderer = rendering.createInstructionRenderer({ width, height });
      const subjectRows: {
        slug: string;
        orientationId: string;
        documentHash: string;
        validationCodes: readonly string[];
        renderDiagnostics: readonly string[];
        views: readonly { name: string; nonBackgroundPixels: number }[];
      }[] = [];
      let sceneDisposals = 0;
      try {
        for (const subject of subjects) {
          const scene = rendering.deriveBrickScene(subject.document, { finish: "instruction" });
          try {
            const packet = rendering.createCanonicalViewPacket(scene);
            const renderDiagnostics = scene.diagnostics.map(
              ({ code }: { readonly code: string }) => code,
            );
            requireCondition(
              !renderDiagnostics.includes("UNKNOWN_ORIENTATION"),
              `${subject.slug} used the unknown-orientation fallback`,
            );
            const viewRows: { name: string; nonBackgroundPixels: number }[] = [];
            for (const view of packet.views) {
              const camera = rendering.createCameraForView(view, width / height);
              const pixels = new Uint8ClampedArray(renderer.render(scene.root, camera));
              const [backgroundRed, backgroundGreen, backgroundBlue] = pixels;
              let nonBackgroundPixels = 0;
              for (let index = 0; index < width * height; index += 1) {
                const offset = index * 4;
                if (
                  pixels[offset] !== backgroundRed ||
                  pixels[offset + 1] !== backgroundGreen ||
                  pixels[offset + 2] !== backgroundBlue
                )
                  nonBackgroundPixels += 1;
              }
              requireCondition(
                nonBackgroundPixels > 500,
                `${subject.slug}/${view.name} rendered only ${nonBackgroundPixels} subject pixels`,
              );
              const card = document.createElement("figure");
              card.style.cssText = "margin:0;background:#1a211a;padding:0 0 8px";
              const label = document.createElement("figcaption");
              label.textContent = `${subject.slug} | ${subject.orientationId} | ${view.name}`;
              label.style.cssText = "padding:6px 8px";
              const canvas = document.createElement("canvas");
              canvas.dataset.properOrientationSubject = subject.slug;
              canvas.dataset.properOrientationView = view.name;
              canvas.width = width;
              canvas.height = height;
              canvas.getContext("2d")!.putImageData(new ImageData(pixels, width, height), 0, 0);
              card.append(label, canvas);
              contact.append(card);
              viewRows.push({ name: view.name, nonBackgroundPixels });
            }
            subjectRows.push({
              slug: subject.slug,
              orientationId: subject.orientationId,
              documentHash: kernel.documentStructuralHash(subject.document),
              validationCodes: kernel
                .validateBrickDocument(subject.document)
                .issues.map(({ code }: { readonly code: string }) => code),
              renderDiagnostics,
              views: viewRows,
            });
          } finally {
            scene.dispose();
            sceneDisposals += 1;
          }
        }
      } finally {
        renderer.dispose();
      }
      return {
        schemaVersion: "lego.proper-orientation-runtime-visual-observation/1",
        authority: "diagnostic-only",
        orientationCount: allOrientationRows.length,
        allOrientationRows,
        rapier: { created: rapierCreated, disposed: rapierDisposed },
        subjects: subjectRows,
        cleanup: { sceneDisposals, rendererDisposed: true },
      };
    },
    {
      catalogUrl: CATALOG_MODULE_URL,
      height: HEIGHT,
      kernelUrl: BRICK_KERNEL_MODULE_URL,
      rapierUrl: RAPIER_MODULE_URL,
      renderingUrl: RENDERING_MODULE_URL,
      width: WIDTH,
    },
  );

  expect(observation.orientationCount).toBe(24);
  expect(observation.rapier).toEqual({ created: 24, disposed: 24 });
  expect(observation.cleanup).toEqual({ sceneDisposals: 3, rendererDisposed: true });
  expect(observation.subjects).toHaveLength(3);
  for (const subject of observation.subjects) {
    expect(subject.views.map(({ name }) => name).sort()).toEqual(EXPECTED_VIEWS);
    expect(subject.renderDiagnostics).not.toContain("UNKNOWN_ORIENTATION");
    for (const view of subject.views) {
      await page
        .locator(
          `canvas[data-proper-orientation-subject="${subject.slug}"][data-proper-orientation-view="${view.name}"]`,
        )
        .screenshot({ path: `${OUT}/${subject.slug}--${subject.orientationId}--${view.name}.png` });
    }
  }
  await page
    .locator('section[data-proper-orientation-contact-sheet="true"]')
    .screenshot({ path: `${OUT}/contact-sheet.png` });
  writeFileSync(`${OUT}/observation.json`, `${JSON.stringify(observation, null, 2)}\n`);
  expect(browserErrors).toEqual([]);

  await page.evaluate(() => {
    document.querySelector('section[data-proper-orientation-contact-sheet="true"]')?.remove();
  });
  await expect(page.locator('section[data-proper-orientation-contact-sheet="true"]')).toHaveCount(
    0,
  );
});

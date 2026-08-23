import { expect, test } from "@playwright/test";

import { RENDERING_MODULE_URL, workspaceModuleUrl } from "./workspace-module";

test("captures exact 24-bit depth and composes only strict minima", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(
    async ({ renderingUrl, threeUrl }) => {
      const rendering = await import(/* @vite-ignore */ renderingUrl);
      const three = await import(/* @vite-ignore */ threeUrl);
      const width = 64;
      const height = 32;
      const renderer = rendering.createInstructionRenderer({
        width,
        height,
        backgroundHex: 0x010203,
      });
      const camera = new three.OrthographicCamera(-2, 2, 1, -1, 0.1, 10);
      camera.position.z = 5;
      camera.updateMatrixWorld(true);
      const prefixMaterial = new three.MeshBasicMaterial({ color: 0xaa0000 });
      const probeMaterial = new three.MeshBasicMaterial({ color: 0x0000aa });
      const prefixMesh = new three.Mesh(new three.PlaneGeometry(3, 1.5), prefixMaterial);
      const probeMesh = new three.Mesh(new three.PlaneGeometry(1, 1), probeMaterial);
      probeMesh.position.z = 0.5;
      const prefixRoot = new three.Group();
      const probeRoot = new three.Group();
      prefixRoot.add(prefixMesh);
      probeRoot.add(probeMesh);
      const prefix = renderer.captureDepthSurface(prefixRoot, camera, "prefix");
      const probe = renderer.captureDepthSurface(probeRoot, camera, "probe");
      const composed = rendering.composeInstructionDepthSurfaces(prefix, probe);
      const sparseProbe = renderer.captureSparseDepthSurface(probeRoot, camera, "sparse-probe");
      const sparseComposed = rendering.composeInstructionDepthPrefixWithSparseProbe(
        prefix,
        sparseProbe,
      );
      const combined = new three.Group();
      combined.add(prefixRoot, probeRoot);
      const reference = new Uint8Array(renderer.render(combined, camera));

      const tieLeft = new three.Group();
      const tieRight = new three.Group();
      tieLeft.add(new three.Mesh(new three.PlaneGeometry(1, 1), prefixMaterial));
      tieRight.add(new three.Mesh(new three.PlaneGeometry(1, 1), probeMaterial));
      const tie = rendering.composeInstructionDepthSurfaces(
        renderer.captureDepthSurface(tieLeft, camera, "tie-left"),
        renderer.captureDepthSurface(tieRight, camera, "tie-right"),
      );
      const sparseTie = rendering.composeInstructionDepthPrefixWithSparseProbe(
        renderer.captureDepthSurface(tieLeft, camera, "sparse-tie-left"),
        renderer.captureSparseDepthSurface(tieRight, camera, "sparse-tie-right"),
      );

      const adjacentMaterial = new three.ShaderMaterial({
        depthTest: true,
        depthWrite: true,
        vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader:
          "precision highp float; void main() { float code = gl_FragCoord.x < 32.0 ? 8000000.0 : 8000001.0; gl_FragDepth = code / 16777215.0; gl_FragColor = vec4(0.25, 0.5, 0.75, 1.0); }",
      });
      const adjacentRoot = new three.Group();
      const adjacentMesh = new three.Mesh(new three.PlaneGeometry(2, 2), adjacentMaterial);
      adjacentMesh.frustumCulled = false;
      adjacentRoot.add(adjacentMesh);
      const adjacent = renderer.captureDepthSurface(adjacentRoot, new three.Camera(), "adjacent");
      const adjacentDepth = adjacent.copyDepth();

      const composedPixels = composed.status === "composed" ? composed.pixels : null;
      const report = {
        composedStatus: composed.status,
        exactPixels:
          composedPixels !== null &&
          composedPixels.length === reference.length &&
          composedPixels.every((value: number, index: number) => value === reference[index]),
        exactSparseMask:
          composed.status === "composed" &&
          sparseComposed.status === "composed" &&
          composed.probeVisibleMask.length === sparseComposed.probeVisibleMask.length &&
          composed.probeVisibleMask.every(
            (value: number, index: number) => value === sparseComposed.probeVisibleMask[index],
          ),
        sparsePixels: sparseProbe.nonClearPixels,
        tieStatus: tie.status,
        tieReason: tie.status === "refused" ? tie.reason : null,
        sparseTieStatus: sparseTie.status,
        sparseTieReason: sparseTie.status === "refused" ? sparseTie.reason : null,
        depthBits: prefix.compatibility.depthAttachmentBits,
        depthReadback: prefix.compatibility.depthReadback,
        clearDepth: prefix.copyDepth()[0],
        adjacentLeft: adjacentDepth[0],
        adjacentRight: adjacentDepth[width - 1],
      };
      combined.remove(prefixRoot, probeRoot);
      prefixMesh.geometry.dispose();
      probeMesh.geometry.dispose();
      for (const root of [tieLeft, tieRight]) {
        root.traverse((object: { geometry?: { dispose(): void } }) => object.geometry?.dispose());
      }
      adjacentMesh.geometry.dispose();
      adjacentMaterial.dispose();
      prefixMaterial.dispose();
      probeMaterial.dispose();
      renderer.dispose();
      return report;
    },
    {
      renderingUrl: RENDERING_MODULE_URL,
      threeUrl: workspaceModuleUrl("node_modules/three/build/three.module.js"),
    },
  );

  expect(result).toMatchObject({
    composedStatus: "composed",
    exactPixels: true,
    exactSparseMask: true,
    tieStatus: "refused",
    tieReason: "equal-depth-tie",
    sparseTieStatus: "refused",
    sparseTieReason: "equal-depth-tie",
    depthBits: 24,
    depthReadback: "depth-texture-uint24-rgb8-pack",
    clearDepth: 0x00ff_ffff,
  });
  expect(result.sparsePixels).toBeGreaterThan(0);
  expect(Math.abs(result.adjacentLeft - 8_000_000)).toBeLessThanOrEqual(1);
  expect(result.adjacentRight - result.adjacentLeft).toBe(1);
});

import { runPartVisualAdmissionCapture } from "./part-visual-admission-renderer.ts";

declare global {
  interface Window {
    run_part_visual_admission?: typeof runPartVisualAdmissionCapture;
  }
}

window.run_part_visual_admission = runPartVisualAdmissionCapture;

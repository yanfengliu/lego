/// <reference types="vite/client" />

import type { AutomationModelCaptureOptions, ModelSnapshot } from "./automation";
import type {
  InstructionViewCaptureRequest,
  InstructionViewCaptureResult,
} from "./components/BrickViewport";

declare global {
  interface Window {
    render_app_to_text?: () => string;
    capture_model_views?: (
      options?: AutomationModelCaptureOptions,
    ) => Promise<Record<string, string>>;
    capture_instruction_view?: (
      request: InstructionViewCaptureRequest,
    ) => Promise<InstructionViewCaptureResult>;
    get_model_snapshot?: () => ModelSnapshot;
    advanceTime?: (milliseconds: number) => Promise<ModelSnapshot>;
  }
}

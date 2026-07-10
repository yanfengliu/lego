/// <reference types="vite/client" />

import type { ModelSnapshot } from "./automation";

declare global {
  interface Window {
    render_app_to_text?: () => string;
    capture_model_views?: () => Promise<Record<string, string>>;
    get_model_snapshot?: () => ModelSnapshot;
    advanceTime?: (milliseconds: number) => Promise<ModelSnapshot>;
  }
}

import type { RealBuildBrowserOutputV4SourceEvidencePanel } from "./real-build-browser-output-v4-source-evidence-types";

const PANEL_DESCRIPTORS = new WeakSet<object>();
const REFLECT_APPLY = Reflect.apply;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;

export function brandRealBuildBrowserOutputV4SourceEvidencePanelDescriptor(
  descriptor: RealBuildBrowserOutputV4SourceEvidencePanel,
): RealBuildBrowserOutputV4SourceEvidencePanel {
  REFLECT_APPLY(WEAK_SET_ADD, PANEL_DESCRIPTORS, [descriptor]);
  return descriptor;
}

export function isRealBuildBrowserOutputV4SourceEvidencePanelDescriptor(
  value: unknown,
): value is RealBuildBrowserOutputV4SourceEvidencePanel {
  return (
    value !== null &&
    typeof value === "object" &&
    REFLECT_APPLY(WEAK_SET_HAS, PANEL_DESCRIPTORS, [value])
  );
}

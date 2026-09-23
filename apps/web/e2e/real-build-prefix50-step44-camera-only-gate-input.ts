export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_GATE_ENV =
  "LEGO_REAL_BUILD_STEP44_CAMERA_ONLY_REQUIRED";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_OUTPUT_ENV =
  "LEGO_REAL_BUILD_STEP44_CAMERA_ONLY_OUTPUT";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT_ENV =
  "LEGO_REAL_BUILD_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_DEFAULT_OUTPUT_NAME =
  "camera-only-page45-gate-20260830-v4";
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE =
  "real-build-prefix50-step44-camera-only-gate-manifest.json";

const OUTPUT_NAME = /^camera-only-page45-gate-[a-z0-9][a-z0-9.-]{0,95}$/u;

export function requireRealBuildPrefix50Step44CameraOnlyOutputName(value: string): string {
  if (!OUTPUT_NAME.test(value))
    throw new TypeError(
      `${REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_OUTPUT_ENV} must be one direct camera-only-page45-gate-* directory name.`,
    );
  return value;
}

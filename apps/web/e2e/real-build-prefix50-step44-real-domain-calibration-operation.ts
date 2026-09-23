export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_REQUIRED";
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_OUTPUT_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_OUTPUT";
export const REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_DEFAULT_OUTPUT =
  "page44-real-domain-calibration-20260830-v1";

const OUTPUT = /^page44-real-domain-calibration-[a-z0-9][a-z0-9.-]{0,95}$/u;

export function requireRealBuildPrefix50Step44RealDomainCalibrationOutputName(
  value: string,
): string {
  if (!OUTPUT.test(value))
    throw new TypeError(
      `${REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_OUTPUT_ENV} must name one direct page44-real-domain-calibration-* output directory.`,
    );
  return value;
}

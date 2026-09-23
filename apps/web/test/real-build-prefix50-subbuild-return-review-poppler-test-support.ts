import { verifyRealBuildPrefix50Step44PopplerToolchain } from "../e2e/real-build-prefix50-subbuild-return-review-poppler-toolchain-verifier.ts";

export function pinCurrentToolchainPopplerForStep44Test(): () => void {
  verifyRealBuildPrefix50Step44PopplerToolchain();
  return () => undefined;
}

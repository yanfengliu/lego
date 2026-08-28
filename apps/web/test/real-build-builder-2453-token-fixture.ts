import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parse, resolve } from "node:path";

import { compileBuilder2453IdentityProof } from "../../../scripts/part-identification-2453-builder-identity.mjs";

const LOCAL_EVIDENCE_ROOT = resolve(parse(process.cwd()).root, "tmp");
const localEvidencePath = (...segments: readonly string[]): string =>
  resolve(LOCAL_EVIDENCE_ROOT, ...segments);
const SHADOW_ROOT = localEvidencePath("ldcad-shadow-20260802");
const OFFICIAL_ARCHIVE = localEvidencePath("ldraw-complete-2026-07.zip");
const PATHS = {
  officialModelBytes: "output/official-model/vx1087034_21066_a.xml",
  builderManifestBytes: localEvidencePath("lego-21066-vx1087034-a-android-manifest.json"),
  builderBundleBytes: localEvidencePath("lego-21066-builder-assets", "2453-I-android.bundle"),
  builderBundleProofBytes: "output/real-build/part-identification-2453-builder-bundle-proof.json",
  nativePackBytes: localEvidencePath("lego-21066-builder-native-part-pack.json"),
  shadowSolidRootBytes: `${SHADOW_ROOT}/parts/2453b.dat`,
  shadowHollowRootBytes: `${SHADOW_ROOT}/parts/2453a.dat`,
  shadowSolidStudBytes: `${SHADOW_ROOT}/p/stud.dat`,
  shadowHollowStudBytes: `${SHADOW_ROOT}/p/stud2a.dat`,
} as const;

export const hasBuilder2453IdentityEvidence =
  existsSync(OFFICIAL_ARCHIVE) &&
  Object.values(PATHS).every((path) => existsSync(resolve(process.cwd(), path)));

function extractOfficialMember(path: string): Buffer {
  return execFileSync(process.platform === "win32" ? "tar.exe" : "tar", [
    "-xOf",
    OFFICIAL_ARCHIVE,
    path,
  ]);
}

/** Mints the opaque route token only by recompiling every exact module-pinned evidence role. */
export async function mintBuilder2453IdentityToken(): Promise<object> {
  const inputs = Object.fromEntries(
    Object.entries(PATHS).map(([role, path]) => [role, readFileSync(resolve(process.cwd(), path))]),
  );
  const compiled = await compileBuilder2453IdentityProof({
    ...inputs,
    officialSolidRootBytes: extractOfficialMember("ldraw/parts/2453b.dat"),
    officialHollowRootBytes: extractOfficialMember("ldraw/parts/2453a.dat"),
    officialSolidStudBytes: extractOfficialMember("ldraw/p/stud.dat"),
    officialHollowStudBytes: extractOfficialMember("ldraw/p/stud2a.dat"),
  });
  return compiled.token;
}

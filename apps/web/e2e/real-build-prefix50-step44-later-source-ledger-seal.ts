import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import { join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalStringify } from "@lego-studio/brick-kernel";

const DPAPI_HELPER_PATH = fileURLToPath(
  new URL("./real-build-prefix50-step44-later-source-dpapi.ps1", import.meta.url),
);
const DPAPI_HELPER_BYTES = 2_477;
const DPAPI_HELPER_DIGEST =
  "sha256:576a7b4e987cb11b573ff79d85fb2c608fb5f728a59c48dd383d069b063f64d4" as const;
const POWERSHELL_BYTES = 495_616;
const POWERSHELL_DIGEST =
  "sha256:8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e" as const;
const KEY_BYTES = 32;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

interface FileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly modifiedNanoseconds: bigint;
  readonly changedNanoseconds: bigint;
  readonly links: bigint;
}

interface AuthenticatedFile {
  readonly path: string;
  readonly bytes: Buffer;
  readonly identity: FileIdentity;
}

export interface RealBuildPrefix50Step44LaterSourceLedgerKeyMaterial {
  readonly key: Buffer;
  readonly keyCommitment: `sha256:${string}`;
}

type LedgerKeyFile = Readonly<{
  schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-key/2";
  protection: "windows-dpapi-current-user" | "posix-owner-mode";
  repositoryIdentityCommitment: `sha256:${string}`;
  keyCommitment: `sha256:${string}`;
  protectedKeyBase64: string;
  ownerUid: number | null;
  ownerGid: number | null;
}>;

function sha256(bytes: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function identity(stats: BigIntStats): FileIdentity {
  return {
    device: stats.dev,
    inode: stats.ino,
    size: stats.size,
    modifiedNanoseconds: stats.mtimeNs,
    changedNanoseconds: stats.ctimeNs,
    links: stats.nlink,
  };
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.size === right.size &&
    left.modifiedNanoseconds === right.modifiedNanoseconds &&
    left.changedNanoseconds === right.changedNanoseconds &&
    left.links === right.links
  );
}

function authenticateFile(input: {
  readonly path: string;
  readonly expectedBytes: number;
  readonly expectedDigest: `sha256:${string}`;
  readonly label: string;
  readonly requireSingleName: boolean;
}): AuthenticatedFile {
  const canonical = realpathSync.native(input.path);
  const requested = resolve(input.path);
  const samePath =
    process.platform === "win32"
      ? canonical.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US")
      : canonical === requested;
  if (!samePath) throw new TypeError(`${input.label} must be its canonical path.`);
  const descriptor = openSync(input.path, constants.O_RDONLY);
  try {
    const beforeStats = fstatSync(descriptor, { bigint: true });
    const before = identity(beforeStats);
    if (
      !beforeStats.isFile() ||
      (input.requireSingleName && before.links !== 1n) ||
      before.size !== BigInt(input.expectedBytes)
    )
      throw new TypeError(`${input.label} must be one exact reviewed file.`);
    const bytes = readFileSync(descriptor);
    const after = identity(fstatSync(descriptor, { bigint: true }));
    if (
      !sameIdentity(before, after) ||
      bytes.byteLength !== input.expectedBytes ||
      sha256(bytes) !== input.expectedDigest
    )
      throw new TypeError(`${input.label} changed or failed its exact digest pin.`);
    return Object.freeze({ path: input.path, bytes, identity: after });
  } finally {
    closeSync(descriptor);
  }
}

function requireUnchanged(
  file: AuthenticatedFile,
  expectedDigest: `sha256:${string}`,
  label: string,
): void {
  const current = authenticateFile({
    path: file.path,
    expectedBytes: file.bytes.byteLength,
    expectedDigest,
    label,
    requireSingleName: file.identity.links === 1n,
  });
  if (!sameIdentity(file.identity, current.identity))
    throw new TypeError(`${label} identity changed during DPAPI invocation.`);
}

function systemPowerShell(): AuthenticatedFile {
  return authenticateFile({
    path: join(
      parse(process.execPath).root,
      "Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    expectedBytes: POWERSHELL_BYTES,
    expectedDigest: POWERSHELL_DIGEST,
    label: "Step-44 DPAPI system PowerShell",
    requireSingleName: false,
  });
}

function framedJson(value: object): Buffer {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  if (bytes.length < 1 || bytes.length > 16 * 1024)
    throw new RangeError("Step-44 DPAPI request exceeded 16 KiB.");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function stderrBytes(run: SpawnSyncReturns<string>): number {
  return Buffer.byteLength(run.stderr ?? "", "utf8");
}

function dpapi(action: "protect" | "unprotect", data: Uint8Array, entropy: Uint8Array): Buffer {
  const helper = authenticateFile({
    path: DPAPI_HELPER_PATH,
    expectedBytes: DPAPI_HELPER_BYTES,
    expectedDigest: DPAPI_HELPER_DIGEST,
    label: "Step-44 DPAPI helper",
    requireSingleName: true,
  });
  const powershell = systemPowerShell();
  const windowsRoot = join(parse(powershell.path).root, "Windows");
  let run: SpawnSyncReturns<string>;
  try {
    run = spawnSync(
      powershell.path,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(helper.bytes.toString("utf8"), "utf16le").toString("base64"),
      ],
      {
        input: framedJson({
          action,
          dataBase64: Buffer.from(data).toString("base64"),
          entropyBase64: Buffer.from(entropy).toString("base64"),
        }),
        encoding: "utf8",
        windowsHide: true,
        timeout: 15_000,
        maxBuffer: 16 * 1024,
        env: { SystemRoot: windowsRoot, WINDIR: windowsRoot },
      },
    );
  } finally {
    requireUnchanged(helper, DPAPI_HELPER_DIGEST, "Step-44 DPAPI helper");
    requireUnchanged(powershell, POWERSHELL_DIGEST, "Step-44 DPAPI system PowerShell");
  }
  if (run.error !== undefined || run.status !== 0)
    throw new TypeError(
      `Step-44 DPAPI ${action} failed with status ${String(run.status)}; ${String(stderrBytes(run))} stderr bytes were withheld.`,
    );
  let result: unknown;
  try {
    result = JSON.parse(run.stdout);
  } catch {
    throw new TypeError("Step-44 DPAPI helper returned invalid JSON.");
  }
  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    Object.keys(result).sort().join("\n") !== "dataBase64\nschemaVersion"
  )
    throw new TypeError("Step-44 DPAPI helper returned a non-canonical result.");
  const typed = result as { schemaVersion?: unknown; dataBase64?: unknown };
  if (
    typed.schemaVersion !== "lego.real-build-prefix50-step44-dpapi-result/1" ||
    typeof typed.dataBase64 !== "string" ||
    typed.dataBase64.length < 1 ||
    typed.dataBase64.length > 8_192
  )
    throw new TypeError("Step-44 DPAPI helper returned an invalid sealed value.");
  const bytes = Buffer.from(typed.dataBase64, "base64");
  if (bytes.toString("base64") !== typed.dataBase64)
    throw new TypeError("Step-44 DPAPI helper returned non-canonical base64.");
  return bytes;
}

function entropy(repositoryIdentityCommitment: `sha256:${string}`): Buffer {
  return createHash("sha256")
    .update("lego-step44-later-source-ledger-dpapi-v2\0")
    .update(repositoryIdentityCommitment)
    .digest();
}

function exactKeyFile(value: unknown): LedgerKeyFile {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join("\n") !==
      "keyCommitment\nownerGid\nownerUid\nprotectedKeyBase64\nprotection\nrepositoryIdentityCommitment\nschemaVersion"
  )
    throw new TypeError("Later-source ledger key file is not one closed-schema value.");
  const key = value as Partial<LedgerKeyFile>;
  if (
    key.schemaVersion !== "lego.real-build-prefix50-step44-later-source-ledger-key/2" ||
    (key.protection !== "windows-dpapi-current-user" && key.protection !== "posix-owner-mode") ||
    typeof key.repositoryIdentityCommitment !== "string" ||
    !SHA256.test(key.repositoryIdentityCommitment) ||
    typeof key.keyCommitment !== "string" ||
    !SHA256.test(key.keyCommitment) ||
    typeof key.protectedKeyBase64 !== "string" ||
    key.protectedKeyBase64.length < 1 ||
    key.protectedKeyBase64.length > 8_192 ||
    (key.ownerUid !== null &&
      (typeof key.ownerUid !== "number" ||
        !Number.isSafeInteger(key.ownerUid) ||
        key.ownerUid < 0)) ||
    (key.ownerGid !== null &&
      (typeof key.ownerGid !== "number" || !Number.isSafeInteger(key.ownerGid) || key.ownerGid < 0))
  )
    throw new TypeError("Later-source ledger key file is malformed.");
  return key as LedgerKeyFile;
}

export function createRealBuildPrefix50Step44LaterSourceLedgerKey(input: {
  readonly repositoryIdentityCommitment: `sha256:${string}`;
}): Readonly<{ bytes: Buffer; material: RealBuildPrefix50Step44LaterSourceLedgerKeyMaterial }> {
  if (!SHA256.test(input.repositoryIdentityCommitment))
    throw new TypeError("Later-source ledger repository identity commitment is invalid.");
  const key = randomBytes(KEY_BYTES);
  const keyCommitment = sha256(key);
  let file: LedgerKeyFile;
  if (process.platform === "win32") {
    file = {
      schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-key/2",
      protection: "windows-dpapi-current-user",
      repositoryIdentityCommitment: input.repositoryIdentityCommitment,
      keyCommitment,
      protectedKeyBase64: dpapi(
        "protect",
        key,
        entropy(input.repositoryIdentityCommitment),
      ).toString("base64"),
      ownerUid: null,
      ownerGid: null,
    };
  } else {
    const ownerUid = process.getuid?.();
    const ownerGid = process.getgid?.();
    if (ownerUid === undefined || ownerGid === undefined)
      throw new TypeError("POSIX later-source ledger requires a stable UID and GID.");
    file = {
      schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-key/2",
      protection: "posix-owner-mode",
      repositoryIdentityCommitment: input.repositoryIdentityCommitment,
      keyCommitment,
      protectedKeyBase64: key.toString("base64"),
      ownerUid,
      ownerGid,
    };
  }
  return Object.freeze({
    bytes: Buffer.from(canonicalStringify(file), "utf8"),
    material: Object.freeze({ key, keyCommitment }),
  });
}

export function openRealBuildPrefix50Step44LaterSourceLedgerKey(
  bytes: Uint8Array,
  repositoryIdentityCommitment: `sha256:${string}`,
): RealBuildPrefix50Step44LaterSourceLedgerKeyMaterial {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new TypeError("Later-source ledger key file is not JSON.");
  }
  const file = exactKeyFile(parsed);
  if (
    canonicalStringify(file) !== Buffer.from(bytes).toString("utf8") ||
    file.repositoryIdentityCommitment !== repositoryIdentityCommitment ||
    Buffer.from(file.protectedKeyBase64, "base64").toString("base64") !== file.protectedKeyBase64
  )
    throw new TypeError("Later-source ledger key file is non-canonical or belongs elsewhere.");
  let key: Buffer;
  if (process.platform === "win32") {
    if (
      file.protection !== "windows-dpapi-current-user" ||
      file.ownerUid !== null ||
      file.ownerGid !== null
    )
      throw new TypeError("Windows later-source ledger key is not DPAPI protected.");
    key = dpapi(
      "unprotect",
      Buffer.from(file.protectedKeyBase64, "base64"),
      entropy(repositoryIdentityCommitment),
    );
  } else {
    const ownerUid = process.getuid?.();
    const ownerGid = process.getgid?.();
    if (
      file.protection !== "posix-owner-mode" ||
      ownerUid === undefined ||
      ownerGid === undefined ||
      file.ownerUid !== ownerUid ||
      file.ownerGid !== ownerGid
    )
      throw new TypeError("POSIX later-source ledger key owner UID/GID changed.");
    key = Buffer.from(file.protectedKeyBase64, "base64");
  }
  if (key.length !== KEY_BYTES || sha256(key) !== file.keyCommitment)
    throw new TypeError("Later-source ledger key failed its protected commitment.");
  return Object.freeze({ key, keyCommitment: file.keyCommitment });
}

export function sealRealBuildPrefix50Step44LaterSourceLedgerValue(
  value: object,
  key: Uint8Array,
): Buffer {
  if (key.byteLength !== KEY_BYTES)
    throw new TypeError("Later-source ledger HMAC requires one 256-bit key.");
  const payload = Buffer.from(canonicalStringify(value), "utf8");
  const hmac = createHmac("sha256", key)
    .update("lego-step44-later-source-ledger-value-v2\0")
    .update(payload)
    .digest("hex");
  return Buffer.from(
    canonicalStringify({
      schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-seal/2",
      payloadBase64: payload.toString("base64"),
      hmac: `hmac-sha256:${hmac}`,
    }),
    "utf8",
  );
}

export function openRealBuildPrefix50Step44LaterSourceLedgerValue(
  bytes: Uint8Array,
  key: Uint8Array,
): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new TypeError("Later-source ledger seal is not JSON.");
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join("\n") !== "hmac\npayloadBase64\nschemaVersion"
  )
    throw new TypeError("Later-source ledger seal is not one closed-schema value.");
  const seal = parsed as { schemaVersion?: unknown; payloadBase64?: unknown; hmac?: unknown };
  if (
    seal.schemaVersion !== "lego.real-build-prefix50-step44-later-source-ledger-seal/2" ||
    typeof seal.payloadBase64 !== "string" ||
    typeof seal.hmac !== "string" ||
    !/^hmac-sha256:[0-9a-f]{64}$/u.test(seal.hmac) ||
    canonicalStringify(seal) !== Buffer.from(bytes).toString("utf8")
  )
    throw new TypeError("Later-source ledger seal is malformed or non-canonical.");
  const payload = Buffer.from(seal.payloadBase64, "base64");
  if (payload.toString("base64") !== seal.payloadBase64)
    throw new TypeError("Later-source ledger payload base64 is non-canonical.");
  const expected = createHmac("sha256", key)
    .update("lego-step44-later-source-ledger-value-v2\0")
    .update(payload)
    .digest();
  const actual = Buffer.from(seal.hmac.slice("hmac-sha256:".length), "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new TypeError("Later-source ledger HMAC verification failed.");
  let value: unknown;
  try {
    value = JSON.parse(payload.toString("utf8"));
  } catch {
    throw new TypeError("Later-source ledger sealed payload is not JSON.");
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    canonicalStringify(value) !== payload.toString("utf8")
  )
    throw new TypeError("Later-source ledger sealed payload is non-canonical.");
  return value;
}

export const __testOnlyRealBuildPrefix50Step44LaterSourceLedgerSeal = Object.freeze({ sha256 });

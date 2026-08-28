export interface CompiledBuilder2453IdentityProof {
  readonly artifact: unknown;
  readonly encoded: Uint8Array;
  readonly encodedDigest: `sha256:${string}`;
  readonly token: object;
}

export function compileBuilder2453IdentityProof(
  input: Readonly<Record<string, Uint8Array>>,
): Promise<CompiledBuilder2453IdentityProof>;

import { ArtifactStoreError } from "./artifact-policy.ts";

type ReleaseAdmission = () => void;

interface PendingAdmission {
  readonly byteLength: number;
  readonly resolve: (release: ReleaseAdmission) => void;
}

export interface AdmissionLimits {
  readonly maxInFlightByteLength: number;
  readonly maxConcurrentOperations: number;
  readonly maxQueuedOperations: number;
}

export class ArtifactAdmission {
  readonly #limits: AdmissionLimits;
  readonly #pending: PendingAdmission[] = [];
  #inFlightByteLength = 0;
  #inFlightOperations = 0;

  constructor(limits: AdmissionLimits) {
    this.#limits = limits;
  }

  acquire(byteLength: number): ReleaseAdmission | Promise<ReleaseAdmission> {
    if (this.#pending.length === 0 && this.#canAdmit(byteLength)) {
      return this.#reserve(byteLength);
    }
    if (this.#pending.length >= this.#limits.maxQueuedOperations) {
      throw new ArtifactStoreError(
        "STORE_BUSY",
        "Artifact store has reached its bounded pending-operation capacity",
      );
    }
    return new Promise((resolve) => {
      this.#pending.push({ byteLength, resolve });
    });
  }

  #canAdmit(byteLength: number): boolean {
    return (
      this.#inFlightOperations < this.#limits.maxConcurrentOperations &&
      byteLength <= this.#limits.maxInFlightByteLength - this.#inFlightByteLength
    );
  }

  #reserve(byteLength: number): ReleaseAdmission {
    this.#inFlightOperations += 1;
    this.#inFlightByteLength += byteLength;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#inFlightOperations -= 1;
      this.#inFlightByteLength -= byteLength;
      this.#drain();
    };
  }

  #drain(): void {
    while (this.#pending.length > 0) {
      const next = this.#pending[0]!;
      if (!this.#canAdmit(next.byteLength)) return;
      this.#pending.shift();
      next.resolve(this.#reserve(next.byteLength));
    }
  }
}

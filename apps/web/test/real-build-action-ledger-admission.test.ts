import { describe, expect, it } from "vitest";

import { admitCanonicalRealBuildActionLedgerBytes } from "../e2e/real-build-action-ledger-admission";
import { encodeRealBuildActionLedger } from "../e2e/real-build-action-ledger";
import { preflightRealBuildActionLedger } from "../e2e/real-build-ledger-bounds";
import type { RealBuildActionLedger } from "../e2e/real-build-ledger";
import {
  realBuildLedgerPrefix,
  realBuildLedgerTestFixture,
} from "./real-build-ledger-test-fixture";

const rawBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 1)}\n`, "utf8");

describe("current /3 action-ledger raw admission", () => {
  it("admits canonical exact execution and separates retained partial artifacts", () => {
    const fixture = realBuildLedgerTestFixture();
    const exact = realBuildLedgerPrefix(fixture.ledger, 3);
    const partial = realBuildLedgerPrefix(fixture.ledger, 50, fixture.ledger.steps.slice(0, 2));

    expect(
      admitCanonicalRealBuildActionLedgerBytes({
        bytes: encodeRealBuildActionLedger(exact),
        label: "test ledger",
        mode: "exact-execution",
        requestedLastStep: 3,
      }),
    ).toEqual(exact);
    expect(() =>
      admitCanonicalRealBuildActionLedgerBytes({
        bytes: encodeRealBuildActionLedger(partial),
        label: "partial test ledger",
        mode: "retained-prefix",
        requestedLastStep: 50,
      }),
    ).not.toThrow();
    expect(() =>
      admitCanonicalRealBuildActionLedgerBytes({
        bytes: encodeRealBuildActionLedger(partial),
        label: "partial test ledger",
        mode: "exact-execution",
        requestedLastStep: 50,
      }),
    ).toThrow(/validated printed step 1\.\.50/u);
  });

  it("rejects duplicate keys and noncanonical numeric spellings before admission", () => {
    const ledger = realBuildLedgerPrefix(realBuildLedgerTestFixture().ledger, 3);
    const canonical = encodeRealBuildActionLedger(ledger).toString("utf8");
    const schemaLine = ` "schemaVersion": "${ledger.schemaVersion}",`;
    const duplicateSchema = canonical.replace(schemaLine, `${schemaLine}\n${schemaLine}`);
    const requestedLine = `  "requestedLastStep": 3,`;
    const duplicateRequest = canonical.replace(requestedLine, `${requestedLine}\n${requestedLine}`);
    const exponentRequest = canonical.replace(requestedLine, `  "requestedLastStep": 3e0,`);
    const admit = (bytes: string) =>
      admitCanonicalRealBuildActionLedgerBytes({
        bytes: Buffer.from(bytes),
        label: "hostile ledger",
        mode: "exact-execution",
        requestedLastStep: 3,
      });

    expect(() => admit(duplicateSchema)).toThrow(/duplicate-free/u);
    expect(() => admit(duplicateRequest)).toThrow(/duplicate-free/u);
    expect(() => admit(exponentRequest)).toThrow(/exact canonical current \/3 encoding/u);
  });

  it("rejects impossible raw container fan-out before strict parsing allocates rows", () => {
    const wideObject = Buffer.from(
      `{${Array.from({ length: 20_000 }, (_, index) => `"extra-${index}":0`).join(",")}}`,
    );
    const wideArray = Buffer.from(`[${Array.from({ length: 4_001 }, () => "0").join(",")}]`);
    const admit = (bytes: Uint8Array) =>
      admitCanonicalRealBuildActionLedgerBytes({
        bytes,
        label: "wide hostile ledger",
        mode: "retained-prefix",
      });

    expect(() => admit(wideObject)).toThrow(
      /more than 16 members in one object; no action-ledger JSON was parsed/u,
    );
    expect(() => admit(wideArray)).toThrow(
      /more than 4000 entries in one array; no action-ledger JSON was parsed/u,
    );
  });

  it("rejects a wide in-memory record without materializing all property descriptors", () => {
    const keys = Array.from({ length: 20_000 }, (_, index) => `extra-${index}`);
    let descriptorReads = 0;
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => keys,
        getOwnPropertyDescriptor: () => {
          descriptorReads += 1;
          return { configurable: true, enumerable: true, value: 0, writable: true };
        },
      },
    );

    expect(preflightRealBuildActionLedger(hostile)).toEqual({
      ledger: null,
      failure: expect.objectContaining({
        code: "action-ledger-incomplete",
        message: expect.stringContaining("exactly its current /3 fields"),
      }),
    });
    expect(descriptorReads).toBe(0);
  });

  it("rejects every extra current-schema authority surface", () => {
    const baseline = realBuildLedgerPrefix(realBuildLedgerTestFixture().ledger, 3);
    const [place, copy, transition] = baseline.steps;
    if (
      place?.action.kind !== "place-callouts" ||
      copy?.action.kind !== "multi-build-copy" ||
      transition?.action.kind !== "transition" ||
      place.action.pieces[0] === undefined
    ) {
      throw new TypeError("Action-ledger fixture no longer covers all closed action shapes.");
    }
    const refusal = { stepNumber: 1, calloutKey: null, brickRef: null, reason: "fixture refusal" };
    const cases: readonly [string, unknown][] = [
      ["top", { ...baseline, tailActions: [] }],
      ["step", { ...baseline, steps: [{ ...place, authority: true }, copy, transition] }],
      [
        "callout",
        {
          ...baseline,
          steps: [
            { ...place, callouts: [{ ...place.callouts[0]!, authority: true }] },
            copy,
            transition,
          ],
        },
      ],
      [
        "place action",
        {
          ...baseline,
          steps: [{ ...place, action: { ...place.action, authority: true } }, copy, transition],
        },
      ],
      [
        "copy action",
        {
          ...baseline,
          steps: [place, { ...copy, action: { ...copy.action, authority: true } }, transition],
        },
      ],
      [
        "transition action",
        {
          ...baseline,
          steps: [
            place,
            copy,
            { ...transition, action: { ...transition.action, authority: true } },
          ],
        },
      ],
      [
        "direct piece",
        {
          ...baseline,
          steps: [
            {
              ...place,
              action: { ...place.action, pieces: [{ ...place.action.pieces[0], authority: true }] },
            },
            copy,
            transition,
          ],
        },
      ],
      [
        "copy piece",
        {
          ...baseline,
          steps: [
            place,
            {
              ...copy,
              action: { ...copy.action, copies: [{ ...copy.action.copies[0]!, authority: true }] },
            },
            transition,
          ],
        },
      ],
      [
        "transform",
        {
          ...baseline,
          steps: [
            {
              ...place,
              action: {
                ...place.action,
                pieces: [
                  {
                    ...place.action.pieces[0],
                    transform: {
                      ...(place.action.pieces[0].transform ?? {
                        positionLdu: [0, 0, 0],
                        orientationId: "upright-yaw-0",
                      }),
                      authority: true,
                    },
                  },
                ],
              },
            },
            copy,
            transition,
          ],
        },
      ],
      ["provenance", { ...baseline, provenance: { ...baseline.provenance, authority: true } }],
      [
        "refusal",
        {
          ...baseline,
          provenance: { ...baseline.provenance, refusals: [{ ...refusal, authority: true }] },
        },
      ],
    ];

    for (const [label, candidate] of cases) {
      expect(
        () =>
          admitCanonicalRealBuildActionLedgerBytes({
            bytes: rawBytes(candidate),
            label,
            mode: "exact-execution",
            requestedLastStep: 3,
          }),
        label,
      ).toThrow(/closed current \/3 schema/u);
    }
  });

  it("rejects legacy generation and raw rows above the artifact request", () => {
    const baseline = realBuildLedgerPrefix(realBuildLedgerTestFixture().ledger, 3);
    const legacy = {
      ...baseline,
      schemaVersion: "lego.real-build-action-ledger/2",
    } as unknown as RealBuildActionLedger;
    const tailed = {
      ...baseline,
      provenance: { ...baseline.provenance, requestedLastStep: 2 },
    };
    const admit = (ledger: unknown, requestedLastStep: number) =>
      admitCanonicalRealBuildActionLedgerBytes({
        bytes: rawBytes(ledger),
        label: "hostile retained ledger",
        mode: "retained-prefix",
        requestedLastStep,
      });

    expect(() => admit(legacy, 3)).toThrow(/lego\.real-build-action-ledger\/3/u);
    expect(() => admit(tailed, 2)).toThrow(/without crossing the request|above requestedLastStep/u);
  });
});

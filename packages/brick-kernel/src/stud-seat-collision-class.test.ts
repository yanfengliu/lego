import { PART_DEFINITIONS, PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getConnectorWorldFrame, rotateLduVector } from "./transforms.ts";
import { validBrickConnections, validateBrickDocument } from "./validation.ts";

/**
 * Class gate for booklet step 32's defect: a clutch seated on a stud through a
 * validated stud-tube edge must not collide with that stud. Seven measured
 * parts kept the LDraw source stud radius 6.0001514980873605 LDU without the
 * nominal-stud-tube/1 profile, so every stud they carried overlapped any
 * seated clutch by 0.00015 LDU (PART_STUD_BODY_COLLISION); a 3023 plate on a
 * 15254 arch failed exactly so.
 *
 * For every catalog part and every stud connector it declares, whatever its
 * normal, a builtin:plate-1x1 is seated by its undersideClutch:0:0 so the seats
 * coincide and the normals oppose, the stud-tube edge is added, and the
 * document is validated. The edge must validate and no collision may name both
 * parts.
 *
 * Bound: the host sits at the origin in upright-yaw-0, and the only probe is a
 * 1 x 1 plate's clutch (tube-seat allowance radius 6, depth 4) seated alone, so
 * this says nothing about other clutch kinds, a second part nearby, or a host
 * in another orientation. A sideways stud needs a plate orientation that
 * plate-1x1 does not admit; the document then also reports ILLEGAL_ORIENTATION,
 * which this gate ignores because it tests collision, not placement policy.
 */
const PROBE_ID = "builtin:plate-1x1";
const PROBE_CLUTCH = "undersideClutch:0:0";
const COLLISION_CODES = new Set([
  "PART_BODY_COLLISION",
  "PART_STUD_BODY_COLLISION",
  "PART_STUD_COLLISION",
]);

/**
 * Studs that cannot take a 1 x 1 plate because the plate body meets other host
 * geometry, each with its measured reason. None: at catalog /31 all 1,125 stud
 * connectors of the 106 definitions take the plate without a collision.
 */
const STUDS_THAT_CANNOT_TAKE_A_1X1_PLATE: Readonly<Record<string, string>> = {};

const sameVector = (left: readonly number[], right: readonly number[]) =>
  left.every((value, axis) => value === right[axis]);

function seatedProbe(host: PartInstance, studId: string): PartInstance {
  const probe = getPartDefinition(PROBE_ID)!;
  const clutch = probe.connectors.find(({ id }) => id === PROBE_CLUTCH)!;
  const stud = getConnectorWorldFrame(host, studId);
  const facing = stud.normal.map((value) => -value);
  const candidates = PROPER_ORIENTATIONS.filter(({ matrix }) =>
    sameVector(rotateLduVector(matrix, clutch.normal), facing),
  );
  // Prefer an orientation the probe admits, so upright studs raise no policy issue.
  const orientation =
    candidates.find(({ id }) => probe.legalOrientationIds.includes(id)) ?? candidates[0];
  if (orientation === undefined) {
    throw new Error(
      `No proper orientation turns ${PROBE_CLUTCH} to face ${host.catalogPartId}/${studId}.`,
    );
  }
  const offset = rotateLduVector(orientation.matrix, clutch.positionLdu);
  return createPartInstance({
    id: "probe",
    catalogPartId: PROBE_ID,
    transform: {
      positionLdu: [
        stud.positionLdu[0] - offset[0],
        stud.positionLdu[1] - offset[1],
        stud.positionLdu[2] - offset[2],
      ],
      orientationId: orientation.id,
    },
  });
}

function seatedDocument(host: PartInstance, probe: PartInstance, studId: string): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "stud-seat-class", name: "Stud seat class gate" });
  const edge: ConnectionEdge = {
    id: "stud-to-probe",
    kind: "stud-tube",
    a: { partId: host.id, portId: studId },
    b: { partId: probe.id, portId: PROBE_CLUTCH },
    provenance: { source: "manual" },
  };
  const partIds = [host.id, probe.id];
  return {
    ...base,
    parts: [host, probe],
    connections: [edge],
    submodels: [{ ...base.submodels[0]!, partIds }],
    steps: [{ ...base.steps[0]!, partIds }],
  };
}

describe("stud seat collision class", () => {
  it("seats a 1 x 1 plate on every catalog stud through a validated edge without collision", () => {
    const failures: string[] = [];
    let seated = 0;
    for (const definition of PART_DEFINITIONS) {
      for (const { id: studId } of definition.connectors.filter(({ kind }) => kind === "stud")) {
        const label = `${definition.id}/${studId}`;
        if (Object.hasOwn(STUDS_THAT_CANNOT_TAKE_A_1X1_PLATE, label)) continue;
        const host = createPartInstance({ id: "host", catalogPartId: definition.id });
        const probe = seatedProbe(host, studId);
        const stud = getConnectorWorldFrame(host, studId);
        const clutch = getConnectorWorldFrame(probe, PROBE_CLUTCH);
        // The probe really sits on the stud, so a pass cannot come from a plate placed elsewhere.
        expect(clutch.positionLdu, label).toEqual(stud.positionLdu);
        expect(
          clutch.normal.map((value) => 0 - value),
          label,
        ).toEqual(stud.normal);

        const document = seatedDocument(host, probe, studId);
        if (validBrickConnections(document).length !== 1) {
          failures.push(`${label}: the stud-tube edge does not validate`);
        }
        const collisions = validateBrickDocument(document).issues.filter(
          ({ code, partIds }) =>
            COLLISION_CODES.has(code) &&
            partIds?.includes(host.id) === true &&
            partIds.includes(probe.id),
        );
        for (const { code, message } of collisions) failures.push(`${label}: ${code} ${message}`);
        seated += 1;
      }
    }

    expect(failures).toEqual([]);
    // Every stud was tried: a catalog with no studs, or a skip that grew, cannot pass quietly.
    expect(seated + Object.keys(STUDS_THAT_CANNOT_TAKE_A_1X1_PLATE).length).toBe(
      PART_DEFINITIONS.flatMap(({ connectors }) => connectors).filter(({ kind }) => kind === "stud")
        .length,
    );
    expect(seated).toBeGreaterThan(1000);
  });
});

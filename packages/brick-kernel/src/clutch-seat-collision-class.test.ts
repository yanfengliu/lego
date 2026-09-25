import { PART_DEFINITIONS, PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getConnectorWorldFrame, rotateLduVector } from "./transforms.ts";
import { validBrickConnections, validateBrickDocument } from "./validation.ts";

/**
 * Class gate for booklet step 40's defect: a stud seated in a clutch through a
 * validated stud-tube edge must not collide with the clutch's part. At /31,
 * 41682 had no clutch in its wall's back recess, where the booklet presses a
 * 1 x 2 round-end plate's two studs, and its height-field collision filled the
 * recess and stood two 1-LDU boxes past the wall's back face, so the plates
 * collided (PART_BODY_COLLISION, PART_STUD_BODY_COLLISION) and hung loose
 * (DISCONNECTED_ASSEMBLY).
 *
 * For every catalog part and every undersideClutch connector it declares,
 * whatever its normal, each probe below is seated by its one stud so the seats
 * coincide and the normals oppose, the stud-tube edge is added, and the
 * document is validated. The edge must validate and no collision may name both
 * parts. Two probes, because a seat can fail two ways: `plate-1x1`'s stud has
 * the nominal 6 LDU radius and catches solid in the seat's way; 73230's keeps
 * the LDraw source radius 6.0001514980873605 LDU with the nominal-stud-tube/1
 * profile, as the booklet's round-end plate does, so a snug seat collides by
 * 0.00015 LDU unless the seat's tube-seat allowance covers the stud.
 *
 * Bound: the host sits at the origin in upright-yaw-0 and each probe is a 1 x 1
 * part seated alone, so this says nothing about a second part nearby, a host in
 * another orientation, or a probe whose body is wider than one cell. A probe
 * turned to face a sideways seat may take an orientation it does not admit;
 * the document then also reports ILLEGAL_ORIENTATION, which this gate ignores
 * because it tests collision, not placement policy.
 */
const PROBES = [
  { id: "builtin:plate-1x1", stud: "stud:0:0" },
  { id: "builtin:technic-brick-1x1-axle-hole", stud: "stud:0" },
] as const;
const COLLISION_CODES = new Set([
  "PART_BODY_COLLISION",
  "PART_STUD_BODY_COLLISION",
  "PART_STUD_COLLISION",
]);

/**
 * Clutches that cannot take a probe because its body meets other host
 * geometry, each with its measured reason. None: at catalog /32 all 1,201
 * clutch connectors of the 106 definitions take both probes without a collision.
 */
const CLUTCHES_THAT_CANNOT_TAKE_A_PROBE: Readonly<Record<string, string>> = {};

const sameVector = (left: readonly number[], right: readonly number[]) =>
  left.every((value, axis) => value === right[axis]);

function seatedProbe(host: PartInstance, clutchId: string, probeId: string, studId: string) {
  const probe = getPartDefinition(probeId)!;
  const stud = probe.connectors.find(({ id }) => id === studId)!;
  const clutch = getConnectorWorldFrame(host, clutchId);
  const facing = clutch.normal.map((value) => -value);
  const candidates = PROPER_ORIENTATIONS.filter(({ matrix }) =>
    sameVector(rotateLduVector(matrix, stud.normal), facing),
  );
  // Prefer an orientation the probe admits, so underside seats raise no policy issue.
  const orientation =
    candidates.find(({ id }) => probe.legalOrientationIds.includes(id)) ?? candidates[0];
  if (orientation === undefined) {
    throw new Error(`No proper orientation turns ${probeId}/${studId} to face ${clutchId}.`);
  }
  const offset = rotateLduVector(orientation.matrix, stud.positionLdu);
  return createPartInstance({
    id: "probe",
    catalogPartId: probeId,
    transform: {
      positionLdu: [
        clutch.positionLdu[0] - offset[0],
        clutch.positionLdu[1] - offset[1],
        clutch.positionLdu[2] - offset[2],
      ],
      orientationId: orientation.id,
    },
  });
}

function seatedDocument(
  host: PartInstance,
  probe: PartInstance,
  clutchId: string,
  studId: string,
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "clutch-seat-class",
    name: "Clutch seat class gate",
  });
  const edge: ConnectionEdge = {
    id: "probe-to-clutch",
    kind: "stud-tube",
    a: { partId: probe.id, portId: studId },
    b: { partId: host.id, portId: clutchId },
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

describe("clutch seat collision class", () => {
  it.each(PROBES)(
    "seats $id by its stud in every catalog clutch through a validated edge without collision",
    ({ id: probeId, stud: studId }) => {
      const failures: string[] = [];
      let seated = 0;
      let sideways = 0;
      for (const definition of PART_DEFINITIONS) {
        const clutches = definition.connectors.filter(({ kind }) => kind === "undersideClutch");
        for (const { id: clutchId, normal } of clutches) {
          const label = `${definition.id}/${clutchId}`;
          if (Object.hasOwn(CLUTCHES_THAT_CANNOT_TAKE_A_PROBE, label)) continue;
          const host = createPartInstance({ id: "host", catalogPartId: definition.id });
          const probe = seatedProbe(host, clutchId, probeId, studId);
          const clutch = getConnectorWorldFrame(host, clutchId);
          const stud = getConnectorWorldFrame(probe, studId);
          // The probe really sits in the seat, so a pass cannot come from a part placed elsewhere.
          expect(stud.positionLdu, label).toEqual(clutch.positionLdu);
          expect(
            stud.normal.map((value) => 0 - value),
            label,
          ).toEqual(clutch.normal);

          const document = seatedDocument(host, probe, clutchId, studId);
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
          if (normal[1] !== 1) sideways += 1;
        }
      }

      expect(failures).toEqual([]);
      // Every clutch was tried: a catalog with no clutches, or a skip that grew, cannot pass quietly.
      expect(seated + Object.keys(CLUTCHES_THAT_CANNOT_TAKE_A_PROBE).length).toBe(
        PART_DEFINITIONS.flatMap(({ connectors }) => connectors).filter(
          ({ kind }) => kind === "undersideClutch",
        ).length,
      );
      expect(seated).toBeGreaterThan(1000);
      // 41682's two recess seats face +Z; losing them would shrink the class to underside seats.
      expect(sideways).toBe(2);
    },
  );
});

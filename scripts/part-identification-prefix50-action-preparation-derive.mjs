import { isDeepStrictEqual } from "node:util";

import {
  PREFIX50_RECONCILED_PHASES_BY_STEP,
  PREFIX50_REPEAT_ROWS,
} from "./part-identification-prefix50-action-preparation-source.mjs";

function phaseMembers(official) {
  let sourceBuilderIdentityOrdinal = 0;
  return official.builderOrder.phases.map((phase) => {
    const identities =
      phase.kind === "direct"
        ? phase.brickRefs.map((builderBrickRef) => ({
            builderBrickRef,
            sourceBuilderBrickRef: null,
          }))
        : phase.copies.map(({ actualBrickRef, sourceBrickRef }) => ({
            builderBrickRef: actualBrickRef,
            sourceBuilderBrickRef: sourceBrickRef,
          }));
    const members = identities.map((identity, phaseMemberOrdinal) => {
      const brick = official.bricks[identity.builderBrickRef];
      if (brick === undefined || brick.itemNos.length !== 1) {
        throw new Error(
          `Official Builder phase ${phase.sequence} member ${identity.builderBrickRef} requires exactly one element identity.`,
        );
      }
      sourceBuilderIdentityOrdinal += 1;
      return {
        phaseMemberOrdinal: phaseMemberOrdinal + 1,
        sourceBuilderIdentityOrdinal,
        ...identity,
        elementId: brick.itemNos[0],
        officialDesignId: brick.designId,
        designRevision: brick.designRevision,
        materialId: brick.materialId,
      };
    });
    return { phase, members };
  });
}

function printedStepCallouts(manifestEvidence, coverage, stepNumber) {
  return manifestEvidence.callouts
    .filter((row) => row.evidenceKind === "part-art" && row.stepNumber === stepNumber)
    .map((source) => {
      const covered = coverage.byCallout[source.identity];
      if (
        covered?.identificationConfidence !== "prefix50-semantic-closure" ||
        covered.identity !== source.identity ||
        covered.pageNumber !== source.pageNumber ||
        covered.stepNumber !== source.stepNumber ||
        covered.quantity !== source.quantity ||
        covered.cropDigest !== source.sha256 ||
        typeof covered.elementId !== "string" ||
        covered.semanticEvidence === null ||
        typeof covered.resolution?.outcome !== "string" ||
        typeof covered.resolution?.catalogPartId !== "string"
      ) {
        throw new Error(
          `Printed step ${stepNumber} callout ${source.identity} is not one exact authenticated semantic-coverage /4 row.`,
        );
      }
      return { source, covered };
    });
}

function chooseStepPhases(stepNumber, quantity, state, allPhases) {
  if (stepNumber === 31 || stepNumber === 32) {
    return PREFIX50_RECONCILED_PHASES_BY_STEP[stepNumber].map(
      (sequence) => allPhases[sequence - 1],
    );
  }
  const selected = [];
  let pieces = 0;
  while (pieces < quantity) {
    const candidate = allPhases[state.phaseIndex];
    if (candidate === undefined || candidate.phase.sequence > 95) {
      throw new Error(`Printed step ${stepNumber} exhausted the bounded first-95 Builder phases.`);
    }
    if (candidate.phase.sequence >= 49 && candidate.phase.sequence <= 54) {
      throw new Error(
        `Printed step ${stepNumber} reached the token-gated phase-49..54 window outside steps 31/32.`,
      );
    }
    if (pieces + candidate.members.length > quantity) {
      throw new Error(
        `Printed step ${stepNumber} quantity ${quantity} would split complete Builder phase ${candidate.phase.sequence}.`,
      );
    }
    selected.push(candidate);
    pieces += candidate.members.length;
    state.phaseIndex += 1;
  }
  return selected;
}

function assignCallouts(callouts, selectedPhases, stepNumber) {
  const members = selectedPhases.flatMap(({ members }) => members.map((member) => ({ ...member })));
  const unassigned = new Set(members.map(({ builderBrickRef }) => builderBrickRef));
  const published = callouts.map(({ source, covered }) => {
    const available = members.filter(
      (member) => unassigned.has(member.builderBrickRef) && member.elementId === covered.elementId,
    );
    if (available.length !== source.quantity) {
      throw new Error(
        `Printed step ${stepNumber} callout ${source.identity} needs ${source.quantity} exact element ${covered.elementId} identities; complete selected phases provide ${available.length}.`,
      );
    }
    for (const member of available) {
      if (member.officialDesignId !== covered.semanticEvidence.officialDesignId) {
        throw new Error(
          `Printed step ${stepNumber} callout ${source.identity} publishes official design ${covered.semanticEvidence.officialDesignId}, but Builder identity ${member.builderBrickRef} is ${member.officialDesignId}.`,
        );
      }
      member.calloutIdentity = source.identity;
      unassigned.delete(member.builderBrickRef);
    }
    return {
      identity: source.identity,
      pageNumber: source.pageNumber,
      stepNumber: source.stepNumber,
      quantity: source.quantity,
      cropDigest: source.sha256,
      elementId: covered.elementId,
      identificationConfidence: covered.identificationConfidence,
      evidenceMethod: covered.semanticEvidence.evidenceMethod,
      publishedPartNum: covered.semanticEvidence.publishedPartNum,
      officialDesignId: covered.semanticEvidence.officialDesignId,
      publishedMatchesOfficialDesignId: covered.semanticEvidence.publishedMatchesOfficialDesignId,
      publishedColorId: covered.resolution.colorId,
      resolutionOutcome: covered.resolution.outcome,
      catalogPartId: covered.resolution.catalogPartId,
      preparedBuilderBrickRefs: available.map(({ builderBrickRef }) => builderBrickRef),
    };
  });
  if (unassigned.size !== 0) {
    throw new Error(
      `Printed step ${stepNumber} leaves ${unassigned.size} Builder identities outside its exact callout quantities.`,
    );
  }
  return { callouts: published, members };
}

function repeatForStep(manifestEvidence, selectedPhases, stepNumber) {
  const expected = PREFIX50_REPEAT_ROWS.find((row) => row.stepNumber === stepNumber);
  const sourceRows = manifestEvidence.callouts.filter(
    (row) => row.evidenceKind === "subassembly-repeat" && row.stepNumber === stepNumber,
  );
  if (expected === undefined) {
    if (sourceRows.length !== 0) {
      throw new Error(`Printed step ${stepNumber} has an unexpected subassembly-repeat row.`);
    }
    return null;
  }
  const source = sourceRows[0];
  if (
    sourceRows.length !== 1 ||
    source?.identity !== expected.identity ||
    source.pageNumber !== expected.pageNumber ||
    source.quantity !== expected.quantity ||
    source.sha256 !== expected.cropDigest
  ) {
    throw new Error(`Printed step ${stepNumber} no longer carries its one exact repeat row.`);
  }
  const phaseSequences = selectedPhases.map(({ phase }) => phase.sequence);
  const observedMasters = selectedPhases
    .filter(
      ({ phase }) =>
        phase.kind === "direct" && expected.masterPhaseSequences.includes(phase.sequence),
    )
    .map(({ phase }) => phase.sequence);
  const observedCopies = selectedPhases
    .filter(({ phase }) => phase.kind === "multi-build-copy")
    .map(({ phase }) => phase.sequence);
  if (
    !isDeepStrictEqual(observedMasters, expected.masterPhaseSequences) ||
    !isDeepStrictEqual(observedCopies, expected.copyPhaseSequences) ||
    expected.masterPhaseSequences.some((sequence) => !phaseSequences.includes(sequence))
  ) {
    throw new Error(
      `Printed step ${stepNumber} repeat phases drifted from its exact mixed direct/copy partition.`,
    );
  }
  return {
    identity: source.identity,
    pageNumber: source.pageNumber,
    stepNumber: source.stepNumber,
    quantity: source.quantity,
    evidenceKind: source.evidenceKind,
    cropDigest: source.sha256,
    masterPhaseSequences: [...expected.masterPhaseSequences],
    copyPhaseSequences: [...expected.copyPhaseSequences],
  };
}

function phasePublication(selectedPhases, members) {
  const bySequence = new Map();
  for (const member of members) {
    const sequence = selectedPhases.find(({ members: rows }) =>
      rows.some(({ builderBrickRef }) => builderBrickRef === member.builderBrickRef),
    )?.phase.sequence;
    const rows = bySequence.get(sequence) ?? [];
    rows.push(member);
    bySequence.set(sequence, rows);
  }
  return selectedPhases.map(({ phase }) => ({
    kind: phase.kind,
    sequence: phase.sequence,
    phaseId: phase.phaseId,
    sourceDigest: phase.sourceDigest,
    stepUuid: phase.stepUuid,
    subBuildPath: [...phase.subBuildPath],
    ...(phase.kind === "multi-build-copy"
      ? { multiBuildName: phase.multiBuildName, masterSubBuildRef: phase.masterSubBuildRef }
      : {}),
    members: bySequence.get(phase.sequence) ?? [],
  }));
}

function multiset(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.elementId}\u0000${row.officialDesignId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, quantity]) => {
      const [elementId, officialDesignId] = key.split("\u0000");
      return { elementId, designId: officialDesignId, quantity };
    })
    .sort((left, right) => left.elementId.localeCompare(right.elementId));
}

function assertSpecialWindow(steps, proof) {
  const step31 = steps[30];
  const step32 = steps[31];
  if (
    !isDeepStrictEqual(step31.phaseSequences, PREFIX50_RECONCILED_PHASES_BY_STEP[31]) ||
    !isDeepStrictEqual(step32.phaseSequences, PREFIX50_RECONCILED_PHASES_BY_STEP[32]) ||
    !isDeepStrictEqual(step31.sourceBuilderIdentityOrdinals, [183, 184, 185, 186]) ||
    !isDeepStrictEqual(
      step32.sourceBuilderIdentityOrdinals,
      [181, 182, 187, 188, 189, 190, 191, 192, 193, 194],
    ) ||
    step31.printedPieceCursorBefore !== 180 ||
    step31.printedPieceCursorAfter !== 184 ||
    step32.printedPieceCursorBefore !== 184 ||
    step32.printedPieceCursorAfter !== 194
  ) {
    throw new Error("The token-gated step-31/32 phase partition or printed cursor facts drifted.");
  }
  for (const step of [step31, step32]) {
    const expected = proof.artifact.reconciledSteps.find(
      (row) => row.stepNumber === step.stepNumber,
    );
    if (
      !isDeepStrictEqual(
        multiset(step.phases.flatMap(({ members }) => members)),
        expected?.multiset,
      )
    ) {
      throw new Error(
        `Printed step ${step.stepNumber} no longer reproduces the opaque order proof's exact multiset.`,
      );
    }
  }
}

function assertCopyBindings(steps) {
  const stepByBrick = new Map();
  const memberByBrick = new Map();
  for (const step of steps) {
    for (const phase of step.phases) {
      for (const member of phase.members) {
        stepByBrick.set(member.builderBrickRef, step.stepNumber);
        memberByBrick.set(member.builderBrickRef, { member, phase });
      }
    }
  }
  for (const step of steps) {
    for (const phase of step.phases.filter(({ kind }) => kind === "multi-build-copy")) {
      for (const member of phase.members) {
        const source = memberByBrick.get(member.sourceBuilderBrickRef);
        if (
          source?.phase.kind !== "direct" ||
          stepByBrick.get(member.sourceBuilderBrickRef) !== step.stepNumber ||
          !source.phase.subBuildPath.includes(phase.masterSubBuildRef) ||
          source.member.elementId !== member.elementId ||
          source.member.officialDesignId !== member.officialDesignId ||
          source.member.designRevision !== member.designRevision ||
          source.member.materialId !== member.materialId ||
          source.member.calloutIdentity !== member.calloutIdentity
        ) {
          throw new Error(
            `Printed step ${step.stepNumber} copy ${member.builderBrickRef} is not bound to one exact same-step direct master identity.`,
          );
        }
      }
    }
  }
}

export function derivePrefix50ActionPreparationSteps(manifestEvidence, coverage, official, proof) {
  const allPhases = phaseMembers(official);
  const state = { phaseIndex: 0 };
  const usedPhaseSequences = new Set();
  const steps = [];
  let printedPieceCursor = 0;
  for (let stepNumber = 1; stepNumber <= 50; stepNumber += 1) {
    if (stepNumber === 32) state.phaseIndex = 54;
    const calloutInputs = printedStepCallouts(manifestEvidence, coverage, stepNumber);
    const quantity = calloutInputs.reduce((total, { source }) => total + source.quantity, 0);
    const selectedPhases = chooseStepPhases(stepNumber, quantity, state, allPhases);
    const selectedPieces = selectedPhases.reduce((total, phase) => total + phase.members.length, 0);
    if (selectedPieces !== quantity) {
      throw new Error(
        `Printed step ${stepNumber} selects ${selectedPieces} complete Builder identities for ${quantity} printed pieces.`,
      );
    }
    for (const { phase } of selectedPhases) {
      if (usedPhaseSequences.has(phase.sequence)) {
        throw new Error(
          `Builder phase ${phase.sequence} was assigned to more than one printed step.`,
        );
      }
      usedPhaseSequences.add(phase.sequence);
    }
    const assigned = assignCallouts(calloutInputs, selectedPhases, stepNumber);
    const sourceBuilderIdentityOrdinals = assigned.members
      .map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal)
      .sort((left, right) => left - right);
    const before = printedPieceCursor;
    printedPieceCursor += quantity;
    steps.push({
      stepNumber,
      printedPieceCursorBefore: before,
      printedPieceCursorAfter: printedPieceCursor,
      printedPieces: quantity,
      sourceBuilderIdentityOrdinals,
      phaseSequences: selectedPhases.map(({ phase }) => phase.sequence),
      orderBasis:
        stepNumber === 31 || stepNumber === 32
          ? "opaque-step31-32-reconciliation"
          : quantity === 0
            ? "zero-piece-printed-row"
            : "complete-builder-phase-prefix",
      repeat: repeatForStep(manifestEvidence, selectedPhases, stepNumber),
      callouts: assigned.callouts,
      phases: phasePublication(selectedPhases, assigned.members),
    });
  }
  if (
    printedPieceCursor !== 320 ||
    usedPhaseSequences.size !== 95 ||
    [...usedPhaseSequences].some((sequence) => sequence < 1 || sequence > 95)
  ) {
    throw new Error(
      `Prefix-50 preparation must consume all and only 95 complete Builder phases / 320 identities; received ${usedPhaseSequences.size}/${printedPieceCursor}.`,
    );
  }
  assertSpecialWindow(steps, proof);
  assertCopyBindings(steps);
  return steps;
}

export function prefix50ActionPreparationAccounting(steps) {
  const phases = steps.flatMap((step) => step.phases);
  const identities = phases.flatMap((phase) => phase.members);
  return {
    printedStepRows: steps.length,
    partBearingStepRows: steps.filter(({ printedPieces }) => printedPieces > 0).length,
    zeroPieceStepRows: steps.filter(({ printedPieces }) => printedPieces === 0).length,
    calloutRows: steps.reduce((total, step) => total + step.callouts.length, 0),
    physicalIdentities: identities.length,
    builderPhases: phases.length,
    directPhases: phases.filter(({ kind }) => kind === "direct").length,
    copyPhases: phases.filter(({ kind }) => kind === "multi-build-copy").length,
    directIdentities: phases
      .filter(({ kind }) => kind === "direct")
      .reduce((total, phase) => total + phase.members.length, 0),
    copyIdentities: phases
      .filter(({ kind }) => kind === "multi-build-copy")
      .reduce((total, phase) => total + phase.members.length, 0),
    repeatRows: steps.filter(({ repeat }) => repeat !== null).length,
  };
}

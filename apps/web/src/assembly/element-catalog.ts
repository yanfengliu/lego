import { COLOR_DEFINITIONS, PART_DEFINITIONS, resolvePartId } from "@lego-studio/catalog";

/**
 * The bridge from what a booklet names to what this catalog can place.
 *
 * Part identification reads a step's callout drawing and answers with an
 * element id — `6092585` — which is a moulding of a shape in a colour. Nothing
 * downstream can place that: the enumerator, the collision world and the
 * renderer all speak catalog part ids. The published parts list resolves an
 * element to a design number (`3020`) and a colour, and the catalog already
 * carries every part's LDraw identifier as an alias, so the join is design
 * number to `ldrawId` and the only real work is knowing which spellings of a
 * design number mean the same shape.
 *
 * Two of them do. A trailing lowercase letter is a mould revision — `3069b` is
 * the grooved tile that replaced `3069`, `41769a` the wedge plate that replaced
 * `41769` — and a `pr####` or `pat####` suffix is the same mould with something
 * printed on it. Both are the same solid, so both resolve, and both say so:
 * `outcome` is `variant` rather than `exact` and `note` names what was dropped.
 * A caller that must not accept an approximation can filter on that.
 *
 * Nothing else is tolerated. A design number the catalog does not carry comes
 * back `absent` naming the number and the printed name, because the honest
 * answer to "this step needs a Plate Round Corner 4 x 4" is that the catalog
 * has none — never the nearest rectangle. A substituted part rebuilds a model
 * that looks plausible and is wrong, which is worse than a rebuild that stops.
 */
export const ELEMENT_CATALOG_SCHEMA_VERSION = "lego.element-catalog/1" as const;

export interface BookletElement {
  /** The moulding id printed in the parts list, e.g. `6092585`. */
  readonly elementId: string;
  /** Published design number, e.g. `3020`, `3069b`, `4162pr0074`. */
  readonly partNum: string;
  /** Published name, used only in diagnostics. */
  readonly name: string;
  /** Published colour id, which follows LDraw's numbering for the common colours. */
  readonly colorId: number | string;
}

export type ElementResolutionOutcome = "exact" | "variant" | "absent";

export interface ElementResolution {
  readonly schemaVersion: typeof ELEMENT_CATALOG_SCHEMA_VERSION;
  readonly outcome: ElementResolutionOutcome;
  readonly elementId: string;
  readonly partNum: string;
  readonly name: string;
  /** Catalog part id, or null when the catalog carries no such shape. */
  readonly catalogPartId: string | null;
  /** Catalog colour id; falls back to black when the published code is unknown. */
  readonly colorId: string;
  /** What was dropped to make the match, or why nothing matched. */
  readonly note: string | null;
}

/** Every design number the catalog can place, in the spelling it carries. */
export function catalogDesignNumbers(): readonly string[] {
  return PART_DEFINITIONS.flatMap((part) =>
    part.aliases
      .filter((alias) => alias.namespace === "ldraw")
      .map((alias) => alias.value.replace(/\.dat$/i, "")),
  );
}

const PRINT_SUFFIX = /(p[a-z]*\d+[a-z\d]*)$/i;
const MOULD_LETTER = /[a-z]$/i;

/**
 * Design-number spellings to try, most exact first.
 *
 * Only ever removes: a print or pattern suffix, which leaves the undecorated
 * mould, and one trailing mould-revision letter. It never adds a letter that
 * was not printed and never truncates digits, so `3021` cannot reach `3020`.
 */
function spellings(partNum: string): readonly { readonly value: string; readonly note: string }[] {
  const tried: { value: string; note: string }[] = [{ value: partNum, note: "" }];
  const undecorated = partNum.replace(PRINT_SUFFIX, "");
  if (undecorated !== partNum && undecorated.length > 0) {
    tried.push({
      value: undecorated,
      note: `dropped the print suffix "${partNum.slice(undecorated.length)}"; the catalog carries the undecorated mould ${undecorated}`,
    });
  }
  for (const base of [...tried]) {
    if (!MOULD_LETTER.test(base.value)) continue;
    const bare = base.value.slice(0, -1);
    if (bare.length === 0 || !/\d$/.test(bare)) continue;
    tried.push({
      value: bare,
      note: [
        base.note,
        `dropped the mould-revision letter "${base.value.slice(-1)}" from ${base.value}`,
      ]
        .filter(Boolean)
        .join("; "),
    });
  }
  // The other direction: the booklet may print the bare number where the
  // catalog carries a revision. Only the revisions the catalog itself holds are
  // offered, so this cannot invent a part.
  for (const base of [...tried]) {
    for (const candidate of catalogDesignNumbers()) {
      if (candidate === base.value) continue;
      if (!MOULD_LETTER.test(candidate)) continue;
      if (candidate.slice(0, -1) !== base.value) continue;
      tried.push({
        value: candidate,
        note: [
          base.note,
          `matched the catalog's mould revision ${candidate} of design ${base.value}`,
        ]
          .filter(Boolean)
          .join("; "),
      });
    }
  }
  return tried;
}

const COLOR_BY_LDRAW_CODE = new Map(COLOR_DEFINITIONS.map((color) => [color.ldrawCode, color.id]));
const FALLBACK_COLOR_ID = "builtin:black";

export interface ColorResolution {
  readonly colorId: string;
  /** Set when the published code named no catalog colour and black stood in. */
  readonly note: string | null;
}

/**
 * The catalog colour a published colour code names.
 *
 * The published list numbers its colours the way LDraw does for everything this
 * booklet uses — 0 black, 15 white, 71 and 72 the two bluish greys — so the
 * catalog's own `ldrawCode` is the join. Colour does not enter placement, so an
 * unknown code falls back rather than refusing, but it says that it did.
 */
export function resolveElementColor(colorId: number | string): ColorResolution {
  const code = typeof colorId === "number" ? colorId : Number.parseInt(colorId, 10);
  if (!Number.isInteger(code)) {
    return {
      colorId: FALLBACK_COLOR_ID,
      note: `Published colour "${String(colorId)}" is not an integer LDraw colour code, so the part is coloured black; colour does not affect placement.`,
    };
  }
  const matched = COLOR_BY_LDRAW_CODE.get(code);
  if (matched !== undefined) return { colorId: matched, note: null };
  return {
    colorId: FALLBACK_COLOR_ID,
    note: `No catalog colour carries LDraw code ${code}, so the part is coloured black; colour does not affect placement, and the palette is extended in packages/catalog COLOR_DEFINITIONS.`,
  };
}

/** The catalog part a booklet element names, or a specific account of why none. */
export function resolveElementPart(element: BookletElement): ElementResolution {
  const color = resolveElementColor(element.colorId);
  const base = {
    schemaVersion: ELEMENT_CATALOG_SCHEMA_VERSION,
    elementId: element.elementId,
    partNum: element.partNum,
    name: element.name,
    colorId: color.colorId,
  } as const;

  for (const { value, note } of spellings(element.partNum)) {
    const catalogPartId = resolvePartId(`${value}.dat`);
    if (catalogPartId === undefined) continue;
    const notes = [note, color.note].filter((entry) => entry !== null && entry !== "");
    return {
      ...base,
      outcome: note === "" ? "exact" : "variant",
      catalogPartId,
      note: notes.length === 0 ? null : notes.join("; "),
    };
  }

  return {
    ...base,
    outcome: "absent",
    catalogPartId: null,
    note:
      `The catalog has no part for design ${element.partNum} ("${element.name}", element ${element.elementId}). ` +
      `Spellings tried: ${spellings(element.partNum)
        .map(({ value }) => `${value}.dat`)
        .join(", ")}. ` +
      `Nothing else may stand in for it — a step that places a different shape rebuilds a model that is wrong while looking right. ` +
      `Admit ${element.partNum}: from measured source into packages/catalog/src/part-blueprints-6651557-measured.ts, which needs its exact LDraw closure, reviewed source-to-catalog frame, connector authority and collision decomposition, or parametrically into packages/catalog/src/part-blueprints.ts if the shape really is describable by the generators. Either way bump BUILTIN_CATALOG_VERSION and extend MIGRATABLE_CATALOG_VERSIONS.`,
  };
}

export interface StepPartRequirement {
  readonly stepNumber: number;
  readonly quantity: number;
  readonly resolution: ElementResolution;
}

export interface StepCatalogCoverage {
  readonly stepNumber: number;
  readonly pieces: number;
  readonly placeablePieces: number;
  readonly covered: boolean;
  readonly parts: readonly {
    readonly catalogPartId: string | null;
    readonly colorId: string;
    readonly quantity: number;
    readonly outcome: ElementResolutionOutcome;
  }[];
  /** One line per design number this step needs and the catalog lacks. */
  readonly missing: readonly string[];
}

export interface CatalogCoverage {
  readonly schemaVersion: typeof ELEMENT_CATALOG_SCHEMA_VERSION;
  readonly steps: readonly StepCatalogCoverage[];
  readonly stepsCovered: number;
  readonly stepsTotal: number;
  /** First step every one of whose parts the catalog carries. */
  readonly firstCoveredStep: number | null;
  /** Longest run of covered steps starting at the first step, which is what a build needs. */
  readonly coveredPrefixLength: number;
  readonly piecesPlaceable: number;
  readonly piecesTotal: number;
  /** Design numbers the catalog lacks, most-needed first. */
  readonly missingDesigns: readonly {
    readonly partNum: string;
    readonly name: string;
    readonly callouts: number;
    readonly pieces: number;
    readonly steps: readonly number[];
  }[];
}

/** How much of a booklet's opening the catalog can place, step by step. */
export function summarizeCatalogCoverage(
  requirements: readonly StepPartRequirement[],
): CatalogCoverage {
  const byStep = new Map<number, StepPartRequirement[]>();
  for (const requirement of requirements) {
    const bucket = byStep.get(requirement.stepNumber) ?? [];
    bucket.push(requirement);
    byStep.set(requirement.stepNumber, bucket);
  }

  const steps: StepCatalogCoverage[] = [];
  const missing = new Map<
    string,
    { name: string; callouts: number; pieces: number; steps: Set<number> }
  >();
  for (const stepNumber of [...byStep.keys()].sort((left, right) => left - right)) {
    const entries = byStep.get(stepNumber)!;
    const absent = entries.filter(({ resolution }) => resolution.outcome === "absent");
    for (const entry of absent) {
      const record = missing.get(entry.resolution.partNum) ?? {
        name: entry.resolution.name,
        callouts: 0,
        pieces: 0,
        steps: new Set<number>(),
      };
      record.callouts += 1;
      record.pieces += entry.quantity;
      record.steps.add(stepNumber);
      missing.set(entry.resolution.partNum, record);
    }
    steps.push({
      stepNumber,
      pieces: entries.reduce((total, entry) => total + entry.quantity, 0),
      placeablePieces: entries
        .filter(({ resolution }) => resolution.catalogPartId !== null)
        .reduce((total, entry) => total + entry.quantity, 0),
      covered: absent.length === 0,
      parts: entries.map((entry) => ({
        catalogPartId: entry.resolution.catalogPartId,
        colorId: entry.resolution.colorId,
        quantity: entry.quantity,
        outcome: entry.resolution.outcome,
      })),
      missing: absent.map(
        ({ resolution }) =>
          `${resolution.partNum} (${resolution.name}, element ${resolution.elementId})`,
      ),
    });
  }

  let prefix = 0;
  for (const step of steps) {
    if (!step.covered) break;
    prefix += 1;
  }

  return {
    schemaVersion: ELEMENT_CATALOG_SCHEMA_VERSION,
    steps,
    stepsCovered: steps.filter(({ covered }) => covered).length,
    stepsTotal: steps.length,
    firstCoveredStep: steps.find(({ covered }) => covered)?.stepNumber ?? null,
    coveredPrefixLength: prefix,
    piecesPlaceable: steps.reduce((total, step) => total + step.placeablePieces, 0),
    piecesTotal: steps.reduce((total, step) => total + step.pieces, 0),
    missingDesigns: [...missing.entries()]
      .map(([partNum, record]) => ({
        partNum,
        name: record.name,
        callouts: record.callouts,
        pieces: record.pieces,
        steps: [...record.steps].sort((left, right) => left - right),
      }))
      .sort((left, right) => right.pieces - left.pieces || right.callouts - left.callouts),
  };
}

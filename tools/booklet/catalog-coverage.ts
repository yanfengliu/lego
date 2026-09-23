import {
  isInterchangeableLdrawMouldRevisionBase,
  type ColorDefinition,
  type PartDefinition,
} from "@lego-studio/catalog";

import type { AnswerKey } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";

/**
 * Stage 3: can the catalog represent every design the official model uses?
 *
 * A design is covered when a catalog part declares the design's exact LDraw
 * file as its alias and carries connectors and collision primitives. A part
 * declared for another LDraw mould revision of the same design number (41769a
 * for the official 41769, 3023 for 3023b) covers it as `interchangeable` only
 * when the catalog's own variant policy says that design's revisions are
 * interchangeable (`isInterchangeableLdrawMouldRevisionBase`); it is counted
 * apart from `exact` and never reported as exact. Revisions the policy calls
 * physically distinct (2453, 3245) are `missing` unless the exact file is
 * declared.
 */
export const CATALOG_STAGE_VERSION = "lego.booklet-catalog/1";

export type Coverage = "exact" | "interchangeable" | "missing";

export interface DesignCoverage {
  /** Official LDraw file, or `<designID>.dat` when no LDraw export is paired. */
  readonly design: string;
  readonly designIds: readonly string[];
  readonly pieces: number;
  readonly coverage: Coverage;
  readonly catalogPartId: string | null;
  readonly catalogAlias: string | null;
  readonly note: string;
  /** First printed step that places this design, when the booklet is aligned. */
  readonly firstStep: number | null;
}

export interface ColorCoverage {
  readonly ldrawCode: number;
  readonly pieces: number;
  readonly colorId: string | null;
  readonly firstStep: number | null;
}

export interface CatalogStage {
  readonly version: typeof CATALOG_STAGE_VERSION;
  readonly catalogVersion: string;
  readonly mappingBasis: "official-ldraw-export" | "lxfml-design-id";
  readonly designs: readonly DesignCoverage[];
  readonly totals: {
    readonly designs: number;
    readonly exact: number;
    readonly interchangeable: number;
    readonly missing: number;
    readonly pieces: number;
    readonly piecesExact: number;
    readonly piecesInterchangeable: number;
    readonly piecesMissing: number;
  };
  readonly firstStepNeedingMissing: {
    readonly step: number;
    readonly designs: readonly string[];
  } | null;
  readonly firstStepNeedingInterchangeable: {
    readonly step: number;
    readonly designs: readonly string[];
  } | null;
  /** Colours by LDraw code; empty without a paired LDraw export (LXFML materials are not LDraw codes). */
  readonly colors: readonly ColorCoverage[];
  readonly firstStepNeedingMissingColor: {
    readonly step: number;
    readonly codes: readonly number[];
  } | null;
  /** Coverage keyed by brick uuid, for playback. */
  readonly byBrick: Readonly<
    Record<
      string,
      {
        readonly design: string;
        readonly coverage: Coverage;
        readonly catalogPartId: string | null;
      }
    >
  >;
}

export interface CatalogTruth {
  readonly version: string;
  readonly parts: readonly PartDefinition[];
  readonly colors: readonly ColorDefinition[];
}

const rootOf = (filename: string): string =>
  /^(\d+)/u.exec(filename)?.[1] ?? filename.replace(/\.dat$/u, "");

function firstStepWhere(
  align: AlignStage | null,
  predicate: (uuid: string) => boolean,
): { step: number; bricks: string[] } | null {
  if (!align) return null;
  for (const step of align.steps) {
    const bricks = step.bricks.filter(predicate);
    if (bricks.length > 0) return { step: step.step, bricks };
  }
  return null;
}

export function runCatalogStage(
  key: AnswerKey,
  align: AlignStage | null,
  catalog: CatalogTruth,
): CatalogStage {
  const aliasOf = new Map<string, PartDefinition>();
  const byRoot = new Map<string, PartDefinition[]>();
  for (const part of catalog.parts) {
    for (const alias of part.aliases) {
      if (alias.namespace !== "ldraw") continue;
      const value = alias.value.toLowerCase();
      aliasOf.set(value, part);
      byRoot.set(rootOf(value), [...(byRoot.get(rootOf(value)) ?? []), part]);
    }
  }
  const paired = key.ldraw.status === "paired" ? key.ldraw.pairing : null;
  const stepOf = new Map<string, number>();
  for (const step of align?.steps ?? [])
    for (const brick of step.bricks) stepOf.set(brick, step.step);

  const groups = new Map<
    string,
    { designIds: Set<string>; bricks: string[]; composite: boolean }
  >();
  for (const brick of key.model.bricks) {
    const official = paired?.byBrick.get(brick.uuid);
    const design = official ? official.filename : `${brick.designId}.dat`;
    const group = groups.get(design) ?? {
      designIds: new Set(),
      bricks: [],
      composite: official?.composite ?? brick.parts.length > 1,
    };
    group.designIds.add(brick.designId);
    group.bricks.push(brick.uuid);
    groups.set(design, group);
  }

  const byBrick: Record<
    string,
    { design: string; coverage: Coverage; catalogPartId: string | null }
  > = {};
  const designs: DesignCoverage[] = [...groups.entries()].map(([design, group]) => {
    let coverage: Coverage = "missing";
    let part: PartDefinition | null = null;
    let note: string;
    const exact = aliasOf.get(design);
    const variants = byRoot.get(rootOf(design)) ?? [];
    if (group.composite) {
      note = `multi-part assembly of ${group.designIds.size === 1 ? [...group.designIds][0] : "several designs"}; the catalog has no assemblies`;
    } else if (exact) {
      part = exact;
      coverage = "exact";
      note = `catalog ${exact.id}`;
    } else if (variants.length > 0) {
      const root = rootOf(design);
      const chosen = variants.length === 1 ? variants[0]! : (aliasOf.get(`${root}.dat`) ?? null);
      const alias = chosen?.aliases.find(({ namespace }) => namespace === "ldraw")?.value ?? "";
      if (chosen && isInterchangeableLdrawMouldRevisionBase(root)) {
        part = chosen;
        coverage = "interchangeable";
        note = `catalog ${chosen.id} declares ${alias}, an interchangeable mould revision of ${design}`;
      } else if (chosen) {
        note = `catalog declares only ${alias}; the variant policy calls ${root} revisions physically distinct, so ${design} needs its own part`;
      } else {
        note = `${variants.length} catalog revisions of design ${root} and none is ${design} or ${root}.dat`;
      }
    } else {
      note = `no catalog part declares design ${rootOf(design)}`;
    }
    if (part && (part.connectors.length === 0 || part.collision.primitives.length === 0)) {
      note = `${part.id} lacks ${part.connectors.length === 0 ? "connectors" : "collision primitives"}`;
      coverage = "missing";
      part = null;
    }
    for (const uuid of group.bricks)
      byBrick[uuid] = { design, coverage, catalogPartId: part?.id ?? null };
    const first = group.bricks
      .map((uuid) => stepOf.get(uuid))
      .filter((step): step is number => step !== undefined);
    return {
      design,
      designIds: [...group.designIds].sort(),
      pieces: group.bricks.length,
      coverage,
      catalogPartId: part?.id ?? null,
      catalogAlias: part?.aliases.find(({ namespace }) => namespace === "ldraw")?.value ?? null,
      note,
      firstStep: first.length === 0 ? null : Math.min(...first),
    };
  });
  designs.sort(
    (left, right) =>
      (left.firstStep ?? 1e9) - (right.firstStep ?? 1e9) || left.design.localeCompare(right.design),
  );

  const count = (coverage: Coverage) => designs.filter((entry) => entry.coverage === coverage);
  const pieces = (coverage: Coverage) =>
    count(coverage).reduce((sum, entry) => sum + entry.pieces, 0);
  const missingFirst = firstStepWhere(align, (uuid) => byBrick[uuid]?.coverage === "missing");
  const interchangeableFirst = firstStepWhere(
    align,
    (uuid) => byBrick[uuid]?.coverage === "interchangeable",
  );

  const colorByCode = new Map(catalog.colors.map((color) => [color.ldrawCode, color] as const));
  const colorGroups = new Map<number, string[]>();
  for (const [uuid, official] of paired?.byBrick ?? []) {
    if (official.composite) continue;
    colorGroups.set(official.colorCode, [...(colorGroups.get(official.colorCode) ?? []), uuid]);
  }
  const colors: ColorCoverage[] = [...colorGroups.entries()]
    .map(([ldrawCode, bricks]) => {
      const first = bricks
        .map((uuid) => stepOf.get(uuid))
        .filter((step): step is number => step !== undefined);
      return {
        ldrawCode,
        pieces: bricks.length,
        colorId: colorByCode.get(ldrawCode)?.id ?? null,
        firstStep: first.length === 0 ? null : Math.min(...first),
      };
    })
    .sort((left, right) => left.ldrawCode - right.ldrawCode);
  const colorFirst = firstStepWhere(align, (uuid) => {
    const official = paired?.byBrick.get(uuid);
    return official !== undefined && !official.composite && !colorByCode.has(official.colorCode);
  });

  return {
    version: CATALOG_STAGE_VERSION,
    catalogVersion: catalog.version,
    mappingBasis: paired ? "official-ldraw-export" : "lxfml-design-id",
    designs,
    totals: {
      designs: designs.length,
      exact: count("exact").length,
      interchangeable: count("interchangeable").length,
      missing: count("missing").length,
      pieces: key.model.bricks.length,
      piecesExact: pieces("exact"),
      piecesInterchangeable: pieces("interchangeable"),
      piecesMissing: pieces("missing"),
    },
    firstStepNeedingMissing: missingFirst && {
      step: missingFirst.step,
      designs: [...new Set(missingFirst.bricks.map((uuid) => byBrick[uuid]!.design))].sort(),
    },
    firstStepNeedingInterchangeable: interchangeableFirst && {
      step: interchangeableFirst.step,
      designs: [
        ...new Set(interchangeableFirst.bricks.map((uuid) => byBrick[uuid]!.design)),
      ].sort(),
    },
    colors,
    firstStepNeedingMissingColor: colorFirst && {
      step: colorFirst.step,
      codes: [
        ...new Set(colorFirst.bricks.map((uuid) => paired!.byBrick.get(uuid)!.colorCode)),
      ].sort((a, b) => a - b),
    },
    byBrick,
  };
}

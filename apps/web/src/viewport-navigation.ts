export function keyboardSelection(
  currentPartId: string | null,
  orderedPartIds: readonly string[],
  key: string,
): string | null | undefined {
  if (key === "Escape") return null;
  if (orderedPartIds.length === 0) return null;
  if (key === "Home") return orderedPartIds[0] ?? null;
  if (key === "End") return orderedPartIds.at(-1) ?? null;

  const direction =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (direction === 0) return undefined;

  const currentIndex = orderedPartIds.indexOf(currentPartId ?? "");
  if (currentIndex < 0) return direction > 0 ? orderedPartIds[0] : orderedPartIds.at(-1);
  return orderedPartIds[(currentIndex + direction + orderedPartIds.length) % orderedPartIds.length];
}

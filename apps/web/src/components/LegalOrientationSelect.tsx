import { UPRIGHT_ORIENTATIONS, type PartDefinition } from "@lego-studio/catalog";

interface LegalOrientationSelectProps {
  readonly definition: PartDefinition;
  readonly value: string;
  readonly onChange: (orientationId: string) => void;
  readonly ariaLabel: string;
}

function legalOrientationLabel(orientationId: string): string {
  const upright = UPRIGHT_ORIENTATIONS.find(({ id }) => id === orientationId);
  return upright === undefined
    ? `Non-upright · ${orientationId}`
    : `${upright.quarterTurns * 90}° yaw`;
}

/** A select whose option set is exactly the selected part's transform authority. */
export function LegalOrientationSelect({
  definition,
  value,
  onChange,
  ariaLabel,
}: LegalOrientationSelectProps) {
  const selectedValue = definition.legalOrientationIds.includes(value) ? value : "";
  return (
    <select
      aria-label={ariaLabel}
      value={selectedValue}
      onChange={(event) => {
        if (definition.legalOrientationIds.includes(event.target.value)) {
          onChange(event.target.value);
        }
      }}
    >
      {definition.legalOrientationIds.map((orientationId) => (
        <option key={orientationId} value={orientationId}>
          {legalOrientationLabel(orientationId)}
        </option>
      ))}
    </select>
  );
}

type ProjectColorSwatchProps = {
  color: string | null;
};

/** Small circular Project color marker (ADR-0015 — not a colored row border). */
export function ProjectColorSwatch({ color }: ProjectColorSwatchProps) {
  const neutral = !color;
  return (
    <span
      data-testid="project-color-swatch"
      data-neutral={neutral ? "true" : undefined}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full${
        neutral ? " bg-muted/50" : ""
      }`}
      style={neutral ? undefined : { backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

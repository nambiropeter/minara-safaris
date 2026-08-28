/**
 * Geometry for the expanding destination accordion.
 *
 * Cards keep a FIXED layout width (the widest they ever get) and never resize.
 * Position comes from `translateX`, visible width from an animated `clip-path`
 * inset — both compositor-friendly, so hovering never triggers layout. The
 * earlier `flex-basis` version reflowed all four cards every frame; a `scaleX`
 * version was rejected because anything inside a scaled box has its
 * border-radius and photo stretched, and counter-scaling undoes the width.
 *
 * Every value here is a percentage of the CARD's own border box, because
 * that's the reference box CSS uses for both `translateX(%)` and `inset(%)`.
 * Only the card's `width` is expressed against the track.
 */

/** Share of the track a hovered card takes; every other card takes OTHER_SHARE.
 *  Carried over from the previous flex-basis version so proportions are unchanged. */
const HOVER_SHARE = 2.8;
const OTHER_SHARE = 0.75;

export type CardGeometry = {
  /** Fraction (0-1) of the gap-free track width this card currently occupies. */
  visible: number;
  /** Fraction (0-1) of the gap-free track width to the left of this card. */
  offset: number;
  /** Number of gutters between the track's left edge and this card. */
  gapsBefore: number;
};

/** The widest a card ever gets. This is its fixed layout width — the hovered
 *  card is therefore never clipped, which also keeps its focus ring intact. */
export function maxVisible(count: number): number {
  if (count <= 0) return 0;
  const total = HOVER_SHARE + (count - 1) * OTHER_SHARE;
  return Math.max(1 / count, HOVER_SHARE / total);
}

export function cardGeometry(
  count: number,
  hoveredIndex: number | null,
): CardGeometry[] {
  const shares = Array.from({ length: count }, (_, i) =>
    hoveredIndex === null ? 1 : i === hoveredIndex ? HOVER_SHARE : OTHER_SHARE,
  );
  const total = shares.reduce((sum, share) => sum + share, 0);

  let offset = 0;
  return shares.map((share, i) => {
    const visible = share / total;
    const geometry = { visible, offset, gapsBefore: i };
    offset += visible;
    return geometry;
  });
}

/** CSS custom properties for one card. Percentages are of the card's own width,
 *  so they stay correct at any track width without JS ever measuring anything. */
export function cardVars(geometry: CardGeometry, max: number) {
  const { visible, offset, gapsBefore } = geometry;
  const hiddenPct = ((max - visible) / max) * 100;

  return {
    // translateX(%) resolves against the card's own width, so the offset is
    // rescaled into card-widths; gutters are added as an absolute length.
    "--card-x": `calc(${((offset / max) * 100).toFixed(4)}% + ${gapsBefore} * var(--accordion-gap))`,
    // Clipped off the card's right edge to leave exactly `visible` showing.
    "--card-hidden": `${hiddenPct.toFixed(4)}%`,
    // Half the clipped amount, so the photo shows its middle rather than its
    // left sliver when a card is collapsed.
    "--card-shift": `${(hiddenPct / 2).toFixed(4)}%`,
  };
}

/** Fixed card width, expressed against the track (the one container-relative value). */
export function trackVars(count: number) {
  return {
    "--accordion-card-w": `calc(${maxVisible(count).toFixed(6)} * (100% - ${count - 1} * var(--accordion-gap)))`,
  };
}

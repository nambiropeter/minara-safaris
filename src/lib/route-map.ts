/**
 * The footer's route map: the destinations Minara actually sells, plotted at
 * their real positions and joined by dashed arcs into one circuit.
 *
 * Coordinates are real, and projected rather than hand-placed, so the shape on
 * screen is genuinely Kenya's geography instead of an eyeballed arrangement —
 * `pnpm check:route-map` asserts the relative bearings still hold.
 *
 * These live here rather than in Payload because `Destinations` has no
 * coordinate field. Adding one is the trigger to make this CMS-driven; until a
 * page needs it, a curated constant is the smaller change.
 */

export type Place = {
  name: string;
  /**
   * Destination slug, or null for a waypoint with no destination page of its
   * own. Must match a `Destinations` slug in the CMS — an invented one would
   * ship a 404 into the footer of every page, so check before adding.
   */
  slug: string | null;
  lat: number;
  lng: number;
  /** Where the label sits relative to the node — hand-set to avoid collisions. */
  label: { anchor: "start" | "middle" | "end"; dx: number; dy: number };
};

/** Ordered as a journey: capital, up to the lakes, west to the Mara, then
 *  south-east through the parks and out to the coast. */
export const CIRCUIT: Place[] = [
  {
    name: "Nairobi",
    slug: null,
    lat: -1.286,
    lng: 36.817,
    label: { anchor: "start", dx: 9, dy: -6 },
  },
  {
    // A waypoint: Nakuru appears in packages but has no Destination entry yet.
    // Give it a slug once one exists and it becomes a link automatically.
    name: "Nakuru",
    slug: null,
    lat: -0.37,
    lng: 36.08,
    label: { anchor: "middle", dx: 0, dy: -10 },
  },
  {
    name: "Maasai Mara",
    slug: "maasai-mara",
    lat: -1.49,
    lng: 35.14,
    label: { anchor: "start", dx: 9, dy: 12 },
  },
  {
    name: "Amboseli",
    slug: "amboseli",
    lat: -2.65,
    lng: 37.26,
    label: { anchor: "end", dx: -9, dy: 4 },
  },
  {
    name: "Tsavo",
    slug: "tsavo",
    lat: -2.98,
    lng: 38.46,
    label: { anchor: "middle", dx: 0, dy: -10 },
  },
  {
    name: "Diani",
    slug: "diani-coast",
    lat: -4.28,
    lng: 39.59,
    label: { anchor: "end", dx: -9, dy: 4 },
  },
];

export type Projected = Place & { x: number; y: number };

/**
 * Equirectangular projection into the SVG box. Over ~500km this close to the
 * equator the longitude distortion is under a percent, so no cos(lat) term —
 * this is a diagram, not a navigation chart.
 */
export function project(
  places: Place[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): Projected[] {
  const lngs = places.map((p) => p.lng);
  const lats = places.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const lngSpan = maxLng - minLng || 1;
  const latSpan = maxLat - minLat || 1;

  return places.map((place) => ({
    ...place,
    x: padding.left + ((place.lng - minLng) / lngSpan) * innerWidth,
    // Flipped: higher latitude is further north, so it belongs higher up.
    y: padding.top + ((maxLat - place.lat) / latSpan) * innerHeight,
  }));
}

/**
 * One quadratic arc per leg, bowed perpendicular to the leg so the circuit
 * reads as flight paths rather than a jagged polyline. Returned as separate
 * segments so each can carry its own dash phase.
 */
export function arcs(points: Projected[], bow = 0.14): string[] {
  return points.slice(0, -1).map((from, i) => {
    const to = points[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    // Consistent sign keeps every leg bowing the same way around the circuit.
    const controlX = (from.x + to.x) / 2 + (-dy / length) * length * bow;
    const controlY = (from.y + to.y) / 2 + (dx / length) * length * bow;
    return `M${from.x.toFixed(2)} ${from.y.toFixed(2)}Q${controlX.toFixed(2)} ${controlY.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  });
}

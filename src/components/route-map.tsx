import Link from "next/link";

import { CIRCUIT, arcs, project } from "@/lib/route-map";

const WIDTH = 320;
const HEIGHT = 300;
const PADDING = { top: 18, right: 14, bottom: 18, left: 14 };

/**
 * The footer's route map — the destinations we actually sell, at their real
 * positions, joined into one circuit by dashed arcs.
 *
 * Decoration that does a job: it's a navigation block, it's specific to this
 * operator in a way stock artwork can't be, and it doubles as the proof of
 * range that the copy above it claims. Geometry comes from
 * src/lib/route-map.ts (`pnpm check:route-map` guards the bearings).
 *
 * Static: hover highlights a node, but nothing animates on load — the site has
 * no entrance animations. Inline SVG, so it costs no extra request.
 */
export function RouteMap() {
  const points = project(CIRCUIT, WIDTH, HEIGHT, PADDING);
  const legs = arcs(points);

  return (
    <div className="w-full max-w-[320px]">
      <p className="text-label uppercase tracking-[0.2em] text-muted-foreground">
        Where we go
      </p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full overflow-visible"
        role="img"
        aria-label="Map of Minara Safaris destinations across Kenya, from Nairobi through Nakuru, the Maasai Mara, Amboseli and Tsavo to the Diani coast."
      >
        {/* Route legs. Dashes are drawn in screen units so they stay even
            however the map is scaled. */}
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1 7"
          vectorEffect="non-scaling-stroke"
          className="text-border"
        >
          {legs.map((leg, i) => (
            <path key={i} d={leg} />
          ))}
        </g>

        {points.map((place) => {
          // Nairobi is the origin; other slug-less places are waypoints we
          // travel through but don't have a destination page for.
          const isOrigin = place.name === "Nairobi";
          const isLinked = place.slug !== null;

          const node = (
            <>
              {/* Wide transparent target so the 3px dot is still tappable. */}
              <circle cx={place.x} cy={place.y} r="22" fill="transparent" />
              {isOrigin && (
                <circle
                  cx={place.x}
                  cy={place.y}
                  r="7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-primary/40"
                />
              )}
              <circle
                cx={place.x}
                cy={place.y}
                r={isOrigin ? 3.5 : 3}
                className={
                  isOrigin
                    ? "fill-primary"
                    : isLinked
                      ? "fill-muted-foreground transition-colors group-hover:fill-primary"
                      : "fill-muted-foreground/50"
                }
              />
              <text
                x={place.x + place.label.dx}
                y={place.y + place.label.dy}
                textAnchor={place.label.anchor}
                className={
                  isOrigin
                    ? "fill-foreground text-[13px] font-medium"
                    : isLinked
                      ? "fill-muted-foreground text-[13px] transition-colors group-hover:fill-foreground"
                      : "fill-muted-foreground/60 text-[13px]"
                }
              >
                {place.name}
              </text>
            </>
          );

          if (!isLinked) {
            return <g key={place.name}>{node}</g>;
          }

          return (
            <Link
              key={place.name}
              href={`/destinations/${place.slug}`}
              className="group focus-visible:outline-none [&:focus-visible_circle:last-of-type]:stroke-primary"
            >
              {node}
            </Link>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Geography check for the footer route map. Run: pnpm check:route-map
 *
 * The point of projecting real coordinates instead of hand-placing nodes is
 * that the result can be checked. These assert the bearings anyone who knows
 * Kenya would notice being wrong — the Mara west of Nairobi, the coast to the
 * south-east, Nakuru to the north.
 */
import assert from "node:assert/strict";

import { CIRCUIT, arcs, project } from "../lib/route-map.ts";

const WIDTH = 320;
const HEIGHT = 300;
const PADDING = { top: 18, right: 14, bottom: 18, left: 14 };

const points = project(CIRCUIT, WIDTH, HEIGHT, PADDING);
const at = (name: string) => {
  const point = points.find((p) => p.name === name);
  assert.ok(point, `missing place: ${name}`);
  return point;
};

// Everything stays inside the drawable area.
for (const point of points) {
  assert.ok(
    point.x >= PADDING.left - 0.01 && point.x <= WIDTH - PADDING.right + 0.01,
    `${point.name} x=${point.x} outside horizontal padding`,
  );
  assert.ok(
    point.y >= PADDING.top - 0.01 && point.y <= HEIGHT - PADDING.bottom + 0.01,
    `${point.name} y=${point.y} outside vertical padding`,
  );
}

// The projection must fill its box, or the map drifts to one side.
assert.ok(
  Math.abs(Math.min(...points.map((p) => p.x)) - PADDING.left) < 0.01,
  "westmost place is not on the left edge",
);
assert.ok(
  Math.abs(Math.max(...points.map((p) => p.x)) - (WIDTH - PADDING.right)) < 0.01,
  "eastmost place is not on the right edge",
);

// Real bearings: west is left, north is up.
assert.ok(at("Maasai Mara").x < at("Nairobi").x, "Mara should be west of Nairobi");
assert.ok(at("Diani").x > at("Nairobi").x, "Diani should be east of Nairobi");
assert.ok(at("Nakuru").y < at("Nairobi").y, "Nakuru should be north of Nairobi");
assert.ok(at("Amboseli").y > at("Nairobi").y, "Amboseli should be south of Nairobi");
assert.ok(at("Diani").y > at("Tsavo").y, "Diani should be south of Tsavo");
assert.ok(at("Tsavo").x > at("Amboseli").x, "Tsavo should be east of Amboseli");

assert.equal(CIRCUIT[0].name, "Nairobi", "circuit should start in Nairobi");
assert.equal(CIRCUIT[0].slug, null, "origin should not link to a destination");

// Every linked slug must be a real `Destinations` entry. A slug that looks
// plausible but doesn't exist ships a 404 into the footer of every page —
// which is exactly what happened with an invented "lake-nakuru". Update this
// list when destinations are added or renamed in the CMS.
const DESTINATION_SLUGS = new Set([
  "maasai-mara",
  "amboseli",
  "tsavo",
  "diani-coast",
]);
for (const place of CIRCUIT) {
  if (place.slug === null) continue;
  assert.ok(
    DESTINATION_SLUGS.has(place.slug),
    `${place.name} links to "${place.slug}", which is not a known destination`,
  );
}

// One arc per leg, each starting and ending exactly on its nodes.
const legs = arcs(points);
assert.equal(legs.length, points.length - 1, "wrong number of legs");
legs.forEach((leg, i) => {
  const from = points[i];
  const to = points[i + 1];
  assert.ok(
    leg.startsWith(`M${from.x.toFixed(2)} ${from.y.toFixed(2)}`),
    `leg ${i} does not start on ${from.name}`,
  );
  assert.ok(
    leg.endsWith(`${to.x.toFixed(2)} ${to.y.toFixed(2)}`),
    `leg ${i} does not end on ${to.name}`,
  );
});

console.log(`route map: geography checks passed (${points.length} places, ${legs.length} legs)`);

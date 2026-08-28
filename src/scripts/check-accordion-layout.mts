/**
 * Geometry check for the destination accordion. Run: pnpm check:accordion
 *
 * The previous transform-based attempt shipped broken because the positioning
 * math was only reasoned about, never executed. This asserts the invariants
 * that actually matter on screen: cards tile the track exactly, never overlap,
 * and the hovered card is never clipped.
 */
import assert from "node:assert/strict";

import { cardGeometry, maxVisible } from "../lib/accordion-layout.ts";

const EPSILON = 1e-9;

for (const count of [1, 2, 3, 4]) {
  const max = maxVisible(count);
  const states: (number | null)[] = [
    null,
    ...Array.from({ length: count }, (_, i) => i),
  ];

  for (const hovered of states) {
    const label = `count=${count} hovered=${hovered}`;
    const cards = cardGeometry(count, hovered);

    assert.equal(cards.length, count, `${label}: wrong card count`);

    // Cards fill the track exactly — no dead space, no overflow.
    const totalVisible = cards.reduce((sum, c) => sum + c.visible, 0);
    assert.ok(
      Math.abs(totalVisible - 1) < EPSILON,
      `${label}: widths sum to ${totalVisible}, expected 1`,
    );

    cards.forEach((card, i) => {
      assert.ok(card.visible > 0, `${label}: card ${i} has no width`);

      // No card is ever wider than its fixed layout box, or clip-path would
      // have to reveal pixels that don't exist.
      assert.ok(
        card.visible <= max + EPSILON,
        `${label}: card ${i} visible ${card.visible} exceeds layout width ${max}`,
      );

      // Each card starts exactly where the previous one ended: no gaps, no overlap.
      const expectedOffset = cards
        .slice(0, i)
        .reduce((sum, c) => sum + c.visible, 0);
      assert.ok(
        Math.abs(card.offset - expectedOffset) < EPSILON,
        `${label}: card ${i} offset ${card.offset}, expected ${expectedOffset}`,
      );

      assert.equal(card.gapsBefore, i, `${label}: card ${i} wrong gap count`);
    });

    // The hovered card must be exactly its layout width, so it is never
    // clipped — that keeps its focus ring fully visible.
    if (hovered !== null) {
      assert.ok(
        Math.abs(cards[hovered].visible - max) < EPSILON,
        `${label}: hovered card clipped (${cards[hovered].visible} vs ${max})`,
      );
    }

    // Last card's right edge lands on the track's right edge.
    const last = cards[count - 1];
    assert.ok(
      Math.abs(last.offset + last.visible - 1) < EPSILON,
      `${label}: track does not end flush`,
    );
  }
}

// Unhovered cards are evenly split.
for (const count of [2, 3, 4]) {
  for (const card of cardGeometry(count, null)) {
    assert.ok(
      Math.abs(card.visible - 1 / count) < EPSILON,
      `count=${count}: resting cards not evenly split`,
    );
  }
}

console.log("accordion layout: all geometry checks passed");

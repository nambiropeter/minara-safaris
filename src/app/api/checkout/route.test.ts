import { describe, expect, it } from "vitest";

import { POST } from "./route";

/**
 * The one behavior we can verify without a Stripe test key: the endpoint
 * fails closed (503) rather than reaching Payload or Stripe when
 * STRIPE_SECRET_KEY is unset. Everything past this branch needs a real key —
 * see task-6-report.md for what that leaves unverified.
 */
describe("POST /api/checkout", () => {
  it("returns 503 when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ kind: "package", refId: "1", quantity: 1 }],
        customerName: "Test",
        customerEmail: "test@example.com",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Payments are not configured." });
  });
});

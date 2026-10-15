# Payments Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the correctness gaps found in the 2026-10-15 review of the payments work on `dev`: reject bad checkout input, never lose or misapply a Stripe event, handle the payment lifecycle beyond "completed", alert staff, and give customers a Stripe receipt instead of an invoice.

**Architecture:** No new services or collections. `POST /api/checkout` gets stricter validation and a failure path. The Stripe webhook is restructured into one `handleEvent` switch with small per-event functions, all still behind the existing signature check and `processed-events` claim. The invoice route becomes a receipt route that redirects to the Stripe-hosted receipt for the order's charge.

**Tech Stack:** Next.js 16.3.0 (App Router), Payload 3.87.1, Postgres (Neon), `stripe@22.6.1` (API `2026-08-26.dahlia`), Zod 4.4.3, Resend, Vitest 5.

**Spec:** `docs/SPEC-PAYMENTS-HOTELS.md` Part A. Deviations decided on 2026-10-15: the customer document is a Stripe **receipt**, not our own R2-stored invoice PDF (A.4/A.6), and the booking-link rotate action (A.5) is out of scope for this plan.

## Global Constraints

- Branch: `fix/payments-webhook-gaps`, cut from `dev`, merges back into `dev`.
- Node `24.16.0`. pnpm only, never npm.
- Money is integer minor units past `src/lib/money.ts`. Settled figures render with `formatMoney`.
- **Only the Stripe webhook may write `status: "paid"`.** No other code path, ever.
- Zod validates at the public POST boundaries only.
- Code style: double quotes, semicolons, named exports. Collections use single quotes (existing file convention).
- Tests are Vitest, colocated `*.test.ts`, imported through `@/`. Run with `pnpm test`.
- Read `node_modules/next/dist/docs/` before changing route handler signatures. Next 16 route `params` is a `Promise`.
- No new dependencies. No schema changes, so no migration.

## Review Focus

- **A late `checkout.session.expired` after a successful payment** must never cancel a paid order. Pinned in Task 4.
- **A partial refund** must keep the booking live (status unchanged) and only note it. Pinned in Task 4.
- **Stripe redelivering an already-fulfilled event** must not send a second confirmation email. Pinned in Task 3.
- **A booking form submitted with no travel date** must still reach Stripe (the field is optional). Pinned in Task 1.
- **A `confirmed` order** (staff have checked availability) must still offer its receipt. Pinned in Task 5.

---

### Task 1: Strict checkout input and a real date field

Fixes review items 2 and 3. Zod's `z.object` drops unknown keys, so an `amount` field is silently ignored. Spec A.3.1 says it must be rejected. `travelDate` is free text but `Orders.travelDate` is a Payload `date` field, so text like "next summer" crashes `payload.create`.

**Files:**
- Modify: `src/app/api/checkout/route.ts:17-34`
- Modify: `src/components/booking-form.tsx:102-105`
- Rewrite: `src/app/api/checkout/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `POST /api/checkout` rejects unknown keys and non-ISO dates with `400 { error: "Invalid request." }`. The test harness in `route.test.ts` (mocked `payload`, `@payload-config`, `@/lib/stripe`) is reused by Task 2.

- [ ] **Step 1: Write the failing tests**

Replace `src/app/api/checkout/route.test.ts` entirely:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { find: vi.fn(), create: vi.fn(), update: vi.fn() },
  sessionsCreate: vi.fn(),
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => h.db) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({ checkout: { sessions: { create: h.sessionsCreate } } })),
}));

import { getStripe } from "@/lib/stripe";
import { POST } from "./route";

const validBody = {
  items: [{ kind: "package", refId: "1", quantity: 2 }],
  customerName: "Test",
  customerEmail: "test@example.com",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.db.find.mockResolvedValue({
    docs: [{ id: 1, title: "Mara", priceFrom: 1000, currency: "KES" }],
  });
  h.db.create.mockResolvedValue({ id: 7 });
  h.db.update.mockResolvedValue({});
  h.sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/x" });
});

describe("POST /api/checkout", () => {
  it("returns 503 when Stripe is not configured", async () => {
    vi.mocked(getStripe).mockReturnValueOnce(null);
    const res = await post(validBody);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Payments are not configured." });
  });

  it("rejects a top-level amount instead of ignoring it", async () => {
    const res = await post({ ...validBody, amount: 1 });
    expect(res.status).toBe(400);
    expect(h.db.create).not.toHaveBeenCalled();
  });

  it("rejects an amount smuggled into an item", async () => {
    const res = await post({
      ...validBody,
      items: [{ kind: "package", refId: "1", quantity: 1, unitAmount: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects a travel date that is not an ISO date", async () => {
    const res = await post({ ...validBody, travelDate: "next summer" });
    expect(res.status).toBe(400);
    expect(h.db.create).not.toHaveBeenCalled();
  });

  it("accepts an ISO travel date", async () => {
    const res = await post({ ...validBody, travelDate: "2026-12-01" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/x" });
  });

  it("accepts a booking with no travel date", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
  });

  it("prices from the catalogue, not the request", async () => {
    await post(validBody);
    expect(h.db.create.mock.calls[0][0].data.amountTotal).toBe(200000);
  });
});
```

`x-forwarded-for` is a fresh UUID per request so the in-memory rate limiter (20/hour per IP) never trips across tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/app/api/checkout`
Expected: the two "rejects … amount" tests and "rejects a travel date" FAIL (status 200, not 400). The others pass.

- [ ] **Step 3: Tighten the schema**

In `src/app/api/checkout/route.ts`, replace the schema:

```ts
/**
 * Trust boundary. Note what is absent: there is no `amount` field. The client
 * cannot express a price, so it cannot tamper with one — and strict objects
 * reject a request that tries, rather than quietly dropping the field.
 */
const checkoutSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        kind: z.literal("package"),
        refId: z.string().trim().min(1).max(64),
        quantity: z.coerce.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(10),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email().trim(),
  customerPhone: z.string().trim().max(50).optional(),
  travelDate: z.iso.date().optional(),
  adults: z.coerce.number().int().min(1).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
});
```

- [ ] **Step 4: Use a native date input**

In `src/components/booking-form.tsx`, replace the travel date label:

```tsx
      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Travel date (optional)
        <input
          name="travelDate"
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </label>
```

A date input submits `YYYY-MM-DD` or `""`. The existing `form.get("travelDate") || undefined` already turns `""` into `undefined`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/app/api/checkout && pnpm exec tsc --noEmit`
Expected: all checkout tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/checkout/route.ts src/app/api/checkout/route.test.ts src/components/booking-form.tsx
git commit -m "fix(checkout): reject unknown fields and non-ISO travel dates"
```

---

### Task 2: A failed Stripe session leaves no live pending order

Fixes review item 10. The order is created before the Stripe session. If `sessions.create` throws, the route 500s and leaves a `pending` order nobody can ever pay.

**Files:**
- Modify: `src/app/api/checkout/route.ts:106-132`
- Modify: `src/app/api/checkout/route.test.ts` (add one test)

**Interfaces:**
- Consumes: the Task 1 test harness (`h.db`, `h.sessionsCreate`, `post`, `validBody`).
- Produces: on Stripe failure, `502 { error: "Payment could not be started. Please try again." }` and the order is updated to `status: "failed"`.

- [ ] **Step 1: Write the failing test**

Add inside the `describe` in `src/app/api/checkout/route.test.ts`:

```ts
  it("marks the order failed and returns 502 when Stripe errors", async () => {
    h.sessionsCreate.mockRejectedValueOnce(new Error("stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await post(validBody);

    expect(res.status).toBe(502);
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, data: expect.objectContaining({ status: "failed" }) }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/api/checkout`
Expected: FAIL, the request rejects with "stripe down" instead of returning 502.

- [ ] **Step 3: Implement**

In `src/app/api/checkout/route.ts`, wrap the session creation (leave `invoice_creation` as is here; Task 6 removes it):

```ts
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      // ...existing options, unchanged...
    });
  } catch (error) {
    console.error("stripe checkout session failed", error, { orderId: order.id });
    // Kept as an audit trail, but never left as a live "pending" order.
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { status: "failed", staffNotes: "Stripe session could not be created." },
    });
    return NextResponse.json(
      { error: "Payment could not be started. Please try again." },
      { status: 502 },
    );
  }
```

Keep the existing options object exactly as it is inside the `try`. The `payload.update` with `checkoutSessionId` and the final `return` stay after the block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/app/api/checkout && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/route.ts src/app/api/checkout/route.test.ts
git commit -m "fix(checkout): fail the order instead of stranding it when Stripe errors"
```

---

### Task 3: Restructure the webhook and fix how events are recorded

Fixes review items 4, 5, 6 and 8:
- A temporary DB error while recording the event id returned 200, so Stripe never retried and the payment was lost.
- A failed confirmation email was swallowed without a log.
- An unknown order id threw a 500, so Stripe retried for days.
- Staff were never told about a paid booking or a refused payment.

**Files:**
- Modify: `src/lib/notify-order.ts` (add `notifyStaff`)
- Modify: `.env.example:15-18`
- Rewrite: `src/app/api/webhooks/stripe/route.ts`
- Create: `src/app/api/webhooks/stripe/route.test.ts`

**Interfaces:**
- Consumes: `assertAmountMatches` (`src/lib/webhook-guards.ts`), `notifyOrderPaid(order, token)`, `formatMoney(minor, currency)`.
- Produces:
  - `notifyStaff(subject: string, text: string): Promise<void>` in `src/lib/notify-order.ts`. It does nothing until `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `LEADS_NOTIFICATION_EMAIL` are all set.
  - In the webhook route: `handleEvent(payload, event)`, `findSessionOrder(payload, session)` and `appendNote(notes, line)`, plus the test harness in `route.test.ts` (`h.db`, `h.event`, `send()`, `session()`). Task 5 extends both.

- [ ] **Step 1: Add `notifyStaff`**

Append to `src/lib/notify-order.ts`:

```ts
/**
 * Internal alert to the same inbox that receives enquiries. No-ops until
 * RESEND_API_KEY, RESEND_FROM_EMAIL and LEADS_NOTIFICATION_EMAIL are set.
 */
export async function notifyStaff(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.LEADS_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) return;

  await new Resend(apiKey).emails.send({ from, to, subject, text });
}
```

In `.env.example`, change the comment above the Resend block to:

```
# Email via Resend (all pending from client). LEADS_NOTIFICATION_EMAIL also receives
# paid-booking, refund and refused-payment alerts. Customer booking emails additionally
# need NEXT_PUBLIC_SITE_URL, since they link to the booking page.
```

- [ ] **Step 2: Write the failing tests**

Create `src/app/api/webhooks/stripe/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { create: vi.fn(), find: vi.fn(), findByID: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { current: null as unknown },
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => h.db) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: () => h.event.current } }),
}));
vi.mock("@/lib/notify-order", () => ({
  notifyOrderPaid: vi.fn(async () => {}),
  notifyStaff: vi.fn(async () => {}),
}));

import { notifyOrderPaid, notifyStaff } from "@/lib/notify-order";
import { POST } from "./route";

const pendingOrder = {
  id: 7,
  orderNumber: "MS-2026-TEST",
  status: "pending",
  customerEmail: "a@example.com",
  amountTotal: 200000,
  currency: "KES",
  items: [{ title: "Mara", quantity: 2 }],
  staffNotes: null,
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 200000,
    currency: "kes",
    payment_intent: "pi_1",
    customer_details: { email: "a@example.com" },
    metadata: { orderId: "7", bookingToken: "tok" },
    ...overrides,
  };
}

function send(type: string, object: unknown) {
  h.event.current = { id: "evt_1", type, data: { object } };
  return POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=x" },
      body: "{}",
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.db.create.mockResolvedValue({ id: 1 });
  h.db.find.mockResolvedValue({ docs: [] });
  h.db.findByID.mockResolvedValue(pendingOrder);
  h.db.update.mockImplementation(async ({ data }) => ({ ...pendingOrder, ...data }));
  h.db.delete.mockResolvedValue({});
});

describe("event recording", () => {
  it("acknowledges a genuine duplicate without acting", async () => {
    h.db.create.mockRejectedValueOnce(new Error("duplicate key"));
    h.db.find.mockResolvedValueOnce({ docs: [{ id: 1 }] });

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.db.update).not.toHaveBeenCalled();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("returns 500 when recording fails and the event was never recorded", async () => {
    h.db.create.mockRejectedValueOnce(new Error("connection reset"));

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(500);
    expect(h.db.update).not.toHaveBeenCalled();
  });
});

describe("checkout.session.completed", () => {
  it("marks a pending order paid and notifies customer and staff", async () => {
    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, data: expect.objectContaining({ status: "paid" }) }),
    );
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }), "tok");
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("MS-2026-TEST"), expect.any(String));
  });

  it("ignores an unpaid completion", async () => {
    await send("checkout.session.completed", session({ payment_status: "unpaid" }));
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("does not re-fulfil an order that is already paid", async () => {
    h.db.findByID.mockResolvedValueOnce({ ...pendingOrder, status: "paid" });
    await send("checkout.session.completed", session());
    expect(h.db.update).not.toHaveBeenCalled();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("acknowledges an unknown order instead of retrying forever", async () => {
    h.db.findByID.mockResolvedValueOnce(null);
    const res = await send("checkout.session.completed", session());
    expect(res.status).toBe(200);
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("refuses a mismatched amount, fails the order and alerts staff", async () => {
    await send("checkout.session.completed", session({ amount_total: 1 }));
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("refused"), expect.any(String));
  });

  it("still acknowledges when the confirmation email fails, and logs it", async () => {
    vi.mocked(notifyOrderPaid).mockRejectedValueOnce(new Error("resend down"));
    const res = await send("checkout.session.completed", session());
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(
      "booking confirmation email failed",
      expect.any(Error),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/app/api/webhooks`
Expected: FAIL. Specifically "returns 500 when recording fails" gets 200, "does not re-fulfil" sees an update, "unknown order" gets 500, and the staff and email-logging assertions fail.

- [ ] **Step 4: Rewrite the route**

Replace `src/app/api/webhooks/stripe/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getPayload, type Payload } from "payload";
import type Stripe from "stripe";

import configPromise from "@payload-config";
import { formatMoney, type Currency } from "@/lib/money";
import { notifyOrderPaid, notifyStaff } from "@/lib/notify-order";
import { getStripe } from "@/lib/stripe";
import { assertAmountMatches } from "@/lib/webhook-guards";

export const runtime = "nodejs";

/**
 * The only code path that may mark an order paid.
 *
 * Order of operations matters: verify the signature against the RAW body,
 * then claim the event id, then act. Claiming first is what makes a Stripe
 * retry a no-op instead of a second fulfilment.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Must be the unparsed body. Any JSON parsing before this breaks verification.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = await getPayload({ config: configPromise });

  let claimedEvent;
  try {
    claimedEvent = await payload.create({
      collection: "processed-events",
      data: { eventId: event.id, type: event.type },
    });
  } catch (error) {
    // Only a row that already exists makes this a retry. Anything else (a
    // dropped connection) must 500 so Stripe redelivers, or the payment is lost.
    const existing = await payload
      .find({
        collection: "processed-events",
        where: { eventId: { equals: event.id } },
        limit: 1,
        depth: 0,
      })
      .catch(() => null);
    if (existing?.docs.length) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("processed-events claim failed", error, { eventId: event.id });
    return NextResponse.json({ error: "Could not record event." }, { status: 500 });
  }

  try {
    await handleEvent(payload, event);
  } catch (error) {
    console.error("webhook handling failed after claiming event", error, { eventId: event.id });
    // Un-claim so a genuine retry can re-attempt instead of being swallowed
    // as a duplicate.
    try {
      await payload.delete({ collection: "processed-events", id: claimedEvent.id });
    } catch (deleteError) {
      console.error("failed to un-claim processed-event after handling error", deleteError, {
        eventId: event.id,
      });
    }
    return NextResponse.json({ error: "Internal error processing webhook." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(payload: Payload, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      // Delayed methods (Bacs, SEPA) complete "unpaid" and settle later.
      if (event.data.object.payment_status === "paid") {
        await fulfil(payload, event.data.object);
      }
      return;
  }
}

async function findSessionOrder(payload: Payload, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    disableErrors: true,
  });
  // A retry can't make a missing order appear, so log and acknowledge.
  if (!order) console.error("webhook for unknown order", { orderId, sessionId: session.id });
  return order;
}

async function fulfil(payload: Payload, session: Stripe.Checkout.Session): Promise<void> {
  const order = await findSessionOrder(payload, session);
  if (!order || order.status === "paid" || order.status === "confirmed") return;

  try {
    assertAmountMatches(
      { amount_total: session.amount_total, currency: session.currency },
      { amountTotal: order.amountTotal, currency: order.currency },
    );
  } catch (error) {
    const reason = (error as Error).message;
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { status: "failed", staffNotes: appendNote(order.staffNotes, `Payment refused: ${reason}`) },
    });
    await notifyStaff(
      `Payment refused - ${order.orderNumber}`,
      `${reason}\nStripe session: ${session.id}`,
    ).catch((e) => console.error("staff alert failed", e));
    return;
  }

  const updated = await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      status: "paid",
      customerEmail: session.customer_details?.email ?? order.customerEmail,
      stripe: {
        checkoutSessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      },
    },
  });

  // A failed send must never fail the webhook: the retry would be swallowed
  // as a duplicate without ever attempting the email again.
  const bookingToken = session.metadata?.bookingToken;
  if (bookingToken) {
    await notifyOrderPaid(updated, bookingToken).catch((e) =>
      console.error("booking confirmation email failed", e, { orderId: order.id }),
    );
  }
  await notifyStaff(
    `New paid booking - ${updated.orderNumber}`,
    [
      `${updated.customerName ?? ""} <${updated.customerEmail}>`,
      `Total: ${formatMoney(updated.amountTotal, updated.currency as Currency)}`,
      ...updated.items.map((i) => `${i.title} x${i.quantity}`),
    ].join("\n"),
  ).catch((e) => console.error("staff alert failed", e));
}

function appendNote(notes: string | null | undefined, line: string): string {
  return `${notes ?? ""}\n${line}`.trim();
}
```

If `tsc` rejects `disableErrors` on `findByID`, check `node_modules/payload/dist/collections/operations/local/findByID.d.ts` for the option name in 3.87.1. Don't fall back to try/catch, because that would treat a DB outage as "unknown order" and acknowledge it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notify-order.ts .env.example src/app/api/webhooks/stripe/route.ts src/app/api/webhooks/stripe/route.test.ts
git commit -m "fix(webhook): never ack an unrecorded event, log email failures, alert staff"
```

---

### Task 4: Handle the rest of the payment lifecycle

Fixes review item 7. The spec (A.4) requires `async_payment_failed` and `charge.refunded`. Without `checkout.session.expired`, every abandoned checkout stays `pending` forever. Without `async_payment_succeeded`, a delayed payment method (Bacs, SEPA) is charged but the order is never marked paid.

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts` (`handleEvent` switch plus two new functions)
- Modify: `src/app/api/webhooks/stripe/route.test.ts` (append tests)

**Interfaces:**
- Consumes: from Task 3, `findSessionOrder`, `fulfil`, `appendNote`, `notifyStaff` and the test harness.
- Produces: `settlePending(payload, session, status, note)` and `recordRefund(payload, charge)`. Order status transitions: pending → failed (async payment failed), pending → cancelled (expired), any → refunded (full refund only).

- [ ] **Step 1: Write the failing tests**

Append to `src/app/api/webhooks/stripe/route.test.ts`:

```ts
describe("payment lifecycle", () => {
  it("marks paid when a delayed payment succeeds", async () => {
    await send("checkout.session.async_payment_succeeded", session());
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paid" }) }),
    );
  });

  it("fails a pending order when a delayed payment fails", async () => {
    await send("checkout.session.async_payment_failed", session({ payment_status: "unpaid" }));
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("cancels a pending order when checkout expires", async () => {
    await send("checkout.session.expired", session({ payment_status: "unpaid" }));
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
    );
  });

  it("never lets a late expiry undo a payment", async () => {
    h.db.findByID.mockResolvedValueOnce({ ...pendingOrder, status: "paid" });
    await send("checkout.session.expired", session({ payment_status: "unpaid" }));
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("marks a fully refunded order refunded", async () => {
    h.db.find.mockResolvedValueOnce({ docs: [{ ...pendingOrder, status: "confirmed" }] });
    await send("charge.refunded", { payment_intent: "pi_1", refunded: true, amount_refunded: 200000 });
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "refunded" }) }),
    );
    expect(notifyStaff).toHaveBeenCalled();
  });

  it("keeps the booking live on a partial refund", async () => {
    h.db.find.mockResolvedValueOnce({ docs: [{ ...pendingOrder, status: "confirmed" }] });
    await send("charge.refunded", { payment_intent: "pi_1", refunded: false, amount_refunded: 5000 });
    const data = h.db.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(data.staffNotes).toContain("Partially refunded");
  });
});
```

The first `find` call in each refund test is the order lookup. The `processed-events` claim uses `create`, which succeeds, so it never calls `find`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/app/api/webhooks`
Expected: the six new tests FAIL, because those event types are ignored.

- [ ] **Step 3: Implement**

In `src/app/api/webhooks/stripe/route.ts`, replace `handleEvent`:

```ts
async function handleEvent(payload: Payload, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // Delayed methods (Bacs, SEPA) complete "unpaid" and settle later via
      // async_payment_succeeded, which lands here too.
      if (event.data.object.payment_status === "paid") {
        await fulfil(payload, event.data.object);
      }
      return;
    case "checkout.session.async_payment_failed":
      await settlePending(payload, event.data.object, "failed", "Delayed payment failed.");
      return;
    case "checkout.session.expired":
      await settlePending(payload, event.data.object, "cancelled", "Checkout expired unpaid.");
      return;
    case "charge.refunded":
      await recordRefund(payload, event.data.object);
      return;
  }
}
```

Add below `fulfil`:

```ts
async function settlePending(
  payload: Payload,
  session: Stripe.Checkout.Session,
  status: "failed" | "cancelled",
  note: string,
): Promise<void> {
  const order = await findSessionOrder(payload, session);
  // Only an unsettled order moves. A late event must never undo a payment.
  if (!order || order.status !== "pending") return;
  await payload.update({
    collection: "orders",
    id: order.id,
    data: { status, staffNotes: appendNote(order.staffNotes, note) },
  });
}

async function recordRefund(payload: Payload, charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  // ponytail: unindexed lookup on stripe.paymentIntentId; index it if orders reach the tens of thousands.
  const {
    docs: [order],
  } = await payload.find({
    collection: "orders",
    where: { "stripe.paymentIntentId": { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
  });
  if (!order) {
    console.error("refund for unknown order", { paymentIntentId });
    return;
  }

  const refunded = formatMoney(charge.amount_refunded, order.currency as Currency);
  // A partial refund keeps the booking live; staff decide what it means.
  const data = charge.refunded
    ? { status: "refunded" as const, staffNotes: appendNote(order.staffNotes, `Refunded in full: ${refunded}.`) }
    : { staffNotes: appendNote(order.staffNotes, `Partially refunded: ${refunded} so far.`) };

  await payload.update({ collection: "orders", id: order.id, data });
  await notifyStaff(
    `Refund - ${order.orderNumber}`,
    `${charge.refunded ? "Full" : "Partial"} refund recorded: ${refunded}.`,
  ).catch((e) => console.error("staff alert failed", e));
}
```

`freeze-paid-orders` only blocks changes to money fields, so moving a paid order to `refunded` is allowed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Subscribe Stripe to the new events**

These events only arrive if Stripe sends them. Locally, `stripe listen --forward-to localhost:3000/api/webhooks/stripe` forwards every event, so nothing extra is needed. For the deployed endpoint, the Stripe Dashboard → Developers → Webhooks → endpoint must list all five: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Record this in the commit body. **Leo does this step; the executor does not touch the Stripe account.**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts src/app/api/webhooks/stripe/route.test.ts
git commit -m "feat(webhook): handle delayed payments, expiry and refunds

The Stripe webhook endpoint must subscribe to checkout.session.completed,
checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
checkout.session.expired and charge.refunded."
```

---

### Task 5: Stripe receipt replaces the invoice

Fixes review item 1 and applies the 2026-10-15 decision. Customers pay up front, so the document they need is proof of payment: a receipt. Stripe creates one for every charge at no extra cost, so `invoice_creation` (an extra per-invoice fee, and the wrong kind of document) goes. The route also allowed only `paid` status, so a `confirmed` order lost its document.

**Files:**
- Modify: `src/lib/booking-status-copy.ts` (add `hasReceipt`)
- Modify: `src/lib/booking-status-copy.test.ts`
- Delete: `src/app/api/booking/[token]/invoice/route.ts`, `src/app/api/booking/[token]/invoice/route.test.ts`
- Create: `src/app/api/booking/[token]/receipt/route.ts`, `src/app/api/booking/[token]/receipt/route.test.ts`
- Modify: `src/app/(site)/booking/[token]/page.tsx:53-63`
- Modify: `src/app/api/checkout/route.ts` (remove `invoice_creation`)
- Modify: `src/lib/notify-order.ts` (email copy)

**Interfaces:**
- Consumes: `findOrderByToken(token)`, `getStripe()`.
- Produces: `hasReceipt(status: Order["status"]): boolean` (true for `paid`, `confirmed`, `refunded`). `GET /api/booking/[token]/receipt` returns a 303 redirect to the charge's Stripe-hosted `receipt_url`, or 404 or 503.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/booking-status-copy.test.ts` (and add `hasReceipt` to its import from `./booking-status-copy` or `@/lib/booking-status-copy`, matching the file's existing import):

```ts
describe("hasReceipt", () => {
  it("is true once money has been taken, including after staff confirm", () => {
    expect(hasReceipt("paid")).toBe(true);
    expect(hasReceipt("confirmed")).toBe(true);
    expect(hasReceipt("refunded")).toBe(true);
  });

  it("is false when nothing was charged", () => {
    expect(hasReceipt("pending")).toBe(false);
    expect(hasReceipt("failed")).toBe(false);
    expect(hasReceipt("cancelled")).toBe(false);
  });
});
```

Create `src/app/api/booking/[token]/receipt/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/orders", () => ({ findOrderByToken: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));

import { findOrderByToken } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { GET } from "./route";

const retrieve = vi.fn();

function get() {
  return GET(new Request("http://localhost/api/booking/tok/receipt"), {
    params: Promise.resolve({ token: "tok" }),
  });
}

function order(overrides: Record<string, unknown> = {}) {
  return { id: 1, status: "paid", stripe: { paymentIntentId: "pi_1" }, ...overrides } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStripe).mockReturnValue({ paymentIntents: { retrieve } } as never);
  retrieve.mockResolvedValue({ latest_charge: { receipt_url: "https://pay.stripe.com/receipts/x" } });
});

describe("GET /api/booking/[token]/receipt", () => {
  it("404s an unknown token", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("404s an order that was never charged", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order({ status: "pending" }));
    expect((await get()).status).toBe(404);
  });

  it("404s an order with no payment intent", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order({ stripe: {} }));
    expect((await get()).status).toBe(404);
  });

  it("503s when Stripe is not configured", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order());
    vi.mocked(getStripe).mockReturnValue(null);
    expect((await get()).status).toBe(503);
  });

  it("redirects a confirmed order to its Stripe receipt", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order({ status: "confirmed" }));
    const res = await get();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://pay.stripe.com/receipts/x");
    expect(retrieve).toHaveBeenCalledWith("pi_1", { expand: ["latest_charge"] });
  });

  it("404s when Stripe has no receipt for the charge", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order());
    retrieve.mockResolvedValueOnce({ latest_charge: { receipt_url: null } });
    expect((await get()).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/booking-status-copy src/app/api/booking`
Expected: FAIL, because `hasReceipt` and `./route` (receipt) don't exist yet.

- [ ] **Step 3: Add `hasReceipt`**

Append to `src/lib/booking-status-copy.ts`:

```ts
/** Statuses where a charge exists, so Stripe holds a receipt for it. */
export function hasReceipt(status: Order["status"]): boolean {
  return status === "paid" || status === "confirmed" || status === "refunded";
}
```

- [ ] **Step 4: Replace the invoice route with the receipt route**

```bash
git rm -r "src/app/api/booking/[token]/invoice"
```

Create `src/app/api/booking/[token]/receipt/route.ts`:

```ts
import { NextResponse } from "next/server";

import { hasReceipt } from "@/lib/booking-status-copy";
import { findOrderByToken } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe hosts the receipt (with its own PDF download). This route only
 * decides who gets the link: whoever holds the booking token.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await findOrderByToken(token);

  // 404 rather than 403 so the route never confirms a booking exists.
  if (!order || !hasReceipt(order.status) || !order.stripe?.paymentIntentId) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return new NextResponse("Service Unavailable", { status: 503 });
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(order.stripe.paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (!charge?.receipt_url) {
      return new NextResponse("Receipt not found", { status: 404 });
    }
    return NextResponse.redirect(charge.receipt_url, 303);
  } catch (error) {
    console.error("Failed to retrieve receipt", error, { orderId: order.id });
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
```

- [ ] **Step 5: Update the booking page**

In `src/app/(site)/booking/[token]/page.tsx`, import `hasReceipt` alongside `bookingStatusCopy`:

```ts
import { bookingStatusCopy, hasReceipt } from "@/lib/booking-status-copy";
```

Replace the invoice block:

```tsx
      {hasReceipt(order.status) && order.stripe?.paymentIntentId && (
        <div className="mt-8">
          <a
            href={`/api/booking/${token}/receipt`}
            className={buttonVariants({ variant: "outline" })}
          >
            View payment receipt
          </a>
        </div>
      )}
```

The `download` attribute goes because the link now opens Stripe's receipt page, not a file. The page's `Referrer-Policy: no-referrer` (`next.config.ts`) keeps the token out of the referrer sent to Stripe.

- [ ] **Step 6: Stop creating invoices, update email copy**

In `src/app/api/checkout/route.ts`, delete the line `invoice_creation: { enabled: true },`.

In `src/lib/notify-order.ts`, change `` `View your booking and download your invoice:` `` to `` `View your booking and payment receipt:` ``.

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: all PASS. `pnpm build` confirms Next accepts the new route file's exports.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/api/booking src/lib/booking-status-copy.ts src/lib/booking-status-copy.test.ts "src/app/(site)/booking/[token]/page.tsx" src/app/api/checkout/route.ts src/lib/notify-order.ts
git commit -m "feat(booking): link the Stripe receipt instead of a Stripe invoice

Customers pay up front, so proof of payment is a receipt. Stripe generates
one per charge for free; invoice_creation added a per-invoice fee for the
wrong document. Receipts stay available after staff move an order to
confirmed, and after a refund."
```

---

### Task 6: Tell customers "paid" is not yet "confirmed"

Added 2026-10-15 at Leo's request. Minara is an intermediary. A paid order still needs staff to check availability with the supplier for that date and party size, and only then does it become `confirmed`. Today `paid` and `confirmed` both read "Your booking", and the paid email says "Your booking is confirmed", which isn't true yet. Don't promise a turnaround time; none has been agreed.

**Files:**
- Modify: `src/lib/booking-status-copy.ts` (`paid` and `confirmed` cases)
- Modify: `src/lib/booking-status-copy.test.ts`
- Modify: `src/lib/notify-order.ts` (subject and first line)

**Interfaces:**
- Consumes: `bookingStatusCopy(status)`, unchanged signature.
- Produces: `paid` → heading "Payment received" plus a body about confirming availability. `confirmed` → heading "Your booking is confirmed", body `null`. Both keep `totalLabel: "Total paid"`.

- [ ] **Step 1: Write the failing test**

In `src/lib/booking-status-copy.test.ts`, change the happy-path test's first assertion from `expect(bookingStatusCopy("paid").body).toBeNull();` to `expect(bookingStatusCopy("confirmed").body).toBeNull();`, and add:

```ts
  it("does not call a paid order confirmed before staff check availability", () => {
    const paid = bookingStatusCopy("paid");
    expect(paid.heading).toBe("Payment received");
    expect(paid.body).toMatch(/confirming availability/i);
    expect(bookingStatusCopy("confirmed").heading).toBe("Your booking is confirmed");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/booking-status-copy`
Expected: FAIL. `paid` heading is "Your booking".

- [ ] **Step 3: Implement**

In `src/lib/booking-status-copy.ts`, replace the final `paid`/`confirmed`/`default` arm with:

```ts
    case "paid":
      // Paid is not booked: staff still confirm availability with the supplier.
      return {
        heading: "Payment received",
        body: "Thank you. We are now confirming availability with our partners for your dates, and will be in touch to confirm your booking.",
        totalLabel: "Total paid",
      };
    case "confirmed":
    default:
      return { heading: "Your booking is confirmed", body: null, totalLabel: "Total paid" };
```

In `src/lib/notify-order.ts`, change the subject to `` `Payment received - ${order.orderNumber}` `` and the first text line to `` `Thank you, we have received your payment. We are now confirming availability with our partners for your dates, and will be in touch to confirm your booking.` ``

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking-status-copy.ts src/lib/booking-status-copy.test.ts src/lib/notify-order.ts
git commit -m "fix(booking): say payment received, not confirmed, until staff confirm"
```

---

### Task 7: Bring the docs up to date

**Files:**
- Modify: `CLAUDE.md` (Status section, payments paragraph)
- Modify: `docs/WORK-PLAN.md` (decision log, new top row)
- Modify: `docs/SPEC-PAYMENTS-HOTELS.md` (A.4 endpoint list and A.6)

- [ ] **Step 1: CLAUDE.md**

In the payments paragraph of "Status", replace the sentence starting `Invoice PDF generation (Task 12) is deliberately deferred:` through the end of that sentence with:

```
Customers get Stripe's hosted receipt (`GET /api/booking/[token]/receipt`, a 303 redirect for paid/confirmed/refunded orders), not an invoice — they pay up front, so proof of payment is the document; Stripe receipts cost nothing, while `invoice_creation` charged per invoice. Our own PDFs come back only if the accountant's UK VAT/TOMS answer requires wording Stripe can't carry. The webhook handles completed, delayed-success, delayed-failure, expiry and refund events; all five must be subscribed on the Stripe endpoint.
```

- [ ] **Step 2: WORK-PLAN.md decision log**

Add a row at the top of the decision table:

```
| 2026-10-15 | Stripe receipts replace Stripe invoices; webhook covers the full payment lifecycle | Review of `dev` found: unknown keys and free-text dates accepted at checkout; a DB blip during event recording acknowledged and lost the payment; abandoned checkouts stayed pending forever; refunds and delayed payments were ignored; confirmed orders lost their document; staff got no alerts. Fixed on `fix/payments-webhook-gaps` (`docs/superpowers/plans/2026-10-15-payments-webhook-gaps.md`). Booking-link rotation (spec A.5) still unbuilt |
```

- [ ] **Step 3: Spec**

In `docs/SPEC-PAYMENTS-HOTELS.md` A.4, replace the line `GET  /api/booking/[token]/invoice   Presigned R2 URL, short expiry.` with:

```
GET  /api/booking/[token]/receipt   303 to the Stripe-hosted receipt (decided 2026-10-15).
```

and replace the webhook's handled-events lines with `Handles checkout.session.completed, .async_payment_succeeded, .async_payment_failed, .expired, charge.refunded.`

At the top of A.6, add: `> **Superseded 2026-10-15:** customers receive Stripe's hosted receipt instead of a generated invoice. Revisit only if the VAT/TOMS answer requires wording Stripe can't carry.`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/WORK-PLAN.md docs/SPEC-PAYMENTS-HOTELS.md
git commit -m "docs: record receipts decision and webhook lifecycle coverage"
```

---

## Out of scope (deliberately)

- **Booking-link rotate action** (spec A.5). It needs a Payload admin custom action and a way to email the new link. Build it if a leaked link actually happens.
- **Honeypot and time-to-submit on the booking form.** Checkout is rate-limited and creates nothing customer-visible until paid. Add these if spam pending orders show up in the admin.
- **The `Orders.invoice` upload field.** It's now unused, but removing it needs a migration. Leave it until our own documents are definitely off the table.

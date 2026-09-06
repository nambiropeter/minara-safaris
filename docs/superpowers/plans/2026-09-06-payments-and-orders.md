# Payments and Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor buy a safari package with a card and receive an invoice and a private booking link, with no account and no way to tamper with the price.

**Architecture:** A Payload `Orders` collection holds a price snapshot taken at creation. `POST /api/checkout` computes the total server-side and opens a Stripe Checkout Session. A signature-verified, idempotent webhook is the *only* code path that marks an order paid. The customer reaches their booking through an unguessable link whose token is stored only as a SHA-256 hash.

**Tech Stack:** Next.js 16.3.0 (App Router), Payload 3.87.1, Postgres (Neon), Stripe Node SDK, Zod 4, Resend, Cloudflare R2 via `@payloadcms/storage-s3`. Tests run on Vitest 5 via `pnpm test`, configured in `vitest.config.mts`.

**Spec:** `docs/SPEC-PAYMENTS-HOTELS.md` (Part A). Parts B and C get their own plans when commissioned.

## Global Constraints

- Node `24.16.0` (`.nvmrc`). pnpm only, never npm.
- Payload pinned `3.87.1`. Do not upgrade anything mid-build.
- Anything imported by `src/payload.config.mts` with top-level await must be `.mts`. Collections are plain `.ts` and stay that way.
- Money is stored as **integer minor units**. No floats, no decimal columns, anywhere.
- Zod validates at the two public POST boundaries only, never CMS-shaped data.
- Colour comes from tokens in `src/app/globals.css`. Never a raw hex or a Tailwind palette class.
- Icons import from `@/components/icons`, never `@phosphor-icons/react`.
- Never render a bare price — money renders through `PriceBlock` or an equivalent that carries a note.
- Public pages live in `src/app/(site)/`.
- Import aliases: `@/*` → `./src/*`, `@payload-config` → `./src/payload.config.mts`.
- Code style: double quotes, semicolons, named exports.
- Tests are Vitest, colocated as `*.test.ts` beside the code. Import through the `@/` alias, not relative `.ts` paths. `vitest.config.mts` is `.mts` for the same ESM reason the Payload config is — do not add `"type": "module"` to `package.json`, it breaks the `payload` CLI.
- **Read `node_modules/next/dist/docs/` before writing route handler code.** Next 16 changed route signatures, `params` semantics and caching directives. Do not write App Router code from memory.

---

### Task 1: Money helpers

Currency arithmetic is the foundation every later task depends on. Vitest is already installed and proven against `src/lib/rate-limit.test.ts`.

**Files:**
- Create: `src/lib/money.ts`
- Create: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Currency = "KES" | "USD" | "GBP"`
  - `toMinorUnits(major: number, currency: Currency): number`
  - `formatMoney(minor: number, currency: Currency): string`
  - `MINOR_UNIT_EXPONENT: Record<Currency, number>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatMoney, toMinorUnits } from "@/lib/money";

describe("toMinorUnits", () => {
  it("converts major units to integer minor units", () => {
    expect(toMinorUnits(1250, "KES")).toBe(125000);
    expect(toMinorUnits(99.99, "USD")).toBe(9999);
  });

  it("rounds half-up rather than truncating", () => {
    // Float drift must not silently lose a cent.
    expect(toMinorUnits(10.005, "USD")).toBe(1001);
  });

  it("rejects non-finite input rather than producing NaN", () => {
    expect(() => toMinorUnits(Number.NaN, "USD")).toThrow(/finite/);
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY, "KES")).toThrow(/finite/);
  });

  it("rejects negative amounts", () => {
    expect(() => toMinorUnits(-1, "USD")).toThrow(/negative/);
  });
});

describe("formatMoney", () => {
  it("formats minor units back to a human string", () => {
    expect(formatMoney(125000, "KES")).toBe("KES 1,250.00");
    expect(formatMoney(9999, "USD")).toBe("USD 99.99");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/money.test.ts`
Expected: FAIL — cannot resolve `@/lib/money`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/money.ts`:

```ts
/**
 * Money is integer minor units everywhere past this file. Floats are allowed
 * only at the boundary where a human typed a price into the admin panel.
 */
export type Currency = "KES" | "USD" | "GBP";

export const MINOR_UNIT_EXPONENT: Record<Currency, number> = {
  KES: 2,
  USD: 2,
  GBP: 2,
};

export function toMinorUnits(major: number, currency: Currency): number {
  if (!Number.isFinite(major)) {
    throw new RangeError(`Amount must be finite, got ${major}`);
  }
  if (major < 0) {
    throw new RangeError(`Amount must not be negative, got ${major}`);
  }
  const factor = 10 ** MINOR_UNIT_EXPONENT[currency];
  // Epsilon nudge so 10.005 * 100 = 1000.4999... rounds to 1001, not 1000.
  return Math.round(major * factor + Number.EPSILON * factor);
}

export function formatMoney(minor: number, currency: Currency): string {
  const factor = 10 ** MINOR_UNIT_EXPONENT[currency];
  const major = minor / factor;
  return `${currency} ${major.toLocaleString("en-US", {
    minimumFractionDigits: MINOR_UNIT_EXPONENT[currency],
    maximumFractionDigits: MINOR_UNIT_EXPONENT[currency],
  })}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 8 tests across 2 files, 0 failures

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat(payments): integer minor-unit money helpers"
```

---

### Task 2: Booking access tokens

**Files:**
- Create: `src/lib/booking-token.ts`
- Create: `src/lib/booking-token.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `generateBookingToken(): { token: string; hash: string }`
  - `hashBookingToken(token: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/booking-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { generateBookingToken, hashBookingToken } from "@/lib/booking-token";

describe("generateBookingToken", () => {
  it("is url-safe and long enough to be unguessable", () => {
    const { token } = generateBookingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
  });

  it("does not repeat", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateBookingToken().token),
    );
    expect(seen.size).toBe(500);
  });
});

describe("hashBookingToken", () => {
  it("is deterministic and matches the generated hash", () => {
    const { token, hash } = generateBookingToken();
    expect(hashBookingToken(token)).toBe(hash);
  });

  it("does not reveal the token", () => {
    const { token, hash } = generateBookingToken();
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/booking-token`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/booking-token.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

/**
 * The booking link is a bearer capability: whoever holds it sees the booking.
 * Only the hash is persisted, so a database dump yields no working links.
 * The page it unlocks is read-only by design — that, not the token, is what
 * makes a forwarded email survivable.
 */
export function hashBookingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateBookingToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashBookingToken(token) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 12 tests total, 0 failures

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking-token.ts src/lib/booking-token.test.ts
git commit -m "feat(payments): hashed booking access tokens"
```

---

### Task 3: Parameterise the rate limiter

`allowRequest` currently hardcodes 5 requests per hour, which is right for the lead form and wrong for checkout. Make the limits arguments without changing existing behaviour.

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/lib/rate-limit.test.ts` (exists already, covering the current 5/hour default)

**Interfaces:**
- Consumes: nothing
- Produces: `allowRequest(key: string, options?: { maxRequests?: number; windowMs?: number }): boolean` — existing single-argument callers keep the 5/hour default.

- [ ] **Step 1: Write the failing test**

Append to the existing `src/lib/rate-limit.test.ts`, inside the `describe("allowRequest", ...)` block. Leave the three existing tests untouched — they are the regression guard proving the default did not change.

```ts
  it("honours a custom maxRequests", () => {
    const k = key("custom");
    const opts = { maxRequests: 2 };
    expect(allowRequest(k, opts)).toBe(true);
    expect(allowRequest(k, opts)).toBe(true);
    expect(allowRequest(k, opts)).toBe(false);
  });

  it("honours a custom windowMs", () => {
    const k = key("window");
    const opts = { maxRequests: 1, windowMs: 1 };
    expect(allowRequest(k, opts)).toBe(true);
    expect(allowRequest(k, opts)).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — TypeScript rejects the second argument, and "honours a custom maxRequests" fails at runtime because the third call still returns `true` under the hardcoded limit of 5.

- [ ] **Step 3: Write minimal implementation**

Replace the body of `src/lib/rate-limit.ts`, keeping the existing `ponytail:` comment at the top:

```ts
/**
 * ponytail: in-memory per-process — resets on redeploy and doesn't share
 * across serverless instances. Fine for the volume a lead form gets; move to
 * Upstash/Redis if abuse outgrows a single box.
 */
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 5;

const hits = new Map<string, number[]>();

export function allowRequest(
  key: string,
  options: { maxRequests?: number; windowMs?: number } = {},
): boolean {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;

  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 17 tests total, 0 failures. The three pre-existing default-behaviour tests must still pass; if they do not, the change was not backwards compatible.

- [ ] **Step 5: Verify the existing caller still compiles**

Run: `pnpm lint && npx tsc --noEmit`
Expected: no errors. `src/app/api/leads/route.ts` calls `allowRequest(ip)` and must still type-check unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "refactor(rate-limit): make window and max configurable, default unchanged"
```

---

### Task 4: Orders and ProcessedEvents collections

**Files:**
- Create: `src/collections/Orders.ts`
- Create: `src/collections/ProcessedEvents.ts`
- Modify: `src/payload.config.mts:9-15` (imports) and `:37` (collections array)

**Interfaces:**
- Consumes: `Currency` from `src/lib/money.ts`
- Produces: Payload collections `orders` and `processed-events`; generated types `Order` and `ProcessedEvent` in `@/payload-types`.

Order status values, used verbatim by every later task:
`"pending" | "paid" | "confirmed" | "cancelled" | "refunded" | "failed"`

- [ ] **Step 1: Create the Orders collection**

Create `src/collections/Orders.ts`:

```ts
import type { CollectionConfig } from "payload";

/**
 * The order record is also the CRM — Payload's list view, filters and query
 * presets are the whole customer database at this volume.
 *
 * `items` is a snapshot taken when the order is created and never re-read from
 * the package. A later price edit in the admin must not change what a customer
 * already agreed to pay.
 */
export const Orders: CollectionConfig = {
  slug: "orders",
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // server-side only, via the local API
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  admin: {
    useAsTitle: "orderNumber",
    defaultColumns: ["orderNumber", "status", "customerEmail", "amountTotal", "createdAt"],
    enableQueryPresets: true,
  },
  fields: [
    { name: "orderNumber", type: "text", required: true, unique: true, index: true, admin: { readOnly: true } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: ["pending", "paid", "confirmed", "cancelled", "refunded", "failed"],
    },
    {
      type: "row",
      fields: [
        { name: "customerName", type: "text" },
        { name: "customerEmail", type: "email", required: true, index: true },
        { name: "customerPhone", type: "text" },
      ],
    },
    {
      name: "items",
      type: "array",
      required: true,
      admin: { readOnly: true, description: "Price snapshot. Never re-read from the package." },
      fields: [
        { name: "kind", type: "select", required: true, options: ["package", "hotel"] },
        { name: "refId", type: "text", required: true },
        { name: "title", type: "text", required: true },
        { name: "unitAmount", type: "number", required: true, admin: { description: "Minor units" } },
        { name: "quantity", type: "number", required: true, min: 1 },
        { name: "subtotal", type: "number", required: true, admin: { description: "Minor units" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "currency", type: "select", required: true, defaultValue: "KES", options: ["KES", "USD", "GBP"] },
        { name: "amountTotal", type: "number", required: true, admin: { readOnly: true, description: "Minor units" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "travelDate", type: "date" },
        { name: "adults", type: "number", min: 1 },
        { name: "children", type: "number", min: 0 },
      ],
    },
    {
      name: "stripe",
      type: "group",
      admin: { readOnly: true },
      fields: [
        { name: "checkoutSessionId", type: "text", index: true },
        { name: "paymentIntentId", type: "text" },
      ],
    },
    { name: "accessTokenHash", type: "text", index: true, unique: true, admin: { hidden: true } },
    { name: "invoice", type: "upload", relationTo: "media" },
    { name: "staffNotes", type: "textarea" },
  ],
};
```

- [ ] **Step 2: Create the ProcessedEvents collection**

Create `src/collections/ProcessedEvents.ts`:

```ts
import type { CollectionConfig } from "payload";

/**
 * Webhook idempotency ledger. Stripe retries deliveries; inserting the event id
 * before doing any work is what stops a retry fulfilling an order twice.
 */
export const ProcessedEvents: CollectionConfig = {
  slug: "processed-events",
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: () => false },
  admin: { useAsTitle: "eventId", defaultColumns: ["eventId", "type", "createdAt"], hidden: true },
  fields: [
    { name: "eventId", type: "text", required: true, unique: true, index: true },
    { name: "type", type: "text", required: true },
  ],
};
```

- [ ] **Step 3: Register both in the Payload config**

In `src/payload.config.mts`, add after the `Media` import on line 12:

```ts
import { Orders } from './collections/Orders'
import { ProcessedEvents } from './collections/ProcessedEvents'
```

and change the collections array on line 37 to:

```ts
collections: [Users, Media, Destinations, Packages, Articles, Pages, Leads, Orders, ProcessedEvents],
```

- [ ] **Step 4: Generate types and a migration**

Run:

```bash
pnpm generate:types
pnpm migrate:create orders_and_processed_events
pnpm migrate
```

Expected: `src/payload-types.ts` gains `Order` and `ProcessedEvent`; a new file appears under the migrations directory; `pnpm migrate:status` shows it applied.

- [ ] **Step 5: Verify the schema landed**

Run: `pnpm migrate:status`
Expected: the new migration listed as applied, no pending migrations.

- [ ] **Step 6: Commit**

```bash
git add src/collections/Orders.ts src/collections/ProcessedEvents.ts src/payload.config.mts src/payload-types.ts src/migrations
git commit -m "feat(payments): orders and webhook idempotency collections"
```

---

### Task 5: Server-side order pricing

The rule this task exists to enforce: **the browser never sends an amount.** It sends a package id and a quantity; the server reads the price from Payload and computes the total.

**Files:**
- Create: `src/lib/pricing.ts`
- Create: `src/lib/pricing.test.ts`

**Interfaces:**
- Consumes: `toMinorUnits`, `Currency` from `src/lib/money.ts`
- Produces:
  - `type PriceablePackage = { id: number | string; title: string; priceFrom: number; currency?: string | null }`
  - `type OrderItemInput = { kind: "package"; refId: string; quantity: number }`
  - `type PricedItem = { kind: "package"; refId: string; title: string; unitAmount: number; quantity: number; subtotal: number }`
  - `priceOrder(items: OrderItemInput[], lookup: (refId: string) => PriceablePackage | undefined): { items: PricedItem[]; currency: Currency; amountTotal: number }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { priceOrder, type PriceablePackage } from "@/lib/pricing";

const CATALOGUE: Record<string, PriceablePackage> = {
  "1": { id: 1, title: "7-day Masai Mara", priceFrom: 1250, currency: "USD" },
  "2": { id: 2, title: "Amboseli weekend", priceFrom: 400, currency: "USD" },
  "3": { id: 3, title: "Nakuru day trip", priceFrom: 9500, currency: "KES" },
};
const lookup = (refId: string) => CATALOGUE[refId];

describe("priceOrder", () => {
  it("computes subtotal and total from the catalogue, not the caller", () => {
    const result = priceOrder([{ kind: "package", refId: "1", quantity: 2 }], lookup);
    expect(result.amountTotal).toBe(250000); // 1250.00 USD x 2
    expect(result.currency).toBe("USD");
    expect(result.items[0].unitAmount).toBe(125000);
    expect(result.items[0].subtotal).toBe(250000);
    expect(result.items[0].title).toBe("7-day Masai Mara");
  });

  it("sums multiple items", () => {
    const result = priceOrder(
      [
        { kind: "package", refId: "1", quantity: 1 },
        { kind: "package", refId: "2", quantity: 3 },
      ],
      lookup,
    );
    expect(result.amountTotal).toBe(125000 + 120000);
  });

  it("rejects an unknown package rather than pricing it at zero", () => {
    expect(() =>
      priceOrder([{ kind: "package", refId: "999", quantity: 1 }], lookup),
    ).toThrow(/Unknown package/);
  });

  it("rejects mixed currencies", () => {
    expect(() =>
      priceOrder(
        [
          { kind: "package", refId: "1", quantity: 1 },
          { kind: "package", refId: "3", quantity: 1 },
        ],
        lookup,
      ),
    ).toThrow(/single currency/);
  });

  it("rejects an empty order", () => {
    expect(() => priceOrder([], lookup)).toThrow(/at least one item/);
  });

  it("rejects a non-positive quantity", () => {
    expect(() =>
      priceOrder([{ kind: "package", refId: "1", quantity: 0 }], lookup),
    ).toThrow(/quantity/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/pricing`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/pricing.ts`:

```ts
import { toMinorUnits, type Currency } from "./money.ts";

export type PriceablePackage = {
  id: number | string;
  title: string;
  priceFrom: number;
  currency?: string | null;
};

export type OrderItemInput = {
  kind: "package";
  refId: string;
  quantity: number;
};

export type PricedItem = {
  kind: "package";
  refId: string;
  title: string;
  unitAmount: number;
  quantity: number;
  subtotal: number;
};

/**
 * The trust boundary for money. The request supplies identifiers and
 * quantities; every figure here comes from the catalogue. Nothing the browser
 * sends can influence the total.
 */
export function priceOrder(
  items: OrderItemInput[],
  lookup: (refId: string) => PriceablePackage | undefined,
): { items: PricedItem[]; currency: Currency; amountTotal: number } {
  if (items.length === 0) {
    throw new Error("An order needs at least one item.");
  }

  let currency: Currency | undefined;
  const priced: PricedItem[] = [];

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new RangeError(`Invalid quantity ${item.quantity} for ${item.refId}`);
    }

    const pkg = lookup(item.refId);
    if (!pkg) {
      throw new Error(`Unknown package: ${item.refId}`);
    }

    const itemCurrency = (pkg.currency ?? "KES") as Currency;
    if (currency && currency !== itemCurrency) {
      throw new Error("An order must use a single currency.");
    }
    currency = itemCurrency;

    const unitAmount = toMinorUnits(pkg.priceFrom, itemCurrency);
    priced.push({
      kind: "package",
      refId: item.refId,
      title: pkg.title,
      unitAmount,
      quantity: item.quantity,
      subtotal: unitAmount * item.quantity,
    });
  }

  return {
    items: priced,
    currency: currency as Currency,
    amountTotal: priced.reduce((sum, i) => sum + i.subtotal, 0),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 23 tests total, 0 failures

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat(payments): server-side order pricing from the catalogue"
```

---

### Task 6: Stripe client and checkout endpoint

**Files:**
- Create: `src/lib/stripe.ts`
- Create: `src/app/api/checkout/route.ts`
- Modify: `.env.example`
- Modify: `package.json` (add `stripe`)

**Interfaces:**
- Consumes: `priceOrder` (Task 5), `generateBookingToken` (Task 2), `allowRequest` (Task 3), the `orders` collection (Task 4)
- Produces: `getStripe(): Stripe | null` from `src/lib/stripe.ts`; `POST /api/checkout` returning `{ url: string }`

- [ ] **Step 1: Install the SDK**

Run: `pnpm add stripe`

- [ ] **Step 2: Write the Stripe client**

Create `src/lib/stripe.ts`:

```ts
import Stripe from "stripe";

/**
 * Returns null until STRIPE_SECRET_KEY exists, matching the no-op pattern in
 * `notify-lead.ts` so local work without credentials still builds.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}
```

- [ ] **Step 3: Add the environment variables**

Append to `.env.example`:

```
# Stripe. Test-mode keys need no merchant account — create an account, pick
# United Kingdom as the country, and copy the test keys.
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 4: Write the checkout endpoint**

Create `src/app/api/checkout/route.ts`. Read `node_modules/next/dist/docs/` for the current route handler signature before writing this.

```ts
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { generateBookingToken } from "@/lib/booking-token";
import { priceOrder, type PriceablePackage } from "@/lib/pricing";
import { allowRequest } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Trust boundary. Note what is absent: there is no `amount` field. The client
 * cannot express a price, so it cannot tamper with one.
 */
const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
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
  travelDate: z.string().trim().max(40).optional(),
  adults: z.coerce.number().int().min(1).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
});

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(`checkout:${ip}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const data = parsed.data;

  const payload = await getPayload({ config: configPromise });

  const found = await payload.find({
    collection: "packages",
    where: { id: { in: data.items.map((i) => i.refId) } },
    limit: 10,
    depth: 0,
  });
  const catalogue = new Map<string, PriceablePackage>(
    found.docs.map((d) => [
      String(d.id),
      { id: d.id, title: d.title, priceFrom: d.priceFrom, currency: d.currency },
    ]),
  );

  let priced;
  try {
    priced = priceOrder(data.items, (refId) => catalogue.get(refId));
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { token, hash } = generateBookingToken();
  const orderNumber = `MS-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

  const order = await payload.create({
    collection: "orders",
    data: {
      orderNumber,
      status: "pending",
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      items: priced.items,
      currency: priced.currency,
      amountTotal: priced.amountTotal,
      travelDate: data.travelDate,
      adults: data.adults,
      children: data.children,
      accessTokenHash: hash,
    },
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: data.customerEmail,
    client_reference_id: String(order.id),
    metadata: { orderId: String(order.id) },
    line_items: priced.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: priced.currency.toLowerCase(),
        unit_amount: item.unitAmount,
        product_data: { name: item.title },
      },
    })),
    success_url: `${origin}/booking/${token}?paid=1`,
    cancel_url: `${origin}/packages`,
  });

  await payload.update({
    collection: "orders",
    id: order.id,
    data: { stripe: { checkoutSessionId: session.id } },
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `pnpm lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manually verify a session is created**

With `STRIPE_SECRET_KEY` set to a test key, run `pnpm dev` and:

```bash
curl -s localhost:3000/api/checkout -H 'content-type: application/json' -d '{
  "items":[{"kind":"package","refId":"1","quantity":2}],
  "customerName":"Test Buyer","customerEmail":"buyer@example.com"
}' | head -c 200
```

Expected: `{"url":"https://checkout.stripe.com/..."}`. Then confirm in the Payload admin that an order exists with status `pending` and an `amountTotal` matching twice the package price in minor units.

- [ ] **Step 7: Confirm the price cannot be tampered with**

```bash
curl -s localhost:3000/api/checkout -H 'content-type: application/json' -d '{
  "items":[{"kind":"package","refId":"1","quantity":1,"unitAmount":1,"subtotal":1}],
  "amountTotal":1,
  "customerName":"Attacker","customerEmail":"a@example.com"
}' | head -c 200
```

Expected: a session is still created, and the new order's `amountTotal` is the catalogue price — **not** 1. The extra fields are ignored by the schema.

- [ ] **Step 8: Commit**

```bash
git add src/lib/stripe.ts src/app/api/checkout/route.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat(payments): checkout endpoint with server-computed pricing"
```

---

### Task 7: Webhook handler

The only code path allowed to write `status: "paid"`.

**Files:**
- Create: `src/lib/webhook-guards.ts`
- Create: `src/lib/webhook-guards.test.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `getStripe` (Task 6), the `orders` and `processed-events` collections (Task 4)
- Produces: `assertAmountMatches(session: { amount_total: number | null; currency: string | null }, order: { amountTotal: number; currency: string }): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/webhook-guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { assertAmountMatches } from "@/lib/webhook-guards";

describe("assertAmountMatches", () => {
  it("accepts a session that matches the order", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: 250000, currency: "usd" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).not.toThrow();
  });

  it("rejects a short payment", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: 100, currency: "usd" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).toThrow(/amount mismatch/i);
  });

  it("rejects a currency swap", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: 250000, currency: "kes" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).toThrow(/currency mismatch/i);
  });

  it("rejects a missing amount rather than treating it as zero", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: null, currency: "usd" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).toThrow(/amount mismatch/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/webhook-guards`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/webhook-guards.ts`:

```ts
/**
 * Stripe tells us what was paid; the order says what was owed. If they differ,
 * something is wrong — a tampered session, a currency mix-up, a code bug — and
 * the safe move is to refuse rather than fulfil.
 */
export function assertAmountMatches(
  session: { amount_total: number | null; currency: string | null },
  order: { amountTotal: number; currency: string },
): void {
  if (session.amount_total !== order.amountTotal) {
    throw new Error(
      `Amount mismatch: paid ${session.amount_total}, owed ${order.amountTotal}`,
    );
  }
  if ((session.currency ?? "").toUpperCase() !== order.currency.toUpperCase()) {
    throw new Error(
      `Currency mismatch: paid ${session.currency}, owed ${order.currency}`,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 27 tests total, 0 failures

- [ ] **Step 5: Write the webhook route**

Create `src/app/api/webhooks/stripe/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getPayload } from "payload";

import configPromise from "@payload-config";
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

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = await getPayload({ config: configPromise });

  // Claim the event before doing any work. A duplicate key means a retry.
  try {
    await payload.create({
      collection: "processed-events",
      data: { eventId: event.id, type: event.type },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ received: true });

    const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0 });

    try {
      assertAmountMatches(
        { amount_total: session.amount_total, currency: session.currency },
        { amountTotal: order.amountTotal, currency: order.currency },
      );
    } catch (error) {
      await payload.update({
        collection: "orders",
        id: orderId,
        data: {
          status: "failed",
          staffNotes: `${order.staffNotes ?? ""}\nPayment refused: ${(error as Error).message}`.trim(),
        },
      });
      return NextResponse.json({ received: true, refused: true });
    }

    await payload.update({
      collection: "orders",
      id: orderId,
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
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 6: Verify against the Stripe CLI**

In one terminal: `pnpm dev`. In another:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, restart dev
stripe trigger checkout.session.completed
```

Expected: the route returns 200 and the terminal shows the event delivered.

- [ ] **Step 7: Verify a forged webhook is rejected**

```bash
curl -si localhost:3000/api/webhooks/stripe \
  -H 'content-type: application/json' \
  -H 'stripe-signature: t=1,v1=deadbeef' \
  -d '{"id":"evt_forged","type":"checkout.session.completed"}' | head -1
```

Expected: `HTTP/1.1 400 Bad Request`, and no order changes state.

- [ ] **Step 8: Verify a replay changes nothing**

Complete a real test-mode checkout, note the order flips to `paid`, then in the Stripe dashboard resend the same event. Expected: response `{"received":true,"duplicate":true}`, and the order is untouched — one row in `processed-events` for that event id.

- [ ] **Step 9: Commit**

```bash
git add src/lib/webhook-guards.ts src/lib/webhook-guards.test.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat(payments): signature-verified idempotent stripe webhook"
```

---

### Task 8: Booking page

**Files:**
- Create: `src/app/(site)/booking/[token]/page.tsx`
- Create: `src/lib/orders.ts`

**Interfaces:**
- Consumes: `hashBookingToken` (Task 2), `formatMoney` (Task 1), the `orders` collection (Task 4)
- Produces: `findOrderByToken(token: string): Promise<Order | null>` from `src/lib/orders.ts`

- [ ] **Step 1: Write the lookup helper**

Create `src/lib/orders.ts`:

```ts
import { getPayload } from "payload";

import configPromise from "@payload-config";
import type { Order } from "@/payload-types";
import { hashBookingToken } from "./booking-token";

/** Looks up by hash, so the plaintext token is never compared against storage. */
export async function findOrderByToken(token: string): Promise<Order | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "orders",
    where: { accessTokenHash: { equals: hashBookingToken(token) } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  return result.docs[0] ?? null;
}
```

- [ ] **Step 2: Write the page**

Create `src/app/(site)/booking/[token]/page.tsx`. Check `node_modules/next/dist/docs/` for the current `params` and `metadata` contract before writing.

```tsx
import { notFound } from "next/navigation";

import { formatMoney, type Currency } from "@/lib/money";
import { findOrderByToken } from "@/lib/orders";

/** Per-customer and never cached. ISR here would serve one person's booking to another. */
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function BookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await findOrderByToken(token);

  // 404 rather than 403 — a 403 would confirm the booking exists.
  if (!order) notFound();

  const currency = order.currency as Currency;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-label text-muted-foreground">Booking {order.orderNumber}</p>
      <h1 className="text-title mt-1">
        {order.status === "pending" ? "Confirming your payment" : "Your booking"}
      </h1>

      {order.status === "pending" && (
        <p className="text-lead mt-3">
          We are waiting for your payment to confirm. This page updates once it does — refresh in a
          moment.
        </p>
      )}

      <dl className="mt-8 space-y-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between gap-4">
            <dt>
              {item.title}
              {item.quantity > 1 ? ` x${item.quantity}` : ""}
            </dt>
            <dd>{formatMoney(item.subtotal, currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
          <dt>Total paid</dt>
          <dd>{formatMoney(order.amountTotal, currency)}</dd>
        </div>
      </dl>

      <p className="text-label text-muted-foreground mt-8">
        Keep this link. It is the only way back to this page, and it does not expire.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Add the no-store and referrer headers**

The page must not be cached by any intermediary and must not leak its URL. Add to `next.config.ts` under `headers()`:

```ts
{
  source: "/booking/:token",
  headers: [
    { key: "Cache-Control", value: "private, no-store, max-age=0" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ],
}
```

If `next.config.ts` has no `headers()` yet, add one returning an array containing this object.

- [ ] **Step 4: Verify a real token renders**

Complete a test-mode checkout, take the `success_url` you were redirected to, and load it. Expected: the order number, line items and total render, and the total matches the Stripe dashboard.

- [ ] **Step 5: Verify a bad token 404s and headers are set**

```bash
curl -si localhost:3000/booking/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | head -1
curl -sI localhost:3000/booking/<real-token> | grep -iE 'cache-control|referrer-policy|x-robots'
```

Expected: `404` for the bogus token; `private, no-store`, `no-referrer` and `noindex` present for the real one.

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders.ts "src/app/(site)/booking" next.config.ts
git commit -m "feat(payments): private booking page behind a hashed token"
```

---

### Task 9: Confirmation email

**Files:**
- Create: `src/lib/notify-order.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts` (call it after marking paid)

**Interfaces:**
- Consumes: `Order` type, `formatMoney` (Task 1)
- Produces: `notifyOrderPaid(order: Order, token: string): Promise<void>`

Note: the plaintext token exists only in Task 6's `checkout` handler, which is a different request from the webhook. Carry it forward by storing it on the Stripe session metadata so the webhook can read it back.

- [ ] **Step 1: Pass the token through Stripe metadata**

In `src/app/api/checkout/route.ts`, change the session `metadata` to:

```ts
metadata: { orderId: String(order.id), bookingToken: token },
```

Stripe metadata is not public — it is readable only with the secret key.

- [ ] **Step 2: Write the email helper**

Create `src/lib/notify-order.ts`, following the no-op pattern in `notify-lead.ts`:

```ts
import { Resend } from "resend";

import type { Order } from "@/payload-types";
import { formatMoney, type Currency } from "./money";

/** No-ops until Resend is configured, same as `notifyLead`. */
export async function notifyOrderPaid(order: Order, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !site) return;

  const resend = new Resend(apiKey);
  const total = formatMoney(order.amountTotal, order.currency as Currency);

  await resend.emails.send({
    from,
    to: order.customerEmail,
    subject: `Booking confirmed - ${order.orderNumber}`,
    text: [
      `Thank you. Your booking is confirmed.`,
      ``,
      `Booking reference: ${order.orderNumber}`,
      `Total paid: ${total}`,
      ``,
      `View your booking and download your invoice:`,
      `${site}/booking/${token}`,
      ``,
      `Keep this link — it is private to you and does not expire.`,
    ].join("\n"),
  });
}
```

- [ ] **Step 3: Call it from the webhook**

In `src/app/api/webhooks/stripe/route.ts`, after the `payload.update` that sets `status: "paid"`, add:

```ts
const updated = await payload.findByID({ collection: "orders", id: orderId, depth: 0 });
const bookingToken = session.metadata?.bookingToken;
if (bookingToken) {
  await notifyOrderPaid(updated, bookingToken).catch(() => {});
}
```

and import it at the top:

```ts
import { notifyOrderPaid } from "@/lib/notify-order";
```

The `.catch(() => {})` matches the leads route: a failed email must not fail the webhook, because Stripe would retry and the guard would then treat it as a duplicate.

- [ ] **Step 4: Verify end to end**

With Resend configured and `stripe listen` running, complete a test-mode checkout. Expected: the order flips to `paid`, an email arrives, and the link in it loads the booking page.

- [ ] **Step 5: Verify a broken email does not break the webhook**

Temporarily set `RESEND_API_KEY` to a bogus value and complete another checkout. Expected: the webhook still returns 200 and the order still flips to `paid`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notify-order.ts src/app/api/checkout/route.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat(payments): booking confirmation email with access link"
```

---

### Task 10: Freeze paid orders

**Files:**
- Modify: `src/collections/Orders.ts`
- Create: `src/collections/hooks/freeze-paid-orders.ts`
- Create: `src/collections/hooks/freeze-paid-orders.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `assertNotRepricingPaidOrder(args: { previous?: { status?: string; amountTotal?: number } | null; incoming: { amountTotal?: number; currency?: string; items?: unknown } }): void`

- [ ] **Step 1: Write the failing test**

Create `src/collections/hooks/freeze-paid-orders.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { assertNotRepricingPaidOrder } from "@/collections/hooks/freeze-paid-orders";

describe("assertNotRepricingPaidOrder", () => {
  it("allows editing a pending order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "pending", amountTotal: 1000 },
        incoming: { amountTotal: 2000 },
      }),
    ).not.toThrow();
  });

  it("allows a status change on a paid order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1000 },
        incoming: {},
      }),
    ).not.toThrow();
  });

  it("refuses to change the total of a paid order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1000 },
        incoming: { amountTotal: 5 },
      }),
    ).toThrow(/already been paid/i);
  });

  it("refuses to change the items of a paid order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1000 },
        incoming: { items: [{ title: "swapped" }] },
      }),
    ).toThrow(/already been paid/i);
  });

  it("treats a brand new order as editable", () => {
    expect(() =>
      assertNotRepricingPaidOrder({ previous: null, incoming: { amountTotal: 1000 } }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/collections/hooks/freeze-paid-orders`

- [ ] **Step 3: Write minimal implementation**

Create `src/collections/hooks/freeze-paid-orders.ts`:

```ts
const FROZEN_STATUSES = new Set(["paid", "confirmed", "refunded"]);

/**
 * Once money has changed hands the priced facts are a record, not a draft.
 * Status and staff notes stay editable; the figures do not.
 */
export function assertNotRepricingPaidOrder(args: {
  previous?: { status?: string; amountTotal?: number } | null;
  incoming: { amountTotal?: number; currency?: string; items?: unknown };
}): void {
  const previous = args.previous;
  if (!previous || !previous.status || !FROZEN_STATUSES.has(previous.status)) return;

  const touchesMoney =
    (args.incoming.amountTotal !== undefined &&
      args.incoming.amountTotal !== previous.amountTotal) ||
    args.incoming.currency !== undefined ||
    args.incoming.items !== undefined;

  if (touchesMoney) {
    throw new Error("This order has already been paid; its figures cannot be changed.");
  }
}
```

- [ ] **Step 4: Wire the hook into the collection**

In `src/collections/Orders.ts`, add the import at the top:

```ts
import { assertNotRepricingPaidOrder } from "./hooks/freeze-paid-orders";
```

and add to the collection config, as a sibling of `fields`:

```ts
  hooks: {
    beforeChange: [
      ({ operation, originalDoc, data }) => {
        if (operation === "update") {
          assertNotRepricingPaidOrder({ previous: originalDoc, incoming: data });
        }
        return data;
      },
    ],
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 32 tests total, 0 failures

- [ ] **Step 6: Verify in the admin panel**

Open a `paid` order in the Payload admin, change the status to `confirmed` and save. Expected: saves fine. Then attempt to edit `amountTotal` via the API and confirm it is refused:

```bash
curl -si -X PATCH localhost:3000/api/orders/<id> \
  -H 'content-type: application/json' \
  -d '{"amountTotal":1}' | head -1
```

Expected: a 4xx/500 carrying the "already been paid" message, and the stored total unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/collections/Orders.ts src/collections/hooks
git commit -m "feat(payments): freeze figures on paid orders"
```

---

### Task 11: Update project documentation

**Files:**
- Modify: `CLAUDE.md` (Status section, Constraints section)
- Modify: `docs/WORK-PLAN.md`

- [ ] **Step 1: Add the money constraint**

In `CLAUDE.md`, under "Constraints that are easy to violate", add:

```markdown
- **Money is integer minor units past `src/lib/money.ts`.** Floats only where a human typed a price into the admin. And only the Stripe webhook may write `status: "paid"` on an order — no other code path, ever.
```

- [ ] **Step 2: Update the Status section**

In `CLAUDE.md`, note that payments, orders and the booking link have shipped, and that `pnpm test` runs Vitest (`vitest.config.mts`, `.mts` for the same ESM reason as the Payload config).

- [ ] **Step 3: Log the work**

In `docs/WORK-PLAN.md`, record the payments work as complete, referencing this plan.

- [ ] **Step 4: Verify the whole suite and build**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all tests pass, no lint errors, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/WORK-PLAN.md
git commit -m "docs: record payments and orders work"
```

---

## Self-review notes

**Spec coverage** — Spec Part A maps to tasks as follows: A.2 data model → Task 4; A.3.1 client sends no amount → Tasks 5, 6 (step 7 proves it); A.3.2 only webhook writes paid → Task 7; A.3.3 raw body signature → Task 7 (step 7 proves it); A.3.4 idempotency → Task 7 (step 8 proves it); A.3.5 amount cross-check → Task 7; A.3.6 immutable once paid → Task 10; A.3.7 redirect proves nothing → Task 8 (the pending state); A.4 endpoints → Tasks 6, 7, 8; A.5 access link → Tasks 2, 8; A.6 email → Task 9.

**Two spec items deliberately deferred, not forgotten:**
- **Invoice PDF generation and the presigned `/api/booking/[token]/invoice` route.** The `invoice` upload field exists on the collection (Task 4) but nothing populates it. This needs a PDF library decision that has not been made, and the email in Task 9 is useful without it. Add as Task 12 once the library is chosen.
- **The admin "rotate booking link" action.** Belongs with Part C's admin work; the `accessTokenHash` field it operates on already exists.

**Type consistency** — `Currency` is defined once in Task 1 and imported by Tasks 5, 8, 9. `PricedItem` (Task 5) matches the `items` array field shape (Task 4). Order status strings are identical in Tasks 4, 7, 8 and 10. `findOrderByToken` and `hashBookingToken` are referenced only after the tasks that define them.

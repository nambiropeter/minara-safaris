import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  checkRate: vi.fn(),
  getKesRates: vi.fn(),
  startCheckout: vi.fn(),
  priceBundlePackage: vi.fn(),
  settings: { current: { enabled: true, marginBps: 1500 } as { enabled: boolean; marginBps: number | null } },
  config: { current: { apiKey: "k", secret: "s", baseUrl: "https://x" } as unknown },
  stripe: { current: {} as unknown },
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: async () => ({}) }));
vi.mock("@/lib/hotelbeds", async () => ({
  ...(await vi.importActual<typeof import("@/lib/hotelbeds")>("@/lib/hotelbeds")),
  getHotelbeds: () => h.config.current,
  checkRate: h.checkRate,
}));
vi.mock("@/lib/exchange-rates", () => ({ getKesRates: h.getKesRates }));
vi.mock("@/lib/hotel-settings", () => ({ getHotelSettings: async () => h.settings.current }));
vi.mock("@/lib/bundle", () => ({ priceBundlePackage: h.priceBundlePackage }));
vi.mock("@/lib/start-checkout", () => ({ startCheckout: h.startCheckout }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => h.stripe.current }));

import { HotelbedsError } from "@/lib/hotelbeds";
import { issueSession, SESSION_COOKIE } from "@/lib/hotel-session";
import { POST } from "./route";

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const rateKey = "20270301|W|1|7|DBL.ST|ID_B2B_26|RO||1~2~1||N@AB+/=";

const valid = {
  rateKey,
  shownFrom: 1_725_000, // EUR 100 net + 15% = EUR 115 = KES 17,250
  adults: 2,
  childAges: [7],
  currency: "KES",
  guests: [
    { firstName: "Amina", lastName: "Otieno" },
    { firstName: "Brian", lastName: "Otieno" },
    { firstName: "Zuri", lastName: "Otieno" },
  ],
  customerEmail: "amina@example.com",
  customerPhone: "+254700000000",
};

const checked = (over: Record<string, unknown> = {}) => ({
  currency: "EUR",
  checkIn: day(40),
  checkOut: day(43),
  hotelCode: 195976,
  hotelName: "The Boma Nairobi",
  roomName: "Superior room",
  adults: 2,
  children: 1,
  comments: "Deposit on arrival.",
  paymentDataRequired: false,
  rate: {
    rateKey: "REISSUED",
    rateType: "BOOKABLE",
    net: 100,
    boardCode: "RO",
    boardName: "ROOM ONLY",
    paymentType: "AT_WEB",
    cancellationPolicies: [{ amount: 100, from: "2000-01-01T00:00:00Z" }],
  },
  ...over,
});

let ip = 0;
function call(body: unknown, session: string | null = issueSession(Date.now() - 5000)) {
  return POST(
    new NextRequest("http://localhost/api/hotels/book", {
      method: "POST",
      headers: { "x-forwarded-for": `10.3.0.${++ip}`, ...(session && { cookie: `${SESSION_COOKIE}=${session}` }) },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  h.checkRate.mockReset();
  h.startCheckout.mockReset();
  h.priceBundlePackage.mockReset();
  h.getKesRates.mockReset();
  h.settings.current = { enabled: true, marginBps: 1500 };
  h.config.current = { apiKey: "k", secret: "s", baseUrl: "https://x" };
  h.stripe.current = {};
  h.getKesRates.mockResolvedValue({ usdPerKes: 0.0077, eurPerKes: 1 / 150, updatedAt: "now" });
  h.checkRate.mockResolvedValue(checked());
  h.startCheckout.mockResolvedValue({ ok: true, url: "https://checkout.stripe.test/s" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/hotels/book: the way in", () => {
  it("is unavailable without Stripe or Hotelbeds", async () => {
    h.stripe.current = null;
    expect((await call(valid)).status).toBe(503);
    h.stripe.current = {};
    h.config.current = null;
    expect((await call(valid)).status).toBe(503);
  });

  it("needs a session", async () => {
    expect((await call(valid, null)).status).toBe(401);
    expect(h.checkRate).not.toHaveBeenCalled();
  });

  it("refuses unknown fields, so no price or dates can be smuggled in", async () => {
    for (const extra of [{ price: 1 }, { amountTotal: 1 }, { checkIn: day(1) }, { checkOut: day(2) }, { hotelCode: 1 }]) {
      expect((await call({ ...valid, ...extra })).status).toBe(400);
    }
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("refuses a guest list that doesn't match the party", async () => {
    expect((await call({ ...valid, guests: valid.guests.slice(0, 2) })).status).toBe(400);
    expect((await call({ ...valid, adults: 3 })).status).toBe(400);
  });

  it("refuses names Hotelbeds would reject, and a bad email", async () => {
    expect((await call({ ...valid, guests: [{ firstName: "A1", lastName: "B" }, ...valid.guests.slice(1)] })).status).toBe(400);
    expect((await call({ ...valid, guests: [{ firstName: "", lastName: "B" }, ...valid.guests.slice(1)] })).status).toBe(400);
    expect((await call({ ...valid, customerEmail: "nope" })).status).toBe(400);
  });

  it("accepts the names people actually have", async () => {
    const guests = [{ firstName: "Wanjiru", lastName: "Mwangi-Kamau" }, { firstName: "Seán", lastName: "O'Brien" }, { firstName: "Zoë", lastName: "de la Cruz" }];
    expect((await call({ ...valid, guests })).status).toBe(200);
  });

  it("is unavailable when staff have switched hotels off or no margin exists", async () => {
    h.settings.current = { enabled: false, marginBps: 1500 };
    expect((await call(valid)).status).toBe(503);
    h.settings.current = { enabled: true, marginBps: null };
    expect((await call(valid)).status).toBe(503);
    expect(h.startCheckout).not.toHaveBeenCalled();
  });
});

describe("POST /api/hotels/book: the price", () => {
  it("re-checks the rate itself, with the rateKey untouched", async () => {
    await call(valid);
    expect(h.checkRate).toHaveBeenCalledWith(expect.anything(), rateKey);
  });

  it("creates the order at the server's price, from the stay CheckRate reports", async () => {
    const response = await call(valid);

    expect(response.status).toBe(200);
    expect((await response.json()).url).toBe("https://checkout.stripe.test/s");

    const args = h.startCheckout.mock.calls[0][0];
    const stay = checked();
    expect(args.cancelPath).toBe("/hotels/195976");
    expect(args.order).toMatchObject({
      customerName: "Amina Otieno",
      customerEmail: "amina@example.com",
      currency: "KES",
      amountTotal: 1_725_000,
      travelDate: stay.checkIn,
      adults: 2,
      children: 1,
      items: [
        {
          kind: "hotel",
          refId: "195976",
          title: "The Boma Nairobi, Superior room, room only, 3 nights",
          unitAmount: 1_725_000,
          quantity: 1,
          subtotal: 1_725_000,
        },
      ],
      supplier: {
        name: "hotelbeds",
        status: "pending",
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        rateKey: "REISSUED",
        netAmount: 100,
        marginBps: 1500,
        fxUsdPerKes: 0.0077,
        rateComments: "Deposit on arrival.",
      },
    });
    expect(args.order.supplier.fxEurPerKes).toBeCloseTo(1 / 150);
    expect(args.order.supplier.guests).toEqual([
      { type: "AD", name: "Amina", surname: "Otieno" },
      { type: "AD", name: "Brian", surname: "Otieno" },
      { type: "CH", name: "Zuri", surname: "Otieno", age: 7 },
    ]);
    expect(args.lineItems).toEqual([
      { quantity: 1, price_data: { currency: "kes", unit_amount: 1_725_000, product_data: { name: "The Boma Nairobi, Superior room, room only, 3 nights" } } },
    ]);
  });

  it("stores the fee schedule at what the customer pays, not what Hotelbeds charges us", async () => {
    await call(valid);
    expect(h.startCheckout.mock.calls[0][0].order.supplier.cancellationPolicies).toEqual([
      { from: "2000-01-01T00:00:00Z", amount: 1_725_000 },
    ]);
  });

  it("stops and shows the new price when it moved, and creates nothing", async () => {
    const response = await call({ ...valid, shownFrom: 1_500_000 });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ priceChanged: true, from: 1_725_000, previousFrom: 1_500_000 });
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("can't be talked into a cheaper charge by a smaller shownFrom", async () => {
    await call({ ...valid, shownFrom: 1 });
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("charges in dollars when asked, from the same server-side rate", async () => {
    await call({ ...valid, currency: "USD", shownFrom: 14_787 }); // 115 EUR * (0.0077*150) = 132.825 -> up to 13283
    const body = h.startCheckout.mock.calls[0]?.[0];
    // 115 * 1.155 = 132.825 USD -> 13283 cents (rounded up), so 14_787 is not the price and nothing is created
    expect(body).toBeUndefined();
    const response = await call({ ...valid, currency: "USD", shownFrom: 13_283 });
    expect(response.status).toBe(200);
    expect(h.startCheckout.mock.calls[0][0].order.currency).toBe("USD");
  });
});

describe("POST /api/hotels/book: what the rate must be", () => {
  it("won't book a rate that isn't BOOKABLE after the recheck, or that wants card data", async () => {
    h.checkRate.mockResolvedValue(checked({ rate: { ...checked().rate, rateType: "RECHECK" } }));
    expect((await call(valid)).status).toBe(409);
    h.checkRate.mockResolvedValue(checked({ paymentDataRequired: true }));
    expect((await call(valid)).status).toBe(409);
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("won't book a rate for a different party size than the one sent", async () => {
    h.checkRate.mockResolvedValue(checked({ adults: 1, children: 0 }));
    expect((await call(valid)).status).toBe(400);
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("won't price anything but euros", async () => {
    h.checkRate.mockResolvedValue(checked({ currency: "USD" }));
    expect((await call(valid)).status).toBe(502);
  });

  it("won't book a stay in the past or one with no nights", async () => {
    h.checkRate.mockResolvedValue(checked({ checkIn: day(-3), checkOut: day(-1) }));
    expect((await call(valid)).status).toBe(400);
    h.checkRate.mockResolvedValue(checked({ checkIn: day(40), checkOut: day(40) }));
    expect((await call(valid)).status).toBe(400);
  });

  it("maps an expired rate to 409 and a supplier outage to 502", async () => {
    h.checkRate.mockRejectedValue(new HotelbedsError(400, "rate expired"));
    expect((await call(valid)).status).toBe(409);
    h.checkRate.mockRejectedValue(new HotelbedsError(500, "down"));
    expect((await call(valid)).status).toBe(502);
  });

  it("reports a payment that could not be started", async () => {
    h.startCheckout.mockResolvedValue({ ok: false });
    expect((await call(valid)).status).toBe(502);
  });
});

describe("POST /api/hotels/book: with a package", () => {
  const pkgLine = { kind: "package", refId: "5", title: "Mara 3 days", unitAmount: 6_000_000, quantity: 3, subtotal: 18_000_000 };
  const bundled = { ...valid, package: { id: "5", shownSubtotal: 18_000_000 } };

  it("charges package and hotel as two items on one session, the party size taken from the rate", async () => {
    h.priceBundlePackage.mockResolvedValue({ item: pkgLine, priceNote: null });
    const res = await call(bundled);
    expect(res.status).toBe(200);
    expect(h.priceBundlePackage).toHaveBeenCalledWith(expect.anything(), "5", "KES", 3, expect.anything());

    const args = h.startCheckout.mock.calls[0][0];
    expect(args.order.items.map((i: { kind: string }) => i.kind)).toEqual(["package", "hotel"]);
    expect(args.order.amountTotal).toBe(18_000_000 + 1_725_000);
    expect(args.lineItems.map((l: { price_data: { unit_amount: number }; quantity: number }) => l.price_data.unit_amount * l.quantity)).toEqual([
      18_000_000,
      1_725_000,
    ]);
  });

  it("rejects a package that can't take a hotel, before anything is created", async () => {
    h.priceBundlePackage.mockResolvedValue(null);
    expect((await call(bundled)).status).toBe(400);
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("refuses when the package price moved since the visitor saw it", async () => {
    h.priceBundlePackage.mockResolvedValue({ item: { ...pkgLine, subtotal: 19_000_000 }, priceNote: null });
    expect((await call(bundled)).status).toBe(409);
    expect(h.startCheckout).not.toHaveBeenCalled();
  });

  it("a hotel-only booking is unchanged: one item, the hotel's price", async () => {
    await call(valid);
    const args = h.startCheckout.mock.calls[0][0];
    expect(args.order.items).toHaveLength(1);
    expect(args.order.amountTotal).toBe(1_725_000);
    expect(h.priceBundlePackage).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import { priceBundlePackage } from "./bundle";

const rates = { usdPerKes: 0.0077 };
const doc = (over: object = {}) => ({
  id: 5,
  title: "Mara 3 days",
  priceFrom: 60000,
  currency: "KES",
  accommodation: "choose-your-own",
  ...over,
});
const payloadWith = (docs: unknown[]) => ({ find: vi.fn().mockResolvedValue({ docs }) }) as never;

describe("priceBundlePackage", () => {
  it("prices per person from the catalogue, times the party", async () => {
    const line = await priceBundlePackage(payloadWith([doc()]), "5", "KES", 3, rates);
    expect(line).toMatchObject({ kind: "package", refId: "5", unitAmount: 6000000, quantity: 3, subtotal: 18000000 });
  });

  it("converts with the shared convertPrice when the visitor chose USD", async () => {
    const line = await priceBundlePackage(payloadWith([doc()]), "5", "USD", 2, rates);
    expect(line?.unitAmount).toBe(46200); // floor(60000 * 0.0077) = 462.00 USD
  });

  it("returns null for a package that is unpublished or unknown", async () => {
    expect(await priceBundlePackage(payloadWith([]), "9", "KES", 2, rates)).toBeNull();
  });

  it("returns null when accommodation is included, so no hotel can be added to it", async () => {
    expect(await priceBundlePackage(payloadWith([doc({ accommodation: "included" })]), "5", "KES", 2, rates)).toBeNull();
  });
});

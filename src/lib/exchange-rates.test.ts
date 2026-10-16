import { describe, expect, it } from "vitest";

import { convertPrice, parseRates } from "./exchange-rates";

describe("parseRates", () => {
  it("reads the keyed endpoint's conversion_rates", () => {
    expect(
      parseRates({
        result: "success",
        time_last_update_utc: "Thu, 15 Oct 2026 00:00:01 +0000",
        conversion_rates: { KES: 1, USD: 0.0077 },
      }),
    ).toEqual({ usdPerKes: 0.0077, updatedAt: "Thu, 15 Oct 2026 00:00:01 +0000" });
  });

  it("reads the open endpoint's rates", () => {
    expect(parseRates({ result: "success", rates: { USD: 0.0077 } })?.usdPerKes).toBe(0.0077);
  });

  it("also reads the euro rate when the provider has one", () => {
    expect(parseRates({ result: "success", rates: { USD: 0.0077, EUR: 0.0066 } })?.eurPerKes).toBe(0.0066);
    expect(parseRates({ result: "success", rates: { USD: 0.0077, EUR: 0 } })?.eurPerKes).toBeUndefined();
  });

  it("rejects errors and nonsense", () => {
    expect(parseRates({ result: "error", "error-type": "invalid-key" })).toBeNull();
    expect(parseRates({ result: "success", rates: { USD: 0 } })).toBeNull();
    expect(parseRates(null)).toBeNull();
  });
});

describe("convertPrice", () => {
  const usdPerKes = 0.0077;

  it("passes same-currency amounts through", () => {
    expect(convertPrice(45000, "KES", "KES", usdPerKes)).toBe(45000);
  });

  it("converts and floors in both directions", () => {
    expect(convertPrice(45000, "KES", "USD", usdPerKes)).toBe(346); // 346.5
    expect(convertPrice(1000, "USD", "KES", usdPerKes)).toBe(129870); // 129870.12…
  });

  it("does not lose a unit to float error", () => {
    expect(convertPrice(100, "KES", "USD", 0.01)).toBe(1);
  });
});

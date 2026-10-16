import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ findGlobal: vi.fn() }));
vi.mock("payload", () => ({ getPayload: async () => db }));
vi.mock("@payload-config", () => ({ default: {} }));

import { getHotelSettings, percentToBps, resetHotelSettingsMemo } from "./hotel-settings";

const NOW = 1_700_000_000_000;

beforeEach(() => {
  db.findGlobal.mockReset();
  resetHotelSettingsMemo();
  vi.stubEnv("HOTEL_MARGIN_BPS", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("percentToBps", () => {
  it("turns admin percent into whole basis points", () => {
    expect(percentToBps(15)).toBe(1500);
    expect(percentToBps(12.5)).toBe(1250);
    expect(percentToBps(0)).toBe(0);
  });
});

describe("getHotelSettings", () => {
  it("uses the margin saved in the admin", async () => {
    db.findGlobal.mockResolvedValue({ enabled: true, marginPercent: 12.5 });
    expect(await getHotelSettings(NOW)).toEqual({ enabled: true, marginBps: 1250 });
  });

  it("lets the admin margin win over the env fallback", async () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "1500");
    db.findGlobal.mockResolvedValue({ enabled: true, marginPercent: 10 });
    expect((await getHotelSettings(NOW)).marginBps).toBe(1000);
  });

  it("falls back to HOTEL_MARGIN_BPS until a margin is saved", async () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "1500");
    db.findGlobal.mockResolvedValue({ enabled: true });
    expect((await getHotelSettings(NOW)).marginBps).toBe(1500);
  });

  it("has no margin at all when neither exists, so callers can refuse", async () => {
    db.findGlobal.mockResolvedValue({ enabled: true });
    expect((await getHotelSettings(NOW)).marginBps).toBeNull();
  });

  it("treats a malformed env value as no margin, never as zero", async () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "15%");
    db.findGlobal.mockResolvedValue({ enabled: true });
    expect((await getHotelSettings(NOW)).marginBps).toBeNull();
  });

  it("reports hotels switched off", async () => {
    db.findGlobal.mockResolvedValue({ enabled: false, marginPercent: 15 });
    expect((await getHotelSettings(NOW)).enabled).toBe(false);
  });

  it("keeps serving on the env margin when the settings can't be read", async () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "1500");
    db.findGlobal.mockRejectedValue(new Error("db down"));
    expect(await getHotelSettings(NOW)).toEqual({ enabled: true, marginBps: 1500 });
  });

  it("remembers the answer for a minute, then reads again", async () => {
    db.findGlobal.mockResolvedValue({ enabled: true, marginPercent: 10 });
    await getHotelSettings(NOW);
    await getHotelSettings(NOW + 59_000);
    expect(db.findGlobal).toHaveBeenCalledTimes(1);

    db.findGlobal.mockResolvedValue({ enabled: true, marginPercent: 20 });
    expect((await getHotelSettings(NOW + 61_000)).marginBps).toBe(2000);
    expect(db.findGlobal).toHaveBeenCalledTimes(2);
  });
});

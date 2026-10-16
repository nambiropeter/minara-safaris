import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("payload", () => ({ getPayload: async () => db }));
vi.mock("@payload-config", () => ({ default: {} }));

import { recordHotelCall } from "./hotel-calls";

beforeEach(() => {
  db.create.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordHotelCall", () => {
  it("writes one row of the given kind", async () => {
    await recordHotelCall("availability");
    expect(db.create).toHaveBeenCalledWith({ collection: "hotel-calls", data: { kind: "availability" } });
  });

  it("never fails the caller when the row can't be written", async () => {
    db.create.mockRejectedValue(new Error("db down"));
    await expect(recordHotelCall("checkrate")).resolves.toBeUndefined();
  });
});

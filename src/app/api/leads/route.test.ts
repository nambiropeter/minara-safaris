import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => db) }));
vi.mock("@/lib/notify-lead", () => ({ notifyLead: vi.fn(async () => {}) }));

import { POST } from "./route";

const valid = { name: "Asha", email: "asha@example.com", elapsedMs: 8000 };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  db.create.mockResolvedValue({ id: 1 });
});

describe("POST /api/leads", () => {
  it("saves a normal submission", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(db.create).toHaveBeenCalledTimes(1);
  });

  it("silently drops a filled honeypot, and logs why", async () => {
    const res = await post({ ...valid, contactRef: "https://spam.example" });
    expect(await res.json()).toEqual({ ok: true });
    expect(db.create).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "lead dropped by spam check",
      expect.objectContaining({ reason: "honeypot" }),
    );
  });

  it("silently drops a submission made faster than a person can type, and logs why", async () => {
    const res = await post({ ...valid, elapsedMs: 500 });
    expect(await res.json()).toEqual({ ok: true });
    expect(db.create).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "lead dropped by spam check",
      expect.objectContaining({ reason: "too-fast", elapsedMs: 500 }),
    );
  });

  it("does not depend on the visitor's clock agreeing with the server's", async () => {
    // A phone whose clock is an hour ahead used to look like an instant bot.
    const res = await post({ ...valid, startedAt: Date.now() + 3_600_000 });
    expect(res.status).toBe(200);
    expect(db.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a submission with no timing at all", async () => {
    const res = await post({ name: "Asha", email: "asha@example.com" });
    expect(res.status).toBe(400);
  });
});

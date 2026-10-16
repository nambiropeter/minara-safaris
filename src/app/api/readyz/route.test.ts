import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ count: vi.fn(), config: { current: null as unknown } }));
vi.mock("payload", () => ({ getPayload: async () => ({ count: h.count }) }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/lib/hotelbeds", () => ({ getHotelbeds: () => h.config.current }));

import { GET as healthz } from "../healthz/route";
import { GET } from "./route";

let ip = 0;
const call = () => GET(new Request("http://localhost/api/readyz", { headers: { "x-forwarded-for": `10.9.0.${++ip}` } }));

beforeEach(() => {
  h.count.mockReset();
  h.count.mockResolvedValue({ totalDocs: 1 });
  h.config.current = { apiKey: "k" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/healthz", () => {
  it("is up without touching anything", async () => {
    const response = healthz();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(h.count).not.toHaveBeenCalled();
  });
});

describe("GET /api/readyz", () => {
  it("is ready when the database answers", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", checks: { database: "ok", hotelbeds: "configured" } });
  });

  it("fails when the database is down", async () => {
    h.count.mockRejectedValue(new Error("db down"));
    const response = await call();
    expect(response.status).toBe(503);
    expect((await response.json()).checks.database).toBe("failing");
  });

  it("stays ready, but says so, when Hotelbeds isn't configured: the site works without it", async () => {
    h.config.current = null;
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).checks.hotelbeds).toBe("not configured");
  });

  it("is never cached", async () => {
    expect((await call()).headers.get("cache-control")).toBe("no-store");
  });

  it("rate-limits a caller hammering it", async () => {
    const hammer = () =>
      GET(new Request("http://localhost/api/readyz", { headers: { "x-forwarded-for": "10.9.9.9" } }));
    let status = 200;
    for (let i = 0; i < 61; i++) status = (await hammer()).status;
    expect(status).toBe(429);
  });
});

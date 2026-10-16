import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("payload", () => ({ getPayload: async () => db }));
vi.mock("@payload-config", () => ({ default: {} }));

import { readCache, writeCache } from "./hotel-cache";

const NOW = Date.parse("2027-01-01T00:00:00Z");

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("readCache", () => {
  it("returns the stored value for a live entry, asking only for unexpired rows", async () => {
    db.find.mockResolvedValue({ docs: [{ body: { value: [1, 2] } }] });

    expect(await readCache<number[]>("k", NOW)).toEqual({ value: [1, 2] });

    const where = db.find.mock.calls[0][0].where;
    expect(where.and).toContainEqual({ key: { equals: "k" } });
    expect(where.and).toContainEqual({ expiresAt: { greater_than: new Date(NOW).toISOString() } });
  });

  it("returns undefined on a miss", async () => {
    db.find.mockResolvedValue({ docs: [] });
    expect(await readCache("k", NOW)).toBeUndefined();
  });

  it("keeps a cached 'no result' distinct from a miss", async () => {
    db.find.mockResolvedValue({ docs: [{ body: { value: null } }] });
    expect(await readCache("k", NOW)).toEqual({ value: null });
  });

  it("treats a database failure as a miss and never throws", async () => {
    db.find.mockRejectedValue(new Error("db down"));
    expect(await readCache("k", NOW)).toBeUndefined();
  });
});

describe("writeCache", () => {
  it("purges expired rows, then creates the entry with its expiry", async () => {
    db.find.mockResolvedValue({ docs: [] });

    await writeCache("k", { a: 1 }, 60_000, NOW);

    expect(db.delete.mock.calls[0][0].where).toEqual({ expiresAt: { less_than: new Date(NOW).toISOString() } });
    expect(db.create.mock.calls[0][0].data).toEqual({
      key: "k",
      body: { value: { a: 1 } },
      expiresAt: new Date(NOW + 60_000).toISOString(),
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates an existing key instead of creating a duplicate", async () => {
    db.find.mockResolvedValue({ docs: [{ id: 9 }] });

    await writeCache("k", "v", 1000, NOW);

    expect(db.update.mock.calls[0][0]).toMatchObject({ id: 9, data: { body: { value: "v" } } });
    expect(db.create).not.toHaveBeenCalled();
  });

  it("stores a null result", async () => {
    db.find.mockResolvedValue({ docs: [] });
    await writeCache("k", null, 1000, NOW);
    expect(db.create.mock.calls[0][0].data.body).toEqual({ value: null });
  });

  it("swallows a write failure", async () => {
    db.delete.mockRejectedValue(new Error("db down"));
    await expect(writeCache("k", 1, 1000, NOW)).resolves.toBeUndefined();
  });
});

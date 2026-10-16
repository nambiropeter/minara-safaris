import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCoverImages, getHotelContent, photoUrl } from "./hotel-content";

const config = { apiKey: "k", secret: "s", baseUrl: "https://api.test.hotelbeds.com" };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("getCoverImages", () => {
  it("asks for the unknown hotels in one call and picks Hotelbeds' first-ordered photo", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        hotels: [
          { code: 101, images: [{ path: "b.jpg", visualOrder: 2 }, { path: "a.jpg", visualOrder: 1 }] },
          { code: 102, images: [] },
        ],
      }),
    );

    const covers = await getCoverImages(config, [101, 102]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("codes=101,102");
    expect(covers.get(101)).toBe(photoUrl("a.jpg"));
    expect(covers.has(102)).toBe(false);
  });

  it("serves a known hotel from cache without calling again", async () => {
    fetchMock.mockImplementation(async () => Response.json({ hotels: [{ code: 201, images: [{ path: "x.jpg", visualOrder: 1 }] }] }));
    await getCoverImages(config, [201]);
    const again = await getCoverImages(config, [201]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.get(201)).toBe(photoUrl("x.jpg"));
  });

  it("never throws: a failed content call just means no thumbnails", async () => {
    fetchMock.mockImplementation(async () => new Response("down", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getCoverImages(config, [301])).size).toBe(0);
  });
});

describe("getHotelContent", () => {
  it("maps the details and orders the gallery", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        hotel: {
          code: 401,
          name: { content: "Hotel Z" },
          description: { content: "A place." },
          address: { content: "1 Road" },
          city: { content: "NAIROBI" },
          zone: { name: "Westlands" },
          category: { description: { content: "4 STARS" } },
          coordinates: { latitude: -1.3, longitude: 36.8 },
          images: [{ path: "two.jpg", visualOrder: 2 }, { path: "one.jpg", visualOrder: 1 }],
        },
      }),
    );

    const content = await getHotelContent(config, 401);

    expect(content).toMatchObject({ code: 401, name: "Hotel Z", city: "NAIROBI", zone: "Westlands", latitude: -1.3 });
    expect(content?.images).toEqual([photoUrl("one.jpg"), photoUrl("two.jpg")]);
  });

  it("is null for an unknown hotel, and remembers that", async () => {
    fetchMock.mockImplementation(async () => Response.json({}));
    expect(await getHotelContent(config, 402)).toBeNull();
    expect(await getHotelContent(config, 402)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

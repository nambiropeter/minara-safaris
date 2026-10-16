import { describe, expect, it, vi } from "vitest";

// content.ts opens Payload at import time only through `client()`, which these pure helpers never call.
vi.mock("payload", () => ({ getPayload: vi.fn() }));
vi.mock("@payload-config", () => ({ default: {} }));

import type { Destination, Package } from "@/payload-types";
import { hotelDestinationSlug } from "./content";

const dest = (hotelDestination: Destination["hotelDestination"]) => ({ id: 1, hotelDestination }) as Destination;
const pkg = (destinations: { destination: Destination | number; isPrimary?: boolean }[]) =>
  ({ destinations }) as unknown as Package;

describe("hotelDestinationSlug", () => {
  it("prefers the primary destination's hotel area", () => {
    expect(
      hotelDestinationSlug(
        pkg([
          { destination: dest("nairobi"), isPrimary: false },
          { destination: dest("maasai-mara"), isPrimary: true },
        ]),
      ),
    ).toBe("maasai-mara");
  });

  it("falls through to the first destination that has one", () => {
    expect(
      hotelDestinationSlug(
        pkg([
          { destination: dest(null), isPrimary: true },
          { destination: dest("diani") },
        ]),
      ),
    ).toBe("diani");
  });

  it("is null when nothing is mapped or destinations weren't populated", () => {
    expect(hotelDestinationSlug(pkg([{ destination: dest(undefined), isPrimary: true }]))).toBeNull();
    expect(hotelDestinationSlug(pkg([{ destination: 7 }]))).toBeNull();
    expect(hotelDestinationSlug(pkg([]))).toBeNull();
  });
});

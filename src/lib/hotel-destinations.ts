/**
 * Where /hotels will search. Codes are Hotelbeds destination codes, read from its
 * Content API (`/locations/destinations`) and checked against the test host;
 * `zone` narrows a destination (Diani is zone 9 of Mombasa). Kenya and Tanzania
 * only, per the spec. Plain data: add a line to add a place.
 */
export type HotelDestination = { slug: string; label: string; code: string; zone?: number };

export const HOTEL_DESTINATIONS: readonly HotelDestination[] = [
  { slug: "nairobi", label: "Nairobi", code: "NAI" },
  { slug: "maasai-mara", label: "Maasai Mara", code: "MAS" },
  { slug: "mombasa", label: "Mombasa", code: "MBA" },
  { slug: "diani", label: "Diani Beach", code: "MBA", zone: 9 },
  { slug: "nakuru", label: "Nakuru", code: "LEK" },
  { slug: "naivasha", label: "Lake Naivasha", code: "LAV" },
  { slug: "amboseli", label: "Amboseli", code: "ASV" },
  { slug: "tsavo", label: "Tsavo", code: "TNP" },
  { slug: "lamu", label: "Lamu", code: "LMU" },
  { slug: "malindi", label: "Malindi", code: "MYD" },
  { slug: "zanzibar", label: "Zanzibar", code: "ZNZ" },
  { slug: "arusha", label: "Arusha", code: "ARK" },
  { slug: "serengeti", label: "Serengeti", code: "SNP" },
  { slug: "ngorongoro", label: "Ngorongoro", code: "NGR" },
  { slug: "dar-es-salaam", label: "Dar es Salaam", code: "DAE" },
] as const;

export const findHotelDestination = (slug: string | null | undefined) =>
  HOTEL_DESTINATIONS.find((d) => d.slug === slug);

/** Back from a search's code/zone to the label, for page headings. */
export const labelFor = (code: string, zone?: number) =>
  (HOTEL_DESTINATIONS.find((d) => d.code === code && d.zone === zone) ?? HOTEL_DESTINATIONS.find((d) => d.code === code))?.label ?? code;

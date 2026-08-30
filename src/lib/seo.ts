/** One-line canonical tag, resolved against `metadataBase` (root layout) since every page otherwise lacks one. */
export function canonical(path: string) {
  return { alternates: { canonical: path } };
}

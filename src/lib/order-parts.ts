/**
 * Imported by the admin refund endpoint, so: no imports at all.
 *
 * An order with both a package and a hotel is a bundle. The hotel is booked with the
 * supplier automatically; the package still waits for staff. So a bundle is never marked
 * `confirmed` by the hotel booking, and a refused hotel refunds only its own subtotal.
 */
export function orderParts(order: { items: { kind: string; subtotal: number }[] }): { bundle: boolean; hotelSubtotal: number } {
  return {
    bundle: order.items.some((i) => i.kind === "package") && order.items.some((i) => i.kind === "hotel"),
    hotelSubtotal: order.items.filter((i) => i.kind === "hotel").reduce((sum, i) => sum + i.subtotal, 0),
  };
}

# Phase 2 — Direct Payments & Client Accounts

Draft scope and price. Not a final quote — detailed scoping happens after Phase 1 ships and the client confirms which pieces below he actually wants, per `docs/Travel_Agency_Roadmap_Quote_with_Projections.pdf`'s own "finalized upon successful completion and review of Phase 1" note. Phase 1 (100,000 KES, 50k/dev) is unaffected by anything here.

## Scope

| Deliverable | Notes |
|---|---|
| Payment gateway integration | One aggregator (Flutterwave or Paystack) covering card (Visa/Mastercard) **and** M-Pesa STK push through a single API/hosted checkout — no direct Safaricom Daraja certification, no raw card handling (keeps us out of PCI scope) |
| Order/booking model | New Payload collection — doesn't exist today, packages currently have no checkout state at all |
| Webhook handling | Signature verification + idempotency so a payment can't double-charge or silently fail to confirm a booking — the one piece of this phase not worth being lazy about |
| Invoicing/receipts | PDF generation on payment confirmation |
| Traveller accounts + dashboard | Login/session + "my bookings" view — net-new auth, doesn't exist on the public side today |
| Live chat | Third-party embed (Crisp/Tawk.to), not custom-built |

## Price

**120,000–180,000 KES.** The traveller-accounts/dashboard piece is the single biggest driver — if the client wants to cut cost, that's the line to defer first (a confirmation email/WhatsApp receipt covers the same need without a login system).

## Explicitly not in this phase

- M-Pesa via direct Safaricom Daraja integration — the aggregator already covers M-Pesa, so this isn't needed
- Multi-currency
- Refund/dispute tooling beyond what the aggregator's dashboard already provides

---

# Phase 3 — Flight Booking & Global Travel Integrations (reference only, not scoped)

Full GDS accreditation (Amadeus/Sabre enterprise) is out — requires an IATA-recognized agency agreement and a certification cycle beyond two devs. **Duffel or Amadeus Self-Service API** is the realistic path (merchant agreement, no full GDS contract).

Even simplified, this covers: flight search, fare rules, seat/baggage selection, order creation, ticketing webhooks, refund/cancellation handling, dynamic packaging (bundling flight + hotel + tour across suppliers with different fulfillment/refund timelines), and agent sub-accounts with commission tracking.

**Estimated 350,000–600,000 KES**, wide range because dynamic packaging and agent accounts could each be split into their own phase. Not to be quoted to the client as a fixed number until he confirms which of those pieces he actually wants.

---

**Mobile app — dropped from the roadmap, not deferred.** A native app for a purchase most travellers make once or twice a year doesn't earn a place on someone's home screen; nobody re-installs an app for a once-a-year booking. Responsive web (already the entire premise of this build) covers the same need without the install friction, app-store review cycles, or a second codebase to maintain. See `docs/PRD.md` §9.

import { NextResponse } from "next/server";

import { findOrderByToken } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await findOrderByToken(token);

  // 404 rather than 403 to prevent leaking whether the token or order exists.
  if (!order || order.status !== "paid" || !order.stripe?.checkoutSessionId) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return new NextResponse("Service Unavailable", { status: 503 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(
      order.stripe.checkoutSessionId,
      { expand: ["invoice"] },
    );

    const invoice = typeof session.invoice === "object" ? session.invoice : null;
    const pdfUrl = invoice?.invoice_pdf;

    if (!pdfUrl) {
      return new NextResponse("Invoice not found", { status: 404 });
    }

    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok || !pdfRes.body) {
      return new NextResponse("Failed to retrieve invoice file", { status: 502 });
    }

    return new Response(pdfRes.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to retrieve invoice", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

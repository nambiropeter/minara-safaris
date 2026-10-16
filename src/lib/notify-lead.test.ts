import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn<(mail: Record<string, unknown>) => Promise<unknown>>());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { notifyLead } from "@/lib/notify-lead";

const lead = {
  id: 12,
  name: "Asha Wanjiru",
  email: "asha@example.com",
  phone: "+254700000000",
  package: { id: 3, title: "Masai Mara 4 Days" },
  travelDates: "mid-October, 7 days",
  travellers: 3,
  message: "We would like a quiet lodge.\nTwo of us are vegetarian.",
  source: "/contact",
  status: "new",
};

/** The real `Lead` type is generated; these tests only care about the fields the email reads. */
const asLead = (l: object) => l as never;

function sent() {
  return send.mock.calls[0][0] as unknown as { subject: string; text: string; html: string; replyTo: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({});
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "Minara <enquiries@send.example.com>";
  process.env.LEADS_NOTIFICATION_EMAIL = "team@example.com";
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("notifyLead", () => {
  it("does nothing until all three settings exist", async () => {
    delete process.env.LEADS_NOTIFICATION_EMAIL;
    await notifyLead(asLead(lead));
    expect(send).not.toHaveBeenCalled();
  });

  it("sends an HTML email with a plain-text twin, replying to the customer", async () => {
    await notifyLead(asLead(lead));
    const mail = sent();
    expect(mail.replyTo).toBe("asha@example.com");
    expect(mail.subject).toBe("New enquiry: Asha Wanjiru");
    expect(mail.html).toContain("<table");
    expect(mail.text).toContain("Asha Wanjiru");
  });

  it("names the package, dates, travellers and phone, and keeps the message's line breaks", async () => {
    await notifyLead(asLead(lead));
    const { html, text } = sent();
    for (const part of ["Masai Mara 4 Days", "mid-October, 7 days", "+254700000000", ">3<"]) {
      expect(html).toContain(part);
    }
    expect(html).toContain("white-space:pre-wrap");
    expect(text).toContain("We would like a quiet lodge.\nTwo of us are vegetarian.");
  });

  it("leaves out the page the form was on, since there is only one contact form", async () => {
    await notifyLead(asLead(lead));
    expect(sent().html).not.toContain("/contact");
    expect(sent().text).not.toContain("/contact");
  });

  it("omits rows the customer left blank", async () => {
    await notifyLead(asLead({ ...lead, phone: null, package: null, travelDates: null, travellers: null, message: null }));
    const { html } = sent();
    for (const label of ["Phone", "Package", "Preferred dates", "Travellers", "Message"]) {
      expect(html).not.toContain(label);
    }
  });

  it("escapes anything the visitor typed, so it cannot inject markup into staff's inbox", async () => {
    await notifyLead(asLead({ ...lead, name: "<b>Bob</b>", message: '<img src=x onerror="alert(1)">' }));
    const { html } = sent();
    expect(html).not.toContain("<b>Bob</b>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;b&gt;Bob&lt;/b&gt;");
  });

  it("links to the lead in the admin when the site URL is known", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://minara.example/";
    await notifyLead(asLead(lead));
    expect(sent().html).toContain("https://minara.example/admin/collections/leads/12");
    expect(sent().text).toContain("https://minara.example/admin/collections/leads/12");
  });

  it("omits the admin link when the site URL is not set", async () => {
    await notifyLead(asLead(lead));
    expect(sent().html).not.toContain("/admin/collections");
  });
});

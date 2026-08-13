import type { Metadata } from "next";

import { EnquiryForm } from "@/components/enquiry-form";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { getPublicPageBySlug, getPublishedPackages } from "@/lib/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contact",
  description: "Send an enquiry and a Minara Safaris consultant will get back to you.",
};

export default async function ContactPage() {
  const [page, packages] = await Promise.all([
    getPublicPageBySlug("contact"),
    getPublishedPackages(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-display">Contact</h1>
        {page?.body ? (
          <div className="measure mt-4 text-lead text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5">
            <RichText data={page.body} />
          </div>
        ) : (
          <p className="measure mt-4 text-lead text-muted-foreground">
            Tell us what you&apos;re planning and a consultant will reply by email. For
            anything urgent, WhatsApp reaches us faster.
          </p>
        )}
        <div className="mt-6">
          <WhatsAppCta />
        </div>
      </div>

      <div className="mt-12 max-w-3xl border-t border-border pt-12">
        <EnquiryForm packages={packages.map((pkg) => ({ id: pkg.id, title: pkg.title }))} />
      </div>
    </main>
  );
}

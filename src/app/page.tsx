import { CalendarBlank, MapPin, Users, WhatsappLogo } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Brand foundations preview. This is the surface used to verify tokens, the type
 * scale and both themes before Phase 3 builds the real home page over it.
 */

const swatches = [
  { name: "primary", token: "bg-primary text-primary-foreground", use: "Buttons, links, focus ring" },
  { name: "gold", token: "bg-gold text-gold-foreground", use: "Offer and deal badges only" },
  { name: "whatsapp", token: "bg-whatsapp text-whatsapp-foreground", use: "The WhatsApp CTA only" },
  { name: "card", token: "bg-card text-card-foreground border border-border", use: "Package cards, panels" },
  { name: "muted", token: "bg-muted text-muted-foreground", use: "Secondary text, quiet fills" },
  { name: "destructive", token: "bg-destructive text-background", use: "Form errors" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <header className="flex items-start justify-between gap-6">
        <p className="font-heading text-heading">Minara Safaris</p>
        <ThemeToggle />
      </header>

      <section className="mt-16 sm:mt-24">
        <h1 className="text-display">
          Seven days in the Mara, planned by someone who has stood in it.
        </h1>
        <p className="measure mt-6 text-lead text-muted-foreground">
          Every package here ends with a conversation, not a checkout. Tell us
          your dates and who is travelling, and a consultant comes back with real
          availability and a real price.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="whatsapp" size="cta">
            <WhatsappLogo weight="fill" />
            Chat on WhatsApp
          </Button>
          <Button variant="outline" size="cta">
            Browse packages
          </Button>
        </div>
      </section>

      <section className="mt-20 border-t border-border pt-10">
        <h2 className="text-title">Type scale</h2>
        <dl className="mt-8 space-y-8">
          {[
            ["text-display", "Newsreader · hero headline"],
            ["text-title", "Newsreader · section heading"],
            ["text-heading", "Newsreader · package title"],
            ["text-lead", "Figtree · intro paragraph"],
            ["text-base", "Figtree · body"],
            ["text-label", "Figtree · form labels, metadata"],
          ].map(([cls, role]) => (
            <div key={cls}>
              <dt className="text-label text-muted-foreground">
                {cls} — {role}
              </dt>
              <dd className={`${cls} mt-1 ${cls === "text-base" || cls === "text-lead" || cls === "text-label" ? "measure" : "font-heading"}`}>
                Amboseli, Tsavo and the Great Rift Valley
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-20 border-t border-border pt-10">
        <h2 className="text-title">Palette</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {swatches.map((s) => (
            <li key={s.name} className={`${s.token} rounded-xl px-5 py-4`}>
              <p className="font-medium">{s.name}</p>
              <p className="text-label opacity-80">{s.use}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20 border-t border-border pt-10">
        <h2 className="text-title">Icons</h2>
        <p className="measure mt-4 text-muted-foreground">
          Phosphor, at the sizes this site actually uses them: inline with text
          and in card metadata rows.
        </p>
        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-muted-foreground">
          {[
            [MapPin, "Maasai Mara"],
            [CalendarBlank, "5 days, 4 nights"],
            [Users, "2–6 travellers"],
          ].map(([Icon, label]) => (
            <li key={label as string} className="flex items-center gap-2">
              <Icon className="size-4" />
              <span className="text-sm">{label as string}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

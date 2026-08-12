import type { Metadata } from "next";
import { Figtree, Newsreader } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Two families, both variable, both latin-only — the whole type budget is one
// serif and one sans. Newsreader does double duty: hero display and blog body.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const DIRECTION_CONTRACT = `<!--
THESIS: The category convention at a craft level the category never reaches. It refuses the
price-as-bait hook: every figure ships with its conditions and the resident rate beside it.
OWN-WORLD: Warm paper ground, burnt sienna primary, gold reserved for offer badges, green only
for WhatsApp. Newsreader display over Figtree UI. Photography leads — overlapping rotated frames
in the hero, tall crops in cards and tiles.
STORY: A real Kenyan operator, real trips, honest prices, and a person who answers. The visitor
browses first and messages from a package page, never cold.
FIRST VIEWPORT: Headline and two CTAs — browse primary, WhatsApp second — on the left five
columns. On the right, five photographs scattered as an overlapping stack, each rotated a few
degrees and captioned with a place-name pill, the portrait Mara frame centred on top; hovering one
lifts it upright and above the pile. On phones the stack drops beneath the headline.
FORM: Category canon, chosen deliberately over the dealt direction. Seed 0fdedae7, canon.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, and DESIGN.md
-->`;

export const metadata: Metadata = {
  title: {
    default: "Minara Safaris — Kenyan safaris and East African tours",
    template: "%s · Minara Safaris",
  },
  description:
    "Safari and tour packages across Kenya and East Africa, planned with you by a real consultant. Talk to us on WhatsApp for dates, prices and availability.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          The direction contract has to survive into the emitted markup — a JSX
          comment is stripped by the compiler and audits nothing, so it ships as
          a real HTML comment.
        */}
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

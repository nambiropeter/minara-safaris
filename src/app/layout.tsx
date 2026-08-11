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

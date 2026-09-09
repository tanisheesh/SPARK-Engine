import type { Metadata } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "../components/ErrorBoundary";

/* Human interface. Instrument Sans reads as editorial rather than
   geometric-startup, and holds up at 13px for hours. */
const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* Machine interface. Everything the database says — SQL, identifiers,
   timings, row counts — wears this, never the sans. */
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SPARK",
  description:
    "Talk to your data. Ask questions in plain English, get answers, charts and the SQL behind them.",
  keywords: ["Data Analytics", "SQL", "DuckDB", "Natural Language", "Voice"],
  authors: [{ name: "Tanish Poddar", url: "https://github.com/tanishpoddar" }],
  creator: "Tanish Poddar",
  openGraph: {
    title: "SPARK",
    description: "Talk to your data.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPARK",
    description: "Talk to your data.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}

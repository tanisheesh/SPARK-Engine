import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "../components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPARK ENGINE - Voice Data Analytics",
  description: "A futuristic voice-enabled data analytics application. Ask questions in natural language and get intelligent responses with voice output. Works with any CSV file.",
  keywords: ["AI", "Data Analytics", "Voice Assistant", "DuckDB", "Groq", "Deepgram", "Natural Language", "CSV Analysis"],
  authors: [{ name: "Tanish Poddar", url: "https://github.com/tanishpoddar" }],
  creator: "Tanish Poddar",
  openGraph: {
    title: "SPARK ENGINE - Voice Data Analytics",
    description: "Ask questions about your data in natural language and get voice responses",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPARK ENGINE - Voice Data Analytics",
    description: "Ask questions about your data in natural language and get voice responses",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

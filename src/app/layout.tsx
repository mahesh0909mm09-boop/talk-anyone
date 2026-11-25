import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://talk-anyone.vercel.app"),

  title: "TALK ANYONE | Random Video & Text Chat",

  description:
    "Meet new people on TALK ANYONE. Connect through random video and text chat, start conversations, and discover new connections online.",

  applicationName: "TALK ANYONE",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    title: "TALK ANYONE | Random Video & Text Chat",
    description:
      "Meet new people through random video and text conversations on TALK ANYONE.",
    url: "https://talk-anyone.vercel.app/",
    siteName: "TALK ANYONE",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "TALK ANYONE | Random Video & Text Chat",
    description:
      "Meet new people through random video and text chat.",
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}

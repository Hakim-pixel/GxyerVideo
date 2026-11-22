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
  title: "GxyerVideo - Online Video Player Free & Anti Iklan",
  description: "GxyerVideo - Putar video dari link web penuh iklan secara langsung, cepat, dan 100% bebas gangguan popup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0c] text-zinc-100 flex flex-col selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const sans = localFont({
  src: [
    { path: "../../public/fonts/instrument-sans-400.ttf", weight: "400" },
    { path: "../../public/fonts/instrument-sans-500.ttf", weight: "500" },
    { path: "../../public/fonts/instrument-sans-600.ttf", weight: "600" },
    { path: "../../public/fonts/instrument-sans-700.ttf", weight: "700" },
  ],
  variable: "--font-studio",
  display: "swap",
});
const mono = localFont({
  src: "../../public/fonts/dm-mono-400.ttf",
  variable: "--font-utility",
  display: "swap",
});
export const metadata: Metadata = {
  title: "FrameLedger — Your creative business, in balance",
  description:
    "Project wallets, clear cash flow, and money that knows its purpose. A financial workspace for independent creatives.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope } from "next/font/google";
import { Providers } from "@/providers";
import "uplot/dist/uPlot.min.css";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DSFAV",
  description: "Aide à la décision pour le suivi de la fistule artério-veineuse",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/favicon.ico" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`h-full antialiased ${manrope.variable}`}>
      <body className="min-h-full flex flex-col font-sans bg-canvas text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

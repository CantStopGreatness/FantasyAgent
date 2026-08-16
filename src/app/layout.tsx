import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "CourtIQ: Fantasy League Intelligence",
  description:
    "Sleeper NBA league analysis with deterministic scoring, availability filtering, and optional Ollama Cloud explanations.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${archivoBlack.variable} antialiased`}>
        {/*
          THESIS: A fantasy tool that reads as equipment from the sport itself,
          a printed stat sheet on a sideline, refusing the dark analytics
          dashboard every competitor in this category ships.
          OWN-WORLD: Turf green ground with fixed yard lines; every panel bone
          stock hard-ruled 3px in ink; scoreboard strips of ink with chalk
          lettering; Archivo Black display over Archivo data. Flat colour only,
          no gradients, glass, or soft elevation. Flag orange acts, gold marks
          the top call.
          STORY: A manager sees their own league's rules on screen, reads a
          ranked sheet they trust because the number that produced it is right
          there, and acts on one call.
          FIRST VIEWPORT: Full-bleed turf. Oversized COURTIQ lockup left, the
          thesis line under it, flag-orange import action beneath; a live stat
          sheet card sits right showing a real ranked row and its cross-format
          delta, so the mechanism is visible before any scrolling.
          FORM: Retro sports-sim, the Retro Bowl lane, user-pinned; a pinned
          brief beats the concept roll.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}

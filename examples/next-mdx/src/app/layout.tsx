import type { Metadata } from "next";
import "@sphynxoid/stepwise/styles.css";
import "./globals.css";
import { GlossaryProvider } from "@sphynxoid/stepwise";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "How binary search finds a number",
  description:
    "An interactive article: a stepwise, editable binary-search simulation, predict-mode checkpoints, and a glossary — built with @sphynxoid/stepwise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlossaryProvider entries={GLOSSARY}>{children}</GlossaryProvider>
      </body>
    </html>
  );
}

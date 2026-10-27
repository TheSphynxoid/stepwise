import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "stepwise — interactive step visualizations",
  description: "A kit for interactive, narrated, step-driven visualizations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

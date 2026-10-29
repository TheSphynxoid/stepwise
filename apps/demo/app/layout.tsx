import type { Metadata } from "next";
import { SiteThemeProvider } from "./theme-provider";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import "./globals.css";

// TODO: point at the real deployment origin when the demo is on Vercel.
const SITE_URL = "https://stepwise-demo.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "stepwise — interactive step visualizations",
    template: "%s — stepwise",
  },
  description:
    "A kit for interactive, narrated, step-driven visualizations. One primitive (useSteps) at every scale.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "stepwise",
    title: "stepwise — interactive step visualizations",
    description:
      "A kit for interactive, narrated, step-driven visualizations. One primitive (useSteps) at every scale.",
  },
  twitter: {
    card: "summary",
    title: "stepwise — interactive step visualizations",
    description:
      "A kit for interactive, narrated, step-driven visualizations. One primitive (useSteps) at every scale.",
  },
};

// Runs before first paint: resolves the persisted (or OS-preferred) theme so
// the site never flashes the wrong palette. React reconciles after mount.
const PRE_PAINT_THEME = `(function(){try{var t=localStorage.getItem("stepwise.demo.theme")||(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_THEME }} />
        <SiteThemeProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </SiteThemeProvider>
      </body>
    </html>
  );
}

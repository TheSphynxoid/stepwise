"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import type { StepwiseTheme } from "@sphynxoid/stepwise";
import {
  SITE_THEME_STORAGE_KEY,
  darkStepwiseTheme,
  lightStepwiseTheme,
} from "./site-themes";

// The demo's own theming layer — and the library's theming story, live:
// the header toggle flips the site palette (CSS variables in globals.css)
// and the StepwiseTheme tokens (site-themes.ts) together. The theme objects
// live in a directive-free module so server components can use them too.

export type SiteThemeMode = "light" | "dark";

interface SiteThemeContextValue {
  mode: SiteThemeMode;
  /** False until the client reconciles the pre-paint script's choice. */
  mounted: boolean;
  toggle: () => void;
  /** The StepwiseTheme matching the active mode — pass to library components. */
  theme: StepwiseTheme;
}

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);

function applyMode(mode: SiteThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, mode);
  } catch {
    // private mode — the toggle still works for this page view
  }
}

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  // The pre-paint script in layout.tsx has already set data-theme; the mode
  // is read back after mount so React state matches the DOM (no flash, no
  // hydration mismatch — <html> is suppressHydrationWarning).
  const [mode, setMode] = useState<SiteThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setMode(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const nextMode = prev === "dark" ? "light" : "dark";
      applyMode(nextMode);
      return nextMode;
    });
  }, []);

  const value = useMemo<SiteThemeContextValue>(
    () => ({ mode, mounted, toggle, theme: mode === "light" ? lightStepwiseTheme : darkStepwiseTheme }),
    [mode, mounted, toggle]
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme(): SiteThemeContextValue {
  const ctx = useContext(SiteThemeContext);
  if (!ctx) throw new Error("useSiteTheme must be used inside <SiteThemeProvider>");
  return ctx;
}

export function ThemeToggle() {
  const { mode, mounted, toggle } = useSiteTheme();
  const isLight = mounted && mode === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="grid h-9 w-9 place-items-center rounded-md border border-border text-foreground/70 transition-all duration-300 hover:border-primary/40 hover:text-foreground hover:rotate-12 cursor-pointer"
    >
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}

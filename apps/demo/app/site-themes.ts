import { defaultTheme, type StepwiseTheme } from "@sphynxoid/stepwise";

// The demo's two StepwiseTheme objects — pure data, NO "use client" here, so
// both client components (theme-provider) and server components (landing)
// can import them. Every component color is either a CSS variable (flips
// with the site palette in globals.css) or one of these injectable tokens.

export const SITE_THEME_STORAGE_KEY = "stepwise.demo.theme";

/**
 * Dark mode rides on the library default (it was designed against a dark
 * host), with the panel tokens pointed at the site's CSS variables so nav
 * bars, cards and dialogs match the demo chrome exactly.
 */
export const darkStepwiseTheme: StepwiseTheme = {
  ...defaultTheme,
  surface: "border border-border/80 bg-card/85 backdrop-blur-md",
  overlay: "bg-[#05070d]/70 backdrop-blur-sm",
  codeBlock:
    "rounded-md border border-border/70 bg-[#060a14]/80 px-3 py-2.5 font-mono text-[11.5px] leading-5 overflow-x-auto",
  codeMuted: "text-foreground/35",
  kbd: "font-mono text-[10px] px-1.5 py-0.5 border border-border bg-secondary rounded text-secondary-foreground/80",
  spotlight: "rounded-md ring-2 ring-primary/80 transition-all duration-300",
  muted: "text-foreground/40",
};

/**
 * Light mode: a full StepwiseTheme override — the proof that no color is
 * baked in. Values chosen against the [data-theme="light"] palette.
 */
export const lightStepwiseTheme: StepwiseTheme = {
  toneSegment: {
    neutral: "bg-slate-300",
    accent: "bg-emerald-500/70",
    good: "bg-blue-600",
    bad: "bg-red-500/70",
    write: "bg-slate-500/50",
    idle: "bg-slate-200",
  },
  toneChip: {
    neutral: "text-slate-500 border-slate-300",
    accent: "text-emerald-700 border-emerald-300",
    good: "text-blue-700 border-blue-300",
    bad: "text-red-600 border-red-300",
    write: "text-slate-600 border-slate-400",
    idle: "text-slate-400 border-slate-200",
  },
  buttonBase: defaultTheme.buttonBase,
  buttonVariants: {
    ghost: "border border-transparent text-slate-600 hover:bg-slate-950/5 hover:text-slate-900",
    outline:
      "border border-blue-600/40 bg-white/70 text-slate-800 hover:border-blue-600/70 hover:text-blue-700",
    primary: "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
  },
  surface: "border border-slate-200 bg-white/90 backdrop-blur-md",
  overlay: "bg-slate-950/40 backdrop-blur-sm",
  codeBlock:
    "rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[11.5px] leading-5 overflow-x-auto",
  codeMuted: "text-slate-400",
  kbd: "font-mono text-[10px] px-1.5 py-0.5 border border-slate-300 bg-slate-50 rounded text-slate-700",
  spotlight: "rounded-md ring-2 ring-blue-600/70 transition-all duration-300",
  muted: "text-slate-400",
};

/**
 * Fixed-dark code panel for the landing sample — literal colors, so it
 * renders identically in both site modes. The library's var-based line
 * colors are fed by the scoped `--foreground` override in page.tsx: the
 * panel carries its own light-on-dark foreground wherever the site goes.
 */
export const darkCodePanelTheme: StepwiseTheme = {
  ...darkStepwiseTheme,
  codeBlock:
    "rounded-lg border border-slate-700/60 bg-[#0b1020] px-4 py-3.5 font-mono text-[12px] leading-6 overflow-x-auto",
  codeMuted: "text-slate-500",
};

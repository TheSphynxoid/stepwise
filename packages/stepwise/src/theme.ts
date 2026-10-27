import type { StepTone } from "./types";

// Optional styled layer. The hooks are headless; these Tailwind classes are
// the DEFAULTS the styled components ship with, overridable per component
// via the `theme` prop — swap in any design system without touching the kit.

export interface StepwiseTheme {
  /** Timeline-segment styling per tone. */
  toneSegment: Record<StepTone, string>;
  /** Step-kind chip styling per tone. */
  toneChip: Record<StepTone, string>;
  /** Shared structural classes for internal buttons. */
  buttonBase: string;
  /** Per-variant appearance for internal buttons. */
  buttonVariants: Record<"ghost" | "outline" | "primary", string>;
}

export const defaultTheme: StepwiseTheme = {
  toneSegment: {
    neutral: "bg-white/10",
    accent: "bg-accent/70",
    good: "bg-primary",
    bad: "bg-destructive/70",
    write: "bg-foreground/30",
    idle: "bg-white/5",
  },
  toneChip: {
    neutral: "text-foreground/50 border-white/10",
    accent: "text-accent border-accent/40",
    good: "text-primary border-primary/40",
    bad: "text-destructive border-destructive/40",
    write: "text-foreground/70 border-white/20",
    idle: "text-foreground/30 border-white/10",
  },
  buttonBase:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-mono transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  buttonVariants: {
    ghost: "border border-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground",
    outline: "border border-primary/40 bg-background/40 text-foreground/85 hover:border-primary/70 hover:text-foreground",
    primary: "border border-primary bg-primary/90 text-primary-foreground hover:bg-primary",
  },
};

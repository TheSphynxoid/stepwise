import type { ReactNode } from "react";

// Hook-free layout pieces for the /qa lesson, usable from the server page.
// The look borrows from a test runner's output: section marks, a question
// the interviewer asks, and a "30-second answer" that reads like a passing
// test. Colours are the site's tokens, so light and dark both work.

export function Chapter({
  id,
  n,
  slug,
  title,
  ask,
  children,
}: {
  id: string;
  n: number;
  slug: string;
  title: string;
  /** The interview question this chapter prepares you for. */
  ask: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-24 scroll-mt-32">
      <div className="mb-3 flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">§{String(n).padStart(2, "0")}</span>
        <span>{slug}</span>
        <span aria-hidden className="h-px flex-1 translate-y-[-3px] bg-border" />
      </div>
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <Ask>{ask}</Ask>
      {children}
    </section>
  );
}

/** The interviewer's question, as it would be asked. */
export function Ask({ children }: { children: ReactNode }) {
  return (
    <figure className="mb-6 max-w-2xl border-l-2 border-primary/70 pl-4">
      <figcaption className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">Interviewer</figcaption>
      <blockquote className="text-[15px] font-medium leading-snug text-foreground/90">{children}</blockquote>
    </figure>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="mb-6 max-w-2xl space-y-3 text-[14px] leading-relaxed text-foreground/75">{children}</div>;
}

/** What to say back, compressed. Styled as a passing test, because it is one. */
export function Answer({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 max-w-2xl overflow-hidden rounded-lg border border-accent/30 bg-accent/[0.06]">
      <div className="flex items-center gap-2 border-b border-accent/20 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent">
        <span aria-hidden>✓</span> Your answer, in 30 seconds
      </div>
      <div className="space-y-2 px-4 py-3 text-[13.5px] leading-relaxed text-foreground/85">{children}</div>
    </div>
  );
}

/** Suggestions under a player: what to change, and what to watch for. */
export function TryThis({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 max-w-2xl rounded-lg border border-dashed border-border px-4 py-3 text-[13px] leading-relaxed text-foreground/70">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-primary">Try</span>
      {children}
    </div>
  );
}

/** A follow-up the interviewer is likely to ask, with the short answer. */
export function FollowUp({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group mt-3 max-w-2xl rounded-lg border border-border bg-card/50 px-4 py-2.5 text-[13px]">
      <summary className="cursor-pointer list-none font-medium text-foreground/85 marker:hidden">
        <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground group-open:text-primary">Follow-up</span>
        {q}
      </summary>
      <div className="mt-2 leading-relaxed text-foreground/75">{children}</div>
    </details>
  );
}

export const C = ({ children }: { children: ReactNode }) => <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[12px] text-primary">{children}</code>;

import Link from "next/link";

// TODO: point at the real repository when it goes public.
const REPO_URL = "https://github.com/TheSphynxoid/stepwise";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-card/30 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="relative grid h-7 w-7 place-items-center">
                <span className="absolute inset-0 rounded-lg bg-primary/15 blur-md" />
                <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden="true" className="relative">
                  <rect width="64" height="64" rx="14" className="fill-secondary" />
                  <path
                    d="M12 46 L24 46 L24 34 L36 34 L36 22 L48 22"
                    fill="none"
                    className="stroke-primary"
                    strokeWidth="6"
                    strokeLinecap="square"
                  />
                  <rect x="44" y="18" width="8" height="8" className="fill-accent" />
                </svg>
              </span>
              <span className="text-sm font-semibold tracking-tight">stepwise</span>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              A kit for interactive, narrated, step-driven visualizations. Every
              demo on this site is built with the published components.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[12px] text-foreground/70 transition hover:border-primary/40 hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4 1 .0 2 .1 2.9.4 2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Demos
            </p>
            <ul className="space-y-2 text-[13px] text-foreground/70">
              {[
                ["/eviction", "Player"],
                ["/tour", "Guided tour"],
                ["/discovery", "Led discovery"],
                ["/scroll", "Scroll chapters"],
                ["/glossary", "Glossary"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Library
            </p>
            <ul className="space-y-2 text-[13px] text-foreground/70">
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition hover:text-primary">
                  GitHub
                </a>
              </li>
              <li><span className="font-mono text-[12px]">@sphynx/stepwise</span></li>
              <li><span className="font-mono text-[12px]">MIT License</span></li>
              <li>
                <Link href="/minimal" className="transition hover:text-primary">
                  Minimal / light theme
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
          <p className="text-[11px] font-mono text-muted-foreground">
            (c) 2026 stepwise - MIT License
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            React 18 & 19 - Tailwind v4
          </p>
        </div>
      </div>
    </footer>
  );
}
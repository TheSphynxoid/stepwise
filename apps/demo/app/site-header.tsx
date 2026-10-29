"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import { ThemeToggle } from "./theme-provider";

// TODO: point at the real repository when it goes public.
const REPO_URL = "https://github.com/TheSphynxoid/stepwise";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative grid h-8 w-8 place-items-center">
            <span className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-0 transition-opacity group-hover:opacity-100" />
            <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" className="relative">
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
          <span className="text-[15px] font-semibold tracking-tight">stepwise</span>
          <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
            v0.1
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1 text-[13px] text-foreground/60 ml-2">
          {[
            { href: "/#code", label: "Code" },
            { href: "/#demos", label: "Demos" },
            { href: "/#theming", label: "Theming" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative px-3 py-1.5 rounded-md transition-colors hover:text-foreground hover:bg-secondary/50"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-foreground/70 transition hover:border-primary/40 hover:text-foreground sw-ring-hover"
          >
            <Github size={15} />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
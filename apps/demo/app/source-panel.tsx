"use client";

import { useState } from "react";
import { Code2, ExternalLink, Github } from "lucide-react";
import { CodeBlock } from "@sphynxoid/stepwise";
import { useSiteTheme } from "./theme-provider";

/** Collapsible source viewer rendered with the library's own CodeBlock. */
export function SourcePanel({
  file,
  lines,
  githubUrl,
  stackblitzUrl,
}: {
  file: string;
  lines: string[];
  githubUrl: string;
  stackblitzUrl: string;
}) {
  const { theme } = useSiteTheme();
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Page source" className="border-t border-border/60 bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-4 text-[12px] font-medium text-foreground/80 transition hover:border-primary/40 hover:text-foreground cursor-pointer"
          >
            <Code2 size={14} />
            {open ? "Hide source" : "View source"}
          </button>
          <code className="font-mono text-[11px] text-muted-foreground">
            {file} - {lines.length} lines
          </code>
          <span className="ml-auto flex items-center gap-2">
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground transition hover:text-foreground"
            >
              <Github size={13} /> GitHub
            </a>
            <a
              href={stackblitzUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground transition hover:text-foreground"
            >
              <ExternalLink size={13} /> Open in StackBlitz
            </a>
          </span>
        </div>
        {open && (
          <div className="mt-4 max-h-[70vh] overflow-auto rounded-md border border-border/60">
            <CodeBlock lines={lines} theme={theme} className="rounded-none border-0" />
          </div>
        )}
      </div>
    </section>
  );
}

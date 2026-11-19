"use client";

import { CodeBlock } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../theme-provider";

/** One source file under an example, in the library's own CodeBlock. */
export function GuideCode({ file, href, lines }: { file: string; href: string; lines: string[] }) {
  const { theme } = useSiteTheme();
  return (
    <div className="border-b border-border/70 last:border-b-0">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <code className="font-mono text-[11px] text-muted-foreground">{file.split("/").pop()}</code>
        <a href={href} target="_blank" rel="noreferrer" className="ml-auto font-mono text-[11px] text-muted-foreground hover:text-primary">
          GitHub
        </a>
      </div>
      <CodeBlock lines={lines} theme={theme} className="max-h-[32rem] rounded-none border-0 border-t border-border/50" />
    </div>
  );
}

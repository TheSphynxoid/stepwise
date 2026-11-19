import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { GuideCode } from "./guide-code";

// Server component: a live example with its real source underneath, read at
// build time like ViewSource, so the code shown is the code running. Lines
// that only exist for this site (the light/dark theme wiring) carry a
// `// demo-only` comment, or sit between `// demo-only:start` and
// `// demo-only:end`, and are left out of what is shown.

const REPO = "https://github.com/TheSphynxoid/stepwise/blob/master/apps/demo/app/guide";

export function stripDemoOnly(source: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    if (line.includes("// demo-only:start")) skipping = true;
    else if (line.includes("// demo-only:end")) skipping = false;
    else if (!skipping && !line.includes("// demo-only")) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function Example({ files, children, caption }: { files: string[]; children?: ReactNode; caption?: ReactNode }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card/40">
      {children && (
        <div className="border-b border-border/70 p-5" data-testid="guide-live">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">Live</p>
          {children}
          {caption && <p className="mt-4 text-[12px] text-muted-foreground">{caption}</p>}
        </div>
      )}
      {files.map((file) => {
        const source = stripDemoOnly(readFileSync(path.join(process.cwd(), "app/guide", file), "utf8"));
        return <GuideCode key={file} file={file} href={`${REPO}/${file}`} lines={source.split("\n").map((l) => l || " ")} />;
      })}
    </div>
  );
}

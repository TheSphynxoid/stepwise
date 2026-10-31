import type { Metadata } from "next";
import Link from "next/link";
import { API } from "./api";

export const metadata: Metadata = {
  title: "API reference",
  description: "Every stepwise hook and component: options, return values and props.",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground pt-12 pb-24">
      <div className="mx-auto max-w-6xl px-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
        <nav aria-label="API index" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 text-[12px]">
            {API.map((g) => (
              <div key={g.title} className="mb-5">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{g.title}</p>
                <ul className="space-y-1">
                  {g.entries.map((e) => (
                    <li key={e.id}>
                      <a href={`#${e.id}`} className="font-mono text-foreground/65 transition hover:text-primary">
                        {e.name.split(" / ")[0]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">API reference</p>
          <h1 className="text-3xl font-semibold tracking-tight mb-3">@sphynxoid/stepwise</h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Everything exported from the package root, grouped by layer. Hooks are headless and
            SSR-safe; the callbacks they return are referentially stable. Adapters live on
            subpaths so their optional peers never become required imports.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-md border border-border bg-card px-4 py-3 font-mono text-[12px] text-foreground/80">
            npm i @sphynxoid/stepwise
          </pre>

          {API.map((g) => (
            <section key={g.title} className="mt-14" aria-labelledby={`group-${g.title}`}>
              <h2 id={`group-${g.title}`} className="text-xl font-semibold tracking-tight">{g.title}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{g.blurb}</p>

              {g.entries.map((e) => (
                <article key={e.id} id={e.id} className="mt-8 scroll-mt-20 rounded-xl border border-border bg-card/50 p-5">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="font-mono text-[15px] font-semibold text-primary">{e.name}</h3>
                    {e.demo && (
                      <Link href={e.demo} className="ml-auto font-mono text-[11px] text-muted-foreground transition hover:text-primary">
                        see it live: {e.demo}
                      </Link>
                    )}
                  </div>
                  <code className="mt-2 block overflow-x-auto whitespace-pre rounded-md bg-secondary/60 px-3 py-2 font-mono text-[11.5px] text-foreground/85">
                    {e.signature}
                  </code>
                  <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">{e.summary}</p>

                  {e.tables.map((t) => (
                    <div key={t.title} className="mt-5">
                      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t.title}</p>
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[560px] text-left text-[12px]">
                          <thead className="bg-secondary/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Name</th>
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Default</th>
                              <th className="px-3 py-2 font-medium">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.rows.map((r) => (
                              <tr key={r.name} className="border-t border-border/70 align-top">
                                <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">{r.name}</td>
                                <td className="px-3 py-2 font-mono text-primary/90">{r.type}</td>
                                <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">{r.def ?? "-"}</td>
                                <td className="px-3 py-2 text-foreground/70 leading-relaxed">{r.desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

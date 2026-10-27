import Link from "next/link";

const demos = [
  { href: "/eviction", title: "Eviction Policy", desc: "ARC vs LRU vs S3-FIFO — same stream, three verdicts. List rows, adaptive p, PolicyBench table." },
  { href: "/tour", title: "Guided Tour", desc: "A three-step tour with spotlight, onEnter effects, and a focus-trapped card." },
  { href: "/glossary", title: "Glossary Chains", desc: "Recursive tooltips with depth capping, cross-references, and anchor links." },
  { href: "/scroll", title: "Scroll-Driven", desc: "The scroll engine adapter — frames advance as you scroll through the page." },
  { href: "/minimal", title: "Minimal Player", desc: "Bare PlayerBar + StepScrubber. No chrome, no domain — just the machinery." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-3">stepwise</p>
        <h1 className="text-3xl font-bold mb-3">Interactive step visualizations</h1>
        <p className="text-sm text-foreground/60 leading-relaxed max-w-2xl mb-10">
          One primitive — a clamped cursor over an ordered sequence — applied at every scale:
          frames in a trace, chapters in a lesson, lessons in a notebook. This demo site exercises
          the kit with different content, different styles, and different interaction models.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {demos.map((demo) => (
            <Link
              key={demo.href}
              href={demo.href}
              className="group border border-border rounded-md p-5 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-200"
            >
              <h2 className="text-base font-semibold text-primary mb-2 group-hover:text-primary/90 transition-colors">
                {demo.title}
              </h2>
              <p className="text-[12px] font-mono text-foreground/55 leading-relaxed">{demo.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

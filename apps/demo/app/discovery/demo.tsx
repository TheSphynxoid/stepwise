"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  useDiscoveries,
  useGuidedTour,
  useGlobalKeys,
  TourSpotlight,
  TourCard,
  type TourStepInput,
} from "@sphynxoid/stepwise";
import { useSiteTheme } from "../theme-provider";
import { useEffect, useRef, useState } from "react";

const FEATURE_ID = "demo:search:v1";
const STORAGE_KEY = "stepwise.demo.discoveries";

export default function DiscoveryDemo() {
  const { theme } = useSiteTheme();
  const { discovered, ready, markDiscovered, reset } = useDiscoveries({ key: STORAGE_KEY });
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);

  const steps: TourStepInput[] = [
    {
      id: "intro",
      title: "New: Search",
      body: (
        <>
          The toolkit grew a search feature. This tour plays once - a discovery
          ledger remembers you&apos;ve seen it. First: <strong>click the search
          box</strong>. The tour won&apos;t advance until you do (a <em>gate</em>).
        </>
      ),
      target: "disc-search",
      gate: () => focused,
      waitHint: "click the search box to continue",
    },
    {
      id: "type",
      title: "Type a query",
      body: (
        <>
          Type anything. This step carries a <em>when</em>: if you already typed
          a query before the tour reached it, it is skipped entirely - steps
          read your app&apos;s state at arrival time.
        </>
      ),
      target: "disc-search",
      when: () => query.length === 0,
      gate: () => query.length > 0,
      waitHint: 'type anything - e.g. "compiler"',
    },
    {
      id: "run",
      title: "Run the search",
      body: (
        <>
          Press <strong>Search</strong>. Also gated - and skipped if you already
          ran a search before the tour caught up with you.
        </>
      ),
      target: "disc-run",
      when: () => !searched,
      gate: () => searched,
      waitHint: "press Search",
    },
    {
      id: "results",
      title: "Results",
      body: <>Matches appear here. No gate - just a look at the outcome.</>,
      target: "disc-results",
    },
    {
      id: "done",
      title: "Discovered",
      body: (
        <>
          Ending the tour marks <code>demo:search:v1</code> in the ledger
          (localStorage). Reload the page - it won&apos;t play again. Use
          &quot;Reset discoveries&quot; below to see the trigger fire fresh.
        </>
      ),
    },
  ];

  const tour = useGuidedTour(steps);
  const { active, start, next, back, end, blocked } = tour;
  const launched = useRef(false);

  useEffect(() => {
    if (!ready || active || launched.current || discovered.has(FEATURE_ID)) return;
    const t = window.setTimeout(() => {
      launched.current = true;
      start();
    }, 600);
    return () => window.clearTimeout(t);
  }, [ready, active, discovered, start]);

  useEffect(() => {
    if (launched.current && !active) markDiscovered(FEATURE_ID);
  }, [active, markDiscovered]);

  useGlobalKeys({
    Escape: () => end(),
    ArrowRight: () => {
      if (active && !blocked) next();
    },
    ArrowLeft: () => {
      if (active) back();
    },
  });

  const runSearch = () => {
    setResults(
      query.trim()
        ? [`"${query}" - 3 matches`, "...in the way a lexer scans", "...before a parser rebuilds"]
        : []
    );
    setSearched(true);
  };

  const isNew = ready && !discovered.has(FEATURE_ID);

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
          Demo - Led Discovery
        </p>
        <h1 className="text-2xl font-bold mb-6 sw-fade-up sw-fade-up-1">A feature tour that plays once</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-8 sw-fade-up sw-fade-up-2">
          <code>useDiscoveries</code> keeps a persisted ledger of discovered
          feature ids; when this page mounts with an undiscovered feature, its
          tour starts automatically. The tour itself uses conditional steps
          (<code>when</code> skips what you&apos;ve already done) and gates
          (<code>gate</code> blocks Next until you actually do the thing).
        </p>

        <div id="disc-search" className="rounded-xl border border-border bg-card p-5 mb-4 shadow-sm sw-fade-up sw-fade-up-3">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-primary">Search</h2>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-widest ${
                isNew
                  ? "text-accent border-accent/40 animate-pulse"
                  : "text-foreground/30 border-border"
              }`}
            >
              {isNew ? "new" : "discovered"}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              id="disc-input"
              type="text"
              value={query}
              placeholder="query the corpus..."
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              className="flex-1 text-[12px] font-mono px-3 py-2 rounded-md border border-border bg-background/60 text-foreground/85 outline-none focus:border-primary/50 transition-colors"
            />
            <button
              id="disc-run"
              type="button"
              onClick={runSearch}
              className="text-[11px] font-mono px-4 py-2 rounded-md border border-primary/40 bg-background/40 text-foreground/85 hover:border-primary/70 hover:text-foreground transition-colors cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {["Sorting", "Export"].map((name, i) => (
            <div key={name} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground/80 mb-1">{name}</h2>
              <p className="text-[12px] text-foreground/50">
                {i === 0
                  ? 'Discovered long ago - its badge would read "discovered" too.'
                  : "Shipped without a tour - nothing in the ledger, nothing plays."}
              </p>
            </div>
          ))}
        </div>

        <div id="disc-results" className="rounded-xl border border-border bg-card p-5 mb-6 min-h-[72px] shadow-sm">
          <h2 className="text-sm font-semibold text-foreground/80 mb-2">Results</h2>
          {results === null ? (
            <p className="text-[12px] text-foreground/40 font-mono">- run a search -</p>
          ) : results.length === 0 ? (
            <p className="text-[12px] text-foreground/40 font-mono">no query, no matches</p>
          ) : (
            <ul className="text-[12px] font-mono text-foreground/70 space-y-1">
              {results.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              launched.current = true;
              start();
            }}
            className="h-9 px-4 text-[12px] font-medium rounded-md border border-primary/40 bg-background/40 text-foreground/85 hover:border-primary/70 hover:text-foreground transition-colors cursor-pointer"
          >
            Replay tour
          </button>
          <button
            type="button"
            onClick={() => {
              launched.current = false;
              reset();
            }}
            className="h-9 px-4 text-[12px] font-medium rounded-md border border-border text-foreground/60 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
          >
            Reset discoveries
          </button>
          <span className="text-[10px] font-mono text-foreground/30">
            ledger: {ready ? (discovered.size > 0 ? [...discovered].join(", ") : "empty") : "hydrating..."}
          </span>
        </div>
      </div>

      {active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight target={tour.current.target ?? null} theme={theme} />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={steps.length}
            onNext={() => next()}
            onBack={() => back()}
            onEnd={end}
            theme={theme}
            nextDisabled={blocked}
          />
        </>
      )}
    </main>
  );
}
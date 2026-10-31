"use client";

import Link from "next/link";
import { ArrowLeft, Milestone } from "lucide-react";
import {
  useChapters,
  useGuidedTour,
  useTrace,
  ChapterNav,
  GlossaryAppendix,
  GlossaryProvider,
  PlayerBar,
  Term,
  TourCard,
  TourSpotlight,
  flattenChapters,
  type Chapter,
  type GlossaryEntry,
  type StepwiseStep,
  type TourStepInput,
} from "@sphynxoid/stepwise";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSiteTheme } from "../theme-provider";

// The flagship: one lesson, three cursors. useChapters (scroll position),
// useTrace (Dijkstra frames) and useGuidedTour (the intro) are each a
// clamped useSteps cursor. Two small couplings compose them:
//   chapter → frame   an effect seeks the paused player to the chapter's frame
//   tour → chapter    a tour step targets a section; the spotlight scrolls it
//                     into view, which moves the chapter cursor, which seeks
// Glossary terms ride along in the prose and collect into the appendix.

// ── The trace: Dijkstra on a small weighted grid (built at module scope) ────

const MAP = [
  "S..#....",
  ".~.#.~~.",
  ".~...~G.",
  "..~#....",
  "...#~~..",
];
const COLS = MAP[0].length;
const CELLS = MAP.join("").split("");
const START = CELLS.indexOf("S");
const GOAL = CELLS.indexOf("G");
const isWall = (i: number) => CELLS[i] === "#";
/** Cost of entering a cell: open ground 1, rough ground 4. */
const weight = (i: number) => (CELLS[i] === "~" ? 4 : 1);
const coord = (i: number) => `(${i % COLS},${Math.floor(i / COLS)})`;

function neighbors(i: number): number[] {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (c < COLS - 1) out.push(i + 1);
  if (r < MAP.length - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  return out.filter((n) => !isWall(n));
}

type Frame = StepwiseStep<{
  dist: (number | null)[];
  settled: number[];
  frontier: number[];
  current: number;
  relaxed: number[];
  path: number[];
}>;

const FRAMES: Frame[] = (() => {
  const dist = CELLS.map(() => Infinity);
  const prev = CELLS.map(() => -1);
  const settled: number[] = [];
  let frontier = [START];
  dist[START] = 0;
  const out: Frame[] = [];
  const push = (f: Pick<Frame, "tone" | "label" | "current" | "relaxed"> & { path?: number[] }) =>
    out.push({
      ...f,
      dist: dist.map((d) => (Number.isFinite(d) ? d : null)),
      settled: [...settled],
      frontier: [...frontier],
      path: f.path ?? [],
    });

  push({ tone: "accent", label: "dist[S] = 0", current: START, relaxed: [] });
  while (frontier.length > 0) {
    // The priority queue: lowest tentative distance first (ties: oldest).
    const u = frontier.reduce((best, n) => (dist[n] < dist[best] ? n : best), frontier[0]);
    frontier = frontier.filter((n) => n !== u);
    settled.push(u);
    const relaxed: number[] = [];
    for (const n of neighbors(u)) {
      if (settled.includes(n)) continue;
      const offer = dist[u] + weight(n);
      if (offer < dist[n]) {
        dist[n] = offer;
        prev[n] = u;
        relaxed.push(n);
        if (!frontier.includes(n)) frontier.push(n);
      }
    }
    if (u === GOAL) {
      push({ tone: "good", label: `Settle G at ${dist[u]}`, current: u, relaxed });
      break;
    }
    push({
      tone: relaxed.length ? "write" : "neutral",
      label: `Settle ${coord(u)} at ${dist[u]}${relaxed.length ? ` - relax ${relaxed.length}` : ""}`,
      current: u,
      relaxed,
    });
  }
  const path: number[] = [];
  for (let n = GOAL; n !== -1; n = prev[n]) path.unshift(n);
  push({ tone: "good", label: `Path: ${path.length - 1} moves, cost ${dist[GOAL]}`, current: -1, relaxed: [], path });
  return out;
})();

const LAST = FRAMES.length - 1;
const FIRST_MULTI_RELAX = Math.max(1, FRAMES.findIndex((f) => f.relaxed.length >= 2));

// ── Chapters (each anchored to a frame of the trace) ─────────────────────────

const CHAPTERS: Chapter[] = [
  { id: "grid", label: "The grid" },
  { id: "frontier", label: "Frontier" },
  {
    id: "relax",
    label: "Relaxation",
    hint: "Offers, then settling",
    children: [
      { id: "relax-offer", label: "Offers" },
      { id: "relax-settle", label: "Settling" },
    ],
  },
  { id: "path", label: "The path" },
  { id: "glossary", label: "Glossary", numbered: false },
];
const FLAT = flattenChapters(CHAPTERS);

/** Frame each chapter seeks the player to (flattened chapter order). */
const CHAPTER_FRAME: Record<string, number> = {
  grid: 0,
  frontier: 1,
  relax: FIRST_MULTI_RELAX,
  "relax-offer": FIRST_MULTI_RELAX,
  "relax-settle": Math.floor(LAST / 2),
  path: LAST,
  glossary: LAST,
};

// ── Glossary ─────────────────────────────────────────────────────────────────

const GLOSSARY: GlossaryEntry[] = [
  { id: "weight", term: "Edge weight", definition: (<>The cost of one move. Here it is the cost of entering a cell: open ground costs 1, rough ground 4. Dijkstra requires weights to be non-negative - that is what makes <Term id="settled">settling</Term> safe.</>) },
  { id: "tentative", term: "Tentative distance", definition: (<>The best cost found so far to reach a cell. It only ever decreases, through <Term id="relaxation">relaxation</Term>, and becomes final once the cell is <Term id="settled">settled</Term>.</>) },
  { id: "frontier", term: "Frontier", definition: (<>Cells that have a <Term id="tentative">tentative distance</Term> but are not settled yet - the boundary between explored and unexplored. Kept in a <Term id="pq">priority queue</Term>.</>) },
  { id: "pq", term: "Priority queue", definition: (<>A collection that hands back its smallest element first. Dijkstra pops the <Term id="frontier">frontier</Term> cell with the lowest <Term id="tentative">tentative distance</Term>. This demo scans an array; a binary heap makes each pop logarithmic.</>) },
  { id: "relaxation", term: "Relaxation", definition: (<>Offering a neighbour a path through the current cell: if <code>dist[u] + w</code> beats the neighbour&apos;s <Term id="tentative">tentative distance</Term>, the offer replaces it and the neighbour joins the <Term id="frontier">frontier</Term>.</>) },
  { id: "settled", term: "Settled", definition: (<>A cell whose distance is final. Because every <Term id="weight">weight</Term> is non-negative, no later path can undercut the cheapest <Term id="frontier">frontier</Term> cell - so popping it settles it.</>) },
  { id: "spt", term: "Shortest-path tree", definition: (<>Each settled cell remembers the neighbour that made its winning offer. Following those back-pointers from any cell walks the cheapest route home to the start.</>) },
];

// ── Prose ────────────────────────────────────────────────────────────────────

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "grid",
    title: "The grid",
    body: (
      <>
        <p>
          Eight columns, five rows. <strong>S</strong> is the start, <strong>G</strong> the goal.
          Walls block movement; rough ground (the shaded cells) costs 4 to enter and open
          ground costs 1. Those costs are the{" "}
          <span id="lesson-term"><Term id="weight">edge weights</Term></span>.
        </p>
        <p>
          The question is not &quot;how many moves&quot; but &quot;what is the cheapest route&quot; -
          a detour around rough ground can beat a straight line through it.
        </p>
      </>
    ),
  },
  {
    id: "frontier",
    title: "The frontier",
    body: (
      <>
        <p>
          Dijkstra keeps a <Term id="frontier">frontier</Term>: cells it has reached but not
          finished with, each carrying a <Term id="tentative">tentative distance</Term>.
          It starts with just <strong>S</strong> at distance 0.
        </p>
        <p>
          Every round pops the cheapest frontier cell from a{" "}
          <Term id="pq">priority queue</Term>. On the grid, dashed outlines are the frontier
          and the number in a cell is its current best distance.
        </p>
      </>
    ),
  },
  {
    id: "relax",
    title: "Relaxation",
    body: (
      <p>
        The popped cell makes offers to its neighbours, then becomes final. Two halves:
      </p>
    ),
  },
  {
    id: "relax-offer",
    title: "Offers",
    body: (
      <>
        <p>
          For each neighbour, <code>dist[u] + w</code> is an offer. If it beats what the
          neighbour already has, it wins: that is <Term id="relaxation">relaxation</Term>.
          Highlighted cells on the grid were relaxed this frame.
        </p>
        <p>
          On this grid the weight lives on the cell you enter, so the first offer a cell
          receives is already its best. On a general graph with weights on edges, a later
          offer can undercut an earlier one - the algorithm doesn&apos;t care either way.
        </p>
      </>
    ),
  },
  {
    id: "relax-settle",
    title: "Settling",
    body: (
      <>
        <p>
          The cell popped from the queue is <Term id="settled">settled</Term> - its distance
          will never change again. Settled cells turn green and the explored region grows
          outward like a ripple, cheapest first.
        </p>
        <p>
          The ripple bends: it flows quickly over open ground and slowly over rough ground,
          so the frontier is not a circle but a contour of equal cost.
        </p>
      </>
    ),
  },
  {
    id: "path",
    title: "The path",
    body: (
      <>
        <p>
          When <strong>G</strong> is settled the search stops. Every settled cell recorded who
          made its winning offer, and those back-pointers form a{" "}
          <Term id="spt">shortest-path tree</Term>. Walking it from G to S gives the route.
        </p>
        <p>
          Press play to watch the whole search, or scroll back up: each chapter seeks the
          paused player to its own frame.
        </p>
      </>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LessonDemo() {
  const { theme } = useSiteTheme();
  const chapters = useChapters(CHAPTERS);
  const trace = useTrace(FRAMES);
  const { player } = trace;
  // Stable controls (invariant 7) - safe effect/memo dependencies.
  const { seek, setPlaying } = player;

  // chapter → frame: a paused player follows the reader's scroll position.
  const playingRef = useRef(player.playing);
  playingRef.current = player.playing;
  const activeId = FLAT[chapters.active]?.chapter.id ?? "grid";
  useEffect(() => {
    if (!playingRef.current) seek(CHAPTER_FRAME[activeId] ?? 0);
  }, [activeId, seek]);

  const tourSteps = useMemo<TourStepInput[]>(
    () => [
      {
        id: "nav",
        target: "lesson-nav",
        title: "Chapters are a cursor",
        body: <>useChapters turns scroll position into an index: the chapter crossing the viewport&apos;s center is active. The nav is just a view of that index.</>,
      },
      {
        id: "viz",
        target: "lesson-viz",
        title: "So is the trace",
        body: <>useTrace wraps a typed array of Dijkstra frames in a player. Same clamped cursor, plus a timer and a scrubber.</>,
        onEnter: () => setPlaying(false),
      },
      {
        id: "sync",
        target: "relax-settle",
        title: "Scroll drives the trace",
        body: <>This step targets a chapter. The spotlight scrolls it into view, useChapters reports the new index, and one effect seeks the player to that chapter&apos;s frame. Watch the grid fill in.</>,
      },
      {
        id: "term",
        target: "lesson-term",
        title: "Terms open definitions",
        body: <>Hover a dotted term, or focus it and press Enter. Definitions can contain more terms; tooltips stack outward.</>,
      },
      {
        id: "appendix",
        target: "glossary",
        title: "The appendix collects itself",
        body: <>Every entry the provider knows, rendered at the end - and registered as the last, unnumbered chapter.</>,
      },
      {
        id: "done",
        title: "One cursor model",
        body: <>Tour step, chapter, frame: three useSteps cursors, composed with two small couplings. The readout under the player shows all three live.</>,
      },
    ],
    [setPlaying]
  );
  const tour = useGuidedTour(tourSteps);

  const f = trace.step!;
  const onPath = new Set(f.path);
  const settled = new Set(f.settled);
  const frontier = new Set(f.frontier);
  const relaxed = new Set(f.relaxed);

  return (
    <GlossaryProvider entries={GLOSSARY} theme={theme}>
      <main className="min-h-screen bg-background text-foreground pb-24">
        <div className="sticky top-14 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div id="lesson-nav" className="max-w-6xl mx-auto px-6 py-2">
            <ChapterNav
              chapters={CHAPTERS}
              active={chapters.active}
              onNavigate={chapters.goTo}
              theme={theme}
              className="static z-auto border-transparent bg-transparent shadow-none"
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-10">
          <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
            <ArrowLeft size={14} /> Back to demos
          </Link>
          <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
            Flagship - composed lesson
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mb-3 sw-fade-up sw-fade-up-1">
            Dijkstra, one cursor at a time
          </h1>
          <p className="max-w-2xl text-[14px] text-muted-foreground leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
            A scroll lesson, an embedded player, an intro tour and a glossary - all on one page,
            all the same primitive. Scroll and the paused player follows; play and it runs the
            whole search.
          </p>
          <button
            type="button"
            onClick={tour.start}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 cursor-pointer sw-fade-up sw-fade-up-3"
          >
            <Milestone size={14} /> Take the {tourSteps.length}-step tour
          </button>

          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="order-2 min-w-0 lg:order-1">
              {SECTIONS.map((s) => {
                const i = FLAT.findIndex((x) => x.chapter.id === s.id);
                const isActive = i === chapters.active;
                const depth = FLAT[i]?.depth ?? 0;
                return (
                  <section
                    key={s.id}
                    id={s.id}
                    className={`border-l-2 pl-5 mb-20 scroll-mt-32 transition-colors duration-300 ${
                      isActive ? "border-primary/60" : "border-border/60"
                    } ${depth > 0 ? "ml-6" : ""}`}
                  >
                    <h2 className={`text-base font-semibold mb-3 transition-colors ${isActive ? "text-primary" : "text-foreground/60"}`}>
                      <span className="mr-3 font-mono text-[10px] text-foreground/30">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </h2>
                    <div className="space-y-3 text-[14px] leading-relaxed text-foreground/75">{s.body}</div>
                  </section>
                );
              })}

              <section id="glossary" className="scroll-mt-32">
                <GlossaryAppendix
                  title="Glossary"
                  intro={<>Collected from the provider&apos;s entries - no list passed by hand.</>}
                  className="mt-0"
                />
              </section>
            </div>

            <aside className="order-1 min-w-0 lg:order-2">
              <div className="lg:sticky lg:top-32 space-y-3">
                <div id="lesson-viz" className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-primary">dijkstra</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{f.label}</span>
                  </div>
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
                    role="img"
                    aria-label={`Dijkstra frame ${trace.frame + 1} of ${FRAMES.length}: ${f.label}`}
                  >
                    {CELLS.map((ch, i) => {
                      const d = f.dist[i];
                      let cls = "bg-background/50 text-foreground/40 border-border/60";
                      if (ch === "#") cls = "bg-foreground/30 border-transparent";
                      else if (onPath.has(i)) cls = "bg-accent text-accent-foreground border-accent";
                      else if (i === f.current) cls = "bg-primary/35 text-foreground border-primary ring-2 ring-primary/50";
                      else if (relaxed.has(i)) cls = "bg-primary/20 text-primary border-primary/70";
                      else if (settled.has(i)) cls = "bg-accent/15 text-accent border-accent/40";
                      else if (frontier.has(i)) cls = "bg-background/50 text-primary border-primary/70 border-dashed";
                      const rough = ch === "~" && !onPath.has(i);
                      return (
                        <div
                          key={i}
                          className={`relative aspect-square rounded-[4px] border text-[11px] font-mono grid place-items-center transition-colors duration-200 ${cls}`}
                        >
                          {rough && (
                            <span aria-hidden className="absolute inset-0 rounded-[3px] bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_oklab,var(--foreground)_14%,transparent)_4px_6px)]" />
                          )}
                          <span className="relative">
                            {ch === "S" ? "S" : ch === "G" ? "G" : ch === "#" ? "" : d ?? ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
                    <span><span className="inline-block h-2 w-2 mr-1 rounded-sm border border-dashed border-primary/70" />frontier</span>
                    <span><span className="inline-block h-2 w-2 mr-1 rounded-sm bg-primary/30" />relaxed</span>
                    <span><span className="inline-block h-2 w-2 mr-1 rounded-sm bg-accent/30" />settled</span>
                    <span><span className="inline-block h-2 w-2 mr-1 rounded-sm bg-accent" />path</span>
                    <span><span className="inline-block h-2 w-2 mr-1 rounded-sm bg-foreground/30" />wall</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                  <PlayerBar
                    player={player}
                    toneAt={trace.toneAt}
                    titleAt={trace.titleAt}
                    onEmpty={player.start}
                    theme={theme}
                    className="p-2"
                  />
                </div>

                <dl aria-label="Cursor readout" className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { hook: "useChapters", label: "chapter", value: `${chapters.active + 1}/${FLAT.length}` },
                    { hook: "useTrace", label: "frame", value: `${trace.frame + 1}/${FRAMES.length}` },
                    { hook: "useGuidedTour", label: "tour", value: tour.index === null ? "-" : `${tour.index + 1}/${tourSteps.length}` },
                  ].map((c) => (
                    <div key={c.hook} className="rounded-lg border border-border bg-card/60 px-2 py-2">
                      <dt className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{c.label}</dt>
                      <dd data-cursor={c.label} className="text-[15px] font-mono text-foreground">{c.value}</dd>
                      <dd className="text-[9px] font-mono text-primary/70">{c.hook}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {tour.active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight target={tour.current.target ?? null} theme={theme} />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={tourSteps.length}
            onNext={tour.next}
            onBack={tour.back}
            onEnd={tour.end}
            theme={theme}
          />
        </>
      )}
    </GlossaryProvider>
  );
}

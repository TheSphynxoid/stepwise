import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Github,
  Milestone,
  Palette,
  Play,
  Sparkles,
} from "lucide-react";
import { CodeBlock } from "@sphynxoid/stepwise";
import { HeroPlayer } from "./hero-player";
import { CodeDemo } from "./code-demo";
import { ThemeToggle } from "./theme-provider";
import { darkCodePanelTheme } from "./site-themes";

// TODO: point at the real repository when it goes public.
const REPO_URL = "https://github.com/TheSphynxoid/stepwise";

const DEMOS = [
  {
    href: "/eviction",
    icon: Play,
    title: "Player",
    desc: "Frames in a trace: autoPlay, scrubber, keyboard control, engine port for GSAP or scroll.",
    tag: "useStepPlayer",
  },
  {
    href: "/tour",
    icon: Milestone,
    title: "Guided tours",
    desc: "Spotlight targeting, onEnter effects over your state, waitHint, focus-trapped card.",
    tag: "useGuidedTour",
  },
  {
    href: "/discovery",
    icon: Sparkles,
    title: "Led discovery",
    desc: "A persisted ledger plays each feature tour once. Gates wait for the user; conditional steps skip what's done.",
    tag: "useDiscoveries",
  },
  {
    href: "/scroll",
    icon: BookOpen,
    title: "Scroll chapters",
    desc: "Scroll-driven lessons with sub-chapters, recursive nav, and viewport-center tracking.",
    tag: "useChapters",
  },
  {
    href: "/glossary",
    icon: BookMarked,
    title: "Glossary chains",
    desc: "Recursive term tooltips, depth-capped, with an appendix that collects the entries for you.",
    tag: "<Term />",
  },
  {
    href: "/minimal",
    icon: Palette,
    title: "Bare & light",
    desc: "The smallest player, on a light page, running a standalone theme object.",
    tag: "StepwiseTheme",
  },
];

const THEME_SAMPLE = [
  "const light: StepwiseTheme = {",
  "  toneSegment: { good: \"bg-blue-600\", ... },",
  "  buttonVariants: {",
  "    primary: \"bg-blue-600 text-white\",",
  "    outline: \"border-blue-600/40 text-slate-800\",",
  "  },",
  "  surface: \"border-slate-200 bg-white/90\",",
  "  kbd: \"border-slate-300 bg-slate-50\",",
  "  muted: \"text-slate-400\",",
  "};",
  "",
  "<PlayerBar theme={light} ... />  // pass in your own theme",
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px] sw-float" />
          <div className="absolute right-[8%] top-32 h-72 w-72 rounded-full bg-accent/10 blur-[120px]" />
          <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_65%_60%_at_50%_0%,black,transparent)]" />
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-mono text-muted-foreground sw-fade-up">
                <span className="h-1.5 w-1.5 rounded-full bg-accent sw-pulse-glow" />
                v0.1.0 - MIT - React 18 & 19
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-[3.4rem] md:leading-[1.08] sw-fade-up sw-fade-up-1">
                Narrate any sequence.
                <br />
                <span className="sw-gradient-text">One cursor, every scale.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sw-fade-up sw-fade-up-2">
                stepwise is a React kit for interactive, narrated step-throughs:
                player-driven traces, guided tours, scroll-told lessons, and
                show-once feature tutorials. All of them run on one core
                primitive, a clamped cursor called{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground/80">
                  useSteps
                </code>
                .
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 sw-fade-up sw-fade-up-3">
                <a
                  href="#demos"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 sw-pulse-glow"
                >
                  Explore the demos
                  <ArrowRight size={15} />
                </a>
                <a
                  href="#theming"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-5 text-sm text-foreground/80 transition hover:border-primary/40 hover:text-foreground sw-ring-hover"
                >
                  How theming works
                </a>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <Github size={15} />
                  Source
                </a>
              </div>
            </div>

            <div className="sw-fade-up sw-fade-up-2">
              <HeroPlayer />
            </div>
          </div>
        </div>
      </section>

      {/* One primitive */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { call: "useStepPlayer()", what: "timers, speed, deep links, engine port" },
              { call: "useGuidedTour()", what: "effects, guards, edges - a tour state machine" },
              { call: "useChapters()", what: "scroll to cursor, viewport-center containment" },
            ].map((x, i) => (
              <div key={x.call} className={`flex items-start gap-4 sw-fade-up sw-fade-up-${i + 1}`}>
                <code className="mt-0.5 rounded border border-border bg-secondary/60 px-2 py-1 text-[11px] font-mono text-primary">
                  {x.call}
                </code>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{x.what}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* In code */}
      <CodeDemo />

      {/* Demos */}
      <section id="demos" className="scroll-mt-20 border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
            The demos
          </p>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl sw-fade-up sw-fade-up-1">
            Six ways to drive a cursor
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground sw-fade-up sw-fade-up-2">
            Built entirely with the published components - the same hooks, props,
            and themes you would use in your own app.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEMOS.map((demo, i) => (
              <Link
                key={demo.href}
                href={demo.href}
                className={`group relative rounded-xl border border-border bg-card/60 p-5 sw-card-glow sw-fade-up sw-fade-up-${(i % 3) + 1}`}
              >
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-md border border-border bg-secondary/50 text-primary transition group-hover:border-primary/40 group-hover:bg-primary/10">
                  <demo.icon size={16} />
                </div>
                <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  {demo.title}
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{demo.desc}</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-primary/70">
                  {demo.tag}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Theming */}
      <section id="theming" className="scroll-mt-20 border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
                Theming
              </p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl sw-fade-up sw-fade-up-1">
                Your design system, not ours.
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-muted-foreground sw-fade-up sw-fade-up-2">
                Components ship className strings, but every color is either a
                CSS variable or a token in the injectable{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground/80">
                  StepwiseTheme
                </code>{" "}
                - surfaces, overlays, code panels, kbd chips, the spotlight.
                Swap in any design system without forking the kit.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-background/60 p-4 sw-fade-up sw-fade-up-3">
                <ThemeToggle />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  <span className="text-foreground">Try it:</span> the toggle in
                  the header switches the whole site between the two palettes,
                  theme tokens included. This code sample is the library&apos;s{" "}
                  <code className="font-mono text-[11.5px]">CodeBlock</code>.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/70 p-4 backdrop-blur-md shadow-xl sw-fade-up sw-fade-up-2">
              <div style={{ "--foreground": "#e9eef8" } as React.CSSProperties}>
                <CodeBlock lines={THEME_SAMPLE} theme={darkCodePanelTheme} />
              </div>
              <p className="mt-3 px-1 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                The hooks are headless; the styled components are optional. Use
                your own markup and keep the behavior.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
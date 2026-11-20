// Hand-written API reference data, transcribed from the public barrel
// (packages/stepwise/src/index.ts) and the JSDoc on each export. When an
// export's signature changes, update its entry here in the same change.

export interface Row {
  name: string;
  type: string;
  /** Default value, when the option has one. */
  def?: string;
  desc: string;
}

export interface Table {
  title: string;
  rows: Row[];
}

export interface ApiEntry {
  id: string;
  name: string;
  signature: string;
  summary: string;
  tables: Table[];
  /** Demo page that showcases this export. */
  demo?: string;
}

export interface ApiGroup {
  title: string;
  blurb: string;
  entries: ApiEntry[];
}

const THEME_ROW: Row = {
  name: "theme",
  type: "StepwiseTheme",
  def: "defaultTheme",
  desc: "Styling tokens. Pass your own object to restyle without forking.",
};
const CLASS_ROW: Row = { name: "className", type: "string", desc: "Extra classes, merged last (tailwind-merge)." };

export const API: ApiGroup[] = [
  {
    title: "Core",
    blurb: "The one primitive. Everything else is a policy layered over this cursor.",
    entries: [
      {
        id: "useSteps",
        name: "useSteps",
        signature: "useSteps<T>(items: readonly T[] | number, opts?: UseStepsOptions): StepsCore",
        summary:
          "A clamped cursor over an ordered sequence. Re-clamps when the count shrinks; all callbacks are referentially stable.",
        tables: [
          {
            title: "UseStepsOptions",
            rows: [
              { name: "initialIndex", type: "number", def: "0", desc: "Initial focus. Clamped." },
              { name: "onChange", type: "(index: number) => void", desc: "Fired whenever the focus index changes." },
            ],
          },
          {
            title: "StepsCore (returned)",
            rows: [
              { name: "count", type: "number", desc: "Number of steps in the sequence." },
              { name: "index", type: "number", desc: "Clamped focus: 0..count-1, or -1 when the sequence is empty." },
              { name: "atStart / atEnd", type: "boolean", desc: "Position flags." },
              { name: "canNext / canPrev", type: "boolean", desc: "Whether a move in that direction would change the index." },
              { name: "go", type: "(index: number) => void", desc: "Clamped jump. No-op on an empty sequence." },
              { name: "next / prev", type: "() => void", desc: "Clamped single-step moves." },
              { name: "first", type: "() => void", desc: "Jump to the first step." },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Policies",
    blurb: "Hooks that drive the cursor from a timer, a tour, the scroll position or a ledger.",
    entries: [
      {
        id: "useStepPlayer",
        name: "useStepPlayer",
        signature: "useStepPlayer(opts: StepPlayerOptions): StepPlayer",
        summary:
          "Player policy: timer, speed, seek, optional #hash deep link and an engine port for GSAP or scroll. index === -1 means not started.",
        demo: "/minimal",
        tables: [
          {
            title: "StepPlayerOptions",
            rows: [
              { name: "total", type: "number", desc: "Frames in the current timeline (0 = no timeline loaded). Required." },
              { name: "baseDelayMs", type: "number", def: "900", desc: "Delay per frame at 1x speed (built-in timer engine)." },
              { name: "autoPlay", type: "boolean", def: "false", desc: "Start playing immediately when a timeline exists on first render." },
              { name: "engine", type: "PlayerEngine", desc: "Alternate frame source replacing the timer. Memoize per timeline - identity changes reconnect it." },
              { name: "syncHash", type: "string", desc: "Deep-link the frame into the URL hash as #<key>=<index>. Other hash parts are kept, including a bare #anchor, which becomes #anchor&frame=3: the page still works, but a shared copy of that URL no longer scrolls to the anchor. Read on mount and on hashchange." },
              { name: "onEnd", type: "() => void", desc: "Fired once when playback runs to the final frame on its own. Cleared by any cursor movement." },
              { name: "respectReducedMotion", type: "boolean", def: "true", desc: "With autoPlay, land on frame 0 but stay paused under prefers-reduced-motion." },
              { name: "holdAt", type: "(frame: number) => boolean", desc: "Checkpoints: autoplay pauses on these frames and reports held. It doesn't resume on its own: call release() (a Continue button) or press play. Manual steps and seeks are never held; each checkpoint holds once per playthrough." },
              { name: "stopAt", type: "(frame: number) => boolean", desc: "Gate forward moves: next, a seek or scrub ahead, a hash-link jump and playback stop on the first frame this returns true for (a move that starts on a gated frame doesn't pass it). Backward moves pass. Read live through a ref, so a new function each render is fine. Also an option of useTrace, useSimulation and useWalk (for useWalk, a gated link jump too). usePrompts uses it for its gate." },
              { name: "follow", type: "boolean", def: "false", desc: "Follow the live edge of a growing timeline: when frames are appended while the reader is live (playing, or parked on the last frame), playback continues into them. A reader who scrubbed back or paused mid-trace stays put. With autoPlay, a player that mounts empty starts on the first frames. Checkpoints still hold; ignored with an engine." },
            ],
          },
          {
            title: "StepPlayer (returned)",
            rows: [
              { name: "total", type: "number", desc: "Total frames in the current timeline." },
              { name: "frame", type: "number", desc: "Raw frame counter; -1 means no timeline / before the first frame." },
              { name: "index", type: "number", desc: "Frame clamped into [0, total-1]; -1 when there is nothing to show." },
              { name: "playing / speed", type: "boolean / number", desc: "Playback state." },
              { name: "atEnd", type: "boolean", desc: "Parked on the final frame (a seek counts too)." },
              { name: "ended", type: "boolean", desc: "Playback ran to the end on its own and nothing has moved since. toggle() at ended replays." },
              { name: "held", type: "number | null", desc: "The checkpoint frame playback is paused on (see holdAt)." },
              { name: "release", type: "() => void", desc: "Release the checkpoint and resume playing." },
              { name: "jump", type: "(frame: number) => void", desc: "Move the cursor without touching play state - for re-anchoring after the timeline changes. User-facing moves should seek." },
              { name: "live", type: "boolean", desc: "With follow: the reader is at the live edge, so appended frames will play. Always false without follow." },
              { name: "goLive", type: "() => void", desc: "Move to the last frame (paused); with follow, new frames play from there." },
              { name: "start", type: "() => void", desc: "Jump to frame 0 and play." },
              { name: "reset", type: "() => void", desc: "Clear the player (frame = -1, paused)." },
              { name: "seek", type: "(frame: number) => void", desc: "Jump to a frame." },
              { name: "next", type: "(onEmpty?: () => void) => void", desc: "Step forward; pauses first. onEmpty fires when there is no timeline." },
              { name: "prev", type: "() => void", desc: "Step backward; pauses first." },
              { name: "toggle", type: "(onEmpty?: () => void) => void", desc: "Play/pause; replays from 0 at the end." },
              { name: "setPlaying / setSpeed", type: "(v) => void", desc: "Direct setters." },
            ],
          },
        ],
      },
      {
        id: "useTrace",
        name: "useTrace",
        signature: "useTrace<S extends StepwiseStep>(steps: readonly S[], opts?: TraceOptions<S>): TracePlayer<S>",
        summary:
          "A player bound to a typed trace. Resolves the frame to render (frame 0 before start) and returns stable scrubber accessors. steps may change: keyed steps re-anchor, so the playhead stays on the same logical step and playback continues.",
        demo: "/player",
        tables: [
          {
            title: "TraceOptions<S> (plus every StepPlayerOptions field except total)",
            rows: [
              { name: "keyOf", type: "(step: S, index: number) => string | undefined", def: "step.key", desc: "Step identity for re-anchoring when steps changes. Unkeyed traces keep the same index, clamped." },
              { name: "holdAt", type: "(frame: number, step: S | undefined) => boolean", desc: "Checkpoints, with the step from the current trace." },
            ],
          },
          {
            title: "TracePlayer<S> (returned)",
            rows: [
              { name: "player", type: "StepPlayer", desc: "The underlying player - pass it to PlayerBar." },
              { name: "step", type: "S | undefined", desc: "The frame to render. Frame 0 before the player starts; undefined only for an empty trace." },
              { name: "frame", type: "number", desc: "Index of step in the trace (0 before start; -1 for an empty trace)." },
              { name: "toneAt", type: "(i: number) => StepTone", desc: "Stable accessor for PlayerBar / StepScrubber." },
              { name: "titleAt", type: "(i: number) => string", desc: "Stable accessor for PlayerBar / StepScrubber." },
            ],
          },
        ],
      },
      {
        id: "useSyncedTracks",
        name: "useSyncedTracks / alignTracks",
        signature: "useSyncedTracks<T extends Tracks>(tracks: T, opts?: SyncedTracksOptions<T>): SyncedTracks<T>",
        summary:
          "Comparison mode: several traces of the same input under one player. Shorter tracks hold their last frame, or steps align on shared sync keys. alignTracks is the pure alignment; on a server, import it from @sphynxoid/stepwise/core.",
        demo: "/compare",
        tables: [
          {
            title: "SyncedTracksOptions (plus every StepPlayerOptions field except total)",
            rows: [
              { name: "key", type: "(step, index, track) => string | null | undefined", desc: "Sync-point key. Matching keys share a frame; the n-th occurrence pairs with the n-th. Omit to hold shorter tracks." },
            ],
          },
          {
            title: "SyncedTracks<T> (returned)",
            rows: [
              { name: "player", type: "StepPlayer", desc: "One player over the aligned timeline - pass it to PlayerBar." },
              { name: "frame / total", type: "number", desc: "Aligned frame to render (0 before start, -1 when all tracks are empty) and frame count." },
              { name: "tracks", type: "{ [K]: TrackView }", desc: "Per track: step, index, held (did not advance this frame), done, length." },
              { name: "rows", type: "readonly AlignedRow[]", desc: "The full alignment table." },
              { name: "toneAt / titleAt", type: "(i: number) => ...", desc: "Stable scrubber accessors: most severe tone, and track: label for every track that moved." },
            ],
          },
        ],
      },
      {
        id: "createTrace",
        name: "createTrace",
        signature: "createTrace<Data>(): TraceBuilder<Data>",
        summary:
          "Typed trace builder: run your algorithm at module scope and record frames as you go. Pure data - no React; on a server, import it from @sphynxoid/stepwise/core.",
        demo: "/compare",
        tables: [
          {
            title: "TraceBuilder<Data>",
            rows: [
              { name: "step", type: "(step: StepwiseStep<Data>) => TraceBuilder<Data>", desc: "Append a frame; chains." },
              { name: "length", type: "number", desc: "Frames appended so far." },
              { name: "last", type: "() => StepwiseStep<Data> | undefined", desc: "Most recent frame." },
              { name: "build", type: "() => StepwiseStep<Data>[]", desc: "Snapshot - a fresh array each call." },
            ],
          },
        ],
      },
      {
        id: "useSimulation",
        name: "useSimulation",
        signature: "useSimulation<Input, S extends StepwiseStep>(simulation: Simulation<Input, S>, input: Input, opts?: SimulationOptions<S>): SimulationPlayer<S>",
        summary:
          "A live trace: runs a generator on the input and plays the result. Change the input or seed and the trace is recomputed while keyed steps keep the playhead in place. Define the simulation at module scope, and keep object inputs in state or useMemo: an inline { arr, target } is a new object every render, so the trace would be recomputed every render (development builds warn about it).",
        demo: "/simulate",
        tables: [
          {
            title: "SimulationOptions<S> (plus every TraceOptions field)",
            rows: [
              { name: "seed", type: "number | string", def: "0", desc: "Seed for ctx.rng. Same simulation + input + seed = same trace." },
              { name: "maxSteps", type: "number", def: "10000", desc: "Stop collecting after this many steps and report truncated." },
              { name: "syncInput", type: "SyncInputOptions<Input>", desc: "Keep the input in the URL next to the frame, so a link replays the exact run (see below). Since 0.4." },
              { name: "initialTrace", type: "PrecomputedTrace<Input, S>", desc: "A trace computed ahead of time (precompute). While the input (compared by content) and the seed match it, its steps are played without running the simulation; once the input changes the trace is recomputed as usual. It matches on input and seed only, not on the simulation's identity or maxSteps. Since 0.6." },
            ],
          },
          {
            title: "SyncInputOptions<Input>",
            rows: [
              { name: "key", type: "string", desc: "Hash key for the input (#in=...). Must differ from syncHash." },
              { name: "serialize", type: "(input: Input) => string", desc: "Input to a URL-safe string ([5, 2, 8] to \"5.2.8\")." },
              { name: "parse", type: "(value: string) => Input | null", desc: "Back to an input; return null to ignore a malformed or hostile value." },
              { name: "onRestore", type: "(input: Input) => void", desc: "Gets the linked input once on mount; pass your setInput. The linked syncHash frame is then applied to the trace of that input, not the default one. Edits are written back to the URL." },
            ],
          },
          {
            title: "SimulationPlayer<S> (returned: every TracePlayer field, plus)",
            rows: [
              { name: "steps", type: "readonly S[]", desc: "The computed trace." },
              { name: "truncated", type: "boolean", desc: "maxSteps cut the run short." },
              { name: "error", type: "unknown", desc: "What the simulation threw; steps holds what it yielded before." },
              { name: "seed", type: "number", desc: "Numeric seed used (strings are hashed)." },
            ],
          },
        ],
      },
      {
        id: "runSimulation",
        name: "runSimulation / createRng",
        signature: "runSimulation(simulation, input, opts?: { seed?, maxSteps? }): SimulationResult<S>  ·  createRng(seed?: number | string): Rng",
        summary:
          "The pure pieces: run a simulation to completion (safe at module scope; on a server or in a build script, import it from @sphynxoid/stepwise/core, since the root entry is a client module), and a seeded mulberry32 generator - the only randomness a simulation should use, so runs replay exactly.",
        demo: "/simulate",
        tables: [
          {
            title: "Simulation<Input, S>",
            rows: [
              { name: "(input, ctx) => Iterable<S>", type: "generator or array", desc: "Yield one step per moment worth showing. Yield snapshots (copies), and give steps a key." },
              { name: "ctx.rng", type: "Rng", desc: "Seeded randomness: next(), int(min, max), pick(items), shuffle(items), seed." },
            ],
          },
        ],
      },
      {
        id: "reanchor",
        name: "reanchor",
        signature: "reanchor(oldSteps, oldIndex, newSteps, keyOf): number",
        summary:
          "The re-anchoring rule useTrace applies: walk back from the old position to the latest step whose key both traces share, and land on it. No shared key returns 0; an empty trace returns -1. Pure - use it in custom players.",
        tables: [],
      },
      {
        id: "useGuidedTour",
        name: "useGuidedTour",
        signature: "useGuidedTour(steps: TourStepInput[], opts?: GuidedTourOptions): GuidedTour",
        summary:
          "Tour policy: onEnter effects over your state, conditional steps (when), guards (gate), branching edges (next) and an optional imperative driver.",
        demo: "/tour",
        tables: [
          {
            title: "TourStepInput",
            rows: [
              { name: "id", type: "string", desc: "Stable id for gotoId and next edges." },
              { name: "title / body", type: "string / ReactNode", desc: "Card content." },
              { name: "target", type: "string", desc: "Element to spotlight: DOM id first, then [data-tour=\"...\"]." },
              { name: "onEnter", type: "() => void", desc: "Effect run when the step becomes active - drive your app state here." },
              { name: "waitHint", type: "string", desc: "Pulsing hint shown on the card." },
              { name: "when", type: "() => boolean", desc: "Conditional step: false skips it in the direction of travel. Evaluated on arrival." },
              { name: "gate", type: "() => boolean | Verdict", desc: "Guard: until it passes, next() is a no-op and the tour reports blocked. Return a Verdict to explain what's missing (tour.feedback)." },
              { name: "next", type: "() => string | null", desc: "Edge override: advance to this step id instead of index+1." },
            ],
          },
          {
            title: "GuidedTourOptions",
            rows: [{ name: "driver", type: "TourDriver", desc: "Imperative presenter (driver.js, Shepherd...). When set, don't render TourSpotlight/TourCard." }],
          },
          {
            title: "GuidedTour (returned)",
            rows: [
              { name: "index", type: "number | null", desc: "Active step index, or null when the tour is not running." },
              { name: "current", type: "TourStepInput | null", desc: "The active step." },
              { name: "active", type: "boolean", desc: "Whether the tour is running." },
              { name: "blocked", type: "boolean", desc: "The active step's gate is closed; pair with TourCard nextDisabled." },
              { name: "feedback", type: "ReactNode", desc: "Feedback from the active gate's Verdict; pair with TourCard feedback." },
              { name: "start / end", type: "() => void", desc: "Run from the first eligible step / stop." },
              { name: "next / back", type: "() => void", desc: "Move along edges, honoring gates and skips." },
              { name: "goto", type: "(index: number) => void", desc: "Programmatic jump (ignores gates)." },
              { name: "gotoId", type: "(id: string) => void", desc: "Jump to a step by id. No-op when unknown." },
            ],
          },
        ],
      },
      {
        id: "useChapters",
        name: "useChapters",
        signature: "useChapters(chapters: Chapter[]): ChaptersApi",
        summary:
          "Scroll-tracked chapters. Active = the section containing the viewport center. Sections are resolved by DOM id; give them scroll-mt to clear sticky headers.",
        demo: "/scroll",
        tables: [
          {
            title: "Chapter",
            rows: [
              { name: "id", type: "string", desc: "DOM id of the chapter's section." },
              { name: "label / hint", type: "string", desc: "Nav label and tooltip." },
              { name: "children", type: "Chapter[]", desc: "Nested sub-chapters, any depth." },
              { name: "numbered", type: "boolean", def: "true", desc: "Show the ordinal chip in ChapterNav." },
            ],
          },
          {
            title: "ChaptersApi (returned)",
            rows: [
              { name: "active", type: "number", desc: "Index of the chapter in view (flattened order)." },
              { name: "goTo", type: "(index: number) => void", desc: "Smooth-scroll to a chapter." },
              { name: "next / prev", type: "() => void", desc: "Neighbouring chapter." },
            ],
          },
        ],
      },
      {
        id: "useLessonStream",
        name: "useLessonStream / useFadeIn",
        signature: "useLessonStream(count: number, opts?: LessonStreamOptions): LessonStream",
        summary:
          "Headless notebook reader: mounts a window of lessons around the seed, loads neighbours on approach, compensates the scroll for content prepended above, and tracks the active lesson by viewport center. Composes with ChapterNav and LessonPager. useFadeIn(initiallyVisible) fades streamed blocks in.",
        tables: [
          {
            title: "LessonStreamOptions",
            rows: [
              { name: "seed", type: "number", def: "0", desc: "Lesson to open on (deep link). Clamped." },
              { name: "radius", type: "number", def: "1", desc: "Lessons mounted on each side of the seed initially." },
              { name: "approachBelow / approachAbove", type: "number", def: "600 / 300", desc: "Pixel thresholds for loading the next / previous lesson." },
              { name: "scrollToSeed", type: "boolean", def: "true", desc: "Scroll the seed into view before first paint." },
              { name: "onActiveChange", type: "(index: number) => void", desc: "Scroll-tracked active lesson changed - sync the URL or title here." },
            ],
          },
          {
            title: "LessonStream (returned)",
            rows: [
              { name: "active / seed", type: "number", desc: "Lesson at the viewport center; the seed lesson." },
              { name: "mounted", type: "number[]", desc: "Indices to render, in order." },
              { name: "complete", type: "boolean", desc: "The window reaches the last lesson." },
              { name: "refFor", type: "(i: number) => RefCallback", desc: "Stable ref for lesson i's block." },
              { name: "goTo / next / prev", type: "...", desc: "Mount through a lesson and scroll to it." },
              { name: "reducedMotion", type: "boolean", desc: "The user prefers reduced motion." },
            ],
          },
        ],
      },
      {
        id: "useDiscoveries",
        name: "useDiscoveries",
        signature: "useDiscoveries(opts?: DiscoveriesOptions): Discoveries",
        summary:
          "A persisted set of discovered ids, hydrated after mount. Pair with useGuidedTour for show-once feature tutorials.",
        demo: "/discovery",
        tables: [
          {
            title: "DiscoveriesOptions",
            rows: [
              { name: "store", type: "DiscoveryStore", def: "localStorageStore()", desc: "Storage seam: localStorageStore, cookieStore, memoryStore, or your own { read, write }." },
              { name: "key", type: "string", def: "\"stepwise.discoveries\"", desc: "Storage key used by the built-in stores." },
            ],
          },
          {
            title: "Discoveries (returned)",
            rows: [
              { name: "discovered", type: "Set<string>", desc: "Discovered ids. Empty until hydration." },
              { name: "ready", type: "boolean", desc: "False during SSR and before the first client pass - gate auto-starts on it." },
              { name: "isDiscovered", type: "(id: string) => boolean", desc: "Ref-backed check for event handlers." },
              { name: "markDiscovered", type: "(id: string | string[]) => void", desc: "Record ids and persist the merged set." },
              { name: "reset", type: "() => void", desc: "Forget everything." },
            ],
          },
        ],
      },
      {
        id: "useGlobalKeys",
        name: "useGlobalKeys",
        signature: "useGlobalKeys(map: KeyMap, opts?: GlobalKeysOptions): void",
        summary:
          "Global keyboard bindings matched on event.key (exact, then lowercase). Handlers fire with preventDefault; Escape always fires.",
        demo: "/player",
        tables: [
          {
            title: "GlobalKeysOptions",
            rows: [
              { name: "ignoreTags", type: "string[]", def: "INPUT, TEXTAREA, SELECT, BUTTON", desc: "Tags that swallow keys (except Escape)." },
              { name: "enabled", type: "boolean | (() => boolean)", def: "true", desc: "Gate, checked per event." },
            ],
          },
        ],
      },
      {
        id: "useFocusTrap",
        name: "useFocusTrap",
        signature: "useFocusTrap(active: boolean): RefObject<HTMLDivElement | null>",
        summary:
          "Traps Tab inside the ref'd container while active, focuses it on activation and restores focus on release. Attach to a tabIndex={-1} element.",
        tables: [],
      },
      {
        id: "usePrefersReducedMotion",
        name: "usePrefersReducedMotion",
        signature: "usePrefersReducedMotion(): boolean",
        summary: "SSR-safe prefers-reduced-motion query (false on the server, corrected after mount).",
        tables: [],
      },
    ],
  },
  {
    title: "Evaluators",
    blurb: "One verdict shape for every \"did the reader get it?\" question: tour gates, player checkpoints, exercises. Booleans are accepted everywhere.",
    entries: [
      {
        id: "useEvaluator",
        name: "useEvaluator",
        signature: "useEvaluator<Ctx>(evaluator: Evaluator<Ctx>, ctx: Ctx, opts?: { mode?: \"auto\" | \"manual\" }): EvaluatorState",
        summary:
          "Keeps an evaluator's verdict as state. Auto re-judges on every context change (gates). Manual judges only on check() (quizzes); when ctx changes identity afterwards the verdict goes back to idle, but attempts are kept (same question), so call reset() when the question itself changes, e.g. in an effect on player.held. Async checks report pending, abort superseded runs and drop late results.",
        demo: "/simulate",
        tables: [
          {
            title: "EvaluatorState (returned)",
            rows: [
              { name: "status", type: "\"idle\" | \"pass\" | \"fail\" | \"pending\"", desc: "idle until the first verdict." },
              { name: "feedback", type: "ReactNode", desc: "The verdict's feedback." },
              { name: "passed", type: "boolean", desc: "status === \"pass\"." },
              { name: "attempts", type: "number", desc: "check() calls so far - for hints after a few tries." },
              { name: "error", type: "unknown", desc: "What the evaluator threw (status is then fail)." },
              { name: "check", type: "() => Promise<Verdict | null>", desc: "Judge now; resolves null if superseded. Stable." },
              { name: "reset", type: "() => void", desc: "Back to idle, attempts to 0. Stable." },
            ],
          },
        ],
      },
      {
        id: "verdicts",
        name: "Evaluator / Verdict / pass / fail / pending",
        signature: "type Evaluator<Ctx> = (ctx: Ctx, signal: AbortSignal) => boolean | Verdict | Promise<boolean | Verdict>",
        summary:
          "A Verdict is { status: \"pass\" | \"fail\" | \"pending\", feedback? }. pass(), fail() and pending() build one; toVerdict() normalizes a boolean. All are exported from the package root. The signal aborts when the result is no longer wanted. Grading a checkpoint: the truth is usually the next frame (sim.steps[player.held + 1]), so phrase the question so every possible next frame is an answer option.",
        tables: [],
      },
    ],
  },
  {
    title: "Components",
    blurb: "Optional styled presentation. Every component takes a theme; the hooks work without them.",
    entries: [
      {
        id: "PlayerBar",
        name: "PlayerBar",
        signature: "<PlayerBar player={...} toneAt={...} titleAt={...} />",
        summary: "Transport controls plus a tone-colored scrubber for a StepPlayer.",
        demo: "/player",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "player", type: "StepPlayer (subset)", desc: "total, index, playing, atEnd, next, prev, toggle, seek (+ live, goLive for the live badge)." },
              { name: "toneAt / titleAt", type: "(i) => StepTone / string", desc: "Segment color and tooltip per frame." },
              { name: "leading", type: "ReactNode", desc: "Content before the controls." },
              { name: "onEmpty", type: "() => void", desc: "Fired when the user plays/steps with no timeline." },
              { name: "emptyHint", type: "string", desc: "Scrubber text when there are no frames." },
              { name: "groupOf", type: "(i: number) => number", desc: "Group consecutive segments (see StepScrubber)." },
              { name: "live", type: "boolean", desc: "Show the live-edge badge for a following player: Live at the edge, Go live +N when the reader is behind." },
              { name: "controls", type: "\"full\" | \"step\"", def: "\"full\"", desc: "\"step\" drops the Play button and puts ← and → on either side of the scrubber: for a timeline the reader drives one step at a time, like a walk that stops at every choice. Since 0.6." },
              { name: "labels", type: "{ previous, play, pause, replay, next, live, goLive }", desc: "Button labels / aria." },
              THEME_ROW,
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "StepScrubber",
        name: "StepScrubber",
        signature: "<StepScrubber count={n} index={i} onSeek={go} />",
        summary: "Keyboard-accessible slider of tone-colored segments, usable with any cursor.",
        demo: "/scroll",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "count / index", type: "number", desc: "Segment count and the active segment." },
              { name: "onSeek", type: "(i: number) => void", desc: "Called on click or arrow keys. Required." },
              { name: "toneAt / titleAt", type: "(i) => StepTone / string", desc: "Per-segment color and title." },
              { name: "groupOf", type: "(i: number) => number", desc: "Group contiguous segments into one proportional span - a chapter fills as its children pass." },
              { name: "emptyHint", type: "string", desc: "Shown when count is 0." },
              { name: "labels", type: "{ scrubber?, frame?(i) }", desc: "aria-label and aria-valuetext." },
              THEME_ROW,
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "ChapterNav",
        name: "ChapterNav",
        signature: "<ChapterNav chapters={CHAPTERS} active={c.active} onNavigate={c.goTo} />",
        summary: "Recursive chapter navigation; sticky by default. Sub-chapters render inline after their parent.",
        demo: "/scroll",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "chapters", type: "Chapter[]", desc: "The same tree passed to useChapters." },
              { name: "active", type: "number", desc: "Flattened active index." },
              { name: "onNavigate", type: "(i: number) => void", desc: "Called with the flattened index." },
              { name: "hint", type: "string", desc: "Right-aligned hint line (md and up)." },
              THEME_ROW,
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "LessonPager",
        name: "LessonPager",
        signature: "<LessonPager prev={{ label }} next={{ label }} onNavigate={dir => ...} />",
        summary: "Previous/next buttons for cross-page lesson navigation.",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "prev / next", type: "{ label: string; hint?: string }", desc: "Omit either to disable that side." },
              { name: "onNavigate", type: "(dir: \"prev\" | \"next\") => void", desc: "Called on click." },
              { name: "labels", type: "{ previous?, next? }", desc: "Eyebrow labels." },
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "TourSpotlight",
        name: "TourSpotlight",
        signature: "<TourSpotlight target={tour.current?.target ?? null} />",
        summary:
          "Dims the page around the target, scrolls it into view once and tracks it every frame. Waits for targets that render late, and finds the target again when it is replaced (a re-keyed subtree, an HTMX or Turbo swap). Portals to <body> after mount, so it works inside a filtered or transformed ancestor (a sticky header with backdrop-blur).",
        demo: "/tour",
        tables: [
          {
            title: "Props",
            rows: [{ name: "target", type: "string | null", desc: "DOM id, then [data-tour] value. null hides the spotlight." }, THEME_ROW],
          },
        ],
      },
      {
        id: "TourCard",
        name: "TourCard",
        signature: "<TourCard step={tour.current} index={tour.index} total={n} onNext onBack onEnd />",
        summary: "Focus-trapped dialog narrating the active tour step, fixed to the bottom of the viewport. Portals to <body> after mount, so it can render next to a tour button inside a blurred or transformed header.",
        demo: "/tour",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "step", type: "TourStepInput", desc: "The active step." },
              { name: "index / total", type: "number", desc: "Position, shown in the header." },
              { name: "onNext / onBack / onEnd", type: "() => void", desc: "Wire to tour.next, tour.back, tour.end." },
              { name: "nextDisabled", type: "boolean", def: "false", desc: "Disable Next/Finish - pair with tour.blocked." },
              { name: "feedback", type: "ReactNode", desc: "Gate feedback, announced politely - pair with tour.feedback." },
              { name: "labels", type: "{ title, back, next, finish, end }", desc: "Text overrides." },
              THEME_ROW,
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "ShortcutsDialog",
        name: "ShortcutsDialog",
        signature: "<ShortcutsDialog open={open} onClose={close} items={SHORTCUTS} />",
        summary: "Modal list of keyboard shortcuts with kbd chips; closes on Escape or backdrop click.",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "open", type: "boolean", desc: "Visibility." },
              { name: "onClose", type: "() => void", desc: "Called on Escape, backdrop or close button." },
              { name: "items", type: "ShortcutItem[]", desc: "{ keys, action } pairs." },
              { name: "title", type: "string", desc: "Dialog heading." },
              THEME_ROW,
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "CodeBlock",
        name: "CodeBlock",
        signature: "<CodeBlock lines={[\"const x = 1\", \"// comment\"]} />",
        summary: "Monospace lines with // comments dimmed. This site's View source panels use it.",
        demo: "/player",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "lines", type: "readonly string[]", def: "[]", desc: "One entry per line. Optional, so a step's optional code passes as is: <CodeBlock lines={step.code} />." },
              THEME_ROW,
              CLASS_ROW,
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Glossary",
    blurb: "Inline term tooltips that can nest, plus an appendix that collects itself.",
    entries: [
      {
        id: "GlossaryProvider",
        name: "GlossaryProvider",
        signature: "<GlossaryProvider entries={GLOSSARY}>...</GlossaryProvider>",
        summary:
          "Declares the entries once. Definitions are ReactNode and may contain further Terms. Every Term and GlossaryAppendix must be inside it (in MDX: wrap the rendered article, or put it in the layout). The entry type is type-only: import type { GlossaryEntry } from \"@sphynxoid/stepwise\".",
        demo: "/glossary",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "entries", type: "GlossaryEntry[]", desc: "{ id, term, definition } - definition may embed <Term>." },
              { name: "theme", type: "StepwiseTheme", def: "defaultTheme", desc: "Styling for tooltip cards." },
              { name: "children", type: "ReactNode", desc: "The page." },
            ],
          },
        ],
      },
      {
        id: "Term",
        name: "Term",
        signature: "<Term id=\"tls\">TLS</Term>",
        summary:
          "A focusable inline reference. Hover or Enter opens a tooltip; nested terms stack outward, depth-capped at 4. Inside the appendix it becomes an anchor link.",
        demo: "/glossary",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "id", type: "string", desc: "Entry id." },
              { name: "children", type: "ReactNode", desc: "Link text; defaults to the entry's term." },
              CLASS_ROW,
            ],
          },
        ],
      },
      {
        id: "GlossaryAppendix",
        name: "GlossaryAppendix",
        signature: "<GlossaryAppendix intro={...} footer={...} />",
        summary: "Renders the provider's entries in declaration order. Every part is overridable.",
        demo: "/scroll",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "entries", type: "GlossaryEntry[]", desc: "Override the row list; defaults to the provider's entries." },
              { name: "title", type: "string", def: "\"Glossary\"", desc: "Section heading." },
              { name: "intro / footer", type: "ReactNode", desc: "Rendered before / after the grid." },
              { name: "columns", type: "1 | 2", def: "2", desc: "Grid columns." },
              { name: "bare", type: "boolean", def: "false", desc: "Omit the section chrome." },
              { name: "entryClassName", type: "string", desc: "Classes for each row." },
              { name: "renderEntry", type: "(entry) => ReactNode", desc: "Replace the row renderer entirely." },
              CLASS_ROW,
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Utilities, theme and ports",
    blurb: "Helpers, the theme contract, and the inversion points adapters plug into.",
    entries: [
      {
        id: "flattenChapters",
        name: "flattenChapters",
        signature: "flattenChapters(chapters: Chapter[]): FlatChapter[]",
        summary: "Depth-first flattening - reading order for prev/next and scroll tracking.",
        tables: [
          {
            title: "FlatChapter",
            rows: [
              { name: "chapter", type: "Chapter", desc: "The original node." },
              { name: "depth", type: "number", desc: "0 for top level." },
              { name: "rootIndex", type: "number", desc: "Flat index of the top-level ancestor - use as StepScrubber groupOf." },
              { name: "parentIndex", type: "number", desc: "Flat index of the parent; -1 at depth 0." },
            ],
          },
        ],
      },
      {
        id: "hashParams",
        name: "readHashParam / writeHashParam",
        signature: "readHashParam(hash: string, key: string): string | null\nwriteHashParam(hash: string, key: string, value: string): string",
        summary:
          "The fragment format syncHash and syncInput use: &-separated parts, key=value parts are params, anything else (a bare #anchor) is kept verbatim. writeHashParam replaces the key in place or appends it, and returns the new hash; apply it with history.replaceState. For a simulation's input, prefer useSimulation's syncInput.",
        demo: "/simulate",
        tables: [],
      },
      {
        id: "toneClasses",
        name: "TONE_CHIP_CLASS / TONE_SEGMENT_CLASS",
        signature: "TONE_CHIP_CLASS[step.tone]  // \"text-accent border-accent/40 ...\"",
        summary:
          "The default theme's per-tone classes as plain records, for your own chips and badges that should match the scrubber. Styled by styles.css or your Tailwind build like the components.",
        demo: "/simulate",
        tables: [],
      },
      {
        id: "stores",
        name: "localStorageStore / cookieStore / memoryStore",
        signature: "localStorageStore(key?) | cookieStore(key?) | memoryStore(seed?): DiscoveryStore",
        summary: "Built-in DiscoveryStore implementations: { read(): string[]; write(ids: string[]): void }.",
        tables: [],
      },
      {
        id: "StepwiseTheme",
        name: "StepwiseTheme / defaultTheme",
        signature: "const theme: StepwiseTheme = { ...defaultTheme, surface: \"...\" }",
        summary:
          "Every non-CSS-variable class the components use. TONE_SEGMENT_CLASS and TONE_CHIP_CLASS re-export the defaults. Without Tailwind, import \"@sphynxoid/stepwise/styles.css\" (precompiled, scoped to [data-stepwise], --stepwise-* tokens); or copy the components in via the shadcn registry at /r/*.json.",
        demo: "/minimal",
        tables: [
          {
            title: "Tokens",
            rows: [
              { name: "toneSegment / toneChip", type: "Record<StepTone, string>", desc: "Scrubber segment and chip colors per tone." },
              { name: "buttonBase / buttonVariants", type: "string / Record<ghost|outline|primary, string>", desc: "Internal buttons." },
              { name: "surface", type: "string", desc: "Panel chrome for nav bars, cards, dialogs and tooltips." },
              { name: "overlay", type: "string", desc: "Dimmed backdrop behind modals." },
              { name: "codeBlock / codeMuted", type: "string", desc: "Code panel frame and comment lines." },
              { name: "kbd", type: "string", desc: "Keyboard chip." },
              { name: "spotlight", type: "string", desc: "Ring around the tour target." },
              { name: "muted", type: "string", desc: "Counters, hints, empty states." },
            ],
          },
        ],
      },
      {
        id: "types",
        name: "StepwiseStep / StepTone",
        signature: "type StepwiseStep<Data> = { tone: StepTone; label: string; code?: string[]; note?: string; key?: string } & Data",
        summary:
          "One frame of a trace, carrying your domain payload. StepTone is exactly \"neutral\" | \"accent\" | \"good\" | \"bad\" | \"write\" | \"idle\". key names the moment (\"compare at i=3, j=2\") so the playhead keeps its place when the trace is recomputed; give every step of a simulation one.",
        tables: [],
      },
      {
        id: "ports",
        name: "PlayerEngine / TourDriver",
        signature: "PlayerEngine.connect(api) => handle  |  TourDriver.show(step, ctx) / hide()",
        summary:
          "Ports for alternate frame sources and tour presenters. Adapters ship on subpaths: @sphynxoid/stepwise/adapters/gsap, /driver-js and /scroll.",
        tables: [
          {
            title: "PlayerEngine",
            rows: [
              { name: "connect(api)", type: "(api: PlayerEngineApi) => PlayerEngineHandle", desc: "api: total, onFrame(frame), onEnd(). handle: play, pause, seek, setRate, disconnect." },
            ],
          },
          {
            title: "TourDriver",
            rows: [
              { name: "show(step, ctx)", type: "(TourStepInput, TourContext) => void", desc: "ctx: index, total, next(), back(), end()." },
              { name: "hide()", type: "() => void", desc: "Called on end and unmount." },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Experimental: transitions",
    blurb: "From @sphynxoid/stepwise/experimental: may change in a minor release. A trace becomes a graph: choice points branch on the reader's answers, and the path taken is still a plain array, so the player, links and re-anchoring work unchanged.",
    entries: [
      {
        id: "useWalk",
        name: "useWalk",
        signature: "useWalk<Input, S extends WalkStep, Choice>(simulation: WalkSimulation<Input, S, Choice>, input: Input, opts?: WalkOptions<S, Input, Choice>): WalkPlayer<S, Choice>",
        summary:
          "useSimulation plus choices. A walk is replayed from (input, seed, choices) on every change, so it stays pure. The unanswered choice point at the end of the path holds playback until choose().",
        demo: "/automaton",
        tables: [
          {
            title: "WalkOptions (plus every SimulationOptions field)",
            rows: [
              { name: "choices", type: "readonly Choice[]", desc: "Choices to start with (read once, on mount)." },
              { name: "stopAt", type: "(frame: number) => boolean", desc: "As for useStepPlayer. A useWalk caller that passes it also gets a gated link jump; the plain walk stays free otherwise." },
              { name: "anchor", type: '"key" | "index"', def: '"key"', desc: "Where the playhead stays when the input changes: on the step with the same key, or at the same index (for walks where step i means \"after i inputs\", like fromGraph)." },
              { name: "syncChoices", type: "{ key, serialize, parse }", desc: "Keep the choices in the URL (#p=a.b.a). Restored together with syncInput, before the linked frame. A choice parse rejects drops the whole linked path." },
              { name: "initialTrace", type: "PrecomputedTrace<Input, S>", desc: "As for useSimulation, plus the choices: the precomputed path stands in for the run while the input matches by content, the seed matches and the choices equal trace.choices. Choice points are its await: true steps. Since 0.6." },
            ],
          },
          {
            title: "WalkPlayer<S, Choice> (returned: every SimulationPlayer field, plus)",
            rows: [
              { name: "choose", type: "(choice: Choice) => void", desc: "Answer the choice point the playhead is on. At the end of the path the walk continues; on an earlier choice point a different answer cuts off the old future (the same answer keeps it). The playhead moves past the choice point; held playback resumes. Off a choice point: no-op (dev warning)." },
              { name: "choices", type: "readonly Choice[]", desc: "The choices made so far. With the input, they are the walk." },
              { name: "choicePoints", type: "readonly number[]", desc: "Indices of the choice points on the path." },
              { name: "awaiting", type: "boolean", desc: "The path ends on a choice point waiting for an answer." },
              { name: "choiceAt", type: "(frame: number) => Choice | undefined", desc: "The answer given at frame, if it's an answered choice point." },
              { name: "lastChange", type: "TraceDiff | null", desc: "What the last re-run changed (see diffTraces), paired the way the playhead anchors." },
            ],
          },
        ],
      },
      {
        id: "runWalk",
        name: "runWalk / WalkSimulation",
        signature: "runWalk(simulation, input, opts?: { seed?, maxSteps?, choices? }): WalkResult<S>",
        summary:
          "A walk simulation is a generator; a step with await: true is a choice point, and that yield returns the reader's choice: const pick = yield { key: \"fork\", await: true, … }. runWalk replays it purely, stopping at the first unanswered choice point. A step whose prompt is an object (a PromptSpec) is a choice point too; a string, null or array prompt is plain step data. maxSteps counts steps since the last choice point, not the whole run. Linear simulations are walks without choice points.",
        tables: [
          {
            title: "WalkResult<S>",
            rows: [
              { name: "steps", type: "S[]", desc: "The path, up to the end or the first unanswered choice point." },
              { name: "choicePoints", type: "number[]", desc: "Indices of the choice points on the path." },
              { name: "awaiting", type: "boolean", desc: "The path ends on an unanswered choice point." },
              { name: "used", type: "number", desc: "How many choices were consumed; extra ones are ignored." },
              { name: "truncated / error / seed", type: "boolean / unknown / number", desc: "As in runSimulation." },
            ],
          },
        ],
      },
      {
        id: "fromGraph",
        name: "fromGraph",
        signature: "fromGraph<Sym extends string, N, Id extends string>(spec: { start, nodes, edges: { from, on, to }[], accept?, otherwise? }): StepGraph<Sym, N, Id>",
        summary:
          "A declared automaton: nodes, labeled edges, accept states. Throws on an inconsistent graph. A missing edge goes to otherwise (a dead state) or ends the run with an error. Pass no type arguments: Sym is inferred from the edges and the node ids (Id) from the keys of nodes, and start, edges, accept and otherwise are checked against them, so an unknown node is a type error. An explicit fromGraph<Sym> leaves Id as string. Typed ids since 0.6.",
        demo: "/automaton",
        tables: [
          {
            title: "StepGraph (returned)",
            rows: [
              { name: "simulation", type: "GraphSimulation<Sym>", desc: "Runs the graph over a word (a string or any iterable): one step per symbol read, keyed by position. Use with useSimulation or useWalk (anchor: \"index\")." },
              { name: "graph", type: "{ start, nodes, edges, accept: Set, otherwise }", desc: "The declared graph, to draw it." },
              { name: "delta", type: "(from: Id, on: Sym) => Id | null", desc: "The transition function, otherwise included." },
              { name: "stepAt", type: "(read, node, from?, on?) => GraphStep", desc: "The step for a position, for custom walks over the same graph." },
            ],
          },
          {
            title: "GraphStep (plus StepwiseStep)",
            rows: [
              { name: "node / from / on", type: "Id / Id | null / Sym | null", desc: "Where the walk is, where it came from, and the symbol read (null on the start step)." },
              { name: "read", type: "number", desc: "Symbols read so far." },
              { name: "accepted", type: "boolean", desc: "The node is an accepting one (tone good)." },
            ],
          },
        ],
      },
      {
        id: "diffTraces",
        name: "diffTraces",
        signature: "diffTraces<S>(oldSteps, newSteps, opts?: { keyOf?, equals? }): TraceDiff",
        summary:
          "What an edit changed between two runs, to mark the changed steps instead of only saying that something did. useWalk exposes it as lastChange.",
        tables: [
          {
            title: "TraceDiff",
            rows: [
              { name: "divergedAt", type: "number", desc: "First index where the runs differ position by position; -1 when equal. Everything before it is the same." },
              { name: "changed", type: "ReadonlySet<number>", desc: "Indices in the new run that are new or differ from their counterpart (by key with keyOf, else by index)." },
            ],
          },
          {
            title: "Options",
            rows: [
              { name: "keyOf", type: "(step, index) => string | undefined", desc: "Pair steps by key instead of index." },
              { name: "equals", type: "(a, b) => boolean", def: "structuralEqual", desc: "Step equality. The default compares plain data structurally; anything else by identity." },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Experimental: prompts",
    blurb: "From @sphynxoid/stepwise/experimental (the pure pieces also from ./core): may change in a minor release. A prompt is a question at a frame: the reader answers, the answer is recorded and judged, forward moves stop at an unanswered one, and on a walk the answer can branch what comes next. Predict, Choices and the kit's predict block are shortcuts over this for one release.",
    entries: [
      {
        id: "usePrompts",
        name: "usePrompts",
        signature: "usePrompts<Input, S extends WalkStep, A = string>(source: { steps: readonly S[] } | { simulation: Simulation<Input, S> | WalkSimulation<Input, S, A>; input: Input }, opts?: PromptsOptions<Input, S, A>): PromptsRun<S, A>",
        summary:
          "Ask the reader at a step. Prompts come from the run's steps (an object prompt on a yielded step, or await: true: the answer is the value of that yield, so it branches the run) or from an ask overlay (any trace; the answer changes nothing downstream). Answers are recorded, judged (prompt.judge, else judge, else equality with prompt.answer, else unjudged) and scored. Playback holds at an unsettled prompt and forward moves stop there. The first answer settles a prompt unless retries says otherwise: a miss reveals the answer and waits for proceed(). Options are those of useWalk (seed, maxSteps, anchor, syncHash, syncInput, initialTrace, autoPlay, holdAt, ...) except choices, syncChoices and stopAt.",
        demo: "/adventure",
        tables: [
          {
            title: "PromptsOptions<Input, S, A>",
            rows: [
              { name: "ask", type: "(step: S, frame: number, steps: readonly S[]) => Prompt<A, S> | null", desc: "Overlay prompts. Called even while prompts are disabled (answers stay recorded). Define it at module scope: a new function recomputes every question." },
              { name: "judge", type: "(answer: A, prompt: PromptSpec<A>, ctx: PromptContext<S>) => EvaluatorResult | Promise<EvaluatorResult>", desc: "Judges every prompt that has no judge of its own (generator prompts get theirs here). May be async: status reads pending, and a late verdict after a restart, input change or another prompt is dropped." },
              { name: "retries", type: "number", def: "0", desc: "Changes allowed after the first answer (Infinity for a story). A prompt's own retries wins." },
              { name: "navigation", type: '"gate" | "free"', def: '"gate"', desc: "gate: forward moves stop at an unsettled prompt. free: they pass it, and it counts as skipped." },
              { name: "autoContinue", type: "boolean", def: "false", desc: "Move on as soon as a prompt settles instead of waiting for proceed()." },
              { name: "enabled / defaultEnabled / readerToggle", type: "boolean", def: "– / true / true", desc: "Overlay prompts on or off (controlled, or the uncontrolled start and whether the reader may toggle). Generator prompts are always on." },
              { name: "onInputChange", type: '"lock" | "clear" | "keep"', desc: "What an input change does to the answers. lock: once answered, the input is locked until restart(). clear: answers and score are cleared. keep: answers stay (by position for generator prompts, by id for overlay prompts) and overlay verdicts are judged again. Default: lock once a judged prompt is reached, else keep. setInput while locked is ignored with one dev warning; a hashchange carrying a new input while locked is applied as navigation." },
              { name: "syncAnswers", type: "{ key: string; serialize: (a: A) => string; parse: (v: string) => A | null }", desc: "Deep-link the answers (#key=a.b..c, a skipped prompt empty). Restored with syncInput, before the frame. A link carries each answer's final value only (restored entries regain their retries); a list holding one skipped entry round-trips as empty; a value parse rejects drops the whole list and the playhead lands on the first unsettled prompt." },
              { name: "maxSteps", type: "number", def: "10000", desc: "Counted since the last prompt, not the whole run. A forward run continues the live generator instead of replaying." },
            ],
          },
          {
            title: "PromptsRun<S, A> (returned: every SimulationPlayer field, plus)",
            rows: [
              { name: "active", type: "{ prompt, entry, frame } | null", desc: "The prompt at the playhead, with its entry (a fresh open one until reached)." },
              { name: "status", type: '"open" | "pass" | "fail" | "answered" | "skipped" | "pending" | null', desc: "The active entry's status; pending while an async judge runs; null off a prompt." },
              { name: "feedback / judgeError / retriesLeft", type: "ReactNode / unknown / number", desc: "The last verdict's feedback, what a throwing judge threw (the answer counts as a miss), and the retries still available." },
              { name: "revealed", type: "{ answer: A | undefined; explain: unknown } | null", desc: "Once the active entry is settled (not skipped): the right answer, if known, and explain." },
              { name: "respond", type: "(answer: A) => void", desc: "Answer the prompt at the playhead. Off a prompt, or once final, ignored (dev warning)." },
              { name: "skip", type: "() => void", desc: "Leave the prompt unanswered (navigation free only)." },
              { name: "proceed", type: "() => void", desc: "Once settled: release a hold, or step on (at the end, finish the run)." },
              { name: "restart", type: "() => void", desc: "Clear every answer and the score, unlock the input; the playhead returns to frame 0." },
              { name: "restoreAnswers", type: "(answers: readonly (A | undefined)[]) => void", desc: "Replay a list of generator answers (a kept branch). Ignored, with a dev warning, while the input is locked." },
              { name: "enabled / setEnabled / canToggle", type: "boolean / (on) => void / boolean", desc: "Overlay prompts on or off; the reader's toggle is ignored when enabled is controlled or while the input is locked." },
              { name: "inputLocked / requestInput", type: "boolean / (apply: () => void) => boolean", desc: "Under lock, true once the reader has answered. requestInput runs an input change (() => setInput(x)) unless locked and returns whether it ran." },
              { name: "record / score", type: "PromptRecord<A> / PromptScore", desc: "One entry per prompt reached; { reached, passed, failed, answered, skipped }." },
            ],
          },
          {
            title: "PromptSpec<A> (what a step's prompt or an ask overlay declares; Prompt<A, S> adds judge)",
            rows: [
              { name: "id", type: "string", desc: "Defaults to the step's key, else the frame number." },
              { name: "options", type: "readonly (string | { value: string; label: string })[]", desc: "Picked answers; without options the answer is free (typed)." },
              { name: "answer / retries / explain / data", type: "A / number / unknown / unknown", desc: "The right answer (judged by equality), this prompt's retries, what to show after it settles, and anything else your view needs. A step's prompt holds JSON only, so a generator can emit it." },
              { name: "judge", type: "(answer: A, ctx: PromptContext<S>) => EvaluatorResult | Promise<EvaluatorResult>", desc: "Overlay prompts only (functions come from the hook's settings)." },
            ],
          },
        ],
      },
      {
        id: "usePromptHistory",
        name: "usePromptHistory",
        signature: "usePromptHistory<S extends WalkStep, A>(run: PromptsRun<S, A>, opts?: { overwrite?: boolean }): PromptHistory<A>",
        summary:
          "Keep the futures an answer cut off. Watches a run's generator answers (overlay answers don't branch the run) and keeps every list walked in a tree; each change of a settled answer is a backtrack. Starting over (restart, a restored branch) is not.",
        demo: "/adventure",
        tables: [
          {
            title: "PromptHistory<A> (returned)",
            rows: [
              { name: "tree", type: "BranchNode<A>", desc: "Every answer list walked, as a tree (the root's list is empty)." },
              { name: "branches", type: "readonly (readonly (A | undefined)[])[]", desc: "Each kept future: a leaf's full answer list." },
              { name: "backtracks", type: "number", desc: "How many times a settled generator answer was changed." },
              { name: "restore", type: "(answers) => void", desc: "Replay a kept branch. Ignored while the run's input is locked." },
              { name: "overwrite (option)", type: "boolean", def: "false", desc: "Drop a branch when another replaces it." },
            ],
          },
        ],
      },
      {
        id: "promptRecord",
        name: "createWalkSession / the prompt record",
        signature: "createWalkSession<Input, S extends WalkStep, Choice>(simulation, input, opts?: { seed?, maxSteps? }): { run(choices): WalkResult<S>; close(): void }\nreachEntry / applyAnswer / skipEntry / truncateAfter / canAnswer / retriesLeft / settledAnswer / scoreOf / EMPTY_RECORD",
        summary:
          "Pure, in ./core (no React). A walk session keeps the generator alive at the choice point it stopped on and, when the next call's choices extend the previous call's, sends it the new answers; it replays only when it must (a changed earlier answer, a dead generator). Continuing equals replaying: the cap and the choice-point rule are runWalk's. The answer record holds one entry per prompt reached ({ id, frame, source, judged, retries, attempts, status, settled }); every function returns a new record, or the same object when nothing changes. addPath and branchesOf build the branch tree.",
        tables: [],
      },
    ],
  },
  {
    title: "Experimental: authoring kit",
    blurb: "From @sphynxoid/stepwise/core, @sphynxoid/stepwise/kit and @sphynxoid/stepwise/kit/mdx: may change in a minor release. An explainer is a definition (pure data, ./core), a view bound to it by createExplainer (client, ./kit) and, on a server, a precomputed wrapper (./kit/mdx). The parts are flat PascalCase components with serializable props, so they compose from MDX.",
    entries: [
      {
        id: "core",
        name: "@sphynxoid/stepwise/core",
        signature: "import { runSimulation, createTrace, precompute, pass, … } from \"@sphynxoid/stepwise/core\"",
        summary:
          "The pure half of the library, with no \"use client\" and no React at runtime: call it from a React Server Component, a route handler or a build script. The root entry is a client module, so a server file that imports runSimulation from it gets a client reference, not a function it can call. The pure names stay exported from the root (and the walk names from ./experimental) for client code; the client bundles import this one copy at runtime.",
        tables: [
          {
            title: "Exports",
            rows: [
              { name: "createRng / runSimulation", type: "function", desc: "Seeded randomness and the pure runner (see runSimulation above)." },
              { name: "createTrace", type: "function", desc: "Typed trace builder." },
              { name: "runWalk / isChoicePoint / fromGraph", type: "function", desc: "Walks and automata (experimental, see above)." },
              { name: "createWalkSession", type: "function", desc: "A walk run that continues forward instead of replaying (see Experimental: prompts)." },
              { name: "reachEntry / applyAnswer / skipEntry / truncateAfter / canAnswer / retriesLeft / settledAnswer / scoreOf / EMPTY_RECORD", type: "function", desc: "The prompt answer record (see Experimental: prompts)." },
              { name: "addPath / branchesOf", type: "function", desc: "The branch tree behind usePromptHistory." },
              { name: "reanchor / stepKey", type: "function", desc: "The re-anchoring rule and its default key (step.key)." },
              { name: "alignTracks", type: "function", desc: "Comparison-mode alignment table." },
              { name: "diffTraces / structuralEqual", type: "function", desc: "What an edit changed." },
              { name: "flattenChapters", type: "function", desc: "Chapter tree to a flat list." },
              { name: "toVerdict / pass / fail / pending", type: "function", desc: "Verdict helpers." },
              { name: "defineExplainer / precompute", type: "function", desc: "Explainer definitions, and running one to a JSON trace (below)." },
              { name: "resolveInput / normalizeOptions / assertJsonInput", type: "function", desc: "The kit's input and option rules, for custom shells (below)." },
              { name: "EXPLAINER_PROP_NAMES", type: "readonly string[]", desc: "The prop names an explainer reserves; never read as input fields (below)." },
              { name: "types", type: "type", desc: "The step / tour / chapter schema, the ports, and the types of everything above (Simulation, ExplainerDefinition, PrecomputedTrace, …)." },
            ],
          },
        ],
      },
      {
        id: "defineExplainer",
        name: "defineExplainer",
        signature: "defineExplainer<Input, S extends StepwiseStep>(def: ExplainerDefinition<Input, S>): Readonly<ExplainerDefinition<Input, S>>\ndefineExplainer<Input, S extends WalkStep, Choice extends string>(def: WalkExplainerDefinition<Input, S, Choice>): Readonly<WalkExplainerDefinition<Input, S, Choice>>",
        summary:
          "One object that says what to simulate (or walk), the default input, how the input goes into a link, and where to stop and ask. Pure data plus pure functions: keep it in a plain module (no \"use client\") so a server can precompute it and the client can re-run it. Freezes the definition shallowly. A definition has a simulation or a walk, never both (a type error, and a throw from plain JS). A walk definition (since 0.6) stops at every await: true step until the reader picks one of choose.options; the kit links the choices (#<id>.path=) and precomputes the path like a simulation.",
        demo: "/kit",
        tables: [
          {
            title: "ExplainerDefinition<Input, S>",
            rows: [
              { name: "name", type: "string", desc: "Optional. Used in error messages and the display name; without it the label is \"explainer\"." },
              { name: "simulation", type: "Simulation<Input, S>", desc: "The generator. Required. Give every step a key." },
              { name: "seed", type: "number | string", def: "0", desc: "Seed for ctx.rng." },
              { name: "maxSteps", type: "number", def: "10000", desc: "Step cap; precompute throws when a run hits it." },
              { name: "input", type: "ExplainerInput<Input>", desc: "{ default, serialize?, parse? }. Leave it out for an explainer with nothing to edit (a recorded walkthrough): the input is null and there are no field props; a simulation that reads an input must declare one. For a seed the reader can change or link, make it an input field and seed createRng from it. With serialize and parse, a linked explainer keeps the input in the URL (#in=, or #<id>.in=); parse returns null to ignore a malformed link." },
              { name: "predict", type: "ExplainerPredict<S>", desc: "Checkpoints for predict mode (below): a shortcut for this release, an ask overlay over the frame after the checkpoint." },
              { name: "prompts", type: "ExplainerPrompts<S>", desc: "Prompt settings (below). Also on a walk definition: its choice points, and any prompt on a step, are its prompts." },
            ],
          },
          {
            title: "ExplainerPrompts<S> (answers are strings; defaults as usePrompts, except a walk: retries Infinity, onInputChange keep)",
            rows: [
              { name: "ask", type: "(step: S, frame: number, steps: readonly S[]) => Prompt<string, S> | null", desc: "An overlay prompt for a frame, or null. On a walk, steps is the path so far." },
              { name: "judge", type: "(answer, prompt, ctx) => EvaluatorResult | Promise<EvaluatorResult>", desc: "Judges every prompt that has no judge of its own." },
              { name: "retries", type: "number", def: "0", desc: "Changes allowed after the first answer. A prompt's own retries wins." },
              { name: "navigation", type: '"gate" | "free"', def: '"gate"', desc: "Forward moves stop at an unsettled prompt, or pass it." },
              { name: "autoContinue", type: "boolean", def: "false", desc: "Move on as soon as a prompt settles, instead of waiting for Continue." },
              { name: "onInputChange", type: '"lock" | "clear" | "keep"', desc: "What an input edit does to the answers. Default: lock once a judged prompt is reached, else keep." },
              { name: "linkAnswers", type: "boolean", desc: "Link the answers in the hash (<id>.a; a walk's <id>.path). Default: only when the definition has no judged prompts (no predict, judge or ask), since a link carries the answers. A walk whose steps' prompts carry an answer should set false." },
            ],
          },
          {
            title: "ExplainerPredict<S>",
            rows: [
              { name: "at", type: "(step: S, frame: number, next: S) => boolean", desc: "Ask here: playback holds, and stepping with Next stops until it is answered. next is the frame the guess is graded against, so a checkpoint can depend on what is about to happen without a lookahead field in the trace. A checkpoint on a frame with no successor is skipped: the guess is graded against the next frame, so there is nothing to grade." },
              { name: "options", type: "readonly (string | { value, label })[]", desc: "Answer options. A bare string gets a capitalized label (\"left\" shows \"Left\")." },
              { name: "truth", type: "(next: S | undefined, held: S) => string | undefined", desc: "The correct option value, judged from the frame after the held one." },
              { name: "feedback", type: "(guess, truth, held) => string | undefined", desc: "Custom message for a graded guess; the defaults are \"Right.\" and \"Not quite.\"." },
              { name: "hint", type: "string", desc: "Appended to the feedback after a miss while a retry remains (see prompts.retries; the default settles on the first answer, so set retries for a hint to show)." },
            ],
          },
          {
            title: "WalkExplainerDefinition<Input, S, Choice>",
            rows: [
              { name: "walk", type: "WalkSimulation<Input, S, Choice>", desc: "Replaces simulation: a generator whose yield at an await: true step returns the reader's choice. Choice is inferred from it (a string union), and options outside it are a type error." },
              { name: "choose.options", type: "readonly (Choice | { value, label })[] | ((step: S) => …)", desc: "What the Choices part offers: the same everywhere, or per step (called with the step on the playhead). A bare value gets a capitalized label, as for predict." },
              { name: "choose.parse", type: "(value: string) => Choice | null", desc: "A choice read from a link; null rejects the whole linked path. Default: one of the options when they are a list, any non-empty string when they are a function." },
              { name: "anchor", type: "\"key\" | \"index\"", def: "\"key\"", desc: "Where the playhead stays when an input edit replays the walk (useWalk's anchor)." },
              { name: "name / seed / maxSteps / input", type: "as above", desc: "As for a simulation. No predict: the choices are already the question." },
            ],
          },
        ],
      },
      {
        id: "precompute",
        name: "precompute",
        signature: "precompute<Input, S extends StepwiseStep>(def: AnyExplainerDefinition<Input, S>, input?: Input, choices?: readonly string[]): PrecomputedTrace<Input, S>",
        summary:
          "Run a definition to a JSON-safe trace, on the default input when input is undefined (so undefined can't be passed as a real input). Throws a labelled error ([stepwise] precompute(\"name\"): input.arr[1] is not JSON-serializable (undefined)) when the input or a step is not JSON (NaN, a Map, a Date, a class instance, a function, an undefined inside an array; a cycle reports kind cycle), when the simulation throws, or when it hits maxSteps, so a broken explainer fails the build. For a walk it replays choices (default none: the walk up to its first choice point); ending on an unanswered choice point is fine.",
        demo: "/kit",
        tables: [
          {
            title: "PrecomputedTrace<Input, S>",
            rows: [
              { name: "input", type: "Input", desc: "The input the trace was computed from." },
              { name: "seed", type: "number", desc: "Numeric seed used." },
              { name: "steps", type: "S[]", desc: "The trace." },
              { name: "choices", type: "string[]", desc: "A walk's answered choices, in order (only those the walk used); absent for a simulation. An explainer given this trace starts partway down the walk." },
            ],
          },
        ],
      },
      {
        id: "explainerHelpers",
        name: "resolveInput / normalizeOptions / assertJsonInput / EXPLAINER_PROP_NAMES",
        signature: "resolveInput(def, props?): Input  ·  normalizeOptions(options): PredictOption[]  ·  assertJsonInput(def, input): void  ·  EXPLAINER_PROP_NAMES",
        summary:
          "The kit's rules as pure functions, for a custom shell. resolveInput: props.input wins when defined; otherwise, for a plain-object default, each own key of the default is overridden by a same-named prop that is not undefined, except the reserved names in EXPLAINER_PROP_NAMES (definition, view, trace, input, id, predict, keys, link, autoPlay, theme, className, children), which are the explainer's own props. The server wrapper and the client both resolve through it, so they agree. FieldOverrides<Input> is the matching props type. normalizeOptions: bare strings become { value, label } with a capitalized label. assertJsonInput: throws precompute's labelled error for a non-JSON input.",
        tables: [],
      },
      {
        id: "createExplainer",
        name: "createExplainer / Explainer",
        signature: "createExplainer<Input, S>(cfg: { definition?: AnyExplainerDefinition<Input, S>; view: ComponentType }): ComponentType<ExplainerInstanceProps<Input, S>>\ntype ExplainerInstanceProps<Input, S> = Omit<ExplainerProps<Input, S>, \"definition\" | \"view\"> & FieldOverrides<Input>",
        summary:
          "Bind a definition (a simulation or a walk) and a view into one component, so a page or an MDX file renders <Sorting /> with serializable props. Without children it renders the default layout: Stage, Narration, Choices, Predict, StepCode, ExplainerBar, EndNote (Choices renders nothing for a simulation, Predict nothing for a walk). Without a definition it is a recorded-only explainer that plays its trace prop and ships no simulation code. Explainer is the same shell with definition and view as props. Besides the props below, the default input's fields are props (FieldOverrides<Input>), so a misspelled prop (autoplay) or an unknown field is a type error.",
        demo: "/kit",
        tables: [
          {
            title: "ExplainerProps",
            rows: [
              { name: "trace", type: "PrecomputedTrace<Input, S>", desc: "A precomputed run: the client starts from it instead of running the simulation (useSimulation's initialTrace). Required without a definition." },
              { name: "input", type: "Input", desc: "Replaces the whole default input. Read once, at mount." },
              { name: "<field>", type: "Input[field]", desc: "For a plain-object default, a prop named after one of its own keys overrides that field (<Search target={61} />), typed from the input. Not for fields named like a reserved prop (id, theme, ...): those props stay the explainer's, so override the field with input. Read once, at mount." },
              { name: "id", type: "string", desc: "Hash namespace: <id>.frame and <id>.in, and <id>.path for a walk's choices. Two linked explainers on a page without distinct ids share keys (development builds warn once)." },
              { name: "link", type: "boolean", def: "true", desc: "Keep the frame in the URL hash, and the input when the definition has serialize and parse." },
              { name: "autoPlay", type: "boolean", def: "false", desc: "Start playing on mount (reduced motion keeps it paused)." },
              { name: "predict", type: "boolean", desc: "Start the reader's toggle on (PredictToggle). Read once; the reader owns it after. Default: off for a predict block, on for prompts." },
              { name: "promptsEnabled", type: "boolean", desc: "Overlay prompts (predict, prompts.ask) forced on (an exam) or off, with no reader toggle. Generator prompts are always on." },
              { name: "keys", type: "boolean", def: "true", desc: "ArrowRight / ArrowLeft / Space, routed to the explainer the reader last clicked or focused. Until the reader clicks or focuses one (and after the active one unmounts), no explainer takes the keys, so Space scrolls the page. With keys={false} the explainer takes no part in routing: touching it leaves the keys with the others." },
              THEME_ROW,
              CLASS_ROW,
              { name: "children", type: "ReactNode", desc: "Replaces the default layout with your own arrangement of parts." },
            ],
          },
        ],
      },
      {
        id: "useExplainer",
        name: "useExplainer",
        signature: "useExplainer<Input = unknown, S extends StepwiseStep = StepwiseStep>(): ExplainerApi<Input, S>",
        summary:
          "Read the explainer from inside its view or a custom part. Throws outside an explainer. Pass theme as a module constant: an object literal created per render changes the api and re-renders every part.",
        demo: "/kit",
        tables: [
          {
            title: "ExplainerApi<Input, S>",
            rows: [
              { name: "step", type: "S | undefined", desc: "The frame to render: frame 0 before playback (so the first Next shows frame 1); undefined for an empty trace." },
              { name: "input", type: "Input", desc: "The current input." },
              { name: "setInput", type: "(next: Input | ((prev: Input) => Input)) => void", desc: "Stable. Re-runs the definition; keyed steps keep the playhead in place. A no-op with a development warning on a recorded-only explainer." },
              { name: "editable", type: "boolean", desc: "There is a definition to re-run." },
              { name: "error", type: "unknown", desc: "What the simulation threw (the trace keeps the steps before it); null when it ran clean, and for a recorded explainer. Development builds log it once: [stepwise] <name>: the simulation threw: <message>." },
              { name: "truncated", type: "boolean", desc: "maxSteps cut the run short. Always false for a recorded explainer." },
              { name: "sim", type: "TracePlayer<S> & { steps }", desc: "The player and the trace (sim.player for your own controls): the useSimulation result for a live explainer, the useTrace result plus steps for a recorded one." },
              { name: "prompts", type: "PromptsRun<S, string> | null", desc: "The usePrompts run (see Experimental: prompts); null unless the definition has predict or prompts." },
              { name: "predict", type: "PredictApi | null", desc: "The thin layer Prompt draws: the picked option held until Check. Non-null whenever prompts is." },
              { name: "walk", type: "WalkApi | null", desc: "A walk's choices (below); null for a simulation and a recorded explainer." },
              { name: "id / theme", type: "string | undefined / StepwiseTheme", desc: "As passed (theme defaults to defaultTheme)." },
            ],
          },
          {
            title: "PredictApi",
            rows: [
              { name: "enabled / setEnabled", type: "boolean / (on: boolean) => void", desc: "Checkpoints hold autoplay only while enabled. Turning it off while held releases." },
              { name: "held", type: "boolean", desc: "The playhead is on a prompt." },
              { name: "options", type: "readonly PredictOption[]", desc: "The normalized options." },
              { name: "guess / setGuess", type: "string | null / (value: string) => void", desc: "The chosen option value." },
              { name: "check", type: "() => void", desc: "Answer with the guess (prompts.respond). With nothing picked it only says Pick an answer first and uses no attempt." },
              { name: "status", type: "VerdictStatus | null", desc: "null until checked, and again after the guess changes." },
              { name: "feedback", type: "ReactNode", desc: "The verdict's feedback, with the definition's hint appended after a miss while a retry remains." },
              { name: "attempts", type: "number", desc: "Answers given at this prompt. The guess resets at each new prompt and when the trace changes." },
              { name: "release", type: "() => void", desc: "Once the prompt is settled: move on (prompts.proceed)." },
            ],
          },
          {
            title: "WalkApi",
            rows: [
              { name: "choices", type: "readonly Choice[]", desc: "The answers given so far, in order." },
              { name: "choose", type: "(choice: Choice) => void", desc: "Stable. Answer the choice point on the playhead: the walk moves past it; a different answer at an earlier choice point cuts off the old future and replays from there." },
              { name: "choiceAt", type: "(frame: number) => Choice | undefined", desc: "Stable. The answer given at frame, if it is an answered choice point." },
              { name: "asking", type: "boolean", desc: "The playhead is on a choice point (answered or not)." },
              { name: "awaiting", type: "boolean", desc: "The path ends on a choice point with no answer yet. Playback holds there." },
              { name: "options", type: "readonly { value, label }[]", desc: "choose.options for the step on the playhead, labelled." },
            ],
          },
        ],
      },
      {
        id: "explainerParts",
        name: "Stage / Narration / StepCode / ExplainerBar / EndNote / Choices / Prompt / Predict / PredictToggle",
        signature: "<Stage />  <Narration />  <StepCode />  <ExplainerBar />  <EndNote>…</EndNote>  <Choices label?>…</Choices>  <Prompt render?>…</Prompt>  <Predict>…</Predict>  <PredictToggle />",
        summary:
          "The parts: each reads the provider and renders one thing, with serializable props only, so they read the same in TSX and MDX. Stage renders the view and takes no props. Choices (a walk) renders one button per option, disabled off a choice point and pressed on the answer given there; children are a visible prompt, label names the group (default \"Choose\"); nothing for a simulation. Narration, StepCode, ExplainerBar and EndNote need only a step and a player, so they also work in a StepParts (below) around a plain player. The others take a className, and three take children as prose: Narration the step label (aria-live); StepCode the step's code (nothing without); ExplainerBar a PlayerBar for the explainer (controls=\"step\" drops Play, the default for a walk explainer, whose keyboard also leaves Space to the page; controls=\"full\" brings it back); EndNote shows once playback ran to the end (children are the note, default \"End of the run. Play to replay.\"); Prompt the question on the playhead (one radio per option, Check for a judged prompt, the feedback, tries left, then the reveal and Continue once it settles; no Skip under the default gate; children are the question, default \"What happens next?\"; render replaces all of it and receives the run); PredictToggle switches overlay prompts (children are its label, default \"Predict mode\"; nothing when there is nothing to toggle or promptsEnabled is set). Predict is Prompt, and Choices is Prompt on an explainer with prompts: both stay as shortcuts for this release. Prompt and PredictToggle render nothing without predict or prompts in the definition.",
        demo: "/kit",
        tables: [],
      },
      {
        id: "stepParts",
        name: "StepParts / useStepParts",
        signature: "<StepParts source={trace} theme?>…</StepParts>\nuseStepParts<S extends StepwiseStep = StepwiseStep>(): StepPartsApi<S>",
        summary:
          "The step parts (Narration, StepCode, ExplainerBar, EndNote) outside an explainer: source is anything with step, player and optionally toneAt / titleAt, which is what useTrace, useSimulation and useWalk return. An explainer opens one for its own parts, so useStepParts also works inside one; a custom part that only needs the step should read it there, so it works in both. Since 0.6. Outside both, the parts throw \"… must be inside <Explainer> or <StepParts>\".",
        demo: "/qa",
        tables: [
          {
            title: "StepPartsApi<S>",
            rows: [
              { name: "step", type: "S | undefined", desc: "The frame to render." },
              { name: "player", type: "StepPlayer", desc: "The player (ExplainerBar's)." },
              { name: "toneAt / titleAt", type: "(i: number) => StepTone / string", desc: "Scrubber accessors, when the source has them." },
              { name: "theme", type: "StepwiseTheme", def: "defaultTheme", desc: "As passed." },
            ],
          },
        ],
      },
      {
        id: "precomputed",
        name: "precomputed",
        signature: "precomputed<Input, S>(definition: AnyExplainerDefinition<Input, S>, Client: ComponentType<ExplainerInstanceProps<Input, S>>): (props: Omit<ExplainerInstanceProps<Input, S>, \"trace\">) => ReactElement",
        summary:
          "From @sphynxoid/stepwise/kit/mdx (no \"use client\"). Wraps a createExplainer component in a hook-free server component: it resolves the input from the props as the client would, runs precompute (cached per definition, up to 8 inputs), and renders Client with every prop plus trace. A client component is server-rendered anyway, so the first frame is in the HTML either way. What this adds in every host is a build-time failure for a non-JSON input or a simulation that throws, hits the cap or yields non-JSON data. In an RSC host (the Next.js App Router) the wrapper runs only on the server, so hydration does not re-run the simulation; in a non-RSC SSR host (Docusaurus, the Next.js Pages Router, Remix) the wrapper itself runs again in the browser, so the simulation runs once there too. Name the wrapper file without .server. (Remix and React Router treat *.server.* files as server-only). The wrapper's props are the client component's minus trace, field props typed from the input.",
        demo: "/kit",
        tables: [],
      },
      {
        id: "stepwiseComponents",
        name: "stepwiseComponents",
        signature: "export function useMDXComponents(c: MDXComponents) { return { ...stepwiseComponents, ...c }; }",
        summary:
          "From @sphynxoid/stepwise/kit/mdx: Term, GlossaryAppendix, Stage, Narration, StepCode, Prompt, Predict, PredictToggle, ExplainerBar, EndNote and Choices as one map, to spread into mdx-components.tsx or an MDX provider's components. Your own explainers are not in it: import them in the MDX file or add them to the map.",
        tables: [],
      },
    ],
  },
];

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
              { name: "syncHash", type: "string", desc: "Deep-link the frame into the URL hash as #<key>=<index>. Other hash parts are kept." },
              { name: "onEnd", type: "() => void", desc: "Fired once when playback runs to the final frame on its own. Cleared by any cursor movement." },
              { name: "respectReducedMotion", type: "boolean", def: "true", desc: "With autoPlay, land on frame 0 but stay paused under prefers-reduced-motion." },
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
        signature: "useTrace<S extends StepwiseStep>(steps: readonly S[], opts?: Omit<StepPlayerOptions, \"total\">): TracePlayer<S>",
        summary:
          "A player bound to a typed trace. Resolves the frame to render (frame 0 before start) and returns stable scrubber accessors.",
        demo: "/player",
        tables: [
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
          "Comparison mode: several traces of the same input under one player. Shorter tracks hold their last frame, or steps align on shared sync keys. alignTracks is the pure alignment, usable on the server.",
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
          "Typed trace builder: run your algorithm at module scope and record frames as you go. Pure data - no React, safe on the server.",
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
              { name: "gate", type: "() => boolean", desc: "Guard: while false, next() is a no-op and the tour reports blocked." },
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
              { name: "player", type: "StepPlayer (subset)", desc: "total, index, playing, atEnd, next, prev, toggle, seek." },
              { name: "toneAt / titleAt", type: "(i) => StepTone / string", desc: "Segment color and tooltip per frame." },
              { name: "leading", type: "ReactNode", desc: "Content before the controls." },
              { name: "onEmpty", type: "() => void", desc: "Fired when the user plays/steps with no timeline." },
              { name: "emptyHint", type: "string", desc: "Scrubber text when there are no frames." },
              { name: "groupOf", type: "(i: number) => number", desc: "Group consecutive segments (see StepScrubber)." },
              { name: "labels", type: "{ previous, play, pause, replay, next }", desc: "Button labels / aria." },
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
          "Dims the page around the target, scrolls it into view once and tracks it every frame. Waits for targets that render late.",
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
        summary: "Focus-trapped dialog narrating the active tour step, fixed to the bottom of the viewport.",
        demo: "/tour",
        tables: [
          {
            title: "Props",
            rows: [
              { name: "step", type: "TourStepInput", desc: "The active step." },
              { name: "index / total", type: "number", desc: "Position, shown in the header." },
              { name: "onNext / onBack / onEnd", type: "() => void", desc: "Wire to tour.next, tour.back, tour.end." },
              { name: "nextDisabled", type: "boolean", def: "false", desc: "Disable Next/Finish - pair with tour.blocked." },
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
            rows: [{ name: "lines", type: "string[]", desc: "One entry per line." }, THEME_ROW, CLASS_ROW],
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
        summary: "Declares the entries once. Definitions are ReactNode and may contain further Terms.",
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
        signature: "type StepwiseStep<Data> = { tone: StepTone; label: string; code?: string[]; note?: string } & Data",
        summary:
          "One frame of a trace, carrying your domain payload. StepTone is exactly \"neutral\" | \"accent\" | \"good\" | \"bad\" | \"write\" | \"idle\".",
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
];

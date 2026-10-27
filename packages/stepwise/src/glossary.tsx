"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

// Glossary + Paradox-style recursive tooltips. Define entries once, reference
// them inline with <Term id="…">; definitions are ReactNode, so they may
// contain further <Term>s — chains stack outward and are depth-capped
// (mutual references terminate at MAX_DEPTH).

export interface GlossaryEntry {
  id: string;
  /** Display name, shown as the tooltip's heading. */
  term: string;
  /** Body — may embed <Term> references for nested tooltips. */
  definition: ReactNode;
}

const MAX_DEPTH = 4;
const CARD_WIDTH = 288; // w-72
const OPEN_DELAY_MS = 60;
const CLOSE_GRACE_MS = 120;

interface GlossaryContextValue {
  byId: Map<string, GlossaryEntry>;
  /** Original declaration order — the auto-appendix renders this. */
  entries: GlossaryEntry[];
}

const GlossaryContext = createContext<GlossaryContextValue | null>(null);
const DepthContext = createContext(0);
const AppendixContext = createContext(false);

export function GlossaryProvider({ entries, children }: { entries: GlossaryEntry[]; children: ReactNode }) {
  const value = useMemo(
    () => ({ byId: new Map(entries.map((e) => [e.id, e])), entries }),
    [entries]
  );
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

export function Term({ id, children, className }: { id: string; children?: ReactNode; className?: string }) {
  const ctx = useContext(GlossaryContext);
  const depth = useContext(DepthContext);
  const entry = ctx?.byId.get(id);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const openRef = useRef(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLSpanElement | null>(null);
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const tipId = useId();

  const display = children ?? entry?.term ?? id;

  const closeNow = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    openRef.current = false;
    setOpen(false);
  }, []);

  const openNow = useCallback((focusCard = false) => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openRef.current = true;
    setOpen(true);
    if (focusCard) {
      requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    if (openRef.current) return;
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => openNow(), OPEN_DELAY_MS);
  }, [openNow]);

  const scheduleClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(closeNow, CLOSE_GRACE_MS);
  }, [closeNow]);

  // Position: below the trigger by default, flipped above when there is no
  // room beneath, horizontally clamped inside the viewport. Runs as a layout
  // effect so the card is measured before paint (no flash), then tracked on
  // scroll + resize, rAF-throttled.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const trigger = triggerRef.current;
      const card = cardRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const margin = 8;
      const gap = 8;
      const cw = card?.offsetWidth ?? CARD_WIDTH;
      const ch = card?.offsetHeight ?? 160;
      let top = r.bottom + gap;
      if (top + ch > window.innerHeight - margin) {
        // Not enough room below — flip above the trigger.
        top = r.top - gap - ch;
        if (top < margin) top = margin; // no room either way: pin to the top
      }
      let left = r.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - cw - margin));
      setPos({ left, top });
    };
    const onMove = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open]);

  // Outside pointer closes (touch + click-away); Escape closes from anywhere
  // inside the tooltip subtree.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (cardRef.current?.contains(target)) return;
      closeNow();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeNow]);

  // Timer cleanup.
  useEffect(() => () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  const capped = depth >= MAX_DEPTH;
  const inAppendix = useContext(AppendixContext);
  const interactive = !capped && !inAppendix;

  // Inside a glossary appendix, references become anchor links to the entry's
  // row instead of nested tooltips.
  if (inAppendix) {
    const linked = ctx?.byId.get(id);
    if (!linked) return <span className={className}>{display}</span>;
    return (
      <a
        href={`#glossary-${linked.id}`}
        title={linked.term}
        className={cn("text-accent underline underline-offset-4 hover:text-primary", className)}
      >
        {display}
      </a>
    );
  }

  const triggerProps = interactive
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-expanded": open,
        "aria-describedby": open ? tipId : undefined,
        onMouseEnter: scheduleOpen,
        onMouseLeave: scheduleClose,
        onFocus: () => openNow(),
        onBlur: (e: React.FocusEvent) => {
          const next = e.relatedTarget as Node | null;
          if (next && (wrapperRef.current?.contains(next) || cardRef.current?.contains(next))) return;
          scheduleClose();
        },
        onClick: () => openNow(),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            closeNow();
          } else if ((e.key === "Enter" || e.key === " ") && !open) {
            e.preventDefault();
            openNow(true);
          }
        },
      }
    : {};

  // Unknown id or no provider: render plain text. All hooks above ran
  // unconditionally — this branch only affects markup.
  if (!ctx || !entry) {
    return <span className={cn("text-foreground/85", className)}>{display}</span>;
  }

  return (
    <span
      ref={wrapperRef}
      className="relative inline"
      onMouseEnter={interactive ? scheduleOpen : undefined}
      onMouseLeave={interactive ? scheduleClose : undefined}
    >
      <span
        ref={triggerRef}
        {...triggerProps}
        className={cn(
          "border-b border-dotted",
          interactive ? "border-primary/50 text-foreground/85 hover:text-primary focus-visible:text-primary cursor-help" : "text-foreground/70",
          className
        )}
      >
        {display}
      </span>
      {open &&
        createPortal(
          <DepthContext.Provider value={depth + 1}>
            <span
              ref={cardRef}
              role="tooltip"
              id={tipId}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  closeNow();
                  triggerRef.current?.focus({ preventScroll: true });
                }
              }}
              onMouseEnter={interactive ? () => window.clearTimeout(closeTimer.current) : undefined}
              onMouseLeave={interactive ? scheduleClose : undefined}
              className={cn(
                "fixed z-50 block w-72 max-w-[calc(100vw-1rem)] rounded-sm border border-white/15 bg-popover p-3 shadow-2xl outline-none motion-reduce:transition-none",
                "transition-opacity duration-150",
                pos === null && "invisible"
              )}
              style={
                pos
                  ? { left: pos.left, top: pos.top, maxHeight: "min(60vh, 20rem)", overflowY: "auto" }
                  : { visibility: "hidden" }
              }
            >
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-primary/90">
                {entry.term}
              </span>
              <span className="block text-[11px] font-mono leading-relaxed text-foreground/70">
                {entry.definition}
              </span>
            </span>
          </DepthContext.Provider>,
          document.body
        )}
    </span>
  );
}

/**
 * The glossary appendix: every entry rendered as an anchored row, placed
 * after the last chapter. Entries default to the provider's declarations —
 * define them once and the appendix follows automatically; pass `entries`
 * explicitly to override or to render without a provider. Inside it, <Term>
 * references resolve to in-page anchor links instead of tooltips.
 *
 * Customization hooks: `intro`/`footer` render arbitrary nodes around the
 * grid, `renderEntry` replaces the whole row renderer, `className` and
 * `entryClassName` style the section and each row. Opt out of the appendix
 * entirely by not rendering it.
 */
export function GlossaryAppendix({
  entries,
  title = "Glossary",
  intro,
  footer,
  columns = 2,
  bare = false,
  className,
  entryClassName,
  renderEntry,
}: {
  /** Override the row list; defaults to the provider's entries. */
  entries?: GlossaryEntry[];
  title?: string;
  /** Rendered between the title and the grid — an introduction, usage notes, scope, … */
  intro?: ReactNode;
  /** Rendered after the grid. */
  footer?: ReactNode;
  columns?: 1 | 2;
  /** Omit the section chrome (title/border) — the host provides its own. */
  bare?: boolean;
  className?: string;
  entryClassName?: string;
  /** Replace the default row renderer entirely. */
  renderEntry?: (entry: GlossaryEntry) => ReactNode;
}) {
  const ctxEntries = useContext(GlossaryContext)?.entries;
  const list = entries ?? ctxEntries;

  if (!list || list.length === 0) return null;

  const grid = (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-10 gap-y-8",
        columns === 2 ? "xl:grid-cols-2" : "grid-cols-1"
      )}
    >
      {list.map((entry) =>
        renderEntry ? (
          <div key={entry.id} id={`glossary-${entry.id}`} className="scroll-mt-40">
            {renderEntry(entry)}
          </div>
        ) : (
          <div key={entry.id} id={`glossary-${entry.id}`} className={cn("scroll-mt-40", entryClassName)}>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-primary/90 mb-1.5">
              {entry.term}
            </h3>
            <div className="text-[12px] font-mono text-foreground/60 leading-relaxed [&_strong]:text-foreground/80">
              {entry.definition}
            </div>
          </div>
        )
      )}
    </div>
  );

  const body = (
    <>
      {intro && (
        <div className="mb-8 text-[12px] font-mono text-foreground/55 leading-relaxed max-w-3xl [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4">
          {intro}
        </div>
      )}
      {grid}
      {footer && <div className="mt-8">{footer}</div>}
    </>
  );

  if (bare) {
    return <AppendixContext.Provider value={true}>{body}</AppendixContext.Provider>;
  }
  return (
    <AppendixContext.Provider value={true}>
      <section aria-label={title} className={cn("mt-16 border-t border-white/10 pt-10", className)}>
        <p className="text-[11px] font-mono uppercase tracking-widest text-foreground/40 mb-6">{title}</p>
        {body}
      </section>
    </AppendixContext.Provider>
  );
}


"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { flattenChapters } from "./flatten";
import { defaultTheme, type StepwiseTheme } from "./theme";
import { useFocusTrap } from "./use-focus-trap";
import type { Chapter, ShortcutItem, StepTone, TourStepInput } from "./types";

// Back-compat re-exports: the default theme maps, injectable per component.
export const TONE_SEGMENT_CLASS = defaultTheme.toneSegment;
export const TONE_CHIP_CLASS = defaultTheme.toneChip;

// ─── Internal button (replaces external UI-kit imports) ─────────────────────

const BTN_BASE = defaultTheme.buttonBase;
const BTN_GHOST = defaultTheme.buttonVariants.ghost;
const BTN_OUTLINE = defaultTheme.buttonVariants.outline;
const BTN_PRIMARY = defaultTheme.buttonVariants.primary;

function StepButton({
  variant = "ghost",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "outline" | "primary" }) {
  const variantClass =
    variant === "outline" ? BTN_OUTLINE : variant === "primary" ? BTN_PRIMARY : BTN_GHOST;
  return <button type="button" {...props} className={cn(BTN_BASE, variantClass, className)} />;
}

// ─── Code block ──────────────────────────────────────────────────────────────

export function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-[11px] leading-5 overflow-x-auto">
      {lines.map((line, i) => {
        const commentStart = line.indexOf("//");
        if (commentStart === 0) {
          return (
            <div key={i} className="whitespace-pre text-foreground/35">
              {line}
            </div>
          );
        }
        if (commentStart > 0) {
          return (
            <div key={i} className="whitespace-pre">
              <span className="text-foreground/85">{line.slice(0, commentStart)}</span>
              <span className="text-foreground/35">{line.slice(commentStart)}</span>
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre text-foreground/85">
            {line}
          </div>
        );
      })}
    </div>
  );
}

// ─── Scrubber + player bar ───────────────────────────────────────────────────

export interface ScrubberLabels {
  /** aria-label for the slider. */
  scrubber?: string;
  /** aria-valuetext for the current position. Receives the frame index. */
  frame?: (i: number) => string;
}

export function StepScrubber({
  count,
  index,
  toneAt,
  titleAt,
  onSeek,
  emptyHint,
  className,
  theme = defaultTheme,
  labels,
}: {
  count: number;
  index: number;
  toneAt?: (i: number) => StepTone;
  titleAt?: (i: number) => string;
  onSeek: (i: number) => void;
  emptyHint?: string;
  className?: string;
  theme?: StepwiseTheme;
  labels?: ScrubberLabels;
}) {
  const onKey = (e: React.KeyboardEvent) => {
    if (count === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      onSeek(Math.min(count - 1, index + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      onSeek(Math.max(0, index - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      e.stopPropagation();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      e.stopPropagation();
      onSeek(count - 1);
    }
  };

  if (count === 0) {
    return (
      <div className={cn("flex-1 flex items-center min-w-0", className)}>
        {emptyHint && <span className="text-xs font-mono text-foreground/40 px-2">{emptyHint}</span>}
      </div>
    );
  }

  const valueText = labels?.frame ? labels.frame(index) : (titleAt?.(index) ?? `frame ${index + 1} of ${count}`);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={labels?.scrubber ?? "Frames"}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      aria-valuetext={valueText}
      aria-orientation="horizontal"
      onKeyDown={onKey}
      className={cn(
        "flex-1 flex items-center gap-[3px] min-w-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm",
        className
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          title={titleAt ? titleAt(i) : `frame ${i + 1}`}
          onClick={() => onSeek(i)}
          className={cn(
            "h-3.5 flex-1 min-w-[3px] rounded-[2px] transition-all cursor-pointer",
            theme.toneSegment[toneAt?.(i) ?? "neutral"],
            i === index && "ring-2 ring-primary scale-y-150"
          )}
        />
      ))}
    </div>
  );
}

export function PlayerBar({
  player,
  toneAt,
  titleAt,
  leading,
  onEmpty,
  emptyHint,
  className,
  theme,
  labels,
}: {
  player: {
    total: number;
    index: number;
    playing: boolean;
    atEnd: boolean;
    next: (onEmpty?: () => void) => void;
    prev: () => void;
    toggle: (onEmpty?: () => void) => void;
    seek: (frame: number) => void;
  };
  toneAt?: (i: number) => StepTone;
  titleAt?: (i: number) => string;
  leading?: ReactNode;
  /** Fired when the user plays/steps with no timeline loaded. */
  onEmpty?: () => void;
  emptyHint?: string;
  className?: string;
  theme?: StepwiseTheme;
  labels?: {
    previous?: string;
    play?: string;
    pause?: string;
    replay?: string;
    next?: string;
  };
}) {
  const L = {
    previous: labels?.previous ?? "Previous step",
    play: labels?.play ?? "Play",
    pause: labels?.pause ?? "Pause",
    replay: labels?.replay ?? "Replay",
    next: labels?.next ?? "Next step",
  };
  const playLabel = player.playing ? L.pause : player.total > 0 && player.atEnd ? L.replay : L.play;

  return (
    <div className={cn("flex items-center gap-2 p-2", className)}>
      {leading}
      <StepButton variant="ghost" onClick={() => player.prev()} className="h-7 px-2 text-xs" aria-label={L.previous}>
        ←
      </StepButton>
      <StepButton variant="outline" onClick={() => player.toggle(onEmpty)} className="h-7 px-3.5 text-[11px]">
        {playLabel}
      </StepButton>
      <StepButton variant="ghost" onClick={() => player.next(onEmpty)} className="h-7 px-2 text-xs" aria-label={L.next}>
        →
      </StepButton>
      <StepScrubber
        count={player.total}
        index={player.index}
        toneAt={toneAt}
        titleAt={titleAt}
        onSeek={(i) => player.seek(i)}
        emptyHint={emptyHint}
        theme={theme}
      />
      <span className="text-[10px] font-mono text-foreground/40 w-11 text-right shrink-0">
        {player.total > 0 ? `${player.index + 1}/${player.total}` : "—"}
      </span>
    </div>
  );
}

// ─── Chapter navigation ──────────────────────────────────────────────────────

export function ChapterNav({
  chapters,
  active,
  onNavigate,
  hint,
  className,
}: {
  chapters: Chapter[];
  active: number;
  onNavigate: (i: number) => void;
  hint?: string;
  className?: string;
}) {
  const flat = flattenChapters(chapters);

  const renderRow = (items: Chapter[], depth: number): ReactNode => {
    const indent = "— ".repeat(depth);
    return items.map((chapter) => {
      const flatIndex = flat.findIndex((f) => f.chapter.id === chapter.id);
      const isActive = flatIndex === active;
      return (
        <div key={chapter.id} className={cn("flex items-center", depth > 0 && "gap-1")}>
          <StepButton
            type="button"
            onClick={() => onNavigate(flatIndex)}
            aria-current={isActive ? "true" : undefined}
            title={chapter.hint ?? chapter.label}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono border transition-colors cursor-pointer whitespace-nowrap",
              depth > 0 && "px-2 text-[10px] border-transparent",
              isActive
                ? depth === 0
                  ? "border-primary/50 text-primary bg-primary/10"
                  : "text-primary bg-primary/5"
                : depth === 0
                  ? "border-transparent text-foreground/50 hover:text-foreground hover:border-white/15"
                  : "text-foreground/45 hover:text-foreground"
            )}
          >
            {depth === 0 && chapter.numbered !== false && (
              <span className={cn("text-[9px]", isActive ? "text-primary/80" : "text-foreground/30")}>
                {String(flatIndex + 1).padStart(2, "0")}
              </span>
            )}
            {depth > 0 && <span className="text-foreground/25">{indent}</span>}
            {chapter.label}
          </StepButton>
          {chapter.children && chapter.children.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">{renderRow(chapter.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <nav
      aria-label="Chapters"
      className={cn(
        "sticky top-20 md:top-24 z-30 rounded-sm border border-white/10 bg-background/85 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className="p-1.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="shrink-0 px-2 text-[9px] font-mono uppercase tracking-widest text-foreground/30">
            Chapters
          </span>
          {renderRow(chapters, 0)}
        </div>
        {hint && (
          <div className="flex justify-end px-2 pt-1.5">
            <span className="text-[10px] font-mono text-foreground/30 hidden md:inline">{hint}</span>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Lesson pager (cross-page chapter navigation) ────────────────────────────

export function LessonPager({
  prev,
  next,
  onNavigate,
  className,
  labels,
}: {
  prev?: { label: string; hint?: string };
  next?: { label: string; hint?: string };
  onNavigate: (dir: "prev" | "next") => void;
  className?: string;
  labels?: { previous?: string; next?: string };
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StepButton
        variant="outline"
       
        onClick={() => onNavigate("prev")}
        disabled={!prev}
        title={prev?.hint ?? prev?.label}
        className="h-9 px-3 text-[11px]"
        aria-label={prev ? `${labels?.previous ?? "Previous lesson"}: ${prev.label}` : "No previous lesson"}
      >
        ← {prev?.label ?? "—"}
      </StepButton>
      <StepButton
        variant="outline"
       
        onClick={() => onNavigate("next")}
        disabled={!next}
        title={next?.hint ?? next?.label}
        className="h-9 px-3 text-[11px] ml-auto"
        aria-label={next ? `${labels?.next ?? "Next lesson"}: ${next.label}` : "No next lesson"}
      >
        {next?.label ?? "—"} →
      </StepButton>
    </div>
  );
}

// ─── Guided tour ─────────────────────────────────────────────────────────────

export function TourSpotlight({ target }: { target: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    // The target may not exist yet (conditional rendering downstream) — poll
    // until it appears, then track it frame by frame.
    let el: Element | null = null;
    let scrolled = false;
    let raf = 0;
    let last = "";
    const tick = () => {
      if (!el) {
        // Resolve by DOM id first (most common), then by data-tour attribute.
        el = document.getElementById(target) ?? document.querySelector(`[data-tour="${target}"]`);
        if (el && !scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
        }
      }
      if (el) {
        const r = el.getBoundingClientRect();
        const key = [r.top, r.left, r.width, r.height].map((n) => Math.round(n)).join(",");
        if (key !== last) {
          last = key;
          setRect(r);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (!rect) return null;
  const pad = 6;
  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        className="absolute rounded-sm ring-2 ring-primary/80 transition-all duration-300"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        }}
      />
    </div>
  );
}

export function TourCard({
  step,
  index,
  total,
  onNext,
  onBack,
  onEnd,
  labels,
}: {
  step: TourStepInput;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onEnd: () => void;
  labels?: {
    title?: string;
    back?: string;
    next?: string;
    finish?: string;
    end?: string;
  };
}) {
  const L = {
    title: labels?.title ?? "Guided tour",
    back: labels?.back ?? "Back",
    next: labels?.next ?? "Next",
    finish: labels?.finish ?? "Finish",
    end: labels?.end ?? "End tour",
  };
  const trapRef = useFocusTrap(true);

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${L.title} · ${index + 1}/${total}`}
      tabIndex={-1}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,26rem)] border border-primary/30 bg-background/95 backdrop-blur-md rounded-sm p-4 shadow-2xl outline-none"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-primary/70">
          {L.title} · {index + 1}/{total}
        </span>
        <StepButton
          type="button"
          onClick={onEnd}
          aria-label={L.end}
          className="text-foreground/40 hover:text-foreground cursor-pointer leading-none"
        >
          ×
        </StepButton>
      </div>
      <p className="text-sm font-bold text-foreground/95 mb-1.5">{step.title}</p>
      <div className="text-[12px] font-mono text-foreground/70 leading-relaxed">{step.body}</div>
      {step.waitHint && <p className="text-[11px] font-mono text-accent mt-2 animate-pulse">{step.waitHint}</p>}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
        <StepButton variant="outline" onClick={onBack} disabled={index === 0} className="h-7 px-3 text-[11px]">
          {L.back}
        </StepButton>
        <StepButton variant="primary" onClick={onNext} className="h-7 px-4 text-[11px] ml-auto">
          {index === total - 1 ? L.finish : L.next}
        </StepButton>
      </div>
    </div>
  );
}

// ─── Shortcuts dialog ────────────────────────────────────────────────────────

export function ShortcutsDialog({
  open,
  onClose,
  items,
  title = "Keyboard shortcuts",
}: {
  open: boolean;
  onClose: () => void;
  items: ShortcutItem[];
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-white/15 bg-card rounded-sm p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-primary">{title}</h3>
          <StepButton
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="text-foreground/40 hover:text-foreground cursor-pointer leading-none text-lg"
          >
            ×
          </StepButton>
        </div>
        <dl className="space-y-2">
          {items.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4">
              <dt>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 border border-white/20 bg-white/5 rounded-sm text-foreground/80">
                  {s.keys}
                </kbd>
              </dt>
              <dd className="font-mono text-[11px] text-foreground/60 text-right">{s.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}






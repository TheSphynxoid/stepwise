"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { TONE_CHIP_CLASS, useGlobalKeys } from "@sphynxoid/stepwise";
import {
  settledAnswer,
  usePromptHistory,
  usePrompts,
  type WalkSimulation,
  type WalkStep,
} from "@sphynxoid/stepwise/experimental";

// A text adventure is a walk whose choice points are prompts. The generator
// yields a scene with a `prompt` and receives the reader's command as the
// value of that `yield`, so the story branches on it. Prompts with options are
// picked commands; the one without options is typed (free text). None is
// judged: any answer is fine, and `retries: Infinity` lets the reader go Back
// and choose again, which replays the story from there. usePromptHistory keeps
// the futures a changed answer cut off, so they can be taken again.

type Scene = WalkStep & { text: string };

const COMMANDS: Record<string, string> = {
  climb: "climb the stairs",
  log: "read the logbook",
  cellar: "go down to the cellar",
  flash: "flash the lamp three times",
  steady: "keep the beam steady",
};
const commands = (...values: string[]) => values.map((value) => ({ value, label: COMMANDS[value] }));

const night: WalkSimulation<null, Scene, string> = function* () {
  yield { key: "dusk", tone: "neutral", label: "Dusk", text: "Dusk. The lamp at the top of the tower is dark, and a storm is rolling in from the sea." };
  const first = yield {
    key: "door",
    tone: "accent",
    label: "The tower",
    text: "You stand inside the tower door. Stairs wind up into the dark; the keeper's logbook lies open on a desk.",
    prompt: { id: "door", options: commands("climb", "log") },
  };
  let spare = false;
  if (first === "log") {
    yield { key: "log", tone: "neutral", label: "The logbook", text: "The last entry, in a hurried hand: “Lens cracked. Spare in the cellar.”" };
    const down = yield {
      key: "trapdoor",
      tone: "accent",
      label: "The trapdoor",
      text: "A trapdoor beside the desk leads down to the cellar.",
      prompt: { id: "trapdoor", options: commands("cellar", "climb") },
    };
    if (down === "cellar") {
      spare = true;
      yield { key: "cellar", tone: "good", label: "The cellar", text: "Behind a crate, wrapped in oilcloth: a spare lens. You carry it up the stairs." };
    }
  }
  yield spare
    ? { key: "top", tone: "good", label: "The lamp room", text: "You reach the lamp room and fit the spare lens. The beam sweeps out over the water, sharp and clean." }
    : { key: "top", tone: "bad", label: "The lamp room", text: "You reach the lamp room and light the lamp. The lens is cracked: the beam breaks into a weak, scattered glow." };
  const name = yield {
    key: "radio",
    tone: "accent",
    label: "The radio",
    text: "The radio crackles. A small boat is out in the storm: “Lighthouse, who keeps the light tonight?”",
    prompt: { id: "name" },
  };
  yield { key: "reply", tone: "neutral", label: "The boat", text: `“${name}, we hear you. We're looking for your beam.”` };
  const signal = yield {
    key: "signal",
    tone: "accent",
    label: "The rocks",
    text: "Through the rain you see the boat's lantern, drifting toward the rocks.",
    prompt: { id: "signal", options: commands("flash", "steady") },
  };
  if (spare) {
    yield signal === "flash"
      ? { key: "end", tone: "good", label: "Morning", text: "The boat sees your three flashes, turns hard, and slips into the harbour. Morning comes quietly." }
      : { key: "end", tone: "good", label: "Morning", text: "The clean, steady beam is enough: the boat finds the channel and ties up at dawn." };
  } else {
    yield signal === "flash"
      ? { key: "end", tone: "neutral", label: "Morning", text: "Your flashes scatter in the cracked lens. The boat hesitates, then follows the bell buoy in. It makes harbour, barely." }
      : { key: "end", tone: "bad", label: "Morning", text: "The weak glow is lost in the rain. The boat drops anchor beyond the rocks and waits out the night." };
  }
};

/** How an answer reads in the story: a picked command by its label, a typed one in quotes. */
const said = (answer: string | undefined) => (answer === undefined ? "…" : (COMMANDS[answer] ?? `“${answer}”`));

export default function AdventureDemo() {
  const run = usePrompts({ simulation: night, input: null }, { retries: Infinity, autoContinue: true });
  const history = usePromptHistory(run);
  const { player, steps, active, record } = run;
  const at = Math.max(player.index, 0);
  const [draft, setDraft] = useState("");

  const answerAt = (frame: number) => {
    const entry = record.entries.find((e) => e.frame === frame);
    return entry ? settledAnswer(entry) : undefined;
  };
  // The path's answers, in order; another kept path is one that leaves it somewhere.
  const path = record.entries.filter((e) => e.source === "generator" && e.settled).map((e) => settledAnswer(e));
  const others = history.branches.filter((b) => b.some((a, i) => i < path.length && a !== path[i]));

  const blocked = active !== null && !active.entry.settled;
  const atEnd = at >= steps.length - 1;
  const next = () => player.next();
  const back = () => player.prev();
  useGlobalKeys({ ArrowRight: next, ArrowLeft: back });

  const say = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    run.respond(text);
    setDraft("");
  };

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">Demo - Prompts (experimental)</p>
        <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">A night at the lighthouse</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-6 sw-fade-up sw-fade-up-2">
          A short text adventure on <code className="text-primary">usePrompts</code>: no scrubber, just Next and Back. The
          story is a generator; each command you pick (or type) is the value of a <code className="text-primary">yield</code>,
          so the story branches on it. Go Back to an earlier question and choose again: the story is replayed from there, and{" "}
          <code className="text-primary">usePromptHistory</code> keeps the path you left, so you can take it again.
        </p>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm mb-4" data-testid="adventure">
          <ol className="space-y-3 mb-4" aria-label="Story so far">
            {steps.slice(0, at + 1).map((s, i) => {
              const current = i === at;
              const answer = s.prompt && i < at ? answerAt(i) : undefined;
              return (
                <li key={s.key} className={current ? "" : "opacity-55"} data-testid={current ? "adv-current" : undefined} aria-current={current ? "step" : undefined}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${TONE_CHIP_CLASS[s.tone]}`}>{s.label}</span>
                  </div>
                  <p className="text-[14px] leading-relaxed">{s.text}</p>
                  {answer !== undefined && <p className="mt-1 text-[12px] font-mono text-primary">&gt; {said(answer)}</p>}
                </li>
              );
            })}
          </ol>

          {active && active.prompt.options && (
            <div role="group" aria-label="Your command" className="flex flex-wrap gap-2 mb-4">
              {active.prompt.options.map((o) => {
                const { value, label } = typeof o === "string" ? { value: o, label: o } : o;
                const chosen = active.entry.settled && answerAt(active.frame) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => run.respond(value)}
                    className={`rounded-md border px-3 py-1.5 text-[12px] font-mono transition ${
                      chosen ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground/70 hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    &gt; {label}
                  </button>
                );
              })}
            </div>
          )}
          {active && !active.prompt.options && (
            <form onSubmit={say} className="flex flex-wrap items-center gap-2 mb-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 24))}
                aria-label="Your reply"
                placeholder={active.entry.settled ? `You said ${said(answerAt(active.frame))}` : "Type a name…"}
                className="flex-1 min-w-40 rounded-md border border-border bg-background/40 px-3 py-1.5 text-[13px] font-mono"
              />
              <button type="submit" disabled={!draft.trim()} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-mono text-primary-foreground disabled:opacity-40">
                Say it
              </button>
            </form>
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={back} disabled={at === 0} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[12px] font-mono disabled:opacity-40">
              <ChevronLeft size={14} /> Back
            </button>
            <button type="button" onClick={next} disabled={blocked || atEnd} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[12px] font-mono disabled:opacity-40">
              Next <ChevronRight size={14} />
            </button>
            {atEnd && !blocked && (
              <button type="button" onClick={run.restart} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[12px] font-mono">
                <RotateCcw size={12} /> Start over
              </button>
            )}
            <span className="ml-auto text-[10px] font-mono text-muted-foreground hidden sm:inline">← → back / next</span>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm" data-testid="adv-history" aria-label="Other paths you took">
          <h2 className="text-[13px] font-semibold mb-1">Other paths you took</h2>
          <p className="text-[11px] text-muted-foreground mb-3">
            {history.backtracks === 0
              ? "Go Back to a question and choose differently: the path you leave is kept here."
              : `You changed your mind ${history.backtracks} ${history.backtracks === 1 ? "time" : "times"}.`}
          </p>
          {others.length > 0 && (
            <ul className="space-y-2">
              {others.map((b) => (
                <li key={b.map(said).join("|")} className="flex flex-wrap items-center gap-2 text-[12px] font-mono">
                  <span className="text-foreground/70">{b.map(said).join(" → ")}</span>
                  <button type="button" onClick={() => history.restore(b)} className="ml-auto rounded-md border border-border px-2 py-1 text-[11px] hover:border-primary/40">
                    Take this path again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

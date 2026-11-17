"use client";

import { useExplainer } from "@sphynxoid/stepwise/kit";
import { LINES, discount } from "./driftwood";
import { ROW_SETS, ROW_SET_NAMES, ruleName, type DecisionInput, type DecisionStep } from "./decisions.explainer";
import { DECISIONS, SUITE_NAMES, type MutationInput, type MutationStep } from "./mutation.explainer";
import { Frame, Mark, Segmented } from "./views";

// Views for §03 (decision tables) and §04 (coverage vs mutation).

// ─── §03 Decision tables ─────────────────────────────────────────────

const yes = (v: boolean) => <span className={v ? "text-foreground" : "text-muted-foreground/40"}>{v ? "Y" : "-"}</span>;

export function DecisionView() {
  const { step, input, setInput } = useExplainer<DecisionInput, DecisionStep>();
  if (!step) return null;
  const all = ROW_SETS[input.rows];
  const found = step.rows.some((r) => r.diff);
  // The row under test is the next one to run (pick) or the one just run (row).
  const currentIndex = step.kind === "pick" ? step.rows.length : step.kind === "row" ? step.rows.length - 1 : -1;
  return (
    <Frame
      title="discounts · decision table"
      tone={step.tone}
      status={<span data-testid="dt-verdict">{found ? "bug found" : `${step.rows.length}/${all.length} rows run`}</span>}
      label={`Decision table with ${all.length} rows; ${step.rows.length} run`}
      controls={
        <Segmented label="Rows" value={input.rows} options={ROW_SET_NAMES} onChange={(rows) => setInput({ rows })} format={(r) => (r === "all" ? "all 8" : "pairwise (4)")} />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] font-mono text-[12px]">
          <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">#</th>
              <th className="font-normal">member</th>
              <th className="font-normal">promo</th>
              <th className="font-normal">weekday</th>
              <th className="font-normal">expected</th>
              <th className="font-normal">shipped</th>
              <th className="text-right font-normal">result</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r, i) => {
              const run = step.rows[i];
              const current = i === currentIndex;
              return (
                <tr
                  key={i}
                  className={`border-t border-border/60 transition-colors ${current ? "bg-primary/[0.08]" : ""} ${run?.diff ? "text-destructive" : ""} ${!run && !current ? "opacity-45" : ""}`}
                >
                  <td className="py-1.5 text-muted-foreground">R{i + 1}</td>
                  <td>{yes(r.member)}</td>
                  <td>{yes(r.promo)}</td>
                  <td>{yes(r.weekday)}</td>
                  <td>{run || current ? `${discount(r, "spec")}%` : ""}</td>
                  <td>{run ? `${run.shipped}%` : ""}</td>
                  <td className="text-right">{run ? <Mark pass={!run.diff} /> : current ? <span className="text-primary">▶</span> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[10.5px] text-muted-foreground">
        {input.rows === "pairwise"
          ? "R1-R4 cover every pair of values for every pair of conditions. Y Y Y is not among them."
          : "Every combination: 2³ = 8 rows."}{" "}
        Current rule: {step.current ? ruleName(step.current) : "none"}
      </p>
    </Frame>
  );
}

// ─── §04 Coverage vs mutation ────────────────────────────────────────

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10.5px]">
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${value}%` }} />
      </span>
      <span className="w-9 text-right">{value}%</span>
    </div>
  );
}

export function MutationView() {
  const { step, input, setInput } = useExplainer<MutationInput, MutationStep>();
  if (!step) return null;
  const killed = step.mutants.filter((m) => m.status === "killed").length;
  const tested = step.mutants.filter((m) => m.status !== "pending").length;
  const branchHit = (id: string, side: "T" | "F") => step.branches.includes(`${id}:${side}`);
  return (
    <Frame
      title={`mutation · ${input.suite} suite`}
      tone={step.tone}
      status={tested ? <span data-testid="mut-score">{`${killed}/${tested} killed`}</span> : "coverage run"}
      label={`Coverage ${step.lineCoverage}% lines, ${step.branchCoverage}% branches; ${killed} of ${tested} mutants killed`}
      controls={<Segmented label="Suite" value={input.suite} options={SUITE_NAMES} onChange={(suite) => setInput({ suite })} />}
    >
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0">
          <div className="overflow-x-auto rounded-lg border border-border bg-background/60 py-2 font-mono text-[11px] leading-[1.7]">
            <div className="min-w-max">
            {LINES.map((l) => {
              const hit = step.lines.includes(l.id);
              const hot = step.hot.includes(l.id);
              const isDecision = (DECISIONS as readonly string[]).includes(l.id);
              return (
                <div key={l.id} className={`flex gap-2 px-2 ${hot ? "bg-primary/10" : ""}`}>
                  <span className={`w-1 shrink-0 rounded-sm ${hit ? "bg-accent" : "bg-destructive/40"}`} aria-hidden />
                  <span className="w-4 shrink-0 text-muted-foreground">{l.id.slice(1)}</span>
                  <span className={`whitespace-pre ${hit ? "text-foreground/85" : "text-foreground/40"}`}>{l.text}</span>
                  {isDecision && (
                    <span className="ml-auto shrink-0 pl-2 text-[9.5px] text-muted-foreground" title="branch outcomes taken">
                      <span className={branchHit(l.id, "T") ? "text-accent" : ""}>T</span>
                      <span className={branchHit(l.id, "F") ? "text-accent" : ""}>F</span>
                    </span>
                  )}
                </div>
              );
            })}
            </div>
          </div>
          <div className="mt-3 space-y-1.5" data-testid="mut-coverage">
            <Meter label="lines" value={step.lineCoverage} />
            <Meter label="branches" value={step.branchCoverage} />
            <span className="sr-only">{`${step.lineCoverage}% lines, ${step.branchCoverage}% branches`}</span>
          </div>
        </div>
        <div className="space-y-3 font-mono text-[11px]">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">tests ({step.tests.length})</p>
            <ul className="space-y-0.5">
              {step.tests.map((t) => (
                <li key={t.name} className={t.pass ? "text-foreground/75" : "text-destructive"}>
                  <Mark pass={t.pass} className="mr-1.5" />
                  {t.name}
                </li>
              ))}
              {step.tests.length === 0 && <li className="text-muted-foreground">none run yet</li>}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">mutants</p>
            <ul className="space-y-0.5">
              {step.mutants.map((m) => (
                <li
                  key={m.id}
                  className={`flex justify-between gap-2 ${step.current === m.id ? "text-primary" : m.status === "survived" ? "text-destructive" : "text-foreground/75"}`}
                >
                  <span>{m.label}</span>
                  <span className="shrink-0">{m.status === "pending" ? (step.current === m.id ? "?" : "") : m.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Frame>
  );
}

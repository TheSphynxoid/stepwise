"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useGuidedTour, TourSpotlight, TourCard, type TourStepInput } from "@sphynx/stepwise";
import { useSiteTheme } from "../theme-provider";
import { useState } from "react";

const STEPS: TourStepInput[] = [
  {
    id: "s1",
    title: "Create a repository",
    body: (
      <>
        Start by creating a Git repository. Every project lives inside one - it
        tracks your files and their history. The <strong>.git</strong> folder is
        the database.
      </>
    ),
    target: "tour-repo",
  },
  {
    id: "s2",
    title: "Stage your changes",
    body: (
      <>
        Before committing, you stage the files you want to include. Think of
        staging as packing a box - only what&apos;s inside gets shipped.
      </>
    ),
    target: "tour-stage",
    waitHint: "try clicking the Stage button - or press Next",
  },
  {
    id: "s3",
    title: "Commit and push",
    body: (
      <>
        A commit is a snapshot of your staged changes with a descriptive
        message. Pushing sends your commits to a remote - sharing your work
        with others.
      </>
    ),
    target: "tour-commit",
  },
  {
    id: "s4",
    title: "That's the loop",
    body: (
      <>
        Create -&gt; stage -&gt; commit -&gt; push. Every collaboration tool you use is
        a variation on this cycle. This tour can restart anytime.
      </>
    ),
  },
];

export default function TourDemo() {
  const tour = useGuidedTour(STEPS);
  const { theme } = useSiteTheme();
  const [stageState, setStageState] = useState("clean");

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-6">
        <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft size={14} /> Back to demos
        </Link>
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">
          Demo - Guided Tour
        </p>
        <h1 className="text-2xl font-bold mb-6 sw-fade-up sw-fade-up-1">Git workflow walkthrough</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-8 sw-fade-up sw-fade-up-2">
          A four-step tour of the Git workflow with spotlight targeting, focus-trapped
          narration, and keyboard navigation. Click &quot;Start tour&quot; - the spotlight
          moves as you step through each stage.
        </p>

        <div className="space-y-4">
          {[
            { id: "tour-repo", n: 1, title: "Create", body: "Initialize a repository in your project directory. This creates the .git folder that tracks all changes." },
            { id: "tour-stage", n: 2, title: "Stage", body: null },
            { id: "tour-commit", n: 3, title: "Commit", body: "Snapshot the staged changes with a descriptive message. The commit becomes part of the project's history." },
          ].map((card, i) => (
            <div
              key={card.id}
              id={card.id}
              className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 sw-fade-up"
              style={{ animationDelay: `${0.1 + i * 0.08}s` }}
            >
              <h2 className="text-sm font-semibold text-primary mb-1">
                {card.n}. {card.title}
              </h2>
              {card.id === "tour-stage" ? (
                <>
                  <p className="text-[12px] text-foreground/60 mb-2">
                    Select which changes to include in the next commit. Current state:{" "}
                    <span className="text-accent font-mono">{stageState}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setStageState(stageState === "clean" ? "staged" : "clean")}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-md border border-border text-foreground/60 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    {stageState === "clean" ? "Stage files" : "Unstage"}
                  </button>
                </>
              ) : (
                <p className="text-[12px] text-foreground/60">{card.body}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3 sw-fade-up sw-fade-up-4">
          <button
            type="button"
            onClick={tour.start}
            className="h-9 px-5 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition cursor-pointer shadow-lg shadow-primary/20"
          >
            Start tour
          </button>
          <span className="text-[10px] font-mono text-foreground/30">
            the spotlight follows each step&apos;s target element
          </span>
        </div>
      </div>

      {tour.active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight target={tour.current.target ?? null} theme={theme} />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={STEPS.length}
            onNext={tour.next}
            onBack={tour.back}
            onEnd={tour.end}
            theme={theme}
          />
        </>
      )}
    </main>
  );
}
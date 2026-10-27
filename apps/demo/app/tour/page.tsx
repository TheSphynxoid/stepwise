"use client";

import { useGuidedTour, TourSpotlight, TourCard, useGlobalKeys, type TourStepInput } from "@sphynx/stepwise";
import { useState } from "react";

const STEPS: TourStepInput[] = [
  {
    id: "s1",
    title: "Create a repository",
    body: "Start by creating a Git repository. Every project lives inside one — it tracks your files and their history.",
    target: "tour-repo",
  },
  {
    id: "s2",
    title: "Stage your changes",
    body: "Before committing, you stage the files you want to include. Think of staging as packing a box — only what's inside gets shipped.",
    target: "tour-stage",
    onEnter: () => {
      const el = document.getElementById("tour-stage");
      if (el) el.classList.add("ring-2", "ring-primary", "bg-primary/10");
    },
  },
  {
    id: "s3",
    title: "Commit and push",
    body: "A commit is a snapshot of your staged changes. Pushing sends your commits to a remote — sharing your work with others.",
    target: "tour-commit",
  },
];

export default function TourDemo() {
  const tour = useGuidedTour(STEPS);
  const [stageState, setStageState] = useState("clean");

  return (
    <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">Demo — Guided Tour</p>
        <h1 className="text-2xl font-bold mb-6">Git workflow walkthrough</h1>
        <p className="text-[13px] text-foreground/60 leading-relaxed mb-8">
          A three-step tour of the Git workflow. Click &quot;Start tour&quot; to walk through each stage
          with a spotlight highlighting the relevant card.
        </p>

        <div className="space-y-4">
          <div id="tour-repo" className="border border-border rounded-md p-4 bg-card transition-all duration-200">
            <h2 className="text-sm font-semibold text-primary mb-1">1. Create</h2>
            <p className="text-[12px] text-foreground/60">
              Initialize a repository in your project directory. This creates the .git folder that
              tracks all changes.
            </p>
          </div>

          <div id="tour-stage" className="border border-border rounded-md p-4 bg-card transition-all duration-200">
            <h2 className="text-sm font-semibold text-primary mb-1">2. Stage</h2>
            <p className="text-[12px] text-foreground/60 mb-2">
              Select which changes to include in the next commit. Current state: <span className="text-accent font-mono">{stageState}</span>
            </p>
            <button
              type="button"
              onClick={() => setStageState(stageState === "clean" ? "staged" : "clean")}
              className="text-[11px] font-mono px-2 py-1 rounded border border-border text-foreground/60 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
            >
              {stageState === "clean" ? "Stage files" : "Unstage"}
            </button>
          </div>

          <div id="tour-commit" className="border border-border rounded-md p-4 bg-card transition-all duration-200">
            <h2 className="text-sm font-semibold text-primary mb-1">3. Commit</h2>
            <p className="text-[12px] text-foreground/60">
              Snapshot the staged changes with a descriptive message. The commit becomes part of the
              project&apos;s history.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={tour.start}
            className="h-8 px-4 text-[11px] font-mono rounded border border-primary/40 bg-background/40 text-foreground/85 hover:border-primary/70 hover:text-foreground transition-colors cursor-pointer"
          >
            Start tour
          </button>
        </div>
      </div>

      {tour.active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight target={tour.current.target ?? null} />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={STEPS.length}
            onNext={tour.next}
            onBack={tour.back}
            onEnd={tour.end}
          />
        </>
      )}
    </main>
  );
}

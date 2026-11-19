"use client";

import { useState } from "react";
import { useGuidedTour, TourSpotlight, TourCard, fail, type TourStepInput } from "@sphynxoid/stepwise";
import { useSiteTheme } from "../../theme-provider"; // demo-only

export function CounterTour() {
  const { theme } = useSiteTheme(); // demo-only
  const [count, setCount] = useState(0);
  // A step's target is an element id (or a [data-tour] value). A gate keeps
  // Next disabled until the reader has actually done the thing.
  const steps: TourStepInput[] = [
    { id: "count", title: "The number", body: "This is the state the tour is about.", target: "guide-tour-count" },
    {
      id: "click",
      title: "Your turn",
      body: "Press +1 twice. Next unlocks when you have.",
      target: "guide-tour-plus",
      gate: () => count >= 2 || fail(`Pressed ${count} of 2 times.`),
    },
    { id: "done", title: "That's a tour", body: "Steps can also change app state (onEnter) or skip themselves (when)." },
  ];
  const tour = useGuidedTour(steps);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span id="guide-tour-count" className="rounded-md border border-border px-3 py-1.5 font-mono text-sm">
        count = {count}
      </span>
      <button id="guide-tour-plus" type="button" onClick={() => setCount((c) => c + 1)} className="rounded-md border border-border px-3 py-1.5 text-sm">
        +1
      </button>
      <button type="button" onClick={tour.start} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
        Start the tour
      </button>
      {tour.active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight
            target={tour.current.target ?? null}
            theme={theme} // demo-only
          />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={steps.length}
            onNext={tour.next}
            onBack={tour.back}
            onEnd={tour.end}
            nextDisabled={tour.blocked}
            feedback={tour.feedback}
            theme={theme} // demo-only
          />
        </>
      )}
    </div>
  );
}

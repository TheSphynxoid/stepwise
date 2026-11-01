import { useMemo } from "react";
import {
  createTrace,
  useTrace,
  useGuidedTour,
  PlayerBar,
  TourSpotlight,
  TourCard,
  type TourStepInput,
} from "@sphynxoid/stepwise";

// 1. Record a trace at module scope: run the algorithm once, snapshot each step.
const frames = (() => {
  const arr = [5, 2, 8, 1, 9, 3, 7];
  const t = createTrace<{ arr: number[]; active: number[]; done: number }>();
  t.step({ tone: "neutral", label: "Unsorted", arr: [...arr], active: [], done: arr.length });
  for (let end = arr.length - 1; end > 0; end--) {
    for (let i = 0; i < end; i++) {
      const swap = arr[i] > arr[i + 1];
      if (swap) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      t.step({
        tone: swap ? "write" : "idle",
        label: swap ? `Swap ${arr[i + 1]} and ${arr[i]}` : `${arr[i]} ≤ ${arr[i + 1]}, keep`,
        arr: [...arr],
        active: [i, i + 1],
        done: end + 1,
      });
    }
  }
  t.step({ tone: "good", label: "Sorted", arr: [...arr], active: [], done: 0 });
  return t.build();
})();

// 2. A tour is the same cursor with effects: targets are element ids.
const tourSteps: TourStepInput[] = [
  { id: "bars", title: "The frame", body: "You render each frame however you like. Here: plain divs.", target: "bars" },
  { id: "player", title: "The player", body: "Play, pause, scrub, or use the arrow buttons. The URL keeps #frame=N.", target: "player" },
];

export function App() {
  const { step, player, toneAt, titleAt } = useTrace(frames, { autoPlay: true, syncHash: "frame" });
  const tour = useGuidedTour(tourSteps);
  const max = useMemo(() => Math.max(...frames[0].arr), []);
  const cur = step!; // frame 0 until playback starts

  return (
    <main>
      <h1>Bubble sort, step by step</h1>
      <div id="bars" className="bars" role="img" aria-label={cur.label}>
        {cur.arr.map((v, i) => (
          <div
            key={i}
            className={`bar ${cur.active.includes(i) ? "active" : ""} ${i >= cur.done ? "done" : ""}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <strong>{cur.label}</strong>
      <div id="player" className="player">
        <PlayerBar player={player} toneAt={toneAt} titleAt={titleAt} />
      </div>
      <button className="start" onClick={tour.start}>Take the tour</button>

      {tour.active && tour.current && tour.index !== null && (
        <>
          <TourSpotlight target={tour.current.target ?? null} />
          <TourCard
            step={tour.current}
            index={tour.index}
            total={tourSteps.length}
            onNext={tour.next}
            onBack={tour.back}
            onEnd={tour.end}
          />
        </>
      )}
    </main>
  );
}

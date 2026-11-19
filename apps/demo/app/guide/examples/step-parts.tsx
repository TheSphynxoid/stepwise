"use client";

import { useTrace } from "@sphynxoid/stepwise";
import { ExplainerBar, Narration, StepCode, StepParts } from "@sphynxoid/stepwise/kit";
import { useSiteTheme } from "../../theme-provider"; // demo-only

const STEPS = [
  { tone: "neutral" as const, label: "Read the config file", code: ["const raw = readFile(path);"] },
  { tone: "write" as const, label: "Parse it", code: ["const config = parse(raw);"] },
  { tone: "good" as const, label: "Start the server with it", code: ["listen(config.port);"] },
];

export function Boot() {
  const { theme } = useSiteTheme(); // demo-only
  const trace = useTrace(STEPS);
  // The kit's parts, around a plain player: no explainer needed.
  return (
    <StepParts
      source={trace}
      theme={theme} // demo-only
    >
      <div className="space-y-3">
        <Narration />
        <StepCode />
        <ExplainerBar />
      </div>
    </StepParts>
  );
}

import { describe, expect, it } from "vitest";
import * as stepwise from "../index";

// The barrel is the public API. Hook tests import modules directly, so a
// missing re-export would otherwise only surface in a consumer's build.
describe("public barrel", () => {
  it("exports every runtime entry point", () => {
    const expected = [
      "useSteps",
      "useStepPlayer",
      "readHashParam",
      "writeHashParam",
      "useTrace",
      "reanchor",
      "useSimulation",
      "createRng",
      "runSimulation",
      "createTrace",
      "useSyncedTracks",
      "alignTracks",
      "useLessonStream",
      "useFadeIn",
      "useEvaluator",
      "toVerdict",
      "pass",
      "fail",
      "pending",
      "useGuidedTour",
      "useChapters",
      "flattenChapters",
      "useGlobalKeys",
      "useDiscoveries",
      "localStorageStore",
      "cookieStore",
      "memoryStore",
      "useFocusTrap",
      "usePrefersReducedMotion",
      "GlossaryProvider",
      "Term",
      "GlossaryAppendix",
      "defaultTheme",
      "ChapterNav",
      "CodeBlock",
      "LessonPager",
      "PlayerBar",
      "ShortcutsDialog",
      "StepScrubber",
      "TONE_CHIP_CLASS",
      "TONE_SEGMENT_CLASS",
      "TourCard",
      "TourSpotlight",
    ];
    const missing = expected.filter((name) => !(name in stepwise));
    expect(missing).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import * as stepwise from "../index";
import * as core from "../core";
import * as experimental from "../experimental";
import * as kit from "../kit/index";
import * as kitMdx from "../kit/mdx";

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

// The other entries, same reason: each name is a promise to a consumer.
describe("./core", () => {
  it("exports every runtime entry point", () => {
    const expected = [
      "createRng",
      "runSimulation",
      "createTrace",
      "runWalk",
      "createWalkSession",
      "fromGraph",
      "reanchor",
      "stepKey",
      "alignTracks",
      "diffTraces",
      "structuralEqual",
      "flattenChapters",
      "toVerdict",
      "pass",
      "fail",
      "pending",
      "defineExplainer",
      "precompute",
      "resolveInput",
      "EXPLAINER_PROP_NAMES",
      "normalizeOptions",
      "assertJsonInput",
    ];
    expect(expected.filter((name) => !(name in core))).toEqual([]);
  });
});

describe("./experimental", () => {
  it("exports every runtime entry point", () => {
    const expected = [
      "runWalk",
      "useWalk",
      "fromGraph",
      "diffTraces",
      "structuralEqual",
      "usePrompts",
      "EMPTY_RECORD",
      "applyAnswer",
      "canAnswer",
      "reachEntry",
      "retriesLeft",
      "scoreOf",
      "settledAnswer",
      "skipEntry",
      "truncateAfter",
    ];
    expect(expected.filter((name) => !(name in experimental))).toEqual([]);
  });
});

describe("./kit", () => {
  it("exports every runtime entry point", () => {
    const expected = [
      "Explainer",
      "createExplainer",
      "useExplainer",
      "Stage",
      "Narration",
      "StepCode",
      "ExplainerBar",
      "EndNote",
      "Choices",
      "StepParts",
      "useStepParts",
      "Predict",
      "PredictToggle",
    ];
    expect(expected.filter((name) => !(name in kit))).toEqual([]);
  });
});

describe("./kit/mdx", () => {
  it("exports every runtime entry point", () => {
    const expected = ["precomputed", "stepwiseComponents"];
    expect(expected.filter((name) => !(name in kitMdx))).toEqual([]);
  });
});


// @sphynxoid/stepwise/kit — explainers from a definition, a view and one line.
//
//   explainer — Explainer (the provider + default layout), useExplainer,
//               createExplainer (definition + view → one component)
//   parts     — Stage, Narration, StepCode, ExplainerBar, EndNote, Choices:
//               flat parts that read the provider, for custom layouts and MDX
//   step-parts— StepParts, useStepParts: the step parts (Narration, StepCode,
//               ExplainerBar, EndNote) around any player, outside an explainer
//   predict   — Predict, PredictToggle: checkpoints that ask the reader
//               what happens next, graded against the next frame
//
// Pure code (defineExplainer, precompute) lives in ./core, so a server
// component can precompute the trace this kit plays.

export { Explainer, createExplainer, useExplainer } from "./explainer";
export type { ExplainerApi, ExplainerInstanceProps, ExplainerProps, PredictApi, WalkApi } from "./explainer";
export { Choices, EndNote, ExplainerBar, Narration, Stage, StepCode } from "./parts";
export { StepParts, useStepParts } from "./step-parts";
export type { StepPartsApi, StepPartsSource } from "./step-parts";
export { Predict, PredictToggle } from "./predict";

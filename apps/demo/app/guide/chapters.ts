import type { Chapter } from "@sphynxoid/stepwise";

// The guide's sections. Each id is the DOM id of a <section> on the page.
// Plain data (no "use client"), shared by the server page and the client nav.
export const CHAPTERS: Chapter[] = [
  { id: "start", label: "Start here" },
  { id: "idea", label: "The idea" },
  { id: "trace", label: "A fixed trace" },
  { id: "simulation", label: "Computed from an input" },
  { id: "links", label: "Shareable links" },
  { id: "ask", label: "Ask the reader" },
  { id: "live", label: "Live timelines" },
  { id: "tours", label: "Guided tours" },
  { id: "chapters", label: "Scroll chapters" },
  { id: "glossary", label: "Glossary tooltips" },
  { id: "kit", label: "The authoring kit" },
  { id: "step-parts", label: "Kit parts, anywhere" },
  { id: "mistakes", label: "Common mistakes", numbered: false },
  { id: "words", label: "Words used here", numbered: false },
];

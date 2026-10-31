// Builds the shadcn registry served at <demo>/r/*.json from the library
// source, so the copied components can never drift from the published ones.
//
//   npx shadcn add https://stepwise-demo.vercel.app/r/player-bar.json
//
// Each item copies PRESENTATION source into the consumer's repo (Tailwind
// scans it there — no @source line needed) while the hooks, types and
// helpers stay imported from the npm package. Runs as the demo's
// predev/prebuild step; output (public/r) is gitignored.
//
// Rewrites applied to the copied source:
//   ./cn                → @/lib/utils (the shadcn `cn`)
//   ./theme             → @/lib/stepwise-theme (copied too: its classes must
//                         be scannable, so it is a registry:lib item)
//   ./types, ./flatten, ./use-focus-trap → @sphynxoid/stepwise
//   StepButton          → @/components/stepwise/step-button
//   `white/N` overlays  → `foreground/N` (same look on dark hosts, visible
//                         on light ones — shadcn hosts are light-first)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../../../packages/stepwise/src");
const out = join(here, "../public/r");
const pkg = JSON.parse(readFileSync(join(src, "../package.json"), "utf8"));
const BASE = (process.env.STEPWISE_REGISTRY_URL ?? "https://stepwise-demo.vercel.app/r").replace(/\/$/, "");
const NPM = pkg.name;

const read = (f) => readFileSync(join(src, f), "utf8").replace(/\r\n/g, "\n");

// ── Split components.tsx at its `// ─── Section ───` banners ──────────────

const components = read("components.tsx");
const sections = new Map();
{
  const re = /^\/\/ ─── (.+?) ─+$/gm;
  const marks = [...components.matchAll(re)];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : components.length;
    sections.set(m[1], components.slice(m.index, end).trimEnd() + "\n");
  });
}
const section = (name) => {
  const body = sections.get(name);
  if (!body) throw new Error(`components.tsx: section "${name}" not found (banners: ${[...sections.keys()].join(", ")})`);
  return body;
};

// ── Import synthesis: emit exactly the imports a body references ─────────

const SOURCES = [
  { from: "react", values: ["createContext", "useCallback", "useContext", "useEffect", "useId", "useLayoutEffect", "useMemo", "useRef", "useState"], types: ["ButtonHTMLAttributes", "ReactNode"] },
  { from: "react-dom", values: ["createPortal"] },
  { from: NPM, values: ["flattenChapters", "useFocusTrap"], types: ["Chapter", "ShortcutItem", "StepTone", "TourStepInput"] },
  { from: "@/lib/utils", values: ["cn"] },
  { from: "@/lib/stepwise-theme", values: ["defaultTheme"], types: ["StepwiseTheme"] },
  { from: "@/components/stepwise/step-button", values: ["StepButton"] },
];

function importsFor(body) {
  // Match code only (comments mention names like flattenChapters), and skip
  // what the body declares itself (step-button declares StepButton).
  const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const uses = (id) => new RegExp(`\\b${id}\\b`).test(code) && !new RegExp(`function ${id}\\b`).test(code);
  const lines = [];
  for (const s of SOURCES) {
    const values = (s.values ?? []).filter(uses);
    const types = (s.types ?? []).filter(uses);
    if (values.length === 0 && types.length === 0) continue;
    if (values.length === 0) {
      lines.push(`import type { ${types.join(", ")} } from "${s.from}";`);
    } else {
      const names = [...values, ...types.map((t) => `type ${t}`)].sort((a, b) =>
        a.replace(/^type /, "").localeCompare(b.replace(/^type /, ""))
      );
      lines.push(`import { ${names.join(", ")} } from "${s.from}";`);
    }
  }
  return lines.join("\n");
}

const lightSafe = (code) => code.replace(/\b(bg|border|ring|text)-white\//g, "$1-foreground/");

const header = (what) =>
  `// ${what} — from ${NPM}@${pkg.version} via the stepwise shadcn registry.\n` +
  `// This file is yours now: edit classes freely. Hooks and types stay\n` +
  `// imported from the npm package.\n`;

function componentFile(name, body) {
  const code = lightSafe(body);
  return `"use client";\n\n${header(name)}\n${importsFor(code)}\n\n${code}`;
}

// ── Item sources ─────────────────────────────────────────────────────────

const theme = lightSafe(read("theme.ts").replace(`from "./types"`, `from "${NPM}"`));

const stepButton = section("Internal button (replaces external UI-kit imports)")
  .replace("// ─── Internal button (replaces external UI-kit imports) ", "// ─── Step button ")
  .replace("function StepButton(", "export function StepButton(");

const glossary = lightSafe(
  read("glossary.tsx")
    .replace(`import { cn } from "./cn";`, `import { cn } from "@/lib/utils";`)
    .replace(`from "./theme";`, `from "@/lib/stepwise-theme";`)
).replace(/^"use client";\n/, `"use client";\n\n${header("Glossary")}`);
if (/from "\.\//.test(glossary)) throw new Error("glossary.tsx: unrewritten relative import");

// ── Items ────────────────────────────────────────────────────────────────

const url = (n) => `${BASE}/${n}.json`;
// No "utils" dependency: `cn` comes with `shadcn init` (@/lib/utils).
const base = [url("stepwise-theme")];

const items = [
  {
    name: "stepwise-theme",
    type: "registry:lib",
    title: "Stepwise theme",
    description: "The default StepwiseTheme class map every stepwise component styles itself from. Edit it to restyle the whole kit.",
    deps: [],
    files: [{ name: "stepwise-theme.ts", type: "registry:lib", target: "lib/stepwise-theme.ts", content: theme }],
  },
  {
    name: "step-button",
    type: "registry:component",
    title: "Step button",
    description: "The small internal button (ghost / outline / primary) shared by the stepwise components.",
    deps: base,
    body: stepButton,
  },
  {
    name: "code-block",
    title: "Code block",
    description: "Monospace code lines with dimmed // comments — pairs with a step player.",
    deps: base,
    body: section("Code block"),
  },
  {
    name: "player-bar",
    title: "Player bar",
    description: "Prev / play / next controls plus the tone-coloured StepScrubber timeline, driven by useStepPlayer or useTrace.",
    deps: [...base, url("step-button")],
    body: section("Scrubber + player bar"),
  },
  {
    name: "chapter-nav",
    title: "Chapter nav",
    description: "Sticky, recursive chapter navigation for useChapters scroll lessons.",
    deps: [...base, url("step-button")],
    body: section("Chapter navigation"),
  },
  {
    name: "lesson-pager",
    title: "Lesson pager",
    description: "Previous / next lesson buttons for cross-page chapter navigation.",
    deps: [...base, url("step-button")],
    body: section("Lesson pager (cross-page chapter navigation)"),
  },
  {
    name: "tour",
    title: "Guided tour",
    description: "TourSpotlight (dimmed cut-out around the target) and TourCard (focus-trapped step dialog) for useGuidedTour.",
    deps: [...base, url("step-button")],
    body: section("Guided tour"),
  },
  {
    name: "shortcuts-dialog",
    title: "Shortcuts dialog",
    description: "Keyboard-shortcut reference dialog with focus trap, Escape and portal.",
    deps: [...base, url("step-button")],
    body: section("Shortcuts dialog"),
  },
  {
    name: "glossary",
    title: "Glossary",
    description: "GlossaryProvider, recursive depth-capped <Term> tooltips and the auto-collecting GlossaryAppendix.",
    deps: base,
    files: [{ name: "glossary.tsx", type: "registry:component", target: "components/stepwise/glossary.tsx", content: glossary }],
  },
];

const ALL = items.filter((i) => i.name !== "stepwise-theme" && i.name !== "step-button").map((i) => url(i.name));
items.push({
  name: "stepwise",
  type: "registry:block",
  title: "Stepwise (everything)",
  description: "Every stepwise presentation component in one install.",
  deps: ALL,
  files: [],
});

// ── Emit ─────────────────────────────────────────────────────────────────

mkdirSync(out, { recursive: true });
const index = [];
for (const item of items) {
  const type = item.type ?? "registry:component";
  const files =
    item.files ??
    [
      {
        name: `${item.name}.tsx`,
        type: "registry:component",
        target: `components/stepwise/${item.name}.tsx`,
        content: componentFile(item.title, item.body),
      },
    ];
  const json = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type,
    title: item.title,
    description: item.description,
    dependencies: item.name === "stepwise" ? [] : [NPM],
    registryDependencies: item.deps,
    files: files.map((f) => ({
      path: `registry/stepwise/${f.name}`,
      type: f.type,
      target: f.target,
      content: f.content,
    })),
  };
  writeFileSync(join(out, `${item.name}.json`), JSON.stringify(json, null, 2) + "\n");
  index.push({ ...json, files: json.files.map((f) => ({ path: f.path, type: f.type, target: f.target })) });
}
writeFileSync(
  join(out, "registry.json"),
  JSON.stringify(
    { $schema: "https://ui.shadcn.com/schema/registry.json", name: "stepwise", homepage: BASE.replace(/\/r$/, ""), items: index },
    null,
    2
  ) + "\n"
);
console.log(`stepwise registry: ${items.length} items → ${out} (${BASE})`);

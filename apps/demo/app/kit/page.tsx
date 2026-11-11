import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  EndNote,
  ExplainerBar,
  Narration,
  Predict,
  PredictToggle,
  Stage,
  StepCode,
} from "@sphynxoid/stepwise/kit";
import { precomputed } from "@sphynxoid/stepwise/kit/server";
import { ViewSource } from "../view-source";
import { binarySearch } from "./binary-search.explainer";
import { BinarySearchClient } from "./demo";

export const metadata: Metadata = { title: "Explainer kit" };

// A server component: the trace for each explainer is computed here, at
// build time, and handed to the client component as plain JSON. The client
// starts from it instead of re-running the search on hydration, and a broken
// definition fails the build. Everything passed below is plain data; the
// parts are client components.
const BinarySearch = precomputed(binarySearch, BinarySearchClient);

export default function Page() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <Link href="/#demos" className="inline-flex items-center gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground transition mb-6">
            <ArrowLeft size={14} /> Back to demos
          </Link>
          <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2 sw-fade-up">Demo - Explainer kit (experimental)</p>
          <h1 className="text-2xl font-bold mb-4 sw-fade-up sw-fade-up-1">A definition, a view, one tag</h1>
          <p className="text-[13px] text-foreground/60 leading-relaxed mb-8 sw-fade-up sw-fade-up-2">
            Both players below come from one <code className="text-primary">defineExplainer</code> and one view.{" "}
            <code className="text-primary">createExplainer</code> binds them into a component;{" "}
            <code className="text-primary">precomputed</code> runs the definition on the server and ships the finished
            trace, so the browser starts from it instead of running the search again. Each explainer has its own <code className="text-primary">id</code>,
            so its frame and input live under their own keys in the URL, and the arrow keys and Space drive whichever
            one you last clicked or focused (until then, none of them takes the keys). Change the target and the
            search re-runs on the client.
          </p>

          <h2 className="text-[15px] font-semibold mb-3">The default layout</h2>
          <BinarySearch id="a" />

          <h2 className="text-[15px] font-semibold mt-10 mb-1">Your own layout, with predict mode</h2>
          <p className="text-[13px] text-foreground/60 leading-relaxed mb-3">
            Children replace the layout, so this one puts the predict switch first and asks its own question. It
            pauses at every probe: guess where the search goes, and the next frame grades you.
          </p>
          <BinarySearch id="b" target={61} predict>
            <Stage />
            <Narration />
            <PredictToggle />
            <Predict>
              Will the search go <strong>left</strong>, <strong>right</strong>, or stop?
            </Predict>
            <StepCode />
            <ExplainerBar />
            <EndNote>End of the search. Try a target that is not in the array.</EndNote>
          </BinarySearch>
        </div>
      </main>
      <ViewSource file="app/kit/demo.tsx" />
      <ViewSource file="app/kit/page.tsx" />
    </>
  );
}

import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Automaton" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/automaton/demo.tsx" />
    </>
  );
}

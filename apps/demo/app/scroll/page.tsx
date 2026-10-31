import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Scroll chapters" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/scroll/demo.tsx" />
    </>
  );
}

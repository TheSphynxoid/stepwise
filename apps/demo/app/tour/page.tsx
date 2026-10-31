import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Guided tour" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/tour/demo.tsx" />
    </>
  );
}

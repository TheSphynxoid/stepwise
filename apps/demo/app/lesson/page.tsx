import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Composed lesson" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/lesson/demo.tsx" />
    </>
  );
}

import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Led discovery" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/discovery/demo.tsx" />
    </>
  );
}

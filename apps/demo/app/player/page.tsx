import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Player" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/player/demo.tsx" />
    </>
  );
}

import type { Metadata } from "next";
import { ViewSource } from "../view-source";
import Demo from "./demo";

export const metadata: Metadata = { title: "Glossary chains" };

export default function Page() {
  return (
    <>
      <Demo />
      <ViewSource file="app/glossary/demo.tsx" />
    </>
  );
}

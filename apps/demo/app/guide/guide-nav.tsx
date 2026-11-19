"use client";

import { useChapters, ChapterNav } from "@sphynxoid/stepwise";
import { CHAPTERS } from "./chapters";
import { useSiteTheme } from "../theme-provider"; // demo-only

// This page's own table of contents. useChapters watches the sections
// (found by id) and reports the one at the middle of the screen; clicking
// an entry scrolls to it.
export function GuideNav() {
  const { theme } = useSiteTheme(); // demo-only
  const { active, goTo } = useChapters(CHAPTERS);
  return (
    <ChapterNav
      chapters={CHAPTERS}
      active={active}
      onNavigate={goTo}
      className="top-16 md:top-16 mb-10"
      theme={theme} // demo-only
    />
  );
}

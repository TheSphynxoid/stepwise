"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { TourDriver, TourStepInput } from "../types";

export interface DriverJsTourOptions {
  /** Extra class for the driver.js popover, e.g. to blend with the app theme. */
  popoverClass?: string;
}

/**
 * TourDriver backed by driver.js. The hook still owns state coupling (onEnter
 * effects fire per step); driver.js only presents the spotlight + popover.
 *
 * Caveats vs the built-in presenter:
 *  - every step needs a `target` (driver.js anchors a popover to an element);
 *    targetless steps are presented as empty passes — prefer the built-in
 *    presenter for tours with intro/outro steps.
 *  - step bodies must be plain strings.
 *
 *   const driver = useMemo(() => createDriverJsTourDriver(), []);
 *   const tour = useGuidedTour(steps, { driver });
 */
export function createDriverJsTourDriver(opts: DriverJsTourOptions = {}): TourDriver {
  let instance: ReturnType<typeof driver> | null = null;

  const destroy = () => {
    if (instance?.isActive()) instance.destroy();
    instance = null;
  };

  return {
    show(step: TourStepInput, ctx) {
      destroy();
      if (!step.target || !document.querySelector(`[data-tour="${step.target}"]`)) return;
      instance = driver({
        popoverClass: opts.popoverClass,
        showProgress: false,
        allowClose: true,
        showButtons: ["next", "previous", "close"],
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        onNextClick: () => ctx.next(),
        onPrevClick: () => ctx.back(),
        onCloseClick: () => ctx.end(),
      });
      const stepConfig = {
        element: `[data-tour="${step.target}"]`,
        popover: {
          title: step.title,
          description: typeof step.body === "string" ? step.body : "",
        },
        waitForElement: 500,
      } as DriveStep;
      instance.highlight(stepConfig);
    },
    hide: destroy,
  };
}

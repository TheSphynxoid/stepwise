import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// No Tailwind here: the precompiled stylesheet styles every stepwise component.
import "@sphynxoid/stepwise/styles.css";
import "./app.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

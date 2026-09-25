import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PlayerApp } from "./PlayerApp";
import "./player.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (root === null) {
  throw new Error("Missing #root application mount");
}

createRoot(root).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
);

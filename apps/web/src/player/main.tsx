import { createRoot } from "react-dom/client";

import { PlayerApp } from "./PlayerApp";
import "./player.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (root === null) {
  throw new Error("Missing #root application mount");
}

// No StrictMode: in development it runs each effect twice, and the player's
// effects parse the 1.9 MB model and open the 70 MB booklet, so every load
// did both twice (measured 2026-09-24).
createRoot(root).render(<PlayerApp />);

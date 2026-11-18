import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./panel.css";

// Entry for panel.html. Query options (handy outside DevTools, e.g. screenshots):
//   ?demo=1   built-in demo captures, no chrome APIs needed
//   ?tab=<id> watch a specific tab id
//   ?lang=ko  force a language (en | ko) without touching the saved choice
createRoot(document.getElementById("root")!).render(<App />);

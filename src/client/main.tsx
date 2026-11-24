import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

// Agent/touch mode enlarges interactive targets and shows hover-only controls
// (?agent or ?mode=agent).
const params = new URLSearchParams(window.location.search);
if (params.has("agent") || params.get("mode") === "agent") {
  document.documentElement.setAttribute("data-agent", "");
}

createRoot(document.getElementById("app")!).render(<App />);

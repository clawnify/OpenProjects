import { useEffect, useState } from "react";
import { reportLocation } from "@clawnify/app/client";

export function navigate(to: string) {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Replace the query string without a new history entry (view state, not a page). */
export function setQuery(params: Record<string, string | null>) {
  const q = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === "") q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  window.history.replaceState(null, "", window.location.pathname + (s ? `?${s}` : ""));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useLocation() {
  const [loc, setLoc] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const h = () => setLoc(window.location.pathname + window.location.search);
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);
  useEffect(() => {
    reportLocation(loc);
  }, [loc]);
  return loc;
}

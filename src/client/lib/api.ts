import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const r = await fetch(path, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : {},
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const text = await r.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`The server answered ${r.status}`);
  }
  if (!r.ok) throw new Error(errorText(data) || "That did not work");
  return data as T;
}

/** The API's own message, or the first validation issue in plain words. */
function errorText(data: unknown): string {
  const d = data as { error?: unknown; issues?: { message?: string }[] };
  if (typeof d?.error === "string") return d.error;
  const issue = (d?.error as { issues?: { message?: string }[] })?.issues?.[0] ?? d?.issues?.[0];
  return issue?.message ?? "";
}

// ── A tiny store: one value, many subscribers ─────────────────────

function store<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(v: T) {
      value = v;
      subs.forEach((f) => f());
    },
    use(): T {
      return useSyncExternalStore(
        (f) => {
          subs.add(f);
          return () => subs.delete(f);
        },
        () => value,
      );
    },
  };
}

/** Bumped after every write (ours, or the dashboard chat's), so open screens re-read. */
export const version = store(0);
export const refresh = () => version.set(version.get() + 1);

export const toast = store<{ text: string; err?: boolean } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function say(text: string, err = false) {
  toast.set({ text, err });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.set(null), 3200);
}

/** A write from the UI: on success refresh every open screen; on failure say why. */
export async function act<T = unknown>(method: string, path: string, body?: unknown, done?: string): Promise<T | undefined> {
  try {
    const res = await api<T>(method, path, body);
    refresh();
    if (done) say(done);
    return res;
  } catch (e) {
    say((e as Error).message, true);
    return undefined;
  }
}

export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = version.use();
  const load = useCallback(() => {
    if (!path) return;
    api<T>("GET", path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [path]);
  useEffect(load, [load, v]);
  return { data, error };
}

// ── Shapes from the API ────────────────────────────────────────────

export type Status = "planned" | "active" | "on_hold" | "done";

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  assignee: string;
  done: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  status: Status;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  start_date: string | null;
  end_date: string | null;
  phase_count: number;
  done_count: number;
  file_count: number;
}

export interface Conflict {
  phase_id: string;
  other_id: string;
  other_name: string;
  other_project_id: string;
  other_project_name: string;
  start_date: string;
  end_date: string;
  assignee: string;
}

export interface ProjectWithPhases extends Project {
  phases: Phase[];
}

export interface ProjectDetail extends ProjectWithPhases {
  conflicts: Conflict[];
}

export interface FileItem {
  id: string;
  project_id: string;
  name: string;
  content_type: string;
  size: number;
  uploaded_by: string;
  created_at: string;
  url: string;
}

export interface Page<K extends string, T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
  key?: K;
}

export const STATUS_LABEL: Record<Status, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  done: "Done",
};

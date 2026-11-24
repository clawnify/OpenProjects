// OpenProjects: the API.
//
// `createApp` brings the OpenAPI router, the per-request database wiring, and
// the two discovery routes (`/api/openapi.json`, `/llms.txt`) that let the org's
// agent learn this API without anyone writing it down twice.

import { createApp, orgId, widgets } from "@clawnify/app";
import { get, query } from "./db.js";
import type { Env } from "./env.js";
import { registerFiles } from "./routes/files.js";
import { registerPhases } from "./routes/phases.js";
import { registerProjects } from "./routes/projects.js";
import { registerTimeline } from "./routes/timeline.js";
import { addDays, weekStart } from "../shared/dates.js";

const app = createApp<Env>({
  title: "OpenProjects",
  version: "1.0.0",
  description:
    "Projects that run for weeks: each one a plan of phases on a timeline (start, end, who does it) and one place for its documents, drawings and photos. " +
    "A person or crew booked on two phases at once is flagged, never blocked.",
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || String(err) }, 500);
});

registerTimeline(app);
registerProjects(app);
registerPhases(app);
registerFiles(app);

widgets(app, async (c) => {
  const o = orgId(c);
  if (!o) return [];
  const today = new Date().toISOString().slice(0, 10);
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const [active, starting] = await Promise.all([
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM projects WHERE org_id = ? AND status = 'active'`, [o]),
    query<{ name: string; project: string; project_id: string; start_date: string; assignee: string }>(
      `SELECT ph.name, p.name AS project, p.id AS project_id, ph.start_date, ph.assignee
         FROM phases ph JOIN projects p ON p.org_id = ph.org_id AND p.id = ph.project_id
        WHERE ph.org_id = ? AND ph.start_date >= ? AND ph.start_date <= ? AND p.status IN ('active','planned')
        ORDER BY ph.start_date LIMIT 5`,
      [o, monday, sunday],
    ),
  ]);
  return [
    { key: "active-projects", kind: "metric", title: "Active projects", value: active?.n ?? 0, at: "/projects?status=active", icon: "folder", color: "amber" },
    {
      key: "starting-this-week",
      kind: "list",
      title: "Starting this week",
      at: "/",
      icon: "calendar-days",
      color: "blue",
      items: starting.map((s) => ({
        label: `${s.name} · ${s.project}`.slice(0, 80),
        meta: [s.start_date.slice(5).split("-").reverse().join("/"), s.assignee].filter(Boolean).join(" · ").slice(0, 80),
        at: `/projects/${s.project_id}`,
      })),
    },
  ];
});

export default app;

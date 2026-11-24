// The timeline: every project that has work in a date window, with its whole
// plan and any double bookings, so the Gantt chart is one request.

import { createRoute, PageQuery, pageParams, z } from "@clawnify/app";
import { get, query } from "../db.js";
import { fail, NO_ORG, ok, org, statusList, type App } from "../env.js";
import { ConflictSchema, loadConflicts, loadPhases, PhaseSchema, PROJECT_SELECT, ProjectSchema, type Project } from "../model.js";
import { addDays, diffDays, isDate } from "../../shared/dates.js";

const Row = ProjectSchema.extend({ phases: z.array(PhaseSchema) }).openapi("TimelineProject");

/** The widest window one request may ask for: two years. */
const MAX_WINDOW_DAYS = 731;

export function registerTimeline(app: App) {
  const timeline = createRoute({
    method: "get",
    path: "/api/timeline",
    tags: ["Timeline"],
    summary: "Projects with work between two dates, each with its whole plan",
    description:
      "A project is included when one of its phases overlaps the window, or when it has no phases yet (so a new project shows up to be planned). " +
      "Defaults: active and planned projects, from 4 weeks ago to 26 weeks ahead. The window is capped at two years.",
    request: {
      query: PageQuery.extend({
        from: z.string().optional().openapi({ example: "2026-11-01" }),
        to: z.string().optional().openapi({ example: "2027-05-31" }),
        status: z.string().optional().openapi({ description: "Comma list: planned,active,on_hold,done. Default planned,active" }),
      }),
    },
    responses: {
      200: ok(
        "Projects in the window",
        z.object({
          from: z.string(),
          to: z.string(),
          projects: z.array(Row),
          conflicts: z.array(ConflictSchema),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
      ),
      400: fail("Bad window"),
      403: fail("No organisation"),
    },
  });

  app.openapi(timeline, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const q = c.req.valid("query");
    const { page, limit, offset, search } = pageParams(q, { defaultLimit: 50 });
    const today = new Date().toISOString().slice(0, 10);
    const from = q.from && isDate(q.from) ? q.from : addDays(today, -28);
    const to = q.to && isDate(q.to) ? q.to : addDays(today, 182);
    if (to < from) return c.json({ error: "`to` is before `from`" }, 400);
    if (diffDays(from, to) > MAX_WINDOW_DAYS) return c.json({ error: "Ask for at most two years at a time" }, 400);

    const statuses = statusList(q.status);
    const want = statuses.length ? statuses : ["active", "planned"];
    const where = [
      "p.org_id = ?",
      `p.status IN (${want.map(() => "?").join(",")})`,
      `(NOT EXISTS (SELECT 1 FROM phases x WHERE x.org_id = p.org_id AND x.project_id = p.id)
        OR EXISTS (SELECT 1 FROM phases x WHERE x.org_id = p.org_id AND x.project_id = p.id
                     AND x.start_date <= ? AND x.end_date >= ?))`,
    ];
    const args: unknown[] = [o, ...want, to, from];
    if (search) {
      where.push("(p.name LIKE ? OR p.client LIKE ? OR p.location LIKE ?)");
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const clause = where.join(" AND ");
    const total = (await get<{ n: number }>(`SELECT COUNT(*) AS n FROM projects p WHERE ${clause}`, args))?.n ?? 0;
    const projects = await query<Project>(
      `${PROJECT_SELECT} WHERE ${clause}
        ORDER BY start_date IS NULL, start_date, p.name
        LIMIT ? OFFSET ?`,
      [...args, limit, offset],
    );
    const phases = await loadPhases(o, projects.map((p) => p.id));
    const byProject = new Map<string, typeof phases>();
    for (const ph of phases) byProject.set(ph.project_id, [...(byProject.get(ph.project_id) ?? []), ph]);
    const conflicts = await loadConflicts(o, phases.map((p) => p.id));
    return c.json(
      {
        from,
        to,
        projects: projects.map((p) => ({ ...p, phases: byProject.get(p.id) ?? [] })),
        conflicts,
        total,
        page,
        limit,
      } as never,
      200,
    );
  });
}

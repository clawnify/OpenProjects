// Phases: the bars on the timeline. Add, move, resize, rename, finish, remove.

import { createRoute, z } from "@clawnify/app";
import { get, query, run } from "../db.js";
import { clean, fail, NO_ORG, now, ok, OkSchema, org, type App } from "../env.js";
import { ConflictSchema, loadConflicts, loadProject, MAX_PHASES, PhaseSchema, type Phase } from "../model.js";
import { isDate } from "../../shared/dates.js";

const Day = z.string().refine(isDate, "Use a real date, YYYY-MM-DD");

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  start_date: Day,
  end_date: Day.optional().openapi({ description: "Defaults to the start date (a one-day phase)" }),
  assignee: z.string().max(120).optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  start_date: Day.optional(),
  end_date: Day.optional(),
  assignee: z.string().max(120).optional(),
  done: z.boolean().optional(),
  position: z.number().int().min(0).max(10_000).optional(),
});

const WithConflicts = PhaseSchema.extend({ conflicts: z.array(ConflictSchema) }).openapi("PhaseWithConflicts");

const PHASE_COLS = "id, project_id, name, start_date, end_date, assignee, done, position, created_at, updated_at";

async function withConflicts(o: string, id: string) {
  const ph = await get<Phase>(`SELECT ${PHASE_COLS} FROM phases WHERE org_id = ? AND id = ?`, [o, id]);
  if (!ph) return undefined;
  return { ...ph, conflicts: await loadConflicts(o, [id]) };
}

export function registerPhases(app: App) {
  const create = createRoute({
    method: "post",
    path: "/api/projects/{id}/phases",
    tags: ["Phases"],
    summary: "Add a phase to a project's plan",
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: CreateBody } } },
    },
    responses: {
      200: ok("The new phase, with any double bookings", WithConflicts),
      400: fail("Bad dates or the plan is full"),
      403: fail("No organisation"),
      404: fail("Project not found"),
    },
  });

  app.openapi(create, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id: projectId } = c.req.valid("param");
    const b = c.req.valid("json");
    const end = b.end_date ?? b.start_date;
    if (end < b.start_date) return c.json({ error: "A phase cannot end before it starts" }, 400);
    if (!(await loadProject(o, projectId))) return c.json({ error: "Project not found" }, 404);
    const stats = await get<{ n: number; last: number | null }>(
      `SELECT COUNT(*) AS n, MAX(position) AS last FROM phases WHERE org_id = ? AND project_id = ?`,
      [o, projectId],
    );
    if ((stats?.n ?? 0) >= MAX_PHASES) return c.json({ error: `A project holds at most ${MAX_PHASES} phases` }, 400);
    const id = crypto.randomUUID();
    const ts = now();
    await run(
      `INSERT INTO phases (id, org_id, project_id, name, start_date, end_date, assignee, done, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, o, projectId, clean(b.name, 120), b.start_date, end, clean(b.assignee, 120), (stats?.last ?? -1) + 1, ts, ts],
    );
    await run(`UPDATE projects SET updated_at = ? WHERE org_id = ? AND id = ?`, [ts, o, projectId]);
    return c.json((await withConflicts(o, id)) as never, 200);
  });

  const update = createRoute({
    method: "patch",
    path: "/api/phases/{id}",
    tags: ["Phases"],
    summary: "Move, resize, rename, reassign or finish a phase",
    description: "Partial: only the fields sent change. Moving a phase means sending both dates.",
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { "application/json": { schema: UpdateBody } } },
    },
    responses: {
      200: ok("The updated phase, with any double bookings", WithConflicts),
      400: fail("The phase would end before it starts"),
      403: fail("No organisation"),
      404: fail("Not found"),
    },
  });

  app.openapi(update, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id } = c.req.valid("param");
    const b = c.req.valid("json");
    const cur = await get<Phase>(`SELECT ${PHASE_COLS} FROM phases WHERE org_id = ? AND id = ?`, [o, id]);
    if (!cur) return c.json({ error: "Phase not found" }, 404);
    const start = b.start_date ?? cur.start_date;
    const end = b.end_date ?? cur.end_date;
    if (end < start) return c.json({ error: "A phase cannot end before it starts" }, 400);
    const ts = now();
    await run(
      `UPDATE phases SET name = ?, start_date = ?, end_date = ?, assignee = ?, done = ?, position = ?, updated_at = ?
        WHERE org_id = ? AND id = ?`,
      [
        b.name !== undefined ? clean(b.name, 120) : cur.name,
        start,
        end,
        b.assignee !== undefined ? clean(b.assignee, 120) : cur.assignee,
        b.done !== undefined ? (b.done ? 1 : 0) : cur.done,
        b.position ?? cur.position,
        ts,
        o,
        id,
      ],
    );
    await run(`UPDATE projects SET updated_at = ? WHERE org_id = ? AND id = ?`, [ts, o, cur.project_id]);
    return c.json((await withConflicts(o, id)) as never, 200);
  });

  const remove = createRoute({
    method: "delete",
    path: "/api/phases/{id}",
    tags: ["Phases"],
    summary: "Remove a phase from the plan",
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: ok("Removed", OkSchema), 403: fail("No organisation"), 404: fail("Not found") },
  });

  app.openapi(remove, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id } = c.req.valid("param");
    const r = await run(`DELETE FROM phases WHERE org_id = ? AND id = ?`, [o, id]);
    if (!r.changes) return c.json({ error: "Phase not found" }, 404);
    return c.json({ ok: true }, 200);
  });

  const people = createRoute({
    method: "get",
    path: "/api/people",
    tags: ["Phases"],
    summary: "Names already used as assignees, most recent first",
    description: "For suggestions when assigning a phase. At most 20.",
    request: { query: z.object({ search: z.string().optional() }) },
    responses: {
      200: ok("Names with how many phases each has", z.object({ items: z.array(z.object({ name: z.string(), phases: z.number() })) })),
      403: fail("No organisation"),
    },
  });

  app.openapi(people, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const search = clean(c.req.valid("query").search, 80);
    // One row per exact spelling, then folded by case here, so "Quinton" and
    // "quinton" are one person shown in the spelling used most.
    const rows = await query<{ name: string; n: number; last: string }>(
      `SELECT assignee AS name, COUNT(*) AS n, MAX(updated_at) AS last
         FROM phases WHERE org_id = ? AND assignee <> '' ${search ? "AND assignee LIKE ?" : ""}
        GROUP BY assignee ORDER BY last DESC LIMIT 100`,
      search ? [o, `%${search}%`] : [o],
    );
    const people = new Map<string, { name: string; phases: number; best: number; last: string }>();
    for (const r of rows) {
      const k = r.name.toLowerCase();
      const p = people.get(k);
      if (!p) people.set(k, { name: r.name, phases: r.n, best: r.n, last: r.last });
      else {
        p.phases += r.n;
        if (r.n > p.best) Object.assign(p, { name: r.name, best: r.n });
        if (r.last > p.last) p.last = r.last;
      }
    }
    const items = [...people.values()]
      .sort((a, b) => (a.last < b.last ? 1 : -1))
      .slice(0, 20)
      .map(({ name, phases }) => ({ name, phases }));
    return c.json({ items }, 200);
  });
}

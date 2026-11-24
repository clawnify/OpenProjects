// Projects: the list, one project with its plan, and the changes to it.

import { createRoute, PageQuery, pageParams, pagedResponse, z } from "@clawnify/app";
import { get, query, run } from "../db.js";
import { actor, clean, fail, NO_ORG, now, ok, OkSchema, org, statusList, STATUSES, uid, type App } from "../env.js";
import { ConflictSchema, loadConflicts, loadPhases, loadProject, MAX_PHASES, PhaseSchema, PROJECT_SELECT, ProjectSchema } from "../model.js";
import { addDays, isDate } from "../../shared/dates.js";

const Day = z.string().refine(isDate, "Use a real date, YYYY-MM-DD");

const NewPhase = z
  .object({
    name: z.string().min(1).max(120),
    start_date: Day,
    end_date: Day,
    assignee: z.string().max(120).optional(),
  })
  .refine((p) => p.start_date <= p.end_date, { message: "A phase cannot end before it starts", path: ["end_date"] });

const CreateBody = z.object({
  name: z.string().min(1).max(160),
  client: z.string().max(160).optional(),
  location: z.string().max(240).optional(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(20_000).optional(),
  phases: z.array(NewPhase).max(MAX_PHASES).optional().openapi({ description: "The plan, in order. Optional: phases can be added later." }),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(160).optional(),
  client: z.string().max(160).optional(),
  location: z.string().max(240).optional(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(20_000).optional(),
});

const Detail = ProjectSchema.extend({
  phases: z.array(PhaseSchema),
  conflicts: z.array(ConflictSchema).openapi({ description: "Phases whose assignee is also booked elsewhere on the same days" }),
}).openapi("ProjectDetail");

const Params = z.object({ id: z.string() });

async function detail(o: string, id: string) {
  const p = await loadProject(o, id);
  if (!p) return undefined;
  const phases = await loadPhases(o, [id]);
  const conflicts = await loadConflicts(o, phases.map((x) => x.id));
  return { ...p, phases, conflicts };
}

export function registerProjects(app: App) {
  const list = createRoute({
    method: "get",
    path: "/api/projects",
    tags: ["Projects"],
    summary: "Projects, one page at a time",
    description: "Ordered active first, then planned, on hold and done; within each by start date. Dates and counts come from the phases.",
    request: {
      query: PageQuery.extend({
        status: z.string().optional().openapi({ description: "Comma list: planned,active,on_hold,done" }),
      }),
    },
    responses: { 200: pagedResponse("items", ProjectSchema), 403: fail("No organisation") },
  });

  app.openapi(list, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const q = c.req.valid("query");
    const { page, limit, offset, search } = pageParams(q);
    const where = ["p.org_id = ?"];
    const args: unknown[] = [o];
    const statuses = statusList(q.status);
    if (statuses.length) {
      where.push(`p.status IN (${statuses.map(() => "?").join(",")})`);
      args.push(...statuses);
    }
    if (search) {
      where.push("(p.name LIKE ? OR p.client LIKE ? OR p.location LIKE ?)");
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const clause = where.join(" AND ");
    const total = (await get<{ n: number }>(`SELECT COUNT(*) AS n FROM projects p WHERE ${clause}`, args))?.n ?? 0;
    const items = await query(
      `${PROJECT_SELECT} WHERE ${clause}
        ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END,
                 start_date IS NULL, start_date, p.name
        LIMIT ? OFFSET ?`,
      [...args, limit, offset],
    );
    return c.json({ items, total, page, limit } as never, 200);
  });

  const create = createRoute({
    method: "post",
    path: "/api/projects",
    tags: ["Projects"],
    summary: "Create a project, optionally with its whole plan",
    request: { body: { content: { "application/json": { schema: CreateBody } } } },
    responses: { 200: ok("The new project with its plan", Detail), 403: fail("No organisation") },
  });

  app.openapi(create, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const b = c.req.valid("json");
    const id = uid();
    const ts = now();
    await run(
      `INSERT INTO projects (id, org_id, name, client, location, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, o, clean(b.name, 160), clean(b.client, 160), clean(b.location, 240), b.status ?? "planned", b.notes ?? "", actor(c), ts, ts],
    );
    for (const [i, ph] of (b.phases ?? []).entries()) {
      await run(
        `INSERT INTO phases (id, org_id, project_id, name, start_date, end_date, assignee, done, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [uid(), o, id, clean(ph.name, 120), ph.start_date, ph.end_date, clean(ph.assignee, 120), i, ts, ts],
      );
    }
    return c.json((await detail(o, id)) as never, 200);
  });

  const read = createRoute({
    method: "get",
    path: "/api/projects/{id}",
    tags: ["Projects"],
    summary: "One project with its phases and any double bookings",
    request: { params: Params },
    responses: { 200: ok("The project", Detail), 403: fail("No organisation"), 404: fail("Not found") },
  });

  app.openapi(read, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const d = await detail(o, c.req.valid("param").id);
    if (!d) return c.json({ error: "Project not found" }, 404);
    return c.json(d as never, 200);
  });

  const update = createRoute({
    method: "patch",
    path: "/api/projects/{id}",
    tags: ["Projects"],
    summary: "Change a project's details or status",
    description: "Partial: only the fields sent change. `notes` is a long text field; edit it in place.",
    request: { params: Params, body: { content: { "application/json": { schema: UpdateBody } } } },
    responses: { 200: ok("The updated project", Detail), 403: fail("No organisation"), 404: fail("Not found") },
  });

  app.openapi(update, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id } = c.req.valid("param");
    const b = c.req.valid("json");
    const sets: string[] = [];
    const args: unknown[] = [];
    if (b.name !== undefined) { sets.push("name = ?"); args.push(clean(b.name, 160)); }
    if (b.client !== undefined) { sets.push("client = ?"); args.push(clean(b.client, 160)); }
    if (b.location !== undefined) { sets.push("location = ?"); args.push(clean(b.location, 240)); }
    if (b.status !== undefined) { sets.push("status = ?"); args.push(b.status); }
    if (b.notes !== undefined) { sets.push("notes = ?"); args.push(b.notes); }
    sets.push("updated_at = ?");
    args.push(now());
    const r = await run(`UPDATE projects SET ${sets.join(", ")} WHERE org_id = ? AND id = ?`, [...args, o, id]);
    if (!r.changes) return c.json({ error: "Project not found" }, 404);
    return c.json((await detail(o, id)) as never, 200);
  });

  const shift = createRoute({
    method: "post",
    path: "/api/projects/{id}/shift",
    tags: ["Projects"],
    summary: "Move a whole project earlier or later",
    description: "Moves every phase by the same number of days, so the plan keeps its shape. Negative days move it earlier.",
    request: {
      params: Params,
      body: { content: { "application/json": { schema: z.object({ days: z.number().int().min(-3650).max(3650) }) } } },
    },
    responses: { 200: ok("The moved project", Detail), 403: fail("No organisation"), 404: fail("Not found") },
  });

  app.openapi(shift, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id } = c.req.valid("param");
    const { days } = c.req.valid("json");
    if (!(await loadProject(o, id))) return c.json({ error: "Project not found" }, 404);
    if (days !== 0) {
      const ts = now();
      // Dates are computed here rather than in SQL so every phase moves by the
      // same calendar arithmetic the app uses everywhere else.
      for (const ph of await loadPhases(o, [id])) {
        await run(`UPDATE phases SET start_date = ?, end_date = ?, updated_at = ? WHERE org_id = ? AND id = ?`, [
          addDays(ph.start_date, days), addDays(ph.end_date, days), ts, o, ph.id,
        ]);
      }
      await run(`UPDATE projects SET updated_at = ? WHERE org_id = ? AND id = ?`, [ts, o, id]);
    }
    return c.json((await detail(o, id)) as never, 200);
  });

  const remove = createRoute({
    method: "delete",
    path: "/api/projects/{id}",
    tags: ["Projects"],
    summary: "Delete a project, its plan and its files",
    request: { params: Params },
    responses: { 200: ok("Deleted", OkSchema), 403: fail("No organisation"), 404: fail("Not found") },
  });

  app.openapi(remove, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id } = c.req.valid("param");
    if (!(await loadProject(o, id))) return c.json({ error: "Project not found" }, 404);
    // Files first: once the rows are gone nothing would point at the bytes.
    const bucket = c.env.UPLOADS;
    for (;;) {
      const batch = await query<{ id: string; storage_key: string }>(
        `SELECT id, storage_key FROM files WHERE org_id = ? AND project_id = ? LIMIT 80`,
        [o, id],
      );
      if (!batch.length) break;
      if (bucket) await bucket.delete(batch.map((f) => f.storage_key));
      for (const f of batch) await run(`DELETE FROM files WHERE org_id = ? AND id = ?`, [o, f.id]);
    }
    await run(`DELETE FROM phases WHERE org_id = ? AND project_id = ?`, [o, id]);
    await run(`DELETE FROM projects WHERE org_id = ? AND id = ?`, [o, id]);
    return c.json({ ok: true }, 200);
  });
}

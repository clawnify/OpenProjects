// A project's files: drawings, quotes, site photos. One place per project
// instead of a folder per person.

import { createRoute, PageQuery, pageParams, pagedResponse, z } from "@clawnify/app";
import { get, query, run } from "../db.js";
import { actor, clean, fail, NO_ORG, now, ok, OkSchema, org, uid, type App } from "../env.js";
import { FileSchema, loadProject } from "../model.js";

/** Per file. Large enough for a drawing set or a phone video, small enough for one request. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Types a browser may show in place. Everything else is sent as a download:
 * an uploaded HTML or SVG file shown inline would run its scripts on this
 * app's own origin, where the signed-in person's session lives.
 */
const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf"]);

interface FileRow {
  id: string;
  project_id: string;
  name: string;
  content_type: string;
  size: number;
  storage_key: string;
  uploaded_by: string;
  created_at: string;
}

const COLS = "id, project_id, name, content_type, size, storage_key, uploaded_by, created_at";

function shape(f: FileRow) {
  const { storage_key: _key, ...rest } = f;
  return { ...rest, url: `/api/files/${f.id}` };
}

/** A filename that is safe in a header and readable in a list. */
function fileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  return clean(base, 200) || "file";
}

function disposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function registerFiles(app: App) {
  const list = createRoute({
    method: "get",
    path: "/api/projects/{id}/files",
    tags: ["Files"],
    summary: "A project's files, newest first",
    request: { params: z.object({ id: z.string() }), query: PageQuery },
    responses: { 200: pagedResponse("items", FileSchema), 403: fail("No organisation"), 404: fail("Project not found") },
  });

  app.openapi(list, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const { id } = c.req.valid("param");
    if (!(await loadProject(o, id))) return c.json({ error: "Project not found" }, 404);
    const { page, limit, offset, search } = pageParams(c.req.valid("query"), { defaultLimit: 50 });
    const where = ["org_id = ?", "project_id = ?"];
    const args: unknown[] = [o, id];
    if (search) {
      where.push("name LIKE ?");
      args.push(`%${search}%`);
    }
    const clause = where.join(" AND ");
    const total = (await get<{ n: number }>(`SELECT COUNT(*) AS n FROM files WHERE ${clause}`, args))?.n ?? 0;
    const rows = await query<FileRow>(`SELECT ${COLS} FROM files WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
      ...args,
      limit,
      offset,
    ]);
    return c.json({ items: rows.map(shape), total, page, limit } as never, 200);
  });

  const upload = createRoute({
    method: "post",
    path: "/api/projects/{id}/files",
    tags: ["Files"],
    summary: "Add a file to a project",
    description: `multipart/form-data with one \`file\` field. At most ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object({ file: z.any().openapi({ type: "string", format: "binary" }) }),
          },
        },
      },
    },
    responses: {
      200: ok("The stored file", FileSchema),
      400: fail("No file, or too large"),
      403: fail("No organisation"),
      404: fail("Project not found"),
      503: fail("File storage is not set up for this app"),
    },
  });

  app.openapi(upload, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ error: "File storage is not set up for this app" }, 503);
    const { id: projectId } = c.req.valid("param");
    if (!(await loadProject(o, projectId))) return c.json({ error: "Project not found" }, 404);
    const declared = Number(c.req.header("content-length") || 0);
    if (declared > MAX_FILE_BYTES + 64 * 1024) return c.json({ error: "That file is larger than 50 MB" }, 400);
    const { file } = c.req.valid("form") as { file: unknown };
    if (!(file instanceof File)) return c.json({ error: "Send the file in a field named `file`" }, 400);
    if (file.size === 0) return c.json({ error: "That file is empty" }, 400);
    if (file.size > MAX_FILE_BYTES) return c.json({ error: "That file is larger than 50 MB" }, 400);

    const id = uid();
    const key = `${o}/${projectId}/${id}`;
    const type = (file.type || "application/octet-stream").slice(0, 120);
    // Bytes, not the stream: object storage needs a known length up front.
    await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
    const row: FileRow = {
      id,
      project_id: projectId,
      name: fileName(file.name),
      content_type: type,
      size: file.size,
      storage_key: key,
      uploaded_by: actor(c),
      created_at: now(),
    };
    await run(
      `INSERT INTO files (id, org_id, project_id, name, content_type, size, storage_key, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, o, row.project_id, row.name, row.content_type, row.size, row.storage_key, row.uploaded_by, row.created_at],
    );
    return c.json(shape(row) as never, 200);
  });

  const read = createRoute({
    method: "get",
    path: "/api/files/{id}",
    tags: ["Files"],
    summary: "Read a file",
    description: "Images and PDFs open in place; anything else downloads. Add ?download=1 to always download.",
    request: { params: z.object({ id: z.string() }), query: z.object({ download: z.string().optional() }) },
    responses: {
      200: { description: "The file's bytes", content: { "application/octet-stream": { schema: z.any().openapi({ type: "string", format: "binary" }) } } },
      403: fail("No organisation"),
      404: fail("Not found"),
    },
  });

  app.openapi(read, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const bucket = c.env.UPLOADS;
    const f = await get<FileRow>(`SELECT ${COLS} FROM files WHERE org_id = ? AND id = ?`, [o, c.req.valid("param").id]);
    if (!f || !bucket) return c.json({ error: "File not found" }, 404);
    const obj = await bucket.get(f.storage_key);
    if (!obj) return c.json({ error: "File not found" }, 404);
    const inline = INLINE.has(f.content_type) && !c.req.valid("query").download;
    return new Response(obj.body, {
      headers: {
        "Content-Type": inline ? f.content_type : "application/octet-stream",
        "Content-Disposition": disposition(inline ? "inline" : "attachment", f.name),
        "Content-Length": String(obj.size),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    }) as never;
  });

  const remove = createRoute({
    method: "delete",
    path: "/api/files/{id}",
    tags: ["Files"],
    summary: "Delete a file",
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: ok("Deleted", OkSchema), 403: fail("No organisation"), 404: fail("Not found") },
  });

  app.openapi(remove, async (c) => {
    const o = org(c);
    if (!o) return c.json(NO_ORG, 403);
    const f = await get<FileRow>(`SELECT ${COLS} FROM files WHERE org_id = ? AND id = ?`, [o, c.req.valid("param").id]);
    if (!f) return c.json({ error: "File not found" }, 404);
    await c.env.UPLOADS?.delete(f.storage_key);
    await run(`DELETE FROM files WHERE org_id = ? AND id = ?`, [o, f.id]);
    return c.json({ ok: true }, 200);
  });
}

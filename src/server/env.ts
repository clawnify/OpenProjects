// The vocabulary every route module imports: bindings, the app type, and the
// few helpers that would otherwise be rewritten per file.

import { orgId, user, z, type OpenAPIHono, type RequestLike } from "@clawnify/app";
import type { DBEnv } from "@clawnify/db";

export interface Env {
  Bindings: DBEnv & {
    /** Object storage for project files. Bound when clawnify.json sets app.storage. */
    UPLOADS?: R2Bucket;
  };
}

export type App = OpenAPIHono<Env>;

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export const STATUSES = ["planned", "active", "on_hold", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
export const OkSchema = z.object({ ok: z.boolean() }).openapi("Ok");

export function ok<T extends z.ZodTypeAny>(description: string, schema: T) {
  return { description, content: { "application/json": { schema } } };
}

export function fail(description: string) {
  return { description, content: { "application/json": { schema: ErrorSchema } } };
}

/** The tenant key. Null means the caller has no organisation, which is no access. */
export function org(c: RequestLike): string | null {
  return orgId(c);
}

export const NO_ORG = { error: "No organisation on this request" } as const;

/** Who did it, for the record: the person's name, else what kind of caller it was. */
export function actor(c: RequestLike): string {
  const u = user(c);
  return (u?.name || u?.email || "").slice(0, 120);
}

/** Free text from a form: trimmed, control characters dropped, length capped. */
export function clean(s: string | undefined | null, max: number): string {
  return (s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

/** Split a comma list of statuses, keeping only known ones. */
export function statusList(s: string | undefined): Status[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter((x): x is Status => (STATUSES as readonly string[]).includes(x));
}

/** D1 refuses a statement with more than 100 bound values; chunk id lists under that. */
export const CHUNK = 80;
export function chunks<T>(xs: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

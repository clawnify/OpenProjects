// Shapes the API returns, and the reads more than one route needs.

import { z } from "@clawnify/app";
import { get, query } from "./db.js";
import { CHUNK, chunks, STATUSES } from "./env.js";

export const PhaseSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    start_date: z.string().openapi({ example: "2026-12-07", description: "First day, YYYY-MM-DD" }),
    end_date: z.string().openapi({ example: "2026-12-11", description: "Last day, inclusive" }),
    assignee: z.string().openapi({ description: "Who does it: a person, crew or subcontractor. Free text." }),
    done: z.number().openapi({ description: "1 when finished" }),
    position: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .openapi("Phase");

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    client: z.string(),
    location: z.string(),
    status: z.enum(STATUSES),
    notes: z.string(),
    created_by: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    start_date: z.string().nullable().openapi({ description: "Earliest phase start; null with no phases" }),
    end_date: z.string().nullable().openapi({ description: "Latest phase end; null with no phases" }),
    phase_count: z.number(),
    done_count: z.number(),
    file_count: z.number(),
  })
  .openapi("Project");

export const ConflictSchema = z
  .object({
    phase_id: z.string().openapi({ description: "The phase that has the clash" }),
    other_id: z.string(),
    other_name: z.string(),
    other_project_id: z.string(),
    other_project_name: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    assignee: z.string(),
  })
  .openapi("Conflict");

export const FileSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    content_type: z.string(),
    size: z.number(),
    uploaded_by: z.string(),
    created_at: z.string(),
    url: z.string().openapi({ description: "GET it to read the file; add ?download=1 to save it" }),
  })
  .openapi("File");

export type Phase = z.infer<typeof PhaseSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;

/** A project with the dates and counts derived from its phases and files. */
export const PROJECT_SELECT = `
  SELECT p.id, p.name, p.client, p.location, p.status, p.notes, p.created_by, p.created_at, p.updated_at,
    (SELECT MIN(start_date) FROM phases x WHERE x.org_id = p.org_id AND x.project_id = p.id) AS start_date,
    (SELECT MAX(end_date)   FROM phases x WHERE x.org_id = p.org_id AND x.project_id = p.id) AS end_date,
    (SELECT COUNT(*) FROM phases x WHERE x.org_id = p.org_id AND x.project_id = p.id) AS phase_count,
    (SELECT COUNT(*) FROM phases x WHERE x.org_id = p.org_id AND x.project_id = p.id AND x.done = 1) AS done_count,
    (SELECT COUNT(*) FROM files f  WHERE f.org_id = p.org_id AND f.project_id = p.id) AS file_count
  FROM projects p`;

/** The most phases one project may hold. A plan bigger than this is several projects. */
export const MAX_PHASES = 300;

export async function loadProject(org: string, id: string): Promise<Project | undefined> {
  return get<Project>(`${PROJECT_SELECT} WHERE p.org_id = ? AND p.id = ?`, [org, id]);
}

/** Every phase of the given projects, in plan order. */
export async function loadPhases(org: string, projectIds: string[]): Promise<Phase[]> {
  const out: Phase[] = [];
  for (const ids of chunks(projectIds)) {
    out.push(
      ...(await query<Phase>(
        `SELECT id, project_id, name, start_date, end_date, assignee, done, position, created_at, updated_at
           FROM phases WHERE org_id = ? AND project_id IN (${ids.map(() => "?").join(",")})
          ORDER BY project_id, position, start_date
          LIMIT ${MAX_PHASES * CHUNK}`,
        [org, ...ids],
      )),
    );
  }
  return out;
}

/**
 * Where the same person, crew or subcontractor is on two unfinished phases
 * on the same days, in any open project. A clash is shown, never blocked:
 * the plan may be right (a half day each) and the person deciding knows.
 */
export async function loadConflicts(org: string, phaseIds: string[]): Promise<Conflict[]> {
  const out: Conflict[] = [];
  for (const ids of chunks(phaseIds)) {
    out.push(
      ...(await query<Conflict>(
        `SELECT a.id AS phase_id, b.id AS other_id, b.name AS other_name, b.project_id AS other_project_id,
                p.name AS other_project_name, b.start_date, b.end_date, b.assignee
           FROM phases a
           JOIN projects pa ON pa.org_id = a.org_id AND pa.id = a.project_id AND pa.status <> 'done'
           JOIN phases b ON b.org_id = a.org_id AND b.id <> a.id
                        AND b.assignee = a.assignee COLLATE NOCASE
                        AND b.start_date <= a.end_date AND b.end_date >= a.start_date
                        AND b.done = 0
           JOIN projects p ON p.org_id = b.org_id AND p.id = b.project_id AND p.status <> 'done'
          WHERE a.org_id = ? AND a.assignee <> '' AND a.done = 0
            AND a.id IN (${ids.map(() => "?").join(",")})
          ORDER BY b.start_date
          LIMIT 500`,
        [org, ...ids],
      )),
    );
  }
  return out;
}

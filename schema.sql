-- OpenProjects schema.
--
-- Projects that run for weeks, their phases on a timeline, and the files that
-- belong to each one. `org_id` is the only tenant key; the platform injects it
-- on every request and every query filters on it.
--
-- Conventions:
--
--   * A date is TEXT 'YYYY-MM-DD'. It sorts correctly as a string and compares
--     with plain <, which is what the overlap checks rely on.
--   * A phase's end_date is inclusive: a phase on one day has start = end.
--   * A project has no dates of its own. It runs from its earliest phase start
--     to its latest phase end, so the plan and the project can never disagree.
--   * `assignee` is free text (a person, a crew, a subcontractor). Most people
--     on a site are not members of the workspace, so it is not a user id.
--
-- DDL only. A seed INSERT here fails the entire first deploy.

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  name        TEXT NOT NULL,
  client      TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  -- planned | active | on_hold | done
  status      TEXT NOT NULL DEFAULT 'planned',
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON projects (org_id, status);

CREATE TABLE IF NOT EXISTS phases (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  assignee    TEXT NOT NULL DEFAULT '',
  done        INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_phases_project ON phases (org_id, project_id, position);
CREATE INDEX IF NOT EXISTS idx_phases_dates ON phases (org_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_phases_assignee ON phases (org_id, assignee COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  project_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
  size          INTEGER NOT NULL DEFAULT 0,
  -- Where the bytes are in object storage: <org_id>/<project_id>/<id>.
  storage_key   TEXT NOT NULL,
  uploaded_by   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files (org_id, project_id, created_at);

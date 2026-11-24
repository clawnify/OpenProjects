# OpenProjects: how to run this app

Projects that run for weeks. Each project is a plan of phases on a Gantt
timeline (a start, an end, who does it) and one place for its documents,
drawings and photos. A person or crew on two phases at the same time is
flagged, never blocked.

## Division of labour: what you do, and what you leave to the app

- **Never work out double bookings yourself.** Every project, phase and timeline
  response carries `conflicts`: the phases whose assignee is also booked
  elsewhere on the same days, in any open project. Change the plan, then read
  `conflicts` back. Names match regardless of case.
- **Never compute a project's dates.** A project has no dates of its own: it
  runs from its earliest phase start to its latest phase end (`start_date`,
  `end_date` on the project). Change the phases and the project follows.
- **Move a whole project with one call**, `POST /api/projects/{id}/shift`, not
  phase by phase. It moves every phase by the same days and keeps the plan's
  shape.
- **Do the data entry.** Creating a project with its whole plan from a
  description, adding phases, renaming, reassigning, marking phases done: all
  yours.
- **Ask before you delete.** Deleting a project deletes its phases and its files
  for everyone, and cannot be undone.

## The procedure

Planning a project from a description ("we start the Keizersgracht job on
7 December: demolition a week, frames two weeks, then glazing"):

1. `GET /api/people` to reuse the names already in use, so one crew is not
   spelled three ways.
2. Draft the phases in order: name, `start_date`, `end_date` (inclusive, so a
   one-day phase has start = end), `assignee`. Skip weekends only if the person
   says they do not work them.
3. Show the plan to the person before creating it, unless they said to go ahead.
4. `POST /api/projects` with `name`, `client`, `location`, `status` and the
   `phases` array, in one call.
5. Read `conflicts` in the response. For each one, say who is double booked,
   on which days and with which other phase, and offer a fix (move a phase,
   reassign it). Change nothing until they choose.

Answering "what runs this week?" or "who is double booked?":

1. `GET /api/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD` with the week's Monday and
   Sunday. Each project comes with all its phases; keep the ones that overlap.
2. `conflicts` in the same response lists every clash. Group by assignee.

A project slipped ("push Schiphol back two weeks"):

1. Find it: `GET /api/projects?search=schiphol`.
2. `POST /api/projects/{id}/shift` with `{ "days": 14 }`. Negative days move it
   earlier.
3. Report the new dates and any `conflicts` the move created.

## Pages

- `/` The timeline: every active and planned project with its phases as bars,
  today's line, and the double bookings marked. **Screenshot-friendly**;
  `?scale=month` fits several months on one screen.
- `/projects` Every project with its status, dates, progress and file count.
- `/projects/{id}` One project: details, notes, its own plan, and its files
  (`?tab=files`).

## API anchors

Full shapes are in `/api/openapi.json` and `/llms.txt`, generated from the live
routes. The ones you will reach for most:

| When | Call |
|---|---|
| Anything across projects in a period | `GET /api/timeline?from=&to=` |
| Find a project | `GET /api/projects?search=&status=` |
| One project with its plan and clashes | `GET /api/projects/{id}` |
| Plan a new project in one go | `POST /api/projects` |
| Add a phase | `POST /api/projects/{id}/phases` |
| Move, resize, rename, reassign or finish a phase | `PATCH /api/phases/{id}` |
| Move a whole project | `POST /api/projects/{id}/shift` |
| A project's files | `GET /api/projects/{id}/files` |

A project's `notes` is a long text field on `/api/projects/{id}` (PATCH keeps
the fields you leave out); change part of it with edits rather than sending it
again.

## Reading failures

- `400` with "A phase cannot end before it starts" or "Use a real date": fix the
  dates you sent. Dates are `YYYY-MM-DD`.
- `403` "No organisation on this request": the call did not come through the
  platform with a workspace. Not something a retry fixes.
- `404`: the project, phase or file is gone or belongs to another workspace.
- `503` on a file upload: file storage is not set up for this deployment.

Nothing in this app spends credits.

## Applying the deploy answers

When the app is first set up from the deploy form:

- **company, projects, phases, people**: create one example project that uses
  them (its phases in the order given, the people as assignees, starting next
  Monday), so the timeline is not empty on first open. Say it is an example
  they can delete.
- **language**: translate every string in `src/client` (labels, buttons, empty
  states, dialogs, toasts) and the `description` texts the person reads. Keep
  dates and numbers formatted by the browser (`Intl`), which already follows the
  viewer's language. Keep identifiers, routes and API field names in English.
- **details**: apply what fits; ask about anything that would change the data
  model.

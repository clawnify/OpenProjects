# OpenProjects

Plan projects that run for weeks on a Gantt timeline, and keep each project's
drawings, quotes and site photos in one place.

An open-source app template provided by [Clawnify.com](https://clawnify.com).

[![Deploy with Clawnify](https://app.clawnify.com/deploy-button.svg)](https://app.clawnify.com/deploy?repo=clawnify/OpenProjects)

## What it does

- **A timeline of every project.** Each project is a plan of phases, each with a
  start, an end and who does it. They show as bars by day, week or month, with
  today's line and weekends shaded.
- **Change the plan by dragging.** Drag a bar to move a phase, drag its edge to
  change its length, drag a project's bar to move its whole plan. Arrow keys do
  the same for keyboard users.
- **Double bookings are flagged, not blocked.** When the same person, crew or
  subcontractor is on two phases on the same days, in any open project, both bars
  are marked and the timeline says how many. The plan may still be right; the
  person deciding knows.
- **One place for a project's files.** Drop drawings, the quote, permits and site
  photos on the project. Photos and PDFs open in place; anything else downloads.
- **Your agent can plan for you.** The API describes itself, so an agent can
  draft a project with its whole plan from a sentence, report what runs this
  week, or push a project back two weeks in one call.

A project has no dates of its own: it runs from its first phase to its last, so
the plan and the project can never disagree.

## Stack

| Part | What |
|---|---|
| Interface | React, Tailwind, shadcn/ui |
| API | Hono, OpenAPI described |
| Database | SQLite |
| Files | Object storage |

## Run it locally

```bash
pnpm install
pnpm dev        # creates the local database, then serves the app and the API
```

Open the address `vite` prints. The dev server stands in for the platform and
puts every request in one local workspace.

```bash
pnpm test       # date arithmetic: weeks, ISO week numbers, inclusive spans
pnpm typecheck
```

## License

MIT

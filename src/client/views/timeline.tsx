import { useMemo, useState } from "react";
import { useHostChanges } from "@clawnify/app/client";
import { CalendarDays, Plus, Search } from "lucide-react";
import { addDays, diffDays, weekStart, today } from "../../shared/dates";
import { act, refresh, useData, type Conflict, type Phase, type ProjectWithPhases } from "@/lib/api";
import { dateRange, days } from "@/lib/format";
import { navigate, setQuery, useLocation } from "@/lib/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gantt, type Scale } from "@/components/gantt";
import { NewProjectDialog, PhaseDialog } from "@/components/dialogs";
import { EmptyState, PageHeader, Picker, Skeleton, ViewBar } from "@/components/shared";

interface TimelineData {
  from: string;
  to: string;
  projects: ProjectWithPhases[];
  conflicts: Conflict[];
  total: number;
  page: number;
  limit: number;
}

const SCALES: { id: Scale; label: string }[] = [
  { id: "day", label: "Days" },
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
];

const SHOW: { id: string; label: string }[] = [
  { id: "active,planned", label: "Active and planned" },
  { id: "active", label: "Active" },
  { id: "planned", label: "Planned" },
  { id: "on_hold", label: "On hold" },
  { id: "done", label: "Done" },
  { id: "active,planned,on_hold,done", label: "All projects" },
];

/** The most days the chart draws at once: two years, the same cap as the API. */
const MAX_DAYS = 730;

export function Timeline() {
  useLocation();
  const params = new URLSearchParams(window.location.search);
  const scale = (SCALES.find((s) => s.id === params.get("scale"))?.id ?? "week") as Scale;
  const show = SHOW.find((s) => s.id === params.get("status")) ?? SHOW[0];
  const q = params.get("q") ?? "";
  const [typed, setTyped] = useState(q);
  const [jump, setJump] = useState(0);
  const [newProject, setNewProject] = useState(false);
  const [dialog, setDialog] = useState<{ project: ProjectWithPhases; phase: Phase | null } | null>(null);

  const t = today();
  const winFrom = addDays(weekStart(t), -7 * 8);
  const winTo = addDays(weekStart(t), 7 * 52 - 1);
  const { data, error } = useData<TimelineData>(
    `/api/timeline?from=${winFrom}&to=${winTo}&status=${show.id}&limit=100${q ? `&search=${encodeURIComponent(q)}` : ""}`,
  );
  useHostChanges(() => refresh());

  // Draw the window, widened to every phase it returned, capped at two years.
  const range = useMemo(() => {
    let from = winFrom;
    let to = winTo;
    for (const p of data?.projects ?? []) {
      if (p.start_date && p.start_date < from) from = p.start_date;
      if (p.end_date && p.end_date > to) to = addDays(p.end_date, 14);
    }
    from = weekStart(from);
    if (diffDays(from, to) > MAX_DAYS) to = addDays(from, MAX_DAYS);
    return { from, to };
  }, [data, winFrom, winTo]);

  const filtered = q !== "" || show.id !== SHOW[0].id;

  const movePhase = (phase: Phase, start: string, end: string) =>
    act("PATCH", `/api/phases/${phase.id}`, { start_date: start, end_date: end }, `${phase.name}: ${dateRange(start, end)}`);
  const shiftProject = (project: ProjectWithPhases, d: number) =>
    act("POST", `/api/projects/${project.id}/shift`, { days: d }, `Moved ${project.name} ${d > 0 ? "later" : "earlier"} by ${days(Math.abs(d))}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Timeline" sub={data && data.conflicts.length > 0 ? <ClashNote count={new Set(data.conflicts.map((c) => c.phase_id)).size} /> : undefined} />
      <ViewBar
        right={
          <>
            <div role="radiogroup" aria-label="Zoom" className="flex items-center rounded-full bg-secondary p-[3px]">
              {SCALES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={scale === s.id}
                  onClick={() => setQuery({ scale: s.id === "week" ? null : s.id })}
                  className={cn(
                    "h-6 rounded-sm px-2.5 text-[0.8125rem] font-medium transition-colors",
                    scale === s.id ? "bg-card text-foreground shadow-raised" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setJump((n) => n + 1)}>
              <CalendarDays /> Today
            </Button>
            <Button onClick={() => setNewProject(true)}>
              <Plus /> New project
            </Button>
          </>
        }
      >
        <Picker
          label="Which projects"
          value={<span>Showing {show.label.toLowerCase()}</span>}
          items={SHOW}
          render={(s) => ({ key: s.id, text: s.label, selected: s.id === show.id })}
          onPick={(s) => setQuery({ status: s.id === SHOW[0].id ? null : s.id })}
        />
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery({ q: typed.trim() || null });
          }}
          className="relative w-48 md:w-64"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search projects"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => setQuery({ q: typed.trim() || null })}
            placeholder="Search projects"
            className="pl-8"
          />
        </form>
        {data && <span className="text-[0.8125rem] text-muted-foreground tabular">{data.total === 1 ? "1 project" : `${data.total} projects`}</span>}
      </ViewBar>

      {error ? (
        <EmptyState title="The timeline did not load" body={error} action={<Button variant="outline" onClick={refresh}>Try again</Button>} />
      ) : !data ? (
        <div className="flex flex-col gap-2 p-6">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : data.projects.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No projects match"
            body={`Nothing ${show.id === SHOW[0].id ? "" : `${show.label.toLowerCase()} `}${q ? `matching “${q}” ` : ""}has work in this period.`}
            action={<Button variant="outline" onClick={() => { setTyped(""); setQuery({ q: null, status: null }); }}>Clear the filter</Button>}
          />
        ) : (
          <EmptyState
            title="Plan your first project"
            body="A project is a set of phases with a start, an end and who does each one. They show up here as bars you can drag."
            action={<Button onClick={() => setNewProject(true)}><Plus /> New project</Button>}
          />
        )
      ) : (
        <>
          <Gantt
            projects={data.projects}
            conflicts={data.conflicts}
            from={range.from}
            to={range.to}
            scale={scale}
            jumpToToday={jump}
            onOpenPhase={(phase, project) => setDialog({ project, phase })}
            onAddPhase={(project) => setDialog({ project, phase: null })}
            onOpenProject={(project) => navigate(`/projects/${project.id}`)}
            onMovePhase={movePhase}
            onShiftProject={shiftProject}
          />
          {data.total > data.projects.length && (
            <p className="border-t border-border px-6 py-2 text-[0.8125rem] text-muted-foreground">
              Showing {data.projects.length} of {data.total} projects. Search or filter to see the others.
            </p>
          )}
        </>
      )}

      <NewProjectDialog open={newProject} onOpenChange={setNewProject} />
      <PhaseDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        project={dialog?.project ?? null}
        phase={dialog?.phase ?? null}
        showProjectLink
      />
    </div>
  );
}

function ClashNote({ count }: { count: number }) {
  return (
    <span className="text-warning">
      {count === 1 ? "1 phase is double booked" : `${count} phases are double booked`}
    </span>
  );
}


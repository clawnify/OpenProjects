import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { addDays, diffDays, spanDays, today } from "../../shared/dates";
import { act, type Phase, type ProjectDetail, type ProjectWithPhases, type Status } from "@/lib/api";
import { days } from "@/lib/format";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DateField, PersonField } from "@/components/shared";

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium">{label}</label>
      {children}
      {hint && <p className="text-[0.75rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Where a new phase naturally goes: the day after the plan ends, or today. */
function nextStart(project: ProjectWithPhases): string {
  return project.end_date ? addDays(project.end_date, 1) : today();
}

/**
 * Add a phase, or change one. Reached from a bar on the timeline, a row on a
 * project's plan, or the "+" next to a project.
 */
export function PhaseDialog({ open, onOpenChange, project, phase, showProjectLink }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithPhases | null;
  phase: Phase | null;
  showProjectLink?: boolean;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [who, setWho] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    if (phase) {
      setName(phase.name);
      setStart(phase.start_date);
      setEnd(phase.end_date);
      setWho(phase.assignee);
      setDone(phase.done === 1);
    } else {
      const s = nextStart(project);
      setName("");
      setStart(s);
      setEnd(addDays(s, 4));
      setWho("");
      setDone(false);
    }
  }, [open, phase, project]);

  if (!project) return null;

  // Moving the start keeps the length, as dragging a bar does.
  const moveStart = (s: string) => {
    if (start && end) setEnd(addDays(s, diffDays(start, end)));
    setStart(s);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !start || !end) return;
    setBusy(true);
    const body = { name: name.trim(), start_date: start, end_date: end, assignee: who };
    const res = phase
      ? await act("PATCH", `/api/phases/${phase.id}`, { ...body, done }, "Phase saved")
      : await act("POST", `/api/projects/${project.id}/phases`, body, "Phase added");
    setBusy(false);
    if (res) onOpenChange(false);
  };

  const remove = async () => {
    if (!phase) return;
    if (await act("DELETE", `/api/phases/${phase.id}`, undefined, `Removed ${phase.name}`)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{phase ? phase.name : "Add a phase"}</DialogTitle>
            <DialogDescription>
              {showProjectLink ? (
                <a
                  href={`/projects/${project.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenChange(false);
                    navigate(`/projects/${project.id}`);
                  }}
                  className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                >
                  {project.name}
                </a>
              ) : (
                project.name
              )}
            </DialogDescription>
          </DialogHeader>

          <Field label="Name" htmlFor="phase-name">
            <Input id="phase-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Demolition, Frames, Glazing, Finishing" maxLength={120} required />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="phase-start">
              <DateField id="phase-start" label="Starts" value={start} onChange={moveStart} />
            </Field>
            <Field label="Ends" htmlFor="phase-end" hint={start && end ? days(spanDays(start, end)) : undefined}>
              <DateField id="phase-end" label="Ends" value={end} onChange={setEnd} min={start} />
            </Field>
          </div>
          <Field label="Who does it" htmlFor="phase-who" hint="A person, a crew or a subcontractor.">
            <PersonField id="phase-who" value={who} onChange={setWho} />
          </Field>
          {phase && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Done
            </label>
          )}

          <DialogFooter className={cn("items-center", phase && "sm:justify-between")}>
            {phase && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {phase.name}?</AlertDialogTitle>
                    <AlertDialogDescription>It comes off the plan of {project.name}. The project and its files stay.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>Remove phase</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={busy || !name.trim()}>{phase ? "Save" : "Add phase"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Create a project. Its plan is built on the project's own page, phase by phase. */
export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Status>("planned");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setClient("");
      setLocation("");
      setStatus("planned");
    }
  }, [open]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const p = await act<ProjectDetail>("POST", "/api/projects", { name: name.trim(), client, location, status }, "Project created");
    setBusy(false);
    if (p) {
      onOpenChange(false);
      navigate(`/projects/${p.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Add its phases next, on the project's page.</DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="project-name">
            <Input id="project-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office renovation, Keizersgracht 120" maxLength={160} required />
          </Field>
          <Field label="Client" htmlFor="project-client">
            <Input id="project-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Who it is for" maxLength={160} />
          </Field>
          <Field label="Location" htmlFor="project-location">
            <Input id="project-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address or site" maxLength={240} />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[0.8125rem] font-medium">Status</legend>
            <div className="flex gap-2">
              {(["planned", "active"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "h-8 flex-1 rounded-sm px-3 text-sm shadow-edge transition-colors",
                    status === s ? "bg-accent-tint font-medium text-accent-text shadow-[inset_0_0_0_1px_var(--accent-brand)]" : "bg-card hover:bg-secondary",
                  )}
                >
                  {s === "planned" ? "Planned" : "Active, under way"}
                </button>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !name.trim()}>Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

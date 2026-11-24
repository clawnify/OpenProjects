import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useChatContext, useHostChanges } from "@clawnify/app/client";
import { ArrowLeft, Download, ExternalLink, File as FileIcon, FileText, Trash2, TriangleAlert, Upload } from "lucide-react";
import { addDays, spanDays, today, weekStart } from "../../shared/dates";
import { act, api, refresh, say, STATUS_LABEL, useData, type FileItem, type Phase, type ProjectDetail, type Status } from "@/lib/api";
import { dateRange, fileSize, when } from "@/lib/format";
import { navigate, setQuery } from "@/lib/router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Gantt, type Scale } from "@/components/gantt";
import { PhaseDialog } from "@/components/dialogs";
import { CategoryBar, EmptyState, Picker, Skeleton, StatusBadge } from "@/components/shared";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function ProjectPage({ id, tab }: { id: string; tab: string | null }) {
  const { data: p, error } = useData<ProjectDetail>(`/api/projects/${id}`);
  useHostChanges(() => refresh());
  useChatContext(p ? { label: "Project", record: { type: "project", id: p.id, label: p.name } } : null);

  if (error) {
    return <EmptyState title="This project is not here" body={error} action={<Button variant="outline" onClick={() => navigate("/projects")}>All projects</Button>} />;
  }
  if (!p) return <div className="p-6"><Skeleton /></div>;

  const current = tab === "files" ? "files" : "plan";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Back to projects" onClick={() => navigate("/projects")}>
              <ArrowLeft />
            </Button>
          </TooltipTrigger>
          <TooltipContent>All projects</TooltipContent>
        </Tooltip>
        <CategoryBar id={p.id} className="h-6" />
        <InlineText
          value={p.name}
          label="Project name"
          className="min-w-0 flex-1 text-[1.375rem] font-semibold tracking-[-0.01em]"
          onSave={(v) => v.trim() && act("PATCH", `/api/projects/${p.id}`, { name: v.trim() })}
        />
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        <Details p={p} />
        <main className="flex min-h-[28rem] min-w-0 flex-1 flex-col lg:min-h-0">
          <Tabs
            value={current}
            onValueChange={(v) => setQuery({ tab: v === "files" ? "files" : null })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex h-12 shrink-0 items-center border-b border-border px-4 md:px-6">
              <TabsList>
                <TabsTrigger value="plan">Plan <Count n={p.phase_count} /></TabsTrigger>
                <TabsTrigger value="files">Files <Count n={p.file_count} /></TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="plan" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <Plan p={p} />
            </TabsContent>
            <TabsContent value="files" className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <Files p={p} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-xs bg-secondary px-1.5 text-[0.75rem] text-muted-foreground tabular">{n}</span>;
}

// ── Details column ────────────────────────────────────────────────────────

function Details({ p }: { p: ProjectDetail }) {
  const patch = (body: Record<string, unknown>) => act("PATCH", `/api/projects/${p.id}`, body);
  const weeks = p.start_date && p.end_date ? Math.ceil(spanDays(p.start_date, p.end_date) / 7) : 0;
  return (
    <aside className="flex shrink-0 flex-col border-b border-border lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex flex-col py-2">
        <Attribute label="Status">
          <Picker
            label="Status"
            value={<StatusBadge status={p.status} />}
            items={["planned", "active", "on_hold", "done"] as Status[]}
            render={(s) => ({ key: s, text: STATUS_LABEL[s], selected: s === p.status })}
            onPick={(s) => patch({ status: s })}
          />
        </Attribute>
        <Attribute label="Client">
          <InlineText value={p.client} label="Client" placeholder="Set client…" onSave={(v) => patch({ client: v })} />
        </Attribute>
        <Attribute label="Location">
          <InlineText value={p.location} label="Location" placeholder="Set location…" onSave={(v) => patch({ location: v })} />
        </Attribute>
        <Attribute label="Runs">
          {p.start_date ? (
            <span className="text-sm tabular">
              {dateRange(p.start_date, p.end_date)} <span className="text-muted-foreground">· {weeks === 1 ? "1 week" : `${weeks} weeks`}</span>
            </span>
          ) : (
            <span className="text-sm text-faint">From its phases</span>
          )}
        </Attribute>
        <Attribute label="Progress">
          <span className="text-sm tabular">
            {p.phase_count ? `${p.done_count} of ${p.phase_count} phases done` : <span className="text-faint">No phases yet</span>}
          </span>
        </Attribute>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-border px-4 py-3">
        <span className="text-[0.8125rem] font-medium text-muted-foreground">Notes</span>
        <InlineText
          value={p.notes}
          label="Notes"
          multiline
          placeholder="Access, keys, contacts on site, what was agreed…"
          onSave={(v) => patch({ notes: v })}
        />
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 py-3 text-[0.75rem] text-muted-foreground">
        <span>Created {when(p.created_at)}{p.created_by ? ` by ${p.created_by}` : ""}</span>
        <DeleteProject p={p} />
      </div>
    </aside>
  );
}

function Attribute({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3 px-4 [[data-agent]_&]:min-h-11">
      <span className="w-20 shrink-0 text-[0.8125rem] text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The value is the control: click it to edit, Enter or blur saves, Esc puts it back. */
function InlineText({ value, onSave, label, placeholder, className, multiline }: {
  value: string; onSave: (v: string) => unknown; label: string; placeholder?: string; className?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  const shell = "w-full rounded-sm px-1.5 py-1 -mx-1.5 text-left transition-colors";
  if (editing) {
    return multiline ? (
      <textarea
        ref={ref}
        aria-label={label}
        value={draft}
        rows={Math.max(4, draft.split("\n").length + 1)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={cn(shell, "resize-y bg-card text-sm shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--ring-halo)] outline-none", className)}
      />
    ) : (
      <input
        ref={ref}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={cn(shell, "bg-card text-sm shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--ring-halo)] outline-none", className)}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={`${label}: ${value || "not set"}. Click to edit.`}
      onClick={() => setEditing(true)}
      className={cn(shell, "text-sm hover:bg-secondary", multiline && "whitespace-pre-wrap", !value && "text-faint", className)}
    >
      {value || placeholder || "Set…"}
    </button>
  );
}

function DeleteProject({ p }: { p: ProjectDetail }) {
  const remove = async () => {
    if (await act("DELETE", `/api/projects/${p.id}`, undefined, `Deleted ${p.name}`)) navigate("/projects");
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="-ml-1.5 w-fit text-destructive hover:text-destructive">
          <Trash2 /> Delete project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its plan ({p.phase_count === 1 ? "1 phase" : `${p.phase_count} phases`}) and {p.file_count === 1 ? "1 file" : `${p.file_count} files`} are deleted with it. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={remove}>Delete project</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Plan tab ──────────────────────────────────────────────────────────────

const SCALES: { id: Scale; label: string }[] = [
  { id: "day", label: "Days" },
  { id: "week", label: "Weeks" },
  { id: "month", label: "Months" },
];

function Plan({ p }: { p: ProjectDetail }) {
  const [scale, setScale] = useState<Scale>("week");
  const [dialog, setDialog] = useState<{ phase: Phase | null } | null>(null);
  const t = today();
  const from = weekStart(addDays(p.start_date && p.start_date < t ? p.start_date : t, -7));
  const end = p.end_date && p.end_date > t ? p.end_date : t;
  const to = addDays(end, scale === "month" ? 120 : 28);
  const clashed = new Set(p.conflicts.map((c) => c.phase_id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 md:px-6">
        {clashed.size > 0 && (
          <span className="flex items-center gap-1.5 text-[0.8125rem] text-warning">
            <TriangleAlert className="size-4" />
            {clashed.size === 1 ? "1 phase is double booked" : `${clashed.size} phases are double booked`}. Hover a marked bar to see where.
          </span>
        )}
        <div role="radiogroup" aria-label="Zoom" className="ml-auto flex items-center rounded-full bg-secondary p-[3px]">
          {SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={scale === s.id}
              onClick={() => setScale(s.id)}
              className={cn(
                "h-6 rounded-sm px-2.5 text-[0.8125rem] font-medium transition-colors",
                scale === s.id ? "bg-card text-foreground shadow-raised" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <Gantt
        single
        projects={[p]}
        conflicts={p.conflicts}
        from={from}
        to={to}
        scale={scale}
        onOpenPhase={(phase) => setDialog({ phase })}
        onAddPhase={() => setDialog({ phase: null })}
        onMovePhase={(phase, s, e) => act("PATCH", `/api/phases/${phase.id}`, { start_date: s, end_date: e }, `${phase.name}: ${dateRange(s, e)}`)}
      />
      <PhaseDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} project={p} phase={dialog?.phase ?? null} />
    </div>
  );
}

// ── Files tab ─────────────────────────────────────────────────────────────

const IMAGE = /^image\/(png|jpeg|gif|webp|avif)$/;

function Files({ p }: { p: ProjectDetail }) {
  const { data } = useData<{ items: FileItem[]; total: number }>(`/api/projects/${p.id}/files?limit=100`);
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [over, setOver] = useState(false);

  const upload = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
    const ok = files.filter((f) => f.size <= MAX_FILE_BYTES && f.size > 0);
    let failed = 0;
    setProgress({ done: 0, of: ok.length });
    for (const [i, f] of ok.entries()) {
      const form = new FormData();
      form.append("file", f);
      try {
        await api("POST", `/api/projects/${p.id}/files`, form);
      } catch (e) {
        failed++;
        say(`${f.name}: ${(e as Error).message}`, true);
      }
      setProgress({ done: i + 1, of: ok.length });
    }
    setProgress(null);
    refresh();
    if (tooBig.length) say(`${tooBig.map((f) => f.name).join(", ")}: larger than 50 MB, not added`, true);
    else if (!failed && ok.length) say(ok.length === 1 ? `Added ${ok[0].name}` : `Added ${ok.length} files`);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void upload(e.dataTransfer.files);
  };

  return (
    <div
      className={cn("relative flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6", over && "shadow-[inset_0_0_0_2px_var(--ring)]")}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setOver(false);
      }}
      onDrop={onDrop}
    >
      <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => input.current?.click()} disabled={progress !== null}>
          <Upload /> Add files
        </Button>
        <span className="text-[0.8125rem] text-muted-foreground">
          {progress ? `Uploading ${progress.done} of ${progress.of}…` : "Or drop them here. Drawings, quotes, photos, up to 50 MB each."}
        </span>
      </div>

      {!data ? (
        <Skeleton />
      ) : data.items.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md p-12 text-center focus-visible:outline-none"
          style={{ outline: "1px dashed var(--border)", outlineOffset: "-1px" }} /* the dashed edge says "drop here" */
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-[0.9375rem] font-semibold">Keep this project's files here</span>
          <span className="max-w-sm text-sm text-muted-foreground">Drop drawings, the quote, permits and site photos, so everyone finds them in one place.</span>
        </button>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {data.items.map((f) => (
              <FileCard key={f.id} f={f} />
            ))}
          </ul>
          {data.total > data.items.length && (
            <p className="mt-4 text-[0.8125rem] text-muted-foreground">Showing the newest {data.items.length} of {data.total} files.</p>
          )}
        </>
      )}
    </div>
  );
}

function FileCard({ f }: { f: FileItem }) {
  const isImage = IMAGE.test(f.content_type);
  const ext = f.name.includes(".") ? f.name.split(".").pop()!.slice(0, 5).toUpperCase() : "";
  const remove = () => act("DELETE", `/api/files/${f.id}`, undefined, `Deleted ${f.name}`);
  return (
    <li className="group flex flex-col overflow-hidden rounded-md bg-card shadow-edge">
      <a href={f.url} target="_blank" rel="noreferrer" className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-secondary">
        {isImage ? (
          <img src={f.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            {f.content_type === "application/pdf" ? <FileText className="size-8" strokeWidth={1.5} /> : <FileIcon className="size-8" strokeWidth={1.5} />}
            {ext && <span className="rounded-xs bg-card px-1.5 text-[0.75rem] tabular">{ext}</span>}
          </span>
        )}
      </a>
      <div className="flex items-start gap-1 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
          <p className="truncate text-[0.75rem] text-muted-foreground">
            {fileSize(f.size)} · {when(f.created_at)}{f.uploaded_by ? ` · ${f.uploaded_by}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [[data-agent]_&]:opacity-100 [@media(pointer:coarse)]:opacity-100">
          <IconLink href={f.url} label={`Open ${f.name}`}><ExternalLink /></IconLink>
          <IconLink href={`${f.url}?download=1`} label={`Download ${f.name}`}><Download /></IconLink>
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${f.name}`}><Trash2 /></Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {f.name}?</AlertDialogTitle>
                <AlertDialogDescription>The file is removed from this project for everyone. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete file</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </li>
  );
}

function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon">
          <a href={href} target="_blank" rel="noreferrer" aria-label={label}>{children}</a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label.split(" ")[0]}</TooltipContent>
    </Tooltip>
  );
}


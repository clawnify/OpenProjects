import { useState } from "react";
import { useHostChanges } from "@clawnify/app/client";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { refresh, STATUS_LABEL, useData, type Project, type Status } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { navigate, setQuery, useLocation } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewProjectDialog } from "@/components/dialogs";
import { CategoryBar, EmptyState, PageHeader, Picker, Skeleton, StatusBadge, ViewBar } from "@/components/shared";

const SHOW: { id: string; label: string }[] = [
  { id: "", label: "All projects" },
  { id: "active", label: STATUS_LABEL.active },
  { id: "planned", label: STATUS_LABEL.planned },
  { id: "on_hold", label: STATUS_LABEL.on_hold },
  { id: "done", label: STATUS_LABEL.done },
];

const LIMIT = 50;

export function Projects() {
  useLocation();
  const params = new URLSearchParams(window.location.search);
  const show = SHOW.find((s) => s.id === (params.get("status") ?? "")) ?? SHOW[0];
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [typed, setTyped] = useState(q);
  const [newProject, setNewProject] = useState(false);
  const { data, error } = useData<{ items: Project[]; total: number; page: number; limit: number }>(
    `/api/projects?limit=${LIMIT}&page=${page}${show.id ? `&status=${show.id}` : ""}${q ? `&search=${encodeURIComponent(q)}` : ""}`,
  );
  useHostChanges(() => refresh());
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const filtered = q !== "" || show.id !== "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Projects" />
      <ViewBar
        right={
          <Button onClick={() => setNewProject(true)}>
            <Plus /> New project
          </Button>
        }
      >
        <Picker
          label="Status"
          value={<span>Showing {show.id ? show.label.toLowerCase() : "all projects"}</span>}
          items={SHOW}
          render={(s) => ({ key: s.id || "all", text: s.label, selected: s.id === show.id })}
          onPick={(s) => setQuery({ status: s.id || null, page: null })}
        />
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery({ q: typed.trim() || null, page: null });
          }}
          className="relative w-48 md:w-64"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search projects"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => setQuery({ q: typed.trim() || null, page: null })}
            placeholder="Name, client or location"
            className="pl-8"
          />
        </form>
        {data && <span className="text-[0.8125rem] text-muted-foreground tabular">{data.total === 1 ? "1 project" : `${data.total} projects`}</span>}
      </ViewBar>

      {error ? (
        <EmptyState title="The projects did not load" body={error} action={<Button variant="outline" onClick={refresh}>Try again</Button>} />
      ) : !data ? (
        <div className="p-6"><Skeleton /></div>
      ) : data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No projects match"
            body={q ? `Nothing matches “${q}”.` : `No project is ${show.label.toLowerCase()}.`}
            action={<Button variant="outline" onClick={() => { setTyped(""); setQuery({ q: null, status: null, page: null }); }}>Clear the filter</Button>}
          />
        ) : (
          <EmptyState
            title="No projects yet"
            body="Create one, then plan its phases and add its drawings, quotes and photos."
            action={<Button onClick={() => setNewProject(true)}><Plus /> New project</Button>}
          />
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead className="text-right">Phases</TableHead>
                <TableHead className="pr-6 text-right">Files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2.5">
                      <CategoryBar id={p.id} className="h-5" />
                      <a
                        href={`/projects/${p.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) return;
                          e.preventDefault();
                        }}
                        className="truncate font-medium hover:underline"
                      >
                        {p.name}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.client}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{p.location}</TableCell>
                  <TableCell><StatusBadge status={p.status as Status} /></TableCell>
                  <TableCell className="tabular">{shortDate(p.start_date) || <span className="text-faint">No phases</span>}</TableCell>
                  <TableCell className="tabular">{shortDate(p.end_date)}</TableCell>
                  <TableCell className="text-right tabular">{p.phase_count ? `${p.done_count}/${p.phase_count}` : "0"}</TableCell>
                  <TableCell className="pr-6 text-right tabular">{p.file_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 px-6 py-3 text-[0.8125rem] text-muted-foreground">
              <span className="tabular">Page {page} of {pages}</span>
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setQuery({ page: page - 1 > 1 ? String(page - 1) : null })}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => setQuery({ page: String(page + 1) })}>
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
      <NewProjectDialog open={newProject} onOpenChange={setNewProject} />
    </div>
  );
}

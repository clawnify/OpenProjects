import { AppNav, useChatCommands, useHostChanges, useHostNavigate } from "@clawnify/app/client";
import { refresh } from "@/lib/api";
import { navigate, useLocation } from "@/lib/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toast } from "@/components/shared";
import { Timeline } from "@/views/timeline";
import { Projects } from "@/views/projects";
import { ProjectPage } from "@/views/project";

export function App() {
  const loc = useLocation();
  const [path, search] = loc.split("?");
  const [view = "", id] = path.replace(/^\/+|\/+$/g, "").split("/");
  const tab = new URLSearchParams(search ?? "").get("tab");

  // The dashboard chat opens pages through our router, and after it writes
  // through the API every open screen re-reads.
  useHostNavigate((to) => navigate(to));
  useHostChanges(() => refresh());
  useChatCommands([
    {
      id: "this-week",
      label: "What runs this week",
      prompt: "Which phases run this week, across all active projects? List them by project with who does each one.",
    },
    {
      id: "double-booked",
      label: "Who is double booked",
      prompt: "Which people or crews are booked on two phases on the same days? For each clash, name both phases, their projects and the days they overlap, and suggest a fix. Change nothing yet.",
    },
    {
      id: "plan-project",
      label: "Plan a new project",
      prompt: "Plan a new project from this description, with phases, dates and who does each one. Show me the plan before creating it: ",
    },
    {
      id: "push-back",
      label: "Push a project back",
      prompt: "Move this project later by the number of weeks I give, keeping every phase in the same order and length: ",
    },
  ]);

  const active = view === "projects" ? "projects" : "timeline";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground md:flex-row">
        <div className="relative flex shrink-0">
          <AppNav
            title="Projects"
            icon="kanban"
            active={active}
            groups={[
              {
                items: [
                  { id: "timeline", label: "Timeline", href: "/", home: true },
                  { id: "projects", label: "All projects", href: "/projects", icon: "folder", color: "amber" },
                ],
              },
            ]}
            onNavigate={(item) => navigate(item.href ?? "/")}
          />
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {view === "projects" && id ? <ProjectPage key={id} id={id} tab={tab} /> : view === "projects" ? <Projects /> : <Timeline />}
        </main>
        <Toast />
      </div>
    </TooltipProvider>
  );
}

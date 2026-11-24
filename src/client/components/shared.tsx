import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, UserRound } from "lucide-react";
import { categoryClasses, cn } from "@/lib/utils";
import { STATUS_LABEL, toast, useData, type Status } from "@/lib/api";
import { longDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

/** A project owns one category colour, taken from its id so it never changes when it is renamed. */
export const projectColor = (id: string) => categoryClasses(id);

const STATUS_TONE: Record<Status, string> = {
  planned: "bg-cat-neutral-tint text-cat-neutral-text",
  active: "bg-info-tint text-info",
  on_hold: "bg-warning-tint text-warning",
  done: "bg-success-tint text-success",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.8125rem] font-medium", STATUS_TONE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Page toolbar row: heading-1 left, view state and the one action right. */
export function PageHeader({ title, sub, children, left }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; left?: ReactNode }) {
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2 md:px-6">
      {left}
      <h1 className="min-w-0 truncate text-[1.375rem] font-semibold tracking-[-0.01em]">{title}</h1>
      {sub && <span className="text-[0.8125rem] text-muted-foreground">{sub}</span>}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}

/** Second toolbar row: the state of the view on the left, settings and the action on the right. */
export function ViewBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2 md:px-6">
      {children}
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-busy="true" className={cn("h-48 animate-pulse rounded-md bg-secondary motion-reduce:animate-none", className)} />;
}

export function Toast() {
  const t = toast.use();
  if (!t) return null;
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-sm px-3.5 py-2 text-sm shadow-float",
        t.err ? "bg-destructive-tint text-destructive" : "bg-primary text-primary-foreground",
      )}
    >
      {t.text}
    </div>
  );
}

/** A white card: sentence-case title row, then its content. */
export function Panel({ title, meta, action, children, className, bodyClassName }: {
  title: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-md bg-card shadow-edge", className)}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <h2 className="text-[1.0625rem] font-semibold">{title}</h2>
        {meta != null && <span className="text-[0.8125rem] text-muted-foreground tabular">{meta}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={cn("px-4 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A view select: names its current value, opens the house combobox. */
export function Picker<T>({ value, items, label, render, onPick, align = "start" }: {
  value: ReactNode; items: T[]; label: string;
  render: (item: T) => { key: string; text: ReactNode; meta?: ReactNode; selected?: boolean };
  onPick: (item: T) => void; align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label}>
          {value}
          <ChevronDown className="text-muted-foreground" strokeWidth={1.5} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-0">
        <Command>
          {items.length > 10 && <CommandInput placeholder="Search" />}
          <CommandList>
            <CommandGroup>
              {items.map((it) => {
                const r = render(it);
                return (
                  <CommandItem
                    key={r.key}
                    value={r.key}
                    aria-selected={r.selected}
                    className={cn(r.selected && "bg-secondary font-medium")}
                    onSelect={() => {
                      onPick(it);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1">{r.text}</span>
                    {r.meta && <span className="text-xs text-muted-foreground">{r.meta}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** A date inside a form: the input shape with a calendar behind it. */
export function DateField({ id, value, onChange, label, min }: { id?: string; value: string; onChange: (d: string) => void; label: string; min?: string }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={`${label}: ${value ? longDate(value) : "not set"}`}
          className="flex h-8 w-full items-center gap-2 rounded-sm bg-card px-3 text-left text-sm shadow-edge focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--ring-halo)]"
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className={cn("flex-1 truncate", !value && "text-faint")}>{value ? longDate(value) : "Pick a date"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={min ? { before: new Date(`${min}T12:00:00`) } : undefined}
          onSelect={(d) => {
            if (!d) return;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-${day}`);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Who does a phase. Free text, because most people on a job are not members
 * of the workspace; names already used are offered first so one crew is not
 * spelled three ways.
 */
export function PersonField({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const { data } = useData<{ items: { name: string; phases: number }[] }>(open ? `/api/people?search=${encodeURIComponent(typed)}` : null);
  const names = data?.items ?? [];
  const exact = names.some((n) => n.name.toLowerCase() === typed.trim().toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={`Who: ${value || "nobody yet"}`}
          className="flex h-8 w-full items-center gap-2 rounded-sm bg-card px-3 text-left text-sm shadow-edge focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--ring-halo)]"
        >
          <UserRound className="size-4 text-muted-foreground" />
          <span className={cn("flex-1 truncate", !value && "text-faint")}>{value || "Set who does it"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="A person, crew or subcontractor" value={typed} onValueChange={setTyped} />
          <CommandList>
            <CommandEmpty>{typed.trim() ? null : "Type a name"}</CommandEmpty>
            <CommandGroup>
              {names.map((n) => (
                <CommandItem
                  key={n.name}
                  value={n.name}
                  aria-selected={n.name === value}
                  className={cn(n.name === value && "bg-secondary font-medium")}
                  onSelect={() => { onChange(n.name); setOpen(false); }}
                >
                  <span className="flex-1">{n.name}</span>
                  <span className="text-xs text-muted-foreground tabular">{n.phases}</span>
                </CommandItem>
              ))}
              {typed.trim() && !exact && (
                <CommandItem value={`new:${typed}`} onSelect={() => { onChange(typed.trim()); setOpen(false); }}>
                  Use “{typed.trim()}”
                </CommandItem>
              )}
              {value && (
                <CommandItem value="__clear" onSelect={() => { onChange(""); setOpen(false); }}>
                  <span className="text-muted-foreground">Nobody yet</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The 3px category bar at a row's left edge. */
export function CategoryBar({ id, className }: { id: string; className?: string }) {
  return <span aria-hidden className={cn("w-[3px] self-stretch rounded-full", projectColor(id).dot, className)} />;
}

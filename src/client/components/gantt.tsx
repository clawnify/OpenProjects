import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronDown, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { addDays, addMonths, diffDays, isoWeek, monthStart, spanDays, today as todayOf, weekStart, weekday } from "../../shared/dates";
import { cn } from "@/lib/utils";
import { dateRange, days, monthName, shortDate } from "@/lib/format";
import type { Conflict, Phase, ProjectWithPhases } from "@/lib/api";
import { projectColor } from "@/components/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Scale = "day" | "week" | "month";

/** Pixels per day at each zoom. A week is 7 of them. */
export const PX: Record<Scale, number> = { day: 36, week: 18, month: 5 };

interface Props {
  projects: ProjectWithPhases[];
  conflicts: Conflict[];
  /** First and last day drawn. `from` is moved back to a Monday. */
  from: string;
  to: string;
  scale: Scale;
  /** One project's own plan: phase rows only, no project rows. */
  single?: boolean;
  onOpenPhase: (phase: Phase, project: ProjectWithPhases) => void;
  onAddPhase: (project: ProjectWithPhases) => void;
  onOpenProject?: (project: ProjectWithPhases) => void;
  onMovePhase: (phase: Phase, start: string, end: string) => void;
  onShiftProject?: (project: ProjectWithPhases, days: number) => void;
  /** Bumped by the parent to scroll today into view. */
  jumpToToday?: number;
}

export function Gantt(p: Props) {
  const from = weekStart(p.from);
  const total = spanDays(from, p.to);
  const px = PX[p.scale];
  const width = total * px;
  const today = todayOf();
  const scroller = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const clashes = useMemo(() => {
    const m = new Map<string, Conflict[]>();
    for (const c of p.conflicts) m.set(c.phase_id, [...(m.get(c.phase_id) ?? []), c]);
    return m;
  }, [p.conflicts]);

  // Open on today, with up to two weeks of the past in view: less on a narrow
  // screen, where two weeks would push today out of sight.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.querySelector<HTMLElement>("[data-gantt-left]")?.offsetWidth ?? 0;
    const lane = el.clientWidth - left;
    el.scrollLeft = Math.max(0, diffDays(from, today) * px - Math.min(14 * px, lane / 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.scale, p.jumpToToday]);

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div
      ref={scroller}
      data-gantt-scroller
      className="relative min-h-0 flex-1 overflow-auto [--gantt-left:9.5rem] md:[--gantt-left:17rem]"
      role="region"
      aria-label="Project timeline"
    >
      <div className="relative" style={{ width: `calc(var(--gantt-left) + ${width}px)` }}>
        <Header from={from} to={p.to} scale={p.scale} px={px} today={today} single={p.single} />
        <div className="relative">
          <Grid from={from} total={total} scale={p.scale} px={px} today={today} />
          {p.projects.map((project) => {
            const open = p.single || !collapsed.has(project.id);
            return (
              <div key={project.id}>
                {!p.single && (
                  <ProjectRow
                    project={project}
                    from={from}
                    px={px}
                    open={open}
                    onToggle={() => toggle(project.id)}
                    onOpen={() => p.onOpenProject?.(project)}
                    onAdd={() => p.onAddPhase(project)}
                    onShift={(d) => p.onShiftProject?.(project, d)}
                  />
                )}
                {open &&
                  project.phases.map((ph) => (
                    <PhaseRow
                      key={ph.id}
                      phase={ph}
                      project={project}
                      from={from}
                      px={px}
                      clashes={clashes.get(ph.id) ?? []}
                      indent={!p.single}
                      onOpen={() => p.onOpenPhase(ph, project)}
                      onMove={(s, e) => p.onMovePhase(ph, s, e)}
                    />
                  ))}
                {open && p.single && (
                  <div className="flex h-10 [[data-agent]_&]:h-11">
                    <div className="sticky left-0 z-10 flex w-[var(--gantt-left)] shrink-0 items-center bg-background px-3 shadow-[inset_-1px_0_0_var(--border)]">
                      <button
                        type="button"
                        onClick={() => p.onAddPhase(project)}
                        className="flex h-7 items-center gap-1.5 rounded-sm px-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Plus className="size-4" /> Add phase
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Header: months over weeks (or days, or years over months) ────────────

function Header({ from, to, scale, px, today, single }: { from: string; to: string; scale: Scale; px: number; today: string; single?: boolean }) {
  const top: { key: string; left: number; width: number; label: string }[] = [];
  const bottom: { key: string; left: number; width: number; label: string; muted?: boolean; now?: boolean }[] = [];
  const end = addDays(to, 1);

  if (scale === "month") {
    for (let y = from.slice(0, 4); `${y}-01-01` < end; y = String(Number(y) + 1)) {
      const s = `${y}-01-01` < from ? from : `${y}-01-01`;
      const e = `${Number(y) + 1}-01-01` > end ? end : `${Number(y) + 1}-01-01`;
      top.push({ key: y, left: diffDays(from, s) * px, width: diffDays(s, e) * px, label: y });
    }
    for (let m = monthStart(from); m < end; m = addMonths(m, 1)) {
      const s = m < from ? from : m;
      const e = addMonths(m, 1) > end ? end : addMonths(m, 1);
      bottom.push({ key: m, left: diffDays(from, s) * px, width: diffDays(s, e) * px, label: monthName(m, false).slice(0, 3), now: today.slice(0, 7) === m.slice(0, 7) });
    }
  } else {
    for (let m = monthStart(from); m < end; m = addMonths(m, 1)) {
      const s = m < from ? from : m;
      const e = addMonths(m, 1) > end ? end : addMonths(m, 1);
      top.push({ key: m, left: diffDays(from, s) * px, width: diffDays(s, e) * px, label: monthName(m, true) });
    }
    if (scale === "week") {
      for (let w = from; w < end; w = addDays(w, 7)) {
        bottom.push({ key: w, left: diffDays(from, w) * px, width: 7 * px, label: `W${isoWeek(w)} · ${shortDate(w)}`, now: weekStart(today) === w });
      }
    } else {
      for (let d = from; d < end; d = addDays(d, 1)) {
        bottom.push({ key: d, left: diffDays(from, d) * px, width: px, label: String(Number(d.slice(8, 10))), muted: weekday(d) >= 5, now: d === today });
      }
    }
  }

  return (
    <div className="sticky top-0 z-20 flex h-16 bg-background shadow-[inset_0_-1px_0_var(--border)]">
      <div data-gantt-left className="sticky left-0 z-30 flex w-[var(--gantt-left)] shrink-0 items-end bg-background px-3 pb-2 text-[0.8125rem] font-medium text-muted-foreground shadow-[inset_-1px_-1px_0_var(--border)]">
        {single ? "Phase" : "Project"}
      </div>
      <div className="relative flex-1">
        {top.map((t) => (
          <div key={t.key} className="absolute top-0 flex h-8 items-center overflow-hidden whitespace-nowrap px-2 text-[0.8125rem] font-medium shadow-[inset_1px_0_0_var(--rule)]" style={{ left: t.left, width: t.width }}>
            {t.label}
          </div>
        ))}
        {bottom.map((b) => (
          <div
            key={b.key}
            className={cn(
              "absolute bottom-0 flex h-8 items-center justify-center overflow-hidden whitespace-nowrap text-[0.75rem] tabular shadow-[inset_1px_0_0_var(--rule)]",
              b.muted ? "text-faint" : "text-muted-foreground",
              b.now && "font-semibold text-foreground",
            )}
            style={{ left: b.left, width: b.width }}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Background: weekends, week or month lines, today ─────────────────────

function Grid({ from, total, scale, px, today }: { from: string; total: number; scale: Scale; px: number; today: string }) {
  const t = diffDays(from, today);
  const lines: number[] = [];
  if (scale === "month") {
    for (let m = addMonths(monthStart(from), 1); diffDays(from, m) < total; m = addMonths(m, 1)) lines.push(diffDays(from, m));
  }
  // `from` is a Monday, so a 7-day repeating background lines up with the weeks.
  const week = 7 * px;
  const weekends = scale === "month" ? "none" : `linear-gradient(to right, transparent ${5 * px}px, var(--secondary) ${5 * px}px)`;
  const weekLines = scale === "month" ? "none" : "linear-gradient(to right, var(--rule) 1px, transparent 1px)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-[var(--gantt-left)]"
      style={{ width: total * px, backgroundImage: `${weekLines}, ${weekends}`, backgroundSize: `${week}px 100%, ${week}px 100%` }}
    >
      {lines.map((l) => (
        <div key={l} className="absolute inset-y-0 w-px bg-rule" style={{ left: l * px }} />
      ))}
      {t >= 0 && t < total && (
        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/50" style={{ left: t * px + px / 2 }} />
      )}
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────

function LeftCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky left-0 z-10 flex w-[var(--gantt-left)] shrink-0 items-center gap-2 bg-background px-3 shadow-[inset_-1px_0_0_var(--border),inset_0_-1px_0_var(--rule)]", className)}>
      {children}
    </div>
  );
}

function ProjectRow({ project, from, px, open, onToggle, onOpen, onAdd, onShift }: {
  project: ProjectWithPhases; from: string; px: number; open: boolean;
  onToggle: () => void; onOpen: () => void; onAdd: () => void; onShift: (days: number) => void;
}) {
  const color = projectColor(project.id);
  const has = project.start_date && project.end_date;
  const drag = useDrag({
    px,
    onCommit: (dStart) => onShift(dStart),
    onClick: onOpen,
    resetKey: `${project.start_date}|${project.end_date}`,
  });
  const left = has ? (diffDays(from, project.start_date!) + drag.dStart) * px : 0;
  const width = has ? spanDays(project.start_date!, project.end_date!) * px : 0;
  return (
    <div className="flex h-11 shadow-[inset_0_-1px_0_var(--rule)] [[data-agent]_&]:h-12">
      <LeftCell className="pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Hide the phases of ${project.name}` : `Show the phases of ${project.name}`}
          aria-expanded={open}
          className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span aria-hidden className={cn("h-5 w-[3px] shrink-0 rounded-full", color.dot)} />
        <a
          href={`/projects/${project.id}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            onOpen();
          }}
          className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
        >
          {project.name}
        </a>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Add a phase to ${project.name}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Add a phase</TooltipContent>
        </Tooltip>
      </LeftCell>
      <div className="relative flex-1">
        {has ? (
          <button
            type="button"
            {...drag.handlers("move")}
            aria-label={`${project.name}: ${dateRange(project.start_date, project.end_date)}. Drag to move the whole plan.`}
            className={cn(
              "absolute top-1/2 h-2.5 -translate-y-1/2 cursor-grab rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] active:cursor-grabbing",
              color.dot,
              drag.dragging && "opacity-100",
            )}
            style={{ left, width: Math.max(width, 4) }}
          />
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="absolute top-1/2 ml-3 flex h-7 -translate-y-1/2 items-center gap-1.5 rounded-sm px-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            style={{ left: Math.max(0, diffDays(from, todayOf()) * px) }}
          >
            <Plus className="size-4" /> No phases yet. Add the first one
          </button>
        )}
        {drag.dragging && drag.dStart !== 0 && has && (
          <DragHint left={left} text={`${drag.dStart > 0 ? "+" : ""}${days(drag.dStart)}: ${dateRange(addDays(project.start_date!, drag.dStart), addDays(project.end_date!, drag.dStart))}`} />
        )}
      </div>
    </div>
  );
}

function PhaseRow({ phase, project, from, px, clashes, indent, onOpen, onMove }: {
  phase: Phase; project: ProjectWithPhases; from: string; px: number; clashes: Conflict[]; indent: boolean;
  onOpen: () => void; onMove: (start: string, end: string) => void;
}) {
  const color = projectColor(project.id);
  const done = phase.done === 1;
  const drag = useDrag({
    px,
    onCommit: (dStart, dEnd) => onMove(addDays(phase.start_date, dStart), addDays(phase.end_date, dEnd)),
    onClick: onOpen,
    length: spanDays(phase.start_date, phase.end_date),
    resetKey: `${phase.start_date}|${phase.end_date}`,
  });
  const start = addDays(phase.start_date, drag.dStart);
  const end = addDays(phase.end_date, drag.dEnd);
  const left = diffDays(from, start) * px;
  const width = spanDays(start, end) * px;
  const labelInside = width >= 96;
  const clashText = clashes.length
    ? `${phase.assignee} is also on ${clashes.map((c) => `${c.other_name} (${c.other_project_name}, ${dateRange(c.start_date, c.end_date)})`).join("; ")}`
    : "";

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 7 : 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = e.key === "ArrowLeft" ? -step : step;
      if (e.altKey) {
        // Alt+arrow changes the length; a phase never ends before it starts.
        const newEnd = addDays(phase.end_date, d);
        if (newEnd >= phase.start_date) onMove(phase.start_date, newEnd);
      } else onMove(addDays(phase.start_date, d), addDays(phase.end_date, d));
    }
  };

  const bar = (
    <button
      type="button"
      {...drag.handlers("move")}
      onKeyDown={onKey}
      aria-label={`${phase.name}, ${dateRange(start, end)}, ${days(spanDays(start, end))}${phase.assignee ? `, ${phase.assignee}` : ""}${done ? ", done" : ""}${clashText ? `. Double booked: ${clashText}` : ""}. Arrow keys move it, Alt and an arrow change its length.`}
      className={cn(
        "group/bar absolute top-1/2 flex h-7 -translate-y-1/2 cursor-grab items-center gap-1.5 overflow-hidden rounded-sm pl-2.5 pr-2 text-left text-[0.8125rem] font-medium transition-shadow focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] active:cursor-grabbing",
        done ? "bg-cat-neutral-tint text-cat-neutral-text" : cn(color.bg, color.text),
        drag.dragging && "shadow-float",
      )}
      style={{ left, width: Math.max(width, 8) }}
    >
      <span aria-hidden className={cn("absolute inset-y-1 left-1 w-[3px] rounded-full", done ? "bg-cat-neutral-solid" : color.dot)} />
      {clashes.length > 0 && <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-warning" />}
      {done && <Check aria-hidden className="size-3.5 shrink-0" />}
      {labelInside && <span className="truncate">{phase.name}</span>}
      <span
        aria-hidden
        {...drag.handlers("start")}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 [[data-agent]_&]:opacity-100"
      />
      <span
        aria-hidden
        {...drag.handlers("end")}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-sm opacity-0 group-hover/bar:bg-foreground/10 group-hover/bar:opacity-100 [[data-agent]_&]:opacity-100"
      />
    </button>
  );

  return (
    <div className="flex h-10 shadow-[inset_0_-1px_0_var(--rule)] [[data-agent]_&]:h-11">
      <LeftCell className={cn(indent && "pl-10")}>
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className={cn("w-full truncate text-sm", done && "text-muted-foreground")}>{phase.name}</span>
          {phase.assignee && <span className="w-full truncate text-[0.75rem] text-muted-foreground">{phase.assignee}</span>}
        </button>
      </LeftCell>
      <div className="relative flex-1">
        {clashes.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>{bar}</TooltipTrigger>
            <TooltipContent className="max-w-xs">Double booked: {clashText}</TooltipContent>
          </Tooltip>
        ) : (
          bar
        )}
        {!labelInside && (
          <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.8125rem] text-muted-foreground" style={{ left: left + Math.max(width, 8) + 6 }}>
            {phase.name}
          </span>
        )}
        {drag.dragging && (drag.dStart !== 0 || drag.dEnd !== 0) && <DragHint left={left} text={`${dateRange(start, end)} · ${days(spanDays(start, end))}`} />}
      </div>
    </div>
  );
}

function DragHint({ left, text }: { left: number; text: string }) {
  return (
    <span className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-sm bg-primary px-2 py-0.5 text-[0.75rem] text-primary-foreground tabular" style={{ left }}>
      {text}
    </span>
  );
}

// ── Dragging ──────────────────────────────────────────────────────────────

type Mode = "move" | "start" | "end";

/** How close to the lane's edge, in px, a drag starts scrolling the timeline. */
const EDGE = 48;
/** Fastest auto-scroll, in px per second, reached at the edge and beyond it. Per second, not per frame, so a 120 Hz screen scrolls no faster. */
const MAX_SPEED = 700;

type DragState = {
  mode: Mode;
  /** Pointer x and the timeline's scrollLeft when the press started. */
  x: number;
  scroll0: number;
  /** The latest pointer x, which auto-scroll keeps measuring from while the pointer rests. */
  lastX: number;
  moved: boolean;
  pointer: number;
  scroller: HTMLElement | null;
  raf: number;
  /** Time of the last auto-scroll frame, and the fraction of a pixel not scrolled yet. */
  t: number;
  carry: number;
};

/** Days dragged so far: the pointer's travel plus however far the timeline scrolled under it. */
function travel(s: DragState, clientX: number) {
  return clientX - s.x + (s.scroller ? s.scroller.scrollLeft - s.scroll0 : 0);
}

/**
 * Auto-scroll speed in px per second for a pointer at x: negative near the
 * lane's left edge (just right of the sticky name column), positive near the
 * right edge, faster the closer it gets and full speed past the edge.
 */
function edgeSpeed(scroller: HTMLElement, x: number) {
  const box = scroller.getBoundingClientRect();
  const laneLeft = scroller.querySelector<HTMLElement>("[data-gantt-left]")?.getBoundingClientRect().right ?? box.left;
  const ramp = (d: number) => MAX_SPEED * Math.min(1, (EDGE - d) / EDGE);
  if (x < laneLeft + EDGE && scroller.scrollLeft > 0) return -ramp(x - laneLeft);
  if (x > box.right - EDGE && scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth) return ramp(box.right - x);
  return 0;
}

/**
 * Pointer drag that snaps to whole days. A press that does not move is a
 * click. Touch never drags: on a phone a swipe scrolls the timeline and a tap
 * opens the phase, where its dates can be changed. Held near either edge of
 * the timeline, a drag scrolls it, so a phase can be moved past what is in view.
 */
function useDrag({ px, onCommit, onClick, length = Infinity, resetKey }: {
  px: number; onCommit: (dStart: number, dEnd: number) => void; onClick: () => void; length?: number;
  /** The saved dates. When they change, the drop has landed and the offset goes. */
  resetKey: string;
}) {
  const [delta, setDelta] = useState({ dStart: 0, dEnd: 0, dragging: false });
  const state = useRef<DragState | null>(null);
  // The auto-scroll loop outlives the render that started it; it reads these.
  const latest = useRef({ px, length });
  latest.current = { px, length };

  const stopScroll = () => {
    const s = state.current;
    if (s?.raf) cancelAnimationFrame(s.raf);
    if (s) s.raf = 0;
  };
  useEffect(() => () => stopScroll(), []);

  // Keep the dropped position until the saved dates arrive, so a bar does not
  // jump back for a moment and then forward again. If the save fails the
  // dates never change, and the bar goes back after a moment.
  const committed = useRef(false);
  useEffect(() => {
    committed.current = false;
    setDelta({ dStart: 0, dEnd: 0, dragging: false });
  }, [resetKey]);
  useEffect(() => {
    if (!committed.current) return;
    const t = setTimeout(() => {
      committed.current = false;
      setDelta({ dStart: 0, dEnd: 0, dragging: false });
    }, 1500);
    return () => clearTimeout(t);
  }, [delta.dragging]);

  const calc = (mode: Mode, d: number, len = length) => {
    if (mode === "move") return { dStart: d, dEnd: d };
    if (mode === "start") return { dStart: Math.min(d, len - 1), dEnd: 0 };
    return { dStart: 0, dEnd: Math.max(d, -(len - 1)) };
  };

  // One frame of auto-scroll: move the timeline, then the bar by the same
  // distance, and go again while the pointer stays near the edge.
  const tick = (now: number) => {
    const s = state.current;
    if (!s?.scroller) return;
    const v = edgeSpeed(s.scroller, s.lastX);
    if (!v) {
      s.raf = 0;
      return;
    }
    // The first frame only sets the clock; a long gap (a background tab) counts as one frame.
    const dt = s.t ? Math.min(now - s.t, 50) / 1000 : 0;
    s.t = now;
    const step = v * dt + s.carry;
    const whole = Math.trunc(step);
    s.carry = step - whole;
    s.scroller.scrollLeft += whole;
    const { px: p, length: len } = latest.current;
    setDelta({ ...calc(s.mode, Math.round(travel(s, s.lastX) / p), len), dragging: true });
    s.raf = requestAnimationFrame(tick);
  };

  const handlers = (mode: Mode) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || e.pointerType === "touch") return;
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks; the drag still works while it stays over the bar.
      }
      const scroller = e.currentTarget.closest<HTMLElement>("[data-gantt-scroller]");
      state.current = {
        mode, x: e.clientX, lastX: e.clientX, scroll0: scroller?.scrollLeft ?? 0,
        moved: false, pointer: e.pointerId, scroller, raf: 0, t: 0, carry: 0,
      };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = state.current;
      if (!s || s.mode !== mode || s.pointer !== e.pointerId) return;
      s.lastX = e.clientX;
      const dx = travel(s, e.clientX);
      if (!s.moved && Math.abs(dx) < 4) return;
      s.moved = true;
      setDelta({ ...calc(mode, Math.round(dx / px)), dragging: true });
      if (!s.raf && s.scroller && edgeSpeed(s.scroller, e.clientX)) {
        s.t = 0;
        s.carry = 0;
        s.raf = requestAnimationFrame(tick);
      }
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const s = state.current;
      if (!s || s.mode !== mode || s.pointer !== e.pointerId) return;
      e.stopPropagation();
      stopScroll();
      state.current = null;
      if (!s.moved) {
        setDelta({ dStart: 0, dEnd: 0, dragging: false });
        onClick();
        return;
      }
      const d = calc(mode, Math.round(travel(s, e.clientX) / px));
      if (d.dStart === 0 && d.dEnd === 0) {
        setDelta({ dStart: 0, dEnd: 0, dragging: false });
        return;
      }
      committed.current = true;
      setDelta({ ...d, dragging: false });
      onCommit(d.dStart, d.dEnd);
    },
    onPointerCancel: () => {
      stopScroll();
      state.current = null;
      setDelta({ dStart: 0, dEnd: 0, dragging: false });
    },
    // A keyboard press or a touch tap arrives as a click with no pointer drag.
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (mode !== "move") return;
      if ((e.nativeEvent as PointerEvent).pointerType === "mouse" || (e.nativeEvent as PointerEvent).pointerType === "pen") return;
      onClick();
    },
  });

  return { ...delta, handlers };
}

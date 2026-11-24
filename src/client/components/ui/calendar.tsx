import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** The house date grid: weeks start on Monday, the chosen day is a highlight, not a fill. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn("p-1", className)}
      classNames={{
        months: "relative flex flex-col gap-4",
        month: "flex w-full flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7"),
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-sm font-medium",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[0.75rem] font-normal text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative size-9 p-0 text-center text-sm tabular",
        day_button:
          "size-9 rounded-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--ring-halo)]",
        selected: "[&>button]:bg-secondary [&>button]:font-semibold [&>button]:shadow-[inset_0_0_0_1px_var(--ring)]",
        today: "[&>button]:text-accent-text [&>button]:font-semibold",
        outside: "text-faint",
        disabled: "opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === "left" ? <ChevronLeft className={cn("size-4", c)} /> : <ChevronRight className={cn("size-4", c)} />,
      }}
      {...props}
    />
  );
}

export { Calendar };

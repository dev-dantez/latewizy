"use client";

import { useMemo } from "react";
import { format } from "date-fns/format";
import { isToday } from "date-fns/isToday";
import { isTomorrow } from "date-fns/isTomorrow";
import { isPast } from "date-fns/isPast";
import type { CalendarEntry } from "@/hooks/use-calendar-entries";
import { EntryStatusBadge } from "./entry-status-badge";
import { Button } from "@/components/ui/button";
import { getPlatformName } from "@/lib/late-api/types";
import { CalendarDays, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlannerListProps {
  entries: CalendarEntry[];
  onEntryClick: (id: string) => void;
  onCreateClick: () => void;
}

function groupByDate(entries: CalendarEntry[]) {
  const groups: Record<string, CalendarEntry[]> = {};
  const unscheduled: CalendarEntry[] = [];

  for (const entry of entries) {
    if (!entry.scheduledFor) {
      unscheduled.push(entry);
      continue;
    }
    const key = format(new Date(entry.scheduledFor), "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  const sortedDates = Object.keys(groups).sort();
  return { sortedDates, groups, unscheduled };
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

export function PlannerList({ entries, onEntryClick, onCreateClick }: PlannerListProps) {
  const { sortedDates, groups, unscheduled } = useMemo(
    () => groupByDate(entries),
    [entries]
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-sm">No planned content</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Add a topic and AI will draft your post. You review and approve before it publishes.
        </p>
        <Button size="sm" className="mt-4" onClick={onCreateClick}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          Plan first post
        </Button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {/* Scheduled entries, grouped by date */}
      {sortedDates.map((dateKey) => {
        const dayEntries = groups[dateKey];
        const isOld = isPast(new Date(dateKey + "T23:59:59"));

        return (
          <div key={dateKey}>
            <div
              className={cn(
                "px-4 py-2 text-xs font-semibold sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border",
                isOld && "text-muted-foreground"
              )}
            >
              {dayLabel(dateKey)}
            </div>
            {dayEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onClick={() => onEntryClick(entry.id)}
              />
            ))}
          </div>
        );
      })}

      {/* Unscheduled entries */}
      {unscheduled.length > 0 && (
        <div>
          <div className="px-4 py-2 text-xs font-semibold sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-1" />
            Not yet scheduled
          </div>
          {unscheduled.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onClick={() => onEntryClick(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  onClick,
}: {
  entry: CalendarEntry;
  onClick: () => void;
}) {
  const platforms = entry.platforms as Array<{ platform: string }>;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
    >
      {/* Time */}
      <div className="w-14 shrink-0 text-xs text-muted-foreground pt-0.5">
        {entry.scheduledFor
          ? format(new Date(entry.scheduledFor), "h:mm a")
          : "—"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {entry.topic}
        </p>
        {entry.content ? (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {entry.content}
          </p>
        ) : entry.status === "generating" ? (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 italic">
            AI is drafting…
          </p>
        ) : null}

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {platforms.map((p, i) => (
              <span
                key={i}
                className="text-[10px] rounded-full bg-muted px-2 py-0.5 capitalize"
              >
                {getPlatformName(p.platform)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        <EntryStatusBadge status={entry.status} />
      </div>
    </button>
  );
}

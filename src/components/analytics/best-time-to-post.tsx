"use client";

import { useMemo } from "react";
import { parseISO, getDay, getHours } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AnalyticsPost } from "@/types/analytics";

interface BestTimeToPostProps {
  posts?: AnalyticsPost[];
  isLoading?: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Show every other hour label to avoid crowding
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = HOURS.map((h) =>
  h % 4 === 0
    ? h === 0
      ? "12am"
      : h < 12
      ? `${h}am`
      : h === 12
      ? "12pm"
      : `${h - 12}pm`
    : ""
);

interface Cell {
  day: number;
  hour: number;
  postCount: number;
  avgEngRate: number;
  totalLikes: number;
  /** Normalised 0-1 score used as fallback when engRate is unavailable */
  _score?: number;
}

function buildHeatmap(posts: AnalyticsPost[]): {
  cells: Cell[][];
  maxEngRate: number;
  hasEngData: boolean;
} {
  // cells[day][hour]
  const acc: Array<Array<{ engSum: number; engCount: number; likes: number; posts: number }>> =
    Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ engSum: 0, engCount: 0, likes: 0, posts: 0 }))
    );

  let hasEngData = false;

  for (const post of posts) {
    const dateStr = post.publishedAt ?? post.scheduledFor;
    if (!dateStr) continue;
    let d: Date;
    try {
      d = parseISO(dateStr);
    } catch {
      continue;
    }
    const day = getDay(d);
    const hour = getHours(d);
    acc[day][hour].posts += 1;
    acc[day][hour].likes += post.analytics?.likes ?? 0;
    if (post.analytics?.engagementRate !== undefined) {
      acc[day][hour].engSum += post.analytics.engagementRate;
      acc[day][hour].engCount += 1;
      hasEngData = true;
    }
  }

  let maxEngRate = 0;
  const cells: Cell[][] = acc.map((dayRow, day) =>
    dayRow.map((cell, hour) => {
      const avgEngRate = cell.engCount > 0 ? cell.engSum / cell.engCount : 0;
      if (avgEngRate > maxEngRate) maxEngRate = avgEngRate;
      return { day, hour, postCount: cell.posts, avgEngRate, totalLikes: cell.likes };
    })
  );

  // If no engRate data, normalise by totalLikes instead
  if (!hasEngData) {
    let maxLikes = 0;
    cells.forEach((row) => row.forEach((c) => { if (c.totalLikes > maxLikes) maxLikes = c.totalLikes; }));
    if (maxLikes > 0) {
      cells.forEach((row) =>
        row.forEach((c) => {
          // Repurpose _score field as normalised likes score for colouring
          c._score = c.totalLikes / maxLikes;
        })
      );
    }
  }

  return { cells, maxEngRate, hasEngData };
}

function cellIntensity(cell: Cell, maxEngRate: number, hasEngData: boolean): number {
  if (cell.postCount === 0) return 0;
  if (hasEngData) {
    return maxEngRate > 0 ? cell.avgEngRate / maxEngRate : 0.3;
  }
  return cell._score ?? 0.3;
}

export function BestTimeToPost({ posts, isLoading }: BestTimeToPostProps) {
  const { cells, maxEngRate, hasEngData } = useMemo(
    () => buildHeatmap(posts ?? []),
    [posts]
  );

  const hasPosts = (posts ?? []).some((p) => p.publishedAt || p.scheduledFor);

  // Find best slots (top 3 by intensity)
  const best = useMemo(() => {
    const flat: Array<Cell & { intensity: number }> = [];
    cells.forEach((row) =>
      row.forEach((cell) => {
        const intensity = cellIntensity(cell, maxEngRate, hasEngData);
        if (cell.postCount > 0) flat.push({ ...cell, intensity });
      })
    );
    return flat.sort((a, b) => b.intensity - a.intensity).slice(0, 3);
  }, [cells, maxEngRate, hasEngData]);

  function formatHour(h: number) {
    if (h === 0) return "12am";
    if (h < 12) return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Best Time to Post</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasEngData
            ? "Avg engagement rate by day and hour of publish time"
            : "Post frequency by day and hour (engagement data unavailable)"}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !hasPosts ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Not enough post history to calculate best times.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Heatmap grid */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: 480 }}>
                {/* Hour axis */}
                <div className="flex" style={{ paddingLeft: 32 }}>
                  {HOURS.map((h, i) => (
                    <div
                      key={h}
                      className="flex-1 text-center text-[9px] text-muted-foreground"
                      style={{ minWidth: 0 }}
                    >
                      {HOUR_LABELS[i]}
                    </div>
                  ))}
                </div>

                {/* Day rows */}
                {DAYS.map((dayLabel, day) => (
                  <div key={day} className="flex items-center gap-0">
                    <span className="w-8 shrink-0 text-[10px] text-muted-foreground pr-1 text-right">
                      {dayLabel}
                    </span>
                    {HOURS.map((hour) => {
                      const cell = cells[day][hour];
                      const intensity = cellIntensity(cell, maxEngRate, hasEngData);

                      let bgClass = "bg-muted/30";
                      if (cell.postCount > 0) {
                        if (intensity >= 0.8) bgClass = "bg-primary";
                        else if (intensity >= 0.6) bgClass = "bg-primary/70";
                        else if (intensity >= 0.4) bgClass = "bg-primary/50";
                        else if (intensity >= 0.2) bgClass = "bg-primary/30";
                        else bgClass = "bg-primary/15";
                      }

                      const tooltipText =
                        cell.postCount === 0
                          ? "No posts"
                          : hasEngData
                          ? `${DAYS[day]} ${formatHour(hour)} — ${cell.postCount} post${cell.postCount !== 1 ? "s" : ""}, avg ${cell.avgEngRate.toFixed(2)}% eng.`
                          : `${DAYS[day]} ${formatHour(hour)} — ${cell.postCount} post${cell.postCount !== 1 ? "s" : ""}`;

                      return (
                        <Tooltip key={hour}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "flex-1 aspect-square rounded-[2px] m-[1px] cursor-default transition-opacity hover:opacity-80",
                                bgClass
                              )}
                              style={{ minWidth: 0 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {tooltipText}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Best slots callout */}
            {best.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-muted-foreground self-center">Top slots:</span>
                {best.map((slot, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {DAYS[slot.day]} {formatHour(slot.hour)}
                    {hasEngData && ` · ${slot.avgEngRate.toFixed(1)}%`}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

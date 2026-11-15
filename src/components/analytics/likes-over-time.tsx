"use client";

import { useMemo } from "react";
import { parseISO, format, startOfDay } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsPost } from "@/types/analytics";

interface LikesOverTimeProps {
  posts?: AnalyticsPost[];
  isLoading?: boolean;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function buildTimeSeries(posts: AnalyticsPost[]) {
  // Aggregate likes by publish date (day bucket)
  const map = new Map<string, { likes: number; posts: number }>();

  for (const post of posts) {
    const dateStr = post.publishedAt ?? post.scheduledFor;
    if (!dateStr) continue;
    let d: Date;
    try {
      d = parseISO(dateStr);
    } catch {
      continue;
    }
    const key = startOfDay(d).toISOString().split("T")[0];
    const existing = map.get(key) ?? { likes: 0, posts: 0 };
    existing.likes += post.analytics?.likes ?? 0;
    existing.posts += 1;
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date,
      dateLabel: (() => {
        try {
          return format(parseISO(date), "MMM d");
        } catch {
          return date;
        }
      })(),
      likes: s.likes,
      posts: s.posts,
    }));
}

export function LikesOverTime({ posts, isLoading }: LikesOverTimeProps) {
  const data = useMemo(() => buildTimeSeries(posts ?? []), [posts]);
  const hasData = data.some((d) => d.likes > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Likes Over Time</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Total likes earned on the day a post was published
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !hasData ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No likes data available for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={compact}
                width={40}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number, _name: string) => [compact(v), "Likes"]}
                labelFormatter={(label) => `Published: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="likes"
                name="Likes"
                stroke="#f43f5e"
                strokeWidth={2}
                fill="url(#likesGradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

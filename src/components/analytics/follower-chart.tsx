"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountWithFollowerStats } from "@/types/analytics";

interface FollowerChartProps {
  accountId?: string;
  stats?: Record<string, Array<{ date?: string; followers?: number }>>;
  accounts?: AccountWithFollowerStats[];
  isLoading?: boolean;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function FollowerChart({
  accountId,
  stats,
  accounts,
  isLoading,
}: FollowerChartProps) {
  // Pick the data series: if accountId specified use that, else show first account
  const selectedId = accountId ?? (accounts?.[0]?._id);
  const series = selectedId && stats ? stats[selectedId] : undefined;

  const data = series
    ?.filter((d) => d.date && d.followers !== undefined)
    .map((d) => ({
      dateLabel: (() => {
        try {
          return format(parseISO(d.date!), "MMM d");
        } catch {
          return d.date!;
        }
      })(),
      followers: d.followers,
    }));

  const account = accounts?.find((a) => a._id === selectedId);
  const title = account
    ? `${account.username ?? account.displayName ?? "Account"} — Follower Growth`
    : "Follower Growth";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data?.length ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No follower history available. Analytics add-on required.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
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
                formatter={(v: number) => [compact(v), "Followers"]}
              />
              <Area
                type="monotone"
                dataKey="followers"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#followerGradient)"
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

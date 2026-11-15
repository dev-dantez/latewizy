"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformColor, getPlatformName } from "@/lib/late-api";
import type { AnalyticsPost } from "@/types/analytics";

interface LikesPerPlatformProps {
  posts?: AnalyticsPost[];
  isLoading?: boolean;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function buildData(posts: AnalyticsPost[]) {
  const map = new Map<string, { totalLikes: number; postCount: number }>();

  for (const post of posts) {
    // A post may have per-platform analytics
    const platforms = post.platforms?.length
      ? post.platforms
      : post.platform
      ? [{ platform: post.platform, analytics: post.analytics }]
      : [];

    for (const pa of platforms) {
      const p = pa.platform ?? "unknown";
      const existing = map.get(p) ?? { totalLikes: 0, postCount: 0 };
      existing.totalLikes += pa.analytics?.likes ?? 0;
      existing.postCount += 1;
      map.set(p, existing);
    }
  }

  return Array.from(map.entries())
    .map(([platform, s]) => ({
      platform,
      platformName: getPlatformName(platform),
      totalLikes: s.totalLikes,
      postCount: s.postCount,
      avgLikes: s.postCount > 0 ? s.totalLikes / s.postCount : 0,
    }))
    .filter((d) => d.totalLikes > 0 || d.postCount > 0)
    .sort((a, b) => b.totalLikes - a.totalLikes);
}

export function LikesPerPlatform({ posts, isLoading }: LikesPerPlatformProps) {
  const data = buildData(posts ?? []);
  const hasLikesData = data.some((d) => d.totalLikes > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Likes per Platform</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Total likes earned per connected platform
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data.length || !hasLikesData ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No likes data available for this period.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compact}
                />
                <YAxis
                  type="category"
                  dataKey="platformName"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number, _name: string) => [compact(v), "Total likes"]}
                />
                <Bar dataKey="totalLikes" name="Total likes" radius={[0, 4, 4, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.platform} fill={getPlatformColor(entry.platform)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Avg likes per post row */}
            <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.length, 4)}, 1fr)` }}>
              {data.map((d) => (
                <div key={d.platform} className="rounded-md bg-muted/40 p-2 text-center">
                  <p className="text-xs text-muted-foreground truncate">{d.platformName}</p>
                  <p className="text-sm font-semibold">{compact(d.totalLikes)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    ~{d.avgLikes.toFixed(0)} / post
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

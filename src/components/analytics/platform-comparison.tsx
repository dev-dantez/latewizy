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

interface PlatformComparisonProps {
  posts?: AnalyticsPost[];
  isLoading?: boolean;
}

interface PlatformSummary {
  platform: string;
  postCount: number;
  totalImpressions: number;
  totalReach: number;
  totalLikes: number;
  avgEngagementRate: number;
}

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function PlatformComparison({ posts, isLoading }: PlatformComparisonProps) {
  const summary = buildSummary(posts);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Platform Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !summary.length ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No platform data for this period.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={summary}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="platformName"
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
                  formatter={(v: number, name: string) => [compact(v), name]}
                />
                <Bar dataKey="totalImpressions" name="Impressions" radius={[4, 4, 0, 0]}>
                  {summary.map((entry) => (
                    <Cell
                      key={entry.platform}
                      fill={getPlatformColor(entry.platform)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Summary table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-1.5 text-left font-medium pr-3">Platform</th>
                    <th className="pb-1.5 text-right font-medium pr-3">Posts</th>
                    <th className="pb-1.5 text-right font-medium pr-3">Impressions</th>
                    <th className="pb-1.5 text-right font-medium pr-3">Reach</th>
                    <th className="pb-1.5 text-right font-medium pr-3">Likes</th>
                    <th className="pb-1.5 text-right font-medium">Avg Eng. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.platform} className="border-b border-border/40">
                      <td className="py-1.5 pr-3 font-medium">{s.platformName}</td>
                      <td className="py-1.5 pr-3 text-right">{s.postCount}</td>
                      <td className="py-1.5 pr-3 text-right">{compact(s.totalImpressions)}</td>
                      <td className="py-1.5 pr-3 text-right">{compact(s.totalReach)}</td>
                      <td className="py-1.5 pr-3 text-right">{compact(s.totalLikes)}</td>
                      <td className="py-1.5 text-right">
                        {s.avgEngagementRate > 0
                          ? `${s.avgEngagementRate.toFixed(2)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function buildSummary(posts?: AnalyticsPost[]): Array<PlatformSummary & { platformName: string }> {
  if (!posts?.length) return [];

  const map = new Map<string, PlatformSummary>();

  for (const post of posts) {
    const platforms = post.platforms?.length
      ? post.platforms
      : post.platform
      ? [{ platform: post.platform, analytics: post.analytics }]
      : [];

    for (const pa of platforms) {
      const p = pa.platform ?? "unknown";
      const a = pa.analytics ?? {};
      if (!map.has(p)) {
        map.set(p, {
          platform: p,
          postCount: 0,
          totalImpressions: 0,
          totalReach: 0,
          totalLikes: 0,
          avgEngagementRate: 0,
        });
      }
      const s = map.get(p)!;
      s.postCount += 1;
      s.totalImpressions += a.impressions ?? 0;
      s.totalReach += a.reach ?? 0;
      s.totalLikes += a.likes ?? 0;
      s.avgEngagementRate += a.engagementRate ?? 0;
    }
  }

  return Array.from(map.values())
    .map((s) => ({
      ...s,
      avgEngagementRate: s.postCount > 0 ? s.avgEngagementRate / s.postCount : 0,
      platformName: getPlatformName(s.platform),
    }))
    .sort((a, b) => b.totalImpressions - a.totalImpressions);
}

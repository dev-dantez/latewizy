"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsPost } from "@/types/analytics";

interface ContentFormatBreakdownProps {
  posts?: AnalyticsPost[];
  isLoading?: boolean;
}

type MediaType = "image" | "video" | "gif" | "document" | "text";

const FORMAT_COLORS: Record<MediaType, string> = {
  image: "#6366f1",
  video: "#f59e0b",
  gif: "#10b981",
  document: "#3b82f6",
  text: "#8b5cf6",
};

const FORMAT_LABELS: Record<MediaType, string> = {
  image: "Image",
  video: "Video",
  gif: "GIF",
  document: "Document",
  text: "Text only",
};

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function buildFormatData(posts: AnalyticsPost[]) {
  const map = new Map<
    MediaType,
    { count: number; totalLikes: number; totalEngRate: number; engPosts: number }
  >();

  for (const post of posts) {
    const mt = (post.mediaType as MediaType | undefined) ?? "text";
    const key: MediaType = ["image", "video", "gif", "document"].includes(mt)
      ? mt
      : "text";

    const existing = map.get(key) ?? { count: 0, totalLikes: 0, totalEngRate: 0, engPosts: 0 };
    existing.count += 1;
    existing.totalLikes += post.analytics?.likes ?? 0;
    if (post.analytics?.engagementRate !== undefined) {
      existing.totalEngRate += post.analytics.engagementRate;
      existing.engPosts += 1;
    }
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([format, s]) => ({
      format,
      label: FORMAT_LABELS[format],
      count: s.count,
      totalLikes: s.totalLikes,
      avgEngRate: s.engPosts > 0 ? s.totalEngRate / s.engPosts : 0,
      color: FORMAT_COLORS[format],
    }))
    .sort((a, b) => b.count - a.count);
}

export function ContentFormatBreakdown({ posts, isLoading }: ContentFormatBreakdownProps) {
  const data = buildFormatData(posts ?? []);
  const hasEngData = (posts ?? []).some((p) => p.analytics?.engagementRate !== undefined);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Content Format Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !data.length ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No posts found for this period.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pie — post count by format */}
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Posts by format</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                  >
                    {data.map((d) => (
                      <Cell key={d.format} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, name: string) => [`${v} posts`, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar — avg engagement rate by format (only when data available) */}
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {hasEngData ? "Avg engagement rate by format" : "Total likes by format"}
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={data}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={
                      hasEngData ? (v) => `${v.toFixed(1)}%` : compact
                    }
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, _name: string) => [
                      hasEngData ? `${v.toFixed(2)}%` : compact(v),
                      hasEngData ? "Avg eng. rate" : "Total likes",
                    ]}
                  />
                  <Bar
                    dataKey={hasEngData ? "avgEngRate" : "totalLikes"}
                    name={hasEngData ? "Avg eng. rate" : "Total likes"}
                    radius={[4, 4, 0, 0]}
                  >
                    {data.map((d) => (
                      <Cell key={d.format} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

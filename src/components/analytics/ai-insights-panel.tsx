"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, RefreshCw, Send } from "lucide-react";
import type { AnalyticsInsight, InsightRequest } from "@/types/analytics";
import type { AnalyticsPost, AccountWithFollowerStats } from "@/types/analytics";
import { cn } from "@/lib/utils";

interface AIInsightsPanelProps {
  profileId?: string;
  platform?: string;
  fromDate: string;
  toDate: string;
  posts?: AnalyticsPost[];
  followerAccounts?: AccountWithFollowerStats[];
  brandContext?: {
    brandName?: string;
    industry?: string;
    tone?: string;
    targetAudience?: string;
  };
}

const TYPE_COLORS: Record<string, string> = {
  trend: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  recommendation: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  anomaly: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  comparison: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  summary: "bg-muted text-muted-foreground",
};

export function AIInsightsPanel({
  profileId,
  platform,
  fromDate,
  toDate,
  posts,
  followerAccounts,
  brandContext,
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  async function fetchInsights(q?: string) {
    if (!profileId) return;
    setIsLoading(true);
    setError(null);
    setAnswer(null);

    // Build a sanitised snapshot from the already-fetched TanStack Query data
    const topPosts = posts
      ?.filter((p) => p.analytics?.engagementRate !== undefined)
      .sort((a, b) => (b.analytics?.engagementRate ?? 0) - (a.analytics?.engagementRate ?? 0))
      .slice(0, 5)
      .map((p) => ({
        content: (p.content ?? "").slice(0, 200),
        platform: p.platform,
        metrics: {
          impressions: p.analytics?.impressions ?? null,
          reach: p.analytics?.reach ?? null,
          likes: p.analytics?.likes ?? null,
          comments: p.analytics?.comments ?? null,
          shares: p.analytics?.shares ?? null,
          engagementRate: p.analytics?.engagementRate ?? null,
        },
      }));

    // Platform breakdown
    const platformMap = new Map<
      string,
      { postCount: number; totalEng: number; totalImpr: number; totalReach: number; totalLikes: number }
    >();
    for (const post of posts ?? []) {
      const p = post.platform ?? "unknown";
      const existing = platformMap.get(p) ?? { postCount: 0, totalEng: 0, totalImpr: 0, totalReach: 0, totalLikes: 0 };
      existing.postCount += 1;
      existing.totalEng += post.analytics?.engagementRate ?? 0;
      existing.totalImpr += post.analytics?.impressions ?? 0;
      existing.totalReach += post.analytics?.reach ?? 0;
      existing.totalLikes += post.analytics?.likes ?? 0;
      platformMap.set(p, existing);
    }
    const platformBreakdown = Array.from(platformMap.entries()).map(([plat, s]) => ({
      platform: plat,
      postCount: s.postCount,
      avgEngagementRate: s.postCount > 0 ? s.totalEng / s.postCount : 0,
      totalImpressions: s.totalImpr,
      totalReach: s.totalReach,
      totalLikes: s.totalLikes,
    }));

    const followerStats = followerAccounts
      ?.filter((a) => a.currentFollowers !== undefined)
      .map((a) => ({
        platform: a.platform,
        username: a.username,
        currentFollowers: a.currentFollowers,
        growth: a.growth,
        growthPercentage: a.growthPercentage,
      }));

    try {
      const res = await fetch("/api/analytics/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          platform,
          fromDate,
          toDate,
          question: q,
          analyticsSnapshot: {
            totalPosts: posts?.length ?? 0,
            publishedPosts: posts?.filter((p) => p.status === "published").length ?? 0,
            topPostsByEngagement: topPosts,
            platformBreakdown,
            followerStats: followerStats ?? [],
          },
          brandContext,
        } satisfies InsightRequest & {
          analyticsSnapshot: object;
          brandContext?: object;
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `API error ${res.status}`);
      }

      const data = await res.json();
      if (data.answer) {
        setAnswer(data.answer);
      } else {
        const now = new Date().toISOString();
        setInsights(
          (data.insights ?? []).map((i: Omit<AnalyticsInsight, "id" | "generatedAt" | "model">, idx: number) => ({
            ...i,
            id: `${now}-${idx}`,
            generatedAt: now,
            model: "openai/gpt-oss-20b",
          }))
        );
        setGenerated(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate insights.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
          </div>
          {!isLoading && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => fetchInsights()}
              disabled={!profileId}
            >
              <RefreshCw className="h-3 w-3" />
              {generated ? "Refresh" : "Generate insights"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Ask a question */}
        {!isLoading && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask a question about your analytics…"
              className="min-h-[60px] resize-none text-sm"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (question.trim()) fetchInsights(question.trim());
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-auto"
              disabled={!question.trim() || !profileId}
              onClick={() => fetchInsights(question.trim())}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Q&A answer */}
        {answer && !isLoading && (
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {answer}
          </div>
        )}

        {/* Insights list */}
        {!isLoading && insights.length > 0 && (
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-md border border-border p-3 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-[10px] font-medium capitalize px-1.5 py-0",
                      TYPE_COLORS[insight.type] ?? TYPE_COLORS.summary
                    )}
                  >
                    {insight.type}
                  </Badge>
                  <span className="text-sm font-medium">{insight.title}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-snug">
                  {insight.body}
                </p>
                {insight.evidence && (
                  <p className="text-xs text-muted-foreground/70 italic">
                    {insight.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty / no-profile state */}
        {!isLoading && !error && !generated && !answer && (
          <p className="text-sm text-muted-foreground">
            {profileId
              ? "Click Generate insights to analyse your analytics data."
              : "Select a profile to enable AI insights."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

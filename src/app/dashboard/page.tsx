"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { parseISO } from "date-fns/parseISO";
import {
  useAccounts,
  useAccountsHealth,
  usePosts,
  useQueuePreview,
  useAnalytics,
  useFollowerStats,
} from "@/hooks";
import { useAuthStore, useAppStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountAvatar } from "@/components/accounts";
import { PlatformIcons, PostStatusBadge } from "@/components/posts";
import { getPlatformName, getPlatformColor } from "@/lib/late-api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  PenSquare,
  Calendar,
  Users,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  BarChart2,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import type { AnalyticsFilters } from "@/types/analytics";

// ============================================================================
// Helpers
// ============================================================================

const THIRTY_DAYS_FILTERS: AnalyticsFilters = {
  dateRange: "30d",
  sortBy: "engagement",
  page: 1,
  limit: 50,
};

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function KpiCard({
  title,
  value,
  icon: Icon,
  iconColor,
  isLoading,
  sub,
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  isLoading?: boolean;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1">{value}</p>
            )}
            {sub && !isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ============================================================================
// Page
// ============================================================================

export default function DashboardPage() {
  const { usageStats } = useAuthStore();
  const { defaultProfileId } = useAppStore();

  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const { data: healthData } = useAccountsHealth();
  const { data: postsData, isLoading: postsLoading } = usePosts({ limit: 20 });
  const { data: queueData } = useQueuePreview(5);

  // Analytics — last 30 days
  const analyticsQuery = useAnalytics(THIRTY_DAYS_FILTERS);

  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const followerQuery = useFollowerStats({
    profileId: defaultProfileId ?? undefined,
    fromDate: thirtyDaysAgo,
    toDate: today,
    granularity: "daily",
  });

  // Derived data
  const accounts = accountsData?.accounts ?? [];
  const posts = useMemo(() => postsData?.posts ?? [], [postsData?.posts]);
  const analyticsPosts = analyticsQuery.data?.posts ?? [];
  const hasAnalyticsAccess = analyticsQuery.data?.hasAnalyticsAccess;
  const followerAccounts = followerQuery.data?.accounts ?? [];

  const accountsNeedingAttention = (healthData?.accounts ?? []).filter(
    (a: any) => a.status === "needs_reconnect"
  ).length;

  const upcomingSlots = queueData?.slots ?? [];

  const { scheduledCount, publishedCount, failedCount } = useMemo(() => ({
    scheduledCount: posts.filter((p: any) => p.status === "scheduled").length,
    publishedCount: posts.filter((p: any) => p.status === "published").length,
    failedCount: posts.filter((p: any) => p.status === "failed").length,
  }), [posts]);

  // Analytics aggregates
  const totalImpressions = analyticsPosts.reduce((s, p) => s + (p.analytics?.impressions ?? 0), 0);
  const totalLikes = analyticsPosts.reduce((s, p) => s + (p.analytics?.likes ?? 0), 0);
  const totalComments = analyticsPosts.reduce((s, p) => s + (p.analytics?.comments ?? 0), 0);
  const totalFollowers = followerAccounts.reduce((s, a) => s + (a.currentFollowers ?? 0), 0);
  const hasImpressionsData = analyticsPosts.some((p) => p.analytics?.impressions !== undefined);

  // Likes over time (last 30 days from analytics posts)
  const likesOverTime = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of analyticsPosts) {
      const date = post.publishedAt?.split("T")[0];
      if (!date) continue;
      map.set(date, (map.get(date) ?? 0) + (post.analytics?.likes ?? 0));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, likes]) => ({
        label: format(parseISO(date), "MMM d"),
        likes,
      }));
  }, [analyticsPosts]);

  // Follower time series for the first account with data
  const firstAccountId = followerAccounts.find((a) => a.currentFollowers !== undefined)?._id;
  const followerSeries = useMemo(() => {
    if (!firstAccountId || !followerQuery.data?.stats) return [];
    const pts = followerQuery.data.stats[firstAccountId] ?? [];
    return pts
      .filter((d) => d.date && d.followers !== undefined)
      .map((d) => ({
        label: format(parseISO(d.date!), "MMM d"),
        followers: d.followers,
      }));
  }, [firstAccountId, followerQuery.data]);

  // Platform breakdown from analytics posts
  const platformBreakdown = useMemo(() => {
    const map = new Map<string, { likes: number; posts: number }>();
    for (const post of analyticsPosts) {
      const p = post.platform ?? "unknown";
      const e = map.get(p) ?? { likes: 0, posts: 0 };
      e.likes += post.analytics?.likes ?? 0;
      e.posts += 1;
      map.set(p, e);
    }
    return Array.from(map.entries())
      .map(([platform, s]) => ({ platform, name: getPlatformName(platform), ...s }))
      .filter((d) => d.posts > 0)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);
  }, [analyticsPosts]);

  // Upload usage percentage
  const uploadsUsed = usageStats?.usage.uploads ?? 0;
  const uploadsLimit = usageStats?.limits.uploads ?? 0;
  const uploadsPercent = uploadsLimit > 0 ? Math.min((uploadsUsed / uploadsLimit) * 100, 100) : -1;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d")} · {usageStats?.planName ?? "LateWiz"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" asChild>
            <Link href="/dashboard/compose" className="gap-1.5">
              <PenSquare className="h-3.5 w-3.5" />
              New Post
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/analytics" className="gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Analytics
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Account health warning ── */}
      {accountsNeedingAttention > 0 && (
        <Link
          href="/dashboard/accounts"
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium">
              {accountsNeedingAttention} account{accountsNeedingAttention > 1 ? "s need" : " needs"} reconnection
            </span>
            <span className="ml-2 opacity-70">— Click to fix</span>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* ── KPI Row 1: Publishing stats ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Published (last 20)"
          value={publishedCount}
          icon={CheckCircle2}
          iconColor="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
          isLoading={postsLoading}
          href="/dashboard/calendar"
        />
        <KpiCard
          title="Scheduled"
          value={scheduledCount}
          icon={Clock}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          isLoading={postsLoading}
          href="/dashboard/queue"
        />
        <KpiCard
          title="Accounts"
          value={accounts.length}
          icon={Users}
          iconColor="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
          isLoading={accountsLoading}
          href="/dashboard/accounts"
        />
        <KpiCard
          title="Failed"
          value={failedCount}
          icon={AlertCircle}
          iconColor={failedCount > 0 ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-muted text-muted-foreground"}
          isLoading={postsLoading}
          href="/dashboard/calendar"
        />
      </div>

      {/* ── KPI Row 2: Analytics stats ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Impressions (30d)"
          value={hasImpressionsData ? compact(totalImpressions) : "—"}
          icon={Eye}
          iconColor="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
          isLoading={analyticsQuery.isLoading}
          sub={hasAnalyticsAccess === false ? "Upgrade required" : undefined}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="Likes (30d)"
          value={analyticsPosts.some((p) => p.analytics?.likes !== undefined) ? compact(totalLikes) : "—"}
          icon={Heart}
          iconColor="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
          isLoading={analyticsQuery.isLoading}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="Comments (30d)"
          value={analyticsPosts.some((p) => p.analytics?.comments !== undefined) ? compact(totalComments) : "—"}
          icon={MessageSquare}
          iconColor="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          isLoading={analyticsQuery.isLoading}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="Total Followers"
          value={hasAnalyticsAccess && totalFollowers > 0 ? compact(totalFollowers) : "—"}
          icon={TrendingUp}
          iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          isLoading={followerQuery.isLoading}
          sub={hasAnalyticsAccess === false ? "Analytics add-on required" : undefined}
          href="/dashboard/analytics"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Likes over time */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-rose-500" />
                Likes Over Time
              </CardTitle>
              <Link href="/dashboard/analytics" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Full view <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {analyticsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : likesOverTime.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                {hasAnalyticsAccess === false
                  ? "Analytics add-on required"
                  : "No likes data for the last 30 days"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={likesOverTime} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashLikesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compact} width={36} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [compact(v), "Likes"]} />
                  <Area type="monotone" dataKey="likes" stroke="#f43f5e" strokeWidth={2} fill="url(#dashLikesGrad)" dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Follower trend or platform breakdown */}
        {followerSeries.length > 1 ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Follower Growth (30d)
                </CardTitle>
                <Link href="/dashboard/analytics" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Full view <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={followerSeries} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashFollowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compact} width={36} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [compact(v), "Followers"]} />
                  <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#dashFollowGrad)" dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Share2 className="h-3.5 w-3.5 text-violet-500" />
                  Likes by Platform
                </CardTitle>
                <Link href="/dashboard/analytics?tab=platforms" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Full view <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : platformBreakdown.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  No platform data for the last 30 days
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={platformBreakdown} layout="vertical" margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compact} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={70} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [compact(v), "Likes"]} />
                    <Bar dataKey="likes" radius={[0, 4, 4, 0]}>
                      {platformBreakdown.map((entry) => (
                        <Cell key={entry.platform} fill={getPlatformColor(entry.platform)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Main content row ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent posts — takes 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Recent Posts
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                <Link href="/dashboard/calendar">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-9 w-9 rounded shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-lg bg-muted p-6 text-center">
                <p className="text-sm text-muted-foreground">No posts yet</p>
                <Button variant="link" size="sm" className="mt-1" asChild>
                  <Link href="/dashboard/compose">Create your first post</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {posts.slice(0, 6).map((post: any) => {
                  const likesData = analyticsPosts.find((p) => p._id === post._id)?.analytics;
                  return (
                    <div key={post._id} className="flex items-center gap-3 py-2.5">
                      {post.mediaItems?.[0] ? (
                        <img
                          src={post.mediaItems[0].url}
                          alt=""
                          className="h-9 w-9 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                          <PenSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{post.content || "(No content)"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <PlatformIcons platforms={post.platforms ?? []} size="xs" />
                          {post.scheduledFor && (
                            <span className="text-[11px] text-muted-foreground">
                              {format(parseISO(post.scheduledFor), "MMM d, h:mm a")}
                            </span>
                          )}
                          {likesData?.likes !== undefined && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Heart className="h-2.5 w-2.5" />
                              {compact(likesData.likes)}
                            </span>
                          )}
                        </div>
                      </div>
                      <PostStatusBadge status={post.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Upcoming queue */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ListOrdered className="h-3.5 w-3.5" />
                  Next in Queue
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/dashboard/queue">Manage</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingSlots.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">No queue slots set up</p>
                  <Button variant="link" size="sm" className="mt-1 h-auto text-xs p-0" asChild>
                    <Link href="/dashboard/queue">Set up queue</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingSlots.slice(0, 4).map((slot: string, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">
                        {format(parseISO(slot), "EEE, MMM d")}
                      </span>
                      <Badge variant="outline" className="text-[11px] h-5">
                        {format(parseISO(slot), "h:mm a")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connected accounts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Accounts
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/dashboard/accounts">Manage</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-3 flex-1" />
                    </div>
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">No accounts connected</p>
                  <Button variant="link" size="sm" className="mt-1 h-auto text-xs p-0" asChild>
                    <Link href="/dashboard/accounts">Connect an account</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.slice(0, 5).map((account: any) => {
                    const isUnhealthy = (healthData?.accounts ?? []).find(
                      (h: any) => h._id === account._id && h.status === "needs_reconnect"
                    );
                    return (
                      <div key={account._id} className="flex items-center gap-2.5">
                        <AccountAvatar account={account} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {account.displayName ?? account.username}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {getPlatformName(account.platform)}
                          </p>
                        </div>
                        {isUnhealthy ? (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {accounts.length > 5 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">
                      +{accounts.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan usage */}
          {usageStats && uploadsLimit > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" />
                  {usageStats.planName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Uploads</span>
                    <span>{uploadsUsed.toLocaleString()} / {uploadsLimit.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${uploadsPercent}%` }}
                    />
                  </div>
                </div>
                {uploadsPercent >= 80 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {uploadsPercent >= 100 ? "Upload limit reached." : "Approaching upload limit."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { href: "/dashboard/compose", icon: PenSquare, label: "Compose Post", desc: "Write & schedule" },
          { href: "/dashboard/calendar", icon: Calendar, label: "Calendar", desc: "View schedule" },
          { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics", desc: "Performance data" },
          { href: "/dashboard/inbox", icon: MessageSquare, label: "Inbox", desc: "Comments & DMs" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 hover:bg-muted/50 transition-colors"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <item.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useAppStore } from "@/stores";
import { useProfiles } from "@/hooks";
import { useAnalytics, useFollowerStats } from "@/hooks/use-analytics";
import { useBrands } from "@/hooks/use-brands";
import { AnalyticsFiltersBar } from "@/components/analytics/analytics-filters";
import { MetricCard } from "@/components/analytics/metric-card";
import { AccountCards } from "@/components/analytics/account-cards";
import { PostsTable } from "@/components/analytics/posts-table";
import { FollowerChart } from "@/components/analytics/follower-chart";
import { AIInsightsPanel } from "@/components/analytics/ai-insights-panel";
import { PlatformComparison } from "@/components/analytics/platform-comparison";
import { ContentFormatBreakdown } from "@/components/analytics/content-format-breakdown";
import { BestTimeToPost } from "@/components/analytics/best-time-to-post";
import { LikesPerPlatform } from "@/components/analytics/likes-per-platform";
import { LikesOverTime } from "@/components/analytics/likes-over-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsFilters } from "@/types/analytics";
import { dateRangeToParams } from "@/lib/analytics/date-range";
import { AlertTriangle } from "lucide-react";

const DEFAULT_FILTERS: AnalyticsFilters = {
  dateRange: "30d",
  sortBy: "date",
  page: 1,
  limit: 20,
};

export default function AnalyticsPage() {
  const { defaultProfileId } = useAppStore();
  const { data: profilesData } = useProfiles();
  const profiles = profilesData?.profiles ?? [];

  const [filters, setFilters] = useState<AnalyticsFilters>({
    ...DEFAULT_FILTERS,
    profileId: defaultProfileId ?? undefined,
  });

  const { fromDate, toDate } = dateRangeToParams(filters);

  const analyticsQuery = useAnalytics(filters);
  const followerQuery = useFollowerStats({
    profileId: filters.profileId,
    fromDate,
    toDate,
    granularity: "daily",
  });

  const analyticsData = analyticsQuery.data;
  const posts = analyticsData?.posts ?? [];
  const hasAnalyticsAccess = analyticsData?.hasAnalyticsAccess;
  const followerAccounts = followerQuery.data?.accounts ?? [];

  // Aggregate top-level metrics from posts
  const totalImpressions = posts.reduce((s, p) => s + (p.analytics?.impressions ?? 0), 0);
  const totalReach = posts.reduce((s, p) => s + (p.analytics?.reach ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.analytics?.likes ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.analytics?.comments ?? 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.analytics?.shares ?? 0), 0);
  const totalViews = posts.reduce((s, p) => s + (p.analytics?.views ?? 0), 0);
  const totalClicks = posts.reduce((s, p) => s + (p.analytics?.clicks ?? 0), 0);
  const totalEngRate = posts.filter((p) => p.analytics?.engagementRate !== undefined);
  const avgEngRate = totalEngRate.length > 0
    ? totalEngRate.reduce((s, p) => s + (p.analytics?.engagementRate ?? 0), 0) / totalEngRate.length
    : undefined;

  const totalFollowers = followerAccounts.reduce((s, a) => s + (a.currentFollowers ?? 0), 0);

  // Net follows: sum of growth across all accounts in the period
  const netFollows = followerAccounts.reduce((s, a) => s + (a.growth ?? 0), 0);
  const hasNetFollowsData = followerAccounts.some((a) => a.growth !== undefined);

  const hasImpressionsData = posts.some((p) => p.analytics?.impressions !== undefined);
  const hasViewsData = posts.some((p) => p.analytics?.views !== undefined);
  const hasClicksData = posts.some((p) => p.analytics?.clicks !== undefined);

  // Brand context (local brands store) for AI insights
  // Local brands are not linked to Zernio profiles; use the default/selected brand.
  const { selectedBrand } = useBrands();
  const activeBrand = selectedBrand;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Performance insights for your social media accounts.
        </p>
      </div>

      {/* Analytics access warning */}
      {hasAnalyticsAccess === false && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your Zernio plan does not include the Analytics add-on. Follower data and
            detailed metrics may be unavailable. Visit{" "}
            <a
              href="https://zernio.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              zernio.com
            </a>{" "}
            to upgrade.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <AnalyticsFiltersBar
        filters={filters}
        profiles={profiles}
        onChange={setFilters}
      />

      {/* Summary metric cards — row 1 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Impressions"
          value={hasImpressionsData ? totalImpressions : undefined}
          isLoading={analyticsQuery.isLoading}
          unavailable={!hasImpressionsData && !analyticsQuery.isLoading}
          description="Times your posts appeared on screen."
        />
        <MetricCard
          title="Total Reach"
          value={posts.some((p) => p.analytics?.reach !== undefined) ? totalReach : undefined}
          isLoading={analyticsQuery.isLoading}
          unavailable={!posts.some((p) => p.analytics?.reach !== undefined) && !analyticsQuery.isLoading}
          description="Unique accounts that saw your posts."
        />
        <MetricCard
          title="Total Views"
          value={hasViewsData ? totalViews : undefined}
          isLoading={analyticsQuery.isLoading}
          unavailable={!hasViewsData && !analyticsQuery.isLoading}
          description="Total video or story views across posts."
        />
        <MetricCard
          title="Total Clicks"
          value={hasClicksData ? totalClicks : undefined}
          isLoading={analyticsQuery.isLoading}
          unavailable={!hasClicksData && !analyticsQuery.isLoading}
          description="Link clicks and profile visits from posts."
        />
      </div>

      {/* Summary metric cards — row 2 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Likes"
          value={posts.some((p) => p.analytics?.likes !== undefined) ? totalLikes : undefined}
          isLoading={analyticsQuery.isLoading}
          unavailable={!posts.some((p) => p.analytics?.likes !== undefined) && !analyticsQuery.isLoading}
          description="Total likes across all published posts."
        />
        <MetricCard
          title="Avg Engagement Rate"
          value={avgEngRate}
          isLoading={analyticsQuery.isLoading}
          unavailable={avgEngRate === undefined && !analyticsQuery.isLoading}
          formatter={(v) => `${v.toFixed(2)}%`}
          description="Average engagement rate across posts with engagement data."
        />
        <MetricCard
          title="Net New Follows"
          value={hasNetFollowsData ? netFollows : undefined}
          isLoading={followerQuery.isLoading}
          unavailable={hasAnalyticsAccess === false || (!hasNetFollowsData && !followerQuery.isLoading)}
          description="Follower growth across connected accounts in this period."
        />
        <MetricCard
          title="Total Followers"
          value={hasAnalyticsAccess && totalFollowers > 0 ? totalFollowers : undefined}
          isLoading={followerQuery.isLoading}
          unavailable={hasAnalyticsAccess === false}
          description="Combined follower count across connected accounts."
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {followerQuery.data?.stats && Object.keys(followerQuery.data.stats).length > 0 && (
            <FollowerChart
              stats={followerQuery.data.stats}
              accounts={followerAccounts}
              isLoading={followerQuery.isLoading}
            />
          )}
          {!followerQuery.isLoading &&
            (!followerQuery.data?.stats ||
              Object.keys(followerQuery.data.stats).length === 0) && (
              <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
                {hasAnalyticsAccess === false
                  ? "Follower history requires the Analytics add-on."
                  : "No follower history available for this period."}
              </div>
            )}

          {/* Likes over time */}
          <LikesOverTime posts={posts} isLoading={analyticsQuery.isLoading} />

          {/* Second row: engagement breakdown */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Comments"
              value={posts.some((p) => p.analytics?.comments !== undefined) ? totalComments : undefined}
              isLoading={analyticsQuery.isLoading}
              unavailable={!posts.some((p) => p.analytics?.comments !== undefined) && !analyticsQuery.isLoading}
              description="Total comments across published posts."
            />
            <MetricCard
              title="Shares"
              value={posts.some((p) => p.analytics?.shares !== undefined) ? totalShares : undefined}
              isLoading={analyticsQuery.isLoading}
              unavailable={!posts.some((p) => p.analytics?.shares !== undefined) && !analyticsQuery.isLoading}
              description="Total shares / reposts."
            />
            <MetricCard
              title="Published Posts"
              value={analyticsData?.overview?.publishedPosts}
              isLoading={analyticsQuery.isLoading}
              description="Posts published in this period."
            />
            <MetricCard
              title="Total Posts (all time)"
              value={analyticsData?.overview?.totalPosts}
              isLoading={analyticsQuery.isLoading}
              description="All posts in your account."
            />
          </div>

          {/* Content format breakdown + best time side by side on large screens */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ContentFormatBreakdown posts={posts} isLoading={analyticsQuery.isLoading} />
            <BestTimeToPost posts={posts} isLoading={analyticsQuery.isLoading} />
          </div>

          {/* Audience Insights — honest unavailable state */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium">Audience Insights</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Demographic and geographic data for your audience.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Age & Gender", note: "Not available via Zernio API" },
                { label: "Countries", note: "Not available via Zernio API" },
                { label: "Cities", note: "Not available via Zernio API" },
                { label: "Profile Visits", note: "Not available via Zernio API" },
              ].map((item) => (
                <div key={item.label} className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 italic">{item.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              These metrics require platform-level audience API access not currently exposed by the Zernio SDK.
              They may become available in a future Zernio API update.
            </p>
          </div>
        </TabsContent>

        {/* Posts tab */}
        <TabsContent value="posts" className="mt-4">
          {analyticsQuery.isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load post analytics:{" "}
              {analyticsQuery.error instanceof Error
                ? analyticsQuery.error.message
                : "Unknown error"}
            </div>
          ) : (
            <PostsTable
              posts={posts}
              isLoading={analyticsQuery.isLoading}
              total={analyticsData?.pagination?.total}
              page={filters.page ?? 1}
              limit={filters.limit ?? 20}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            />
          )}
        </TabsContent>

        {/* Accounts tab */}
        <TabsContent value="accounts" className="mt-4">
          <AccountCards
            accounts={followerAccounts}
            isLoading={followerQuery.isLoading}
            hasAnalyticsAccess={hasAnalyticsAccess}
          />
        </TabsContent>

        {/* Platforms tab */}
        <TabsContent value="platforms" className="mt-4 space-y-4">
          <PlatformComparison
            posts={posts}
            isLoading={analyticsQuery.isLoading}
          />
          <LikesPerPlatform
            posts={posts}
            isLoading={analyticsQuery.isLoading}
          />
        </TabsContent>

        {/* AI Insights tab */}
        <TabsContent value="ai" className="mt-4">
          <AIInsightsPanel
            profileId={filters.profileId}
            platform={filters.platform}
            fromDate={fromDate}
            toDate={toDate}
            posts={posts}
            followerAccounts={followerAccounts}
            brandContext={
              activeBrand
                ? {
                    brandName: activeBrand.brandName,
                    industry: activeBrand.industry,
                    tone: activeBrand.tone,
                    targetAudience: activeBrand.targetAudience,
                  }
                : undefined
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

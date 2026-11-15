/**
 * Analytics Hooks
 *
 * Wraps the @getlatedev/node SDK analytics methods via TanStack Query.
 * All requests go through the existing useLate() client — no new API client.
 */

import { useQuery } from "@tanstack/react-query";
import { useLate } from "./use-late";
import type { AnalyticsFilters } from "@/types/analytics";
import { dateRangeToParams } from "@/lib/analytics/date-range";

// ============================================================================
// Query keys
// ============================================================================

export const analyticsKeys = {
  all: ["analytics"] as const,
  list: (filters: AnalyticsFilters) =>
    ["analytics", "list", filters] as const,
  post: (postId: string) => ["analytics", "post", postId] as const,
  followerStats: (params: {
    profileId?: string;
    accountIds?: string;
    fromDate?: string;
    toDate?: string;
    granularity?: string;
  }) => ["analytics", "follower-stats", params] as const,
  linkedInAggregate: (params: {
    accountId: string;
    aggregation?: string;
    startDate?: string;
    endDate?: string;
  }) => ["analytics", "linkedin-aggregate", params] as const,
  linkedInPost: (params: { accountId: string; urn: string }) =>
    ["analytics", "linkedin-post", params] as const,
  youtubeDailyViews: (params: {
    accountId: string;
    videoId: string;
    startDate?: string;
    endDate?: string;
  }) => ["analytics", "youtube-daily", params] as const,
};

// ============================================================================
// Post analytics list
// ============================================================================

export function useAnalytics(filters: AnalyticsFilters) {
  const late = useLate();
  const { fromDate, toDate } = dateRangeToParams(filters);

  return useQuery({
    queryKey: analyticsKeys.list({ ...filters, fromDate, toDate }),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.analytics.getAnalytics({
        query: {
          profileId: filters.profileId,
          platform: filters.platform === "all" ? undefined : filters.platform,
          fromDate,
          toDate,
          sortBy: filters.sortBy ?? "date",
          page: filters.page ?? 1,
          limit: filters.limit ?? 20,
          order: "desc",
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!late,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Single post analytics
// ============================================================================

export function usePostAnalytics(postId: string) {
  const late = useLate();

  return useQuery({
    queryKey: analyticsKeys.post(postId),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.analytics.getAnalytics({
        query: { postId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!late && !!postId,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Follower stats
// ============================================================================

export function useFollowerStats(params: {
  profileId?: string;
  accountIds?: string;
  fromDate?: string;
  toDate?: string;
  granularity?: "daily" | "weekly" | "monthly";
}) {
  const late = useLate();

  return useQuery({
    queryKey: analyticsKeys.followerStats(params),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.accounts.getFollowerStats({
        query: {
          profileId: params.profileId,
          accountIds: params.accountIds,
          fromDate: params.fromDate,
          toDate: params.toDate,
          granularity: params.granularity ?? "daily",
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!late,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================================================
// LinkedIn aggregate analytics
// ============================================================================

export function useLinkedInAggregateAnalytics(params: {
  accountId: string;
  aggregation?: "TOTAL" | "DAILY";
  startDate?: string;
  endDate?: string;
  metrics?: string;
}) {
  const late = useLate();

  return useQuery({
    queryKey: analyticsKeys.linkedInAggregate(params),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.analytics.getLinkedInAggregateAnalytics(
        {
          path: { accountId: params.accountId },
          query: {
            aggregation: params.aggregation ?? "TOTAL",
            startDate: params.startDate,
            endDate: params.endDate,
            metrics: params.metrics,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    enabled: !!late && !!params.accountId,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================================================
// LinkedIn post analytics
// ============================================================================

export function useLinkedInPostAnalytics(params: {
  accountId: string;
  urn: string;
}) {
  const late = useLate();

  return useQuery({
    queryKey: analyticsKeys.linkedInPost(params),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.analytics.getLinkedInPostAnalytics({
        path: { accountId: params.accountId },
        query: { urn: params.urn },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!late && !!params.accountId && !!params.urn,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================================================
// YouTube daily views
// ============================================================================

export function useYouTubeDailyViews(params: {
  accountId: string;
  videoId: string;
  startDate?: string;
  endDate?: string;
}) {
  const late = useLate();

  return useQuery({
    queryKey: analyticsKeys.youtubeDailyViews(params),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.analytics.getYouTubeDailyViews({
        query: {
          accountId: params.accountId,
          videoId: params.videoId,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!late && !!params.accountId && !!params.videoId,
    staleTime: 60 * 60 * 1000, // 1 hour (YouTube data has 2-3 day latency)
  });
}

/**
 * Analytics Type Definitions
 *
 * All types derived from verified @getlatedev/node SDK types.
 * No invented fields.
 */

// ============================================================================
// Core metric types (match SDK)
// ============================================================================

export interface PostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  views?: number;
  engagementRate?: number;
  lastUpdated?: string;
}

export interface PlatformAnalytics {
  platform?: string;
  status?: string;
  accountId?: string;
  accountUsername?: string;
  analytics?: PostAnalytics;
  accountMetrics?: {
    followers?: number | null;
    subscribers?: number | null;
    lastUpdated?: string | null;
  } | null;
}

export interface AnalyticsPost {
  _id?: string;
  content?: string;
  scheduledFor?: string;
  publishedAt?: string;
  status?: string;
  analytics?: PostAnalytics;
  platforms?: PlatformAnalytics[];
  platform?: string;
  platformPostUrl?: string;
  isExternal?: boolean;
  thumbnailUrl?: string;
  mediaType?: "image" | "video" | "gif" | "document";
  mediaItems?: Array<{ type?: string; url?: string }>;
}

export interface AnalyticsOverview {
  totalPosts?: number;
  publishedPosts?: number;
  scheduledPosts?: number;
  lastSync?: string;
}

export interface AnalyticsListResponse {
  overview?: AnalyticsOverview;
  posts?: AnalyticsPost[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
  accounts?: SocialAccountAnalytics[];
  hasAnalyticsAccess?: boolean;
}

// ============================================================================
// Follower stats
// ============================================================================

export interface AccountWithFollowerStats {
  _id?: string;
  platform?: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  profileId?: string | { _id?: string; name?: string };
  currentFollowers?: number;
  lastUpdated?: string;
  growth?: number;
  growthPercentage?: number;
  dataPoints?: number;
}

export interface FollowerStatsResponse {
  accounts?: AccountWithFollowerStats[];
  stats?: Record<string, Array<{ date?: string; followers?: number }>>;
  dateRange?: { from?: string; to?: string };
  granularity?: string;
}

// ============================================================================
// LinkedIn analytics
// ============================================================================

export interface LinkedInAggregateAnalytics {
  accountId?: string;
  platform?: string;
  accountType?: "personal" | "organization";
  username?: string;
  aggregation?: "TOTAL" | "DAILY";
  dateRange?: { startDate?: string; endDate?: string } | null;
  analytics?: {
    impressions?: number | Array<{ date?: string; count?: number }>;
    reach?: number;
    reactions?: number | Array<{ date?: string; count?: number }>;
    comments?: number | Array<{ date?: string; count?: number }>;
    shares?: number | Array<{ date?: string; count?: number }>;
    engagementRate?: number;
  };
  skippedMetrics?: string[];
  note?: string;
  lastUpdated?: string;
}

export interface LinkedInPostAnalytics {
  accountId?: string;
  platform?: string;
  accountType?: "personal" | "organization";
  username?: string;
  postUrn?: string;
  analytics?: {
    impressions?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    clicks?: number;
    views?: number;
    engagementRate?: number;
  };
  lastUpdated?: string;
}

// ============================================================================
// YouTube analytics
// ============================================================================

export interface YouTubeDailyViews {
  success?: boolean;
  videoId?: string;
  dateRange?: { startDate?: string; endDate?: string };
  totalViews?: number;
  dailyViews?: Array<{
    date?: string;
    views?: number;
    estimatedMinutesWatched?: number;
    averageViewDuration?: number;
    subscribersGained?: number;
    subscribersLost?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  }>;
  lastSyncedAt?: string | null;
  scopeStatus?: { hasAnalyticsScope?: boolean };
}

// ============================================================================
// Social account (with optional analytics fields)
// ============================================================================

export interface SocialAccountAnalytics {
  _id?: string;
  platform?: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  profilePicture?: string;
  isActive?: boolean;
  followersCount?: number;
  followersLastUpdated?: string;
}

// ============================================================================
// Filter state for analytics UI
// ============================================================================

export type DateRange =
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "12m"
  | "custom";

export interface AnalyticsFilters {
  profileId?: string;
  platform?: string;
  accountIds?: string[];
  dateRange: DateRange;
  fromDate?: string;
  toDate?: string;
  sortBy?: "date" | "engagement";
  page?: number;
  limit?: number;
}

// ============================================================================
// AI insights
// ============================================================================

export interface AnalyticsInsight {
  id: string;
  type: "trend" | "recommendation" | "anomaly" | "comparison" | "summary";
  title: string;
  body: string;
  metric?: string;
  evidence?: string;
  generatedAt: string;
  model: string;
  profileId?: string;
  platform?: string;
  periodLabel?: string;
}

export interface InsightRequest {
  profileId: string;
  platform?: string;
  fromDate: string;
  toDate: string;
  question?: string;
}

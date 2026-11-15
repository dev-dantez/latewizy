/**
 * AI hooks — Trending Topics
 *
 * useTrendingTopics wraps POST /api/ai/trending-topics as a cached query.
 * Results are cached per-niche for 1 hour (CACHE_DURATIONS.trendingTopics) so
 * re-requesting the same niche within the window returns instantly without
 * hitting Groq again.
 */

import { useQuery } from "@tanstack/react-query";
import { CACHE_KEYS, CACHE_DURATIONS } from "@/lib/ai/constants";
import type { TrendingTopic, BrandProfile } from "@/types/ai";

// ─── Query keys ────────────────────────────────────────────────────────────────

export const aiKeys = {
  trendingTopics: (niche: string, brandName?: string) =>
    [CACHE_KEYS.trendingTopics, niche, brandName ?? null] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function postTrendingTopics(
  niche: string,
  brandContext?: BrandProfile
): Promise<TrendingTopic[]> {
  const res = await fetch("/api/ai/trending-topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ niche, brandContext }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `Request failed: ${res.status}`);
  }

  const data = (await res.json()) as { topics: TrendingTopic[] };
  return data.topics;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch trending content topics for a niche.
 *
 * Cached per-niche for 1 hour. The query stays disabled until a non-empty
 * niche is provided, so a panel can render empty until the user submits one.
 * Optional brandContext (brand name/audience/industry) tailors the topics.
 */
export function useTrendingTopics(
  niche: string,
  brandContext?: BrandProfile
) {
  return useQuery({
    queryKey: aiKeys.trendingTopics(niche, brandContext?.brandName),
    queryFn: () => postTrendingTopics(niche, brandContext),
    enabled: !!niche.trim(),
    staleTime: CACHE_DURATIONS.trendingTopics, // 1 hour
    gcTime: CACHE_DURATIONS.trendingTopics,
  });
}

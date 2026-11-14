/**
 * AI Content Generator Constants
 * 
 * This file contains all constants for the AI Content Generator feature,
 * including platform-specific limits, rate limits, and validation constraints.
 */

import type { Platform } from "@/lib/late-api";
import type { PlatformConstraints } from "@/types/ai";

// ============================================================================
// Platform Character Limits
// ============================================================================

/**
 * Maximum character counts per platform.
 * These limits are used to validate content length before publishing.
 */
export const PLATFORM_CHARACTER_LIMITS: Record<Platform, number> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  facebook: 63206,
  threads: 500,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  bluesky: 300,
  snapchat: 250,
  googlebusiness: 1500,
  reddit: 40000,
  telegram: 4096,
};

// ============================================================================
// Platform Hashtag Limits
// ============================================================================

/**
 * Maximum number of hashtags per platform.
 * These limits are enforced during content generation and validation.
 */
export const PLATFORM_HASHTAG_LIMITS: Record<Platform, number> = {
  twitter: 2,
  instagram: 30,
  linkedin: 5,
  facebook: 10,
  threads: 10,
  tiktok: 10,
  youtube: 15,
  pinterest: 20,
  bluesky: 5,
  snapchat: 0, // Snapchat doesn't support hashtags
  googlebusiness: 0, // Google Business doesn't support hashtags
  reddit: 0, // Reddit doesn't use hashtags
  telegram: 10,
};

// ============================================================================
// Platform Constraints
// ============================================================================

/**
 * Get platform-specific constraints for a given platform.
 * Returns character limits, hashtag limits, and feature support flags.
 */
export function getPlatformConstraints(platform: Platform): PlatformConstraints {
  return {
    platform,
    maxCharacters: PLATFORM_CHARACTER_LIMITS[platform],
    maxHashtags: PLATFORM_HASHTAG_LIMITS[platform],
    supportsHashtags: PLATFORM_HASHTAG_LIMITS[platform] > 0,
    supportsMedia: true, // All platforms support some form of media
    supportsVideo: !["googlebusiness"].includes(platform),
  };
}

// ============================================================================
// Provider Rate Limits
// ============================================================================

/**
 * Rate limits for external AI service providers (free tier).
 * Format: { requests: number, windowSeconds: number }
 */
export const PROVIDER_RATE_LIMITS = {
  groq: {
    requests: 30,
    windowSeconds: 60,
  },
  pixabay: {
    requests: 100,
    windowSeconds: 60,
  },
  pollinations: {
    requests: 10,
    windowSeconds: 60,
  },
} as const;

/**
 * Provider names for rate limiting keys.
 */
export type RateLimitProvider = keyof typeof PROVIDER_RATE_LIMITS;

// ============================================================================
// Validation Constraints
// ============================================================================

/**
 * Brand profile validation constraints.
 */
export const BRAND_PROFILE_CONSTRAINTS = {
  brandName: {
    minLength: 1,
    maxLength: 100,
  },
  description: {
    minLength: 1,
    maxLength: 500,
  },
  tone: {
    minLength: 1,
    maxLength: 50,
  },
  voice: {
    minLength: 1,
    maxLength: 200,
  },
  targetAudience: {
    minLength: 1,
    maxLength: 200,
  },
  industry: {
    minLength: 1,
    maxLength: 100,
  },
  defaultCTA: {
    minLength: 1,
    maxLength: 200,
  },
  hashtags: {
    max: 30,
  },
  doList: {
    max: 10,
    itemMaxLength: 200,
  },
  dontList: {
    max: 10,
    itemMaxLength: 200,
  },
} as const;

/**
 * Generation preferences validation constraints.
 */
export const GENERATION_PREFS_CONSTRAINTS = {
  temperature: {
    min: 0.0,
    max: 1.0,
  },
  maxTokens: {
    min: 256,
    max: 4096,
  },
  numVariants: {
    min: 1,
    max: 5,
  },
} as const;

/**
 * Auto-schedule configuration validation constraints.
 */
export const AUTO_SCHEDULE_CONSTRAINTS = {
  postsPerWeek: {
    min: 1,
    max: 14,
  },
  postingTimes: {
    max: 7,
  },
  contentThemes: {
    min: 1,
  },
} as const;

/**
 * API request validation constraints.
 */
export const API_REQUEST_CONSTRAINTS = {
  topic: {
    minLength: 1,
    maxLength: 500,
  },
  searchQuery: {
    minLength: 1,
    maxLength: 100,
  },
  imagePrompt: {
    minLength: 1,
    maxLength: 500,
  },
  niche: {
    minLength: 1,
    maxLength: 200,
  },
  imageDimensions: {
    min: 256,
    max: 2048,
  },
  imagePerPage: {
    min: 1,
    max: 200,
  },
} as const;

// ============================================================================
// Prompt Construction Limits
// ============================================================================

/**
 * Maximum lengths for prompt construction to prevent token overflow.
 */
export const PROMPT_LIMITS = {
  systemPrompt: 4000,
  userPrompt: 2000,
} as const;

// ============================================================================
// Storage Limits
// ============================================================================

/**
 * Maximum number of items to store in generation history.
 */
export const GENERATION_HISTORY_LIMIT = 50;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default generation preferences.
 */
export const DEFAULT_GENERATION_PREFS = {
  defaultModel: "llama-3.3-70b" as const,
  temperature: 0.7,
  maxTokens: 1024,
  numVariants: 3,
  includeHashtags: true,
  includeEmoji: true,
  includeCTA: true,
};

/**
 * Default image generation dimensions.
 */
export const DEFAULT_IMAGE_DIMENSIONS = {
  width: 1024,
  height: 1024,
};

/**
 * Default image generation model.
 */
export const DEFAULT_IMAGE_MODEL = "flux" as const;

/**
 * Groq model identifiers.
 * Use models available on the free tier of this account.
 */
export const GROQ_MODELS = {
  LLAMA_3_3_70B: "openai/gpt-oss-20b",
  LLAMA_3_1_8B: "openai/gpt-oss-20b",   // fallback — same model, still recovers on transient errors
} as const;

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * External API base URLs.
 */
export const EXTERNAL_API_URLS = {
  groq: "https://api.groq.com/openai/v1",
  pixabay: "https://pixabay.com/api",
  pollinations: "https://image.pollinations.ai/prompt",
} as const;

// ============================================================================
// Cache Keys
// ============================================================================

/**
 * Cache key prefixes for TanStack Query.
 */
export const CACHE_KEYS = {
  trendingTopics: "ai-trending-topics",
  imageSearch: "ai-image-search",
} as const;

/**
 * Cache durations in milliseconds.
 */
export const CACHE_DURATIONS = {
  trendingTopics: 60 * 60 * 1000, // 1 hour
  imageSearch: 5 * 60 * 1000, // 5 minutes
} as const;

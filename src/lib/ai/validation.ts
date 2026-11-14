/**
 * AI Content Generator Validation Schemas
 * 
 * This file contains Zod schemas for validating all AI Content Generator
 * request and response types, ensuring type safety and data integrity.
 */

import { z } from "zod";
import {
  BRAND_PROFILE_CONSTRAINTS,
  GENERATION_PREFS_CONSTRAINTS,
  AUTO_SCHEDULE_CONSTRAINTS,
  API_REQUEST_CONSTRAINTS,
  PLATFORM_CHARACTER_LIMITS,
  PLATFORM_HASHTAG_LIMITS,
} from "./constants";
import { PLATFORMS } from "@/lib/late-api";

// ============================================================================
// Brand Profile Schema
// ============================================================================

export const brandProfileSchema = z.object({
  brandName: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.brandName.minLength, "Brand name is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.brandName.maxLength,
      `Brand name must be at most ${BRAND_PROFILE_CONSTRAINTS.brandName.maxLength} characters`
    ),
  description: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.description.minLength, "Description is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.description.maxLength,
      `Description must be at most ${BRAND_PROFILE_CONSTRAINTS.description.maxLength} characters`
    ),
  tone: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.tone.minLength, "Tone is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.tone.maxLength,
      `Tone must be at most ${BRAND_PROFILE_CONSTRAINTS.tone.maxLength} characters`
    ),
  voice: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.voice.minLength, "Voice is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.voice.maxLength,
      `Voice must be at most ${BRAND_PROFILE_CONSTRAINTS.voice.maxLength} characters`
    ),
  targetAudience: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.targetAudience.minLength, "Target audience is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.targetAudience.maxLength,
      `Target audience must be at most ${BRAND_PROFILE_CONSTRAINTS.targetAudience.maxLength} characters`
    ),
  industry: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.industry.minLength, "Industry is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.industry.maxLength,
      `Industry must be at most ${BRAND_PROFILE_CONSTRAINTS.industry.maxLength} characters`
    ),
  hashtags: z
    .array(
      z
        .string()
        .startsWith("#", "Hashtags must start with #")
        .min(2, "Hashtags must be at least 2 characters (including #)")
    )
    .max(
      BRAND_PROFILE_CONSTRAINTS.hashtags.max,
      `Maximum ${BRAND_PROFILE_CONSTRAINTS.hashtags.max} hashtags allowed`
    )
    .default([]),
  doList: z
    .array(
      z
        .string()
        .min(1, "Do list items must not be empty")
        .max(
          BRAND_PROFILE_CONSTRAINTS.doList.itemMaxLength,
          `Do list items must be at most ${BRAND_PROFILE_CONSTRAINTS.doList.itemMaxLength} characters`
        )
    )
    .max(
      BRAND_PROFILE_CONSTRAINTS.doList.max,
      `Maximum ${BRAND_PROFILE_CONSTRAINTS.doList.max} do list items allowed`
    )
    .default([]),
  dontList: z
    .array(
      z
        .string()
        .min(1, "Don't list items must not be empty")
        .max(
          BRAND_PROFILE_CONSTRAINTS.dontList.itemMaxLength,
          `Don't list items must be at most ${BRAND_PROFILE_CONSTRAINTS.dontList.itemMaxLength} characters`
        )
    )
    .max(
      BRAND_PROFILE_CONSTRAINTS.dontList.max,
      `Maximum ${BRAND_PROFILE_CONSTRAINTS.dontList.max} don't list items allowed`
    )
    .default([]),
  defaultCTA: z
    .string()
    .min(BRAND_PROFILE_CONSTRAINTS.defaultCTA.minLength, "Default CTA is required")
    .max(
      BRAND_PROFILE_CONSTRAINTS.defaultCTA.maxLength,
      `Default CTA must be at most ${BRAND_PROFILE_CONSTRAINTS.defaultCTA.maxLength} characters`
    ),
});

/**
 * Partial brand profile schema for updates (all fields optional).
 */
export const partialBrandProfileSchema = brandProfileSchema.partial();

// ============================================================================
// Generation Preferences Schema
// ============================================================================

export const generationPrefsSchema = z.object({
  defaultModel: z.enum(["llama-3.3-70b", "llama-3.1-8b"]),
  temperature: z
    .number()
    .min(
      GENERATION_PREFS_CONSTRAINTS.temperature.min,
      `Temperature must be at least ${GENERATION_PREFS_CONSTRAINTS.temperature.min}`
    )
    .max(
      GENERATION_PREFS_CONSTRAINTS.temperature.max,
      `Temperature must be at most ${GENERATION_PREFS_CONSTRAINTS.temperature.max}`
    ),
  maxTokens: z
    .number()
    .int("Max tokens must be an integer")
    .min(
      GENERATION_PREFS_CONSTRAINTS.maxTokens.min,
      `Max tokens must be at least ${GENERATION_PREFS_CONSTRAINTS.maxTokens.min}`
    )
    .max(
      GENERATION_PREFS_CONSTRAINTS.maxTokens.max,
      `Max tokens must be at most ${GENERATION_PREFS_CONSTRAINTS.maxTokens.max}`
    ),
  numVariants: z
    .number()
    .int("Number of variants must be an integer")
    .min(
      GENERATION_PREFS_CONSTRAINTS.numVariants.min,
      `Number of variants must be at least ${GENERATION_PREFS_CONSTRAINTS.numVariants.min}`
    )
    .max(
      GENERATION_PREFS_CONSTRAINTS.numVariants.max,
      `Number of variants must be at most ${GENERATION_PREFS_CONSTRAINTS.numVariants.max}`
    ),
  includeHashtags: z.boolean(),
  includeEmoji: z.boolean(),
  includeCTA: z.boolean(),
});

/**
 * Partial generation preferences schema for updates (all fields optional).
 */
export const partialGenerationPrefsSchema = generationPrefsSchema.partial();

// ============================================================================
// Content Theme Schema
// ============================================================================

export const contentThemeSchema = z.object({
  id: z.string().min(1, "Theme ID is required"),
  name: z.string().min(1, "Theme name is required").max(100, "Theme name must be at most 100 characters"),
  description: z
    .string()
    .min(1, "Theme description is required")
    .max(500, "Theme description must be at most 500 characters"),
  weight: z
    .number()
    .min(0, "Weight must be at least 0")
    .max(1, "Weight must be at most 1"),
});

// ============================================================================
// Auto-Schedule Configuration Schema
// ============================================================================

/**
 * Validates posting time format (HH:MM).
 */
const postingTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Posting time must be in HH:MM format");

/**
 * Base object shape for auto-schedule config (without cross-field refinements).
 * Used for partial updates where individual fields are optional.
 */
const autoScheduleConfigBaseSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["daily", "every-other-day", "weekly", "custom"]),
  postsPerWeek: z
    .number()
    .int("Posts per week must be an integer")
    .min(
      AUTO_SCHEDULE_CONSTRAINTS.postsPerWeek.min,
      `Posts per week must be at least ${AUTO_SCHEDULE_CONSTRAINTS.postsPerWeek.min}`
    )
    .max(
      AUTO_SCHEDULE_CONSTRAINTS.postsPerWeek.max,
      `Posts per week must be at most ${AUTO_SCHEDULE_CONSTRAINTS.postsPerWeek.max}`
    ),
  postingTimes: z
    .array(postingTimeSchema)
    .min(1, "At least one posting time is required")
    .max(
      AUTO_SCHEDULE_CONSTRAINTS.postingTimes.max,
      `Maximum ${AUTO_SCHEDULE_CONSTRAINTS.postingTimes.max} posting times allowed`
    ),
  contentThemes: z
    .array(contentThemeSchema)
    .min(1, "At least one content theme is required"),
  startDate: z.string().refine(
    (date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    },
    { message: "Start date must be a valid ISO date string" }
  ),
  endDate: z
    .string()
    .refine(
      (date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
      },
      { message: "End date must be a valid ISO date string" }
    )
    .optional(),
});

export const autoScheduleConfigSchema = autoScheduleConfigBaseSchema.refine(
  (data) => {
    // Validate that start date is today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(data.startDate);
    startDate.setHours(0, 0, 0, 0);
    return startDate >= today;
  },
  { message: "Start date must be today or a future date", path: ["startDate"] }
).refine(
  (data) => {
    // Validate that end date is after start date
    if (!data.endDate) return true;
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return endDate > startDate;
  },
  { message: "End date must be after start date", path: ["endDate"] }
).refine(
  (data) => {
    // Validate that theme weights sum to 1.0
    const sum = data.contentThemes.reduce((acc, theme) => acc + theme.weight, 0);
    return Math.abs(sum - 1.0) < 0.0001; // Allow for floating point precision
  },
  { message: "Content theme weights must sum to 1.0", path: ["contentThemes"] }
);

/**
 * Partial auto-schedule config schema for updates (all fields optional).
 * Uses the base schema (without cross-field refinements) so .partial() works
 * in Zod v4, which disallows .partial() on refined schemas.
 */
export const partialAutoScheduleConfigSchema = autoScheduleConfigBaseSchema.partial();

// ============================================================================
// API Request Schemas
// ============================================================================

/**
 * Platform schema - validates against known platforms.
 */
const platformSchema = z.enum(PLATFORMS as [string, ...string[]]);

/**
 * Generate content request schema.
 */
export const generateContentRequestSchema = z.object({
  topic: z
    .string()
    .min(API_REQUEST_CONSTRAINTS.topic.minLength, "Topic is required")
    .max(
      API_REQUEST_CONSTRAINTS.topic.maxLength,
      `Topic must be at most ${API_REQUEST_CONSTRAINTS.topic.maxLength} characters`
    ),
  platform: platformSchema,
  tone: z.string().max(50, "Tone must be at most 50 characters").optional(),
  brandContext: brandProfileSchema,
  contentAngle: z.string().max(200, "Content angle must be at most 200 characters").optional(),
  numVariants: z
    .number()
    .int()
    .min(GENERATION_PREFS_CONSTRAINTS.numVariants.min)
    .max(GENERATION_PREFS_CONSTRAINTS.numVariants.max)
    .default(3)
    .optional(),
});

/**
 * Search images request schema (query params).
 */
export const searchImagesRequestSchema = z.object({
  q: z
    .string()
    .min(API_REQUEST_CONSTRAINTS.searchQuery.minLength, "Search query is required")
    .max(
      API_REQUEST_CONSTRAINTS.searchQuery.maxLength,
      `Search query must be at most ${API_REQUEST_CONSTRAINTS.searchQuery.maxLength} characters`
    ),
  per_page: z
    .number()
    .int()
    .min(API_REQUEST_CONSTRAINTS.imagePerPage.min)
    .max(API_REQUEST_CONSTRAINTS.imagePerPage.max)
    .default(10)
    .optional(),
  image_type: z.enum(["all", "photo", "illustration", "vector"]).default("photo").optional(),
});

/**
 * Generate image request schema.
 */
export const generateImageRequestSchema = z.object({
  prompt: z
    .string()
    .min(API_REQUEST_CONSTRAINTS.imagePrompt.minLength, "Prompt is required")
    .max(
      API_REQUEST_CONSTRAINTS.imagePrompt.maxLength,
      `Prompt must be at most ${API_REQUEST_CONSTRAINTS.imagePrompt.maxLength} characters`
    ),
  width: z
    .number()
    .int()
    .min(API_REQUEST_CONSTRAINTS.imageDimensions.min)
    .max(API_REQUEST_CONSTRAINTS.imageDimensions.max)
    .default(1024)
    .optional(),
  height: z
    .number()
    .int()
    .min(API_REQUEST_CONSTRAINTS.imageDimensions.min)
    .max(API_REQUEST_CONSTRAINTS.imageDimensions.max)
    .default(1024)
    .optional(),
  model: z.enum(["flux", "turbo"]).default("flux").optional(),
});

/**
 * Trending topics request schema.
 */
export const trendingTopicsRequestSchema = z.object({
  niche: z
    .string()
    .min(API_REQUEST_CONSTRAINTS.niche.minLength, "Niche is required")
    .max(
      API_REQUEST_CONSTRAINTS.niche.maxLength,
      `Niche must be at most ${API_REQUEST_CONSTRAINTS.niche.maxLength} characters`
    ),
  brandContext: brandProfileSchema.optional(),
});

/**
 * Auto-schedule request schema.
 */
export const autoScheduleRequestSchema = z.object({
  config: autoScheduleConfigSchema,
  brandContext: brandProfileSchema,
  platforms: z.array(z.object({
    platform: platformSchema,
    accountId: z.string().min(1, "Account ID is required"),
    customContent: z.string().optional(),
    platformSpecificData: z.any().optional(),
  })).min(1, "At least one platform is required"),
  timezone: z.string().min(1, "Timezone is required"),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Content variant schema.
 */
export const contentVariantSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  hashtags: z.array(z.string()),
  imageSuggestion: z.string(),
  callToAction: z.string().optional(),
  platformSpecificData: z.any().optional(),
  characterCount: z.number().int().min(0),
  platformValid: z.boolean(),
  warnings: z.array(z.string()),
});

/**
 * Stock image schema.
 */
export const stockImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  previewUrl: z.string().url(),
  tags: z.array(z.string()),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  source: z.enum(["pixabay", "unsplash"]),
});

/**
 * Trending topic schema.
 */
export const trendingTopicSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  angle: z.string().min(1),
  whyItTrends: z.string().min(1),
  contentIdeas: z.array(z.string()).max(5),
});

/**
 * Draft scheduled post schema.
 */
export const draftScheduledPostSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  hashtags: z.array(z.string()),
  mediaUrls: z.array(z.object({
    type: z.enum(["image", "video"]),
    url: z.string().url(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().optional(),
  })),
  platforms: z.array(z.object({
    platform: platformSchema,
    accountId: z.string().min(1),
    customContent: z.string().optional(),
    platformSpecificData: z.any().optional(),
  })),
  scheduledFor: z.string().refine(
    (date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime()) && parsed > new Date();
    },
    { message: "Scheduled time must be a valid ISO date string in the future" }
  ),
  topic: z.string().min(1),
  status: z.literal("draft"),
});

// ============================================================================
// Type Inference Helpers
// ============================================================================

/**
 * Infer TypeScript types from Zod schemas.
 */
export type BrandProfileInput = z.infer<typeof brandProfileSchema>;
export type GenerationPrefsInput = z.infer<typeof generationPrefsSchema>;
export type ContentThemeInput = z.infer<typeof contentThemeSchema>;
export type AutoScheduleConfigInput = z.infer<typeof autoScheduleConfigSchema>;
export type GenerateContentRequestInput = z.infer<typeof generateContentRequestSchema>;
export type SearchImagesRequestInput = z.infer<typeof searchImagesRequestSchema>;
export type GenerateImageRequestInput = z.infer<typeof generateImageRequestSchema>;
export type TrendingTopicsRequestInput = z.infer<typeof trendingTopicsRequestSchema>;
export type AutoScheduleRequestInput = z.infer<typeof autoScheduleRequestSchema>;
export type ContentVariantOutput = z.infer<typeof contentVariantSchema>;
export type StockImageOutput = z.infer<typeof stockImageSchema>;
export type TrendingTopicOutput = z.infer<typeof trendingTopicSchema>;
export type DraftScheduledPostOutput = z.infer<typeof draftScheduledPostSchema>;

/**
 * Platform Validation Utilities
 * 
 * This file contains utilities for validating content against platform-specific constraints,
 * including character limits, hashtag validation, and warning generation.
 */

import type { Platform } from "@/lib/late-api";
import type { ContentVariant, PlatformConstraints } from "@/types/ai";
import { PLATFORM_CHARACTER_LIMITS, PLATFORM_HASHTAG_LIMITS, getPlatformConstraints } from "./constants";

// Re-export getPlatformConstraints for convenience
export { getPlatformConstraints };

// ============================================================================
// Content Length Validation
// ============================================================================

/**
 * Check if content is within platform character limits.
 * 
 * @param content - The text content to validate
 * @param platform - The target platform
 * @returns true if content length is within the platform limit, false otherwise
 * 
 * @example
 * checkPlatformLimits("Hello world", "twitter") // true (11 chars < 280)
 * checkPlatformLimits("a".repeat(300), "twitter") // false (300 chars > 280)
 */
export function checkPlatformLimits(content: string, platform: Platform): boolean {
  const maxChars = PLATFORM_CHARACTER_LIMITS[platform];
  return content.length <= maxChars;
}

// ============================================================================
// Hashtag Validation
// ============================================================================

/**
 * Validate and sanitize hashtags for a specific platform.
 * 
 * Rules:
 * - Ensures each tag starts with "#"
 * - Removes empty tags
 * - Truncates array to platform-specific maximum
 * - Does NOT mutate the input array
 * 
 * @param hashtags - Array of hashtag strings (with or without "#" prefix)
 * @param platform - The target platform
 * @returns Sanitized array of hashtags conforming to platform limits
 * 
 * @example
 * validateHashtags(["#tech", "coding", "", "#ai"], "twitter")
 * // Returns: ["#tech", "#coding", "#ai"] (max 2 for twitter, so first 2 valid)
 * 
 * validateHashtags(["tech", "coding", "ai"], "instagram")
 * // Returns: ["#tech", "#coding", "#ai"]
 */
export function validateHashtags(hashtags: string[], platform: Platform): string[] {
  const maxHashtags = PLATFORM_HASHTAG_LIMITS[platform];
  
  // Return empty array if platform doesn't support hashtags
  if (maxHashtags === 0) {
    return [];
  }
  
  // Create a copy to avoid mutating input
  const hashtagsCopy = [...hashtags];
  
  // Filter empty tags and ensure all start with "#"
  const sanitized = hashtagsCopy
    .filter((tag) => tag.trim() !== "") // Remove empty tags
    .map((tag) => {
      const trimmed = tag.trim();
      return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    });
  
  // Truncate to platform maximum
  return sanitized.slice(0, maxHashtags);
}

// ============================================================================
// Warning Generation
// ============================================================================

/**
 * Generate warning messages for content that violates platform constraints.
 * 
 * Checks for:
 * - Content exceeding character limits
 * - Hashtag count exceeding platform limits
 * - Invalid hashtag format (if present)
 * 
 * @param variant - The content variant to validate
 * @param platform - The target platform
 * @returns Array of warning messages (empty if no violations)
 * 
 * @example
 * const variant = {
 *   content: "a".repeat(300),
 *   hashtags: ["#a", "#b", "#c"],
 *   // ... other fields
 * };
 * generateWarnings(variant, "twitter")
 * // Returns: [
 * //   "Content exceeds Twitter's 280 character limit (300 characters)",
 * //   "Hashtag count (3) exceeds Twitter's limit of 2"
 * // ]
 */
export function generateWarnings(variant: ContentVariant, platform: Platform): string[] {
  const warnings: string[] = [];
  const constraints = getPlatformConstraints(platform);
  
  // Check content length
  if (variant.content.length > constraints.maxCharacters) {
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    warnings.push(
      `Content exceeds ${platformName}'s ${constraints.maxCharacters} character limit (${variant.content.length} characters)`
    );
  }
  
  // Check hashtag count
  if (constraints.supportsHashtags && variant.hashtags.length > constraints.maxHashtags) {
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    warnings.push(
      `Hashtag count (${variant.hashtags.length}) exceeds ${platformName}'s limit of ${constraints.maxHashtags}`
    );
  }
  
  // Check for invalid hashtags (not starting with #)
  if (constraints.supportsHashtags) {
    const invalidHashtags = variant.hashtags.filter((tag) => !tag.startsWith("#"));
    if (invalidHashtags.length > 0) {
      warnings.push(
        `Invalid hashtags detected (must start with #): ${invalidHashtags.join(", ")}`
      );
    }
  }
  
  return warnings;
}

// ============================================================================
// Composite Validation
// ============================================================================

/**
 * Perform complete platform validation on a content variant.
 * Updates the variant's platformValid and warnings fields in place.
 * 
 * @param variant - The content variant to validate (modified in place)
 * @param platform - The target platform
 * 
 * @example
 * const variant = {
 *   id: "1",
 *   content: "Hello world",
 *   hashtags: ["tech", "ai"],
 *   imageSuggestion: "tech image",
 *   characterCount: 11,
 *   platformValid: false,
 *   warnings: []
 * };
 * 
 * validateContentVariant(variant, "twitter");
 * // variant.platformValid is now true
 * // variant.warnings is []
 * // variant.hashtags is ["#tech", "#ai"]
 */
export function validateContentVariant(variant: ContentVariant, platform: Platform): void {
  // Update character count
  variant.characterCount = variant.content.length;
  
  // Validate hashtags and update
  variant.hashtags = validateHashtags(variant.hashtags, platform);
  
  // Check platform limits
  variant.platformValid = checkPlatformLimits(variant.content, platform);
  
  // Generate warnings
  variant.warnings = generateWarnings(variant, platform);
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate multiple content variants for a specific platform.
 * 
 * @param variants - Array of content variants to validate
 * @param platform - The target platform
 * @returns Array of validated variants (originals are modified in place)
 * 
 * @example
 * const variants = [
 *   { content: "Post 1", hashtags: ["tech"], ... },
 *   { content: "Post 2", hashtags: ["ai", "ml"], ... }
 * ];
 * 
 * validateContentVariants(variants, "twitter");
 * // All variants now have updated platformValid, warnings, and hashtags
 */
export function validateContentVariants(
  variants: ContentVariant[],
  platform: Platform
): ContentVariant[] {
  variants.forEach((variant) => validateContentVariant(variant, platform));
  return variants;
}

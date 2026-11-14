/**
 * Brand-aware helpers for image search and AI image prompt enrichment.
 */

import type { SavedBrand } from "@/types/brand";

/**
 * Build Pixabay search terms from a brand + topic.
 *
 * Strategy: extract up to 3 relevant keywords from industry, niche, and topic.
 * We deliberately do NOT inject the brand name — it produces noisy results on
 * stock photo sites.
 */
export function buildImageSearchTerms(brand: SavedBrand, topic: string): string {
  const parts: string[] = [];

  // Topic words (first 4 meaningful words)
  const topicWords = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);
  parts.push(...topicWords);

  // Industry as a single keyword (first word only to keep it broad)
  if (brand.industry) {
    const industryWord = brand.industry.split(/[\s,/]/)[0].toLowerCase();
    if (industryWord && industryWord.length > 2 && !parts.includes(industryWord)) {
      parts.push(industryWord);
    }
  }

  // Niche keyword if it adds signal
  if (brand.niche) {
    const nicheWord = brand.niche.split(/[\s,/]/)[0].toLowerCase();
    if (nicheWord && nicheWord.length > 2 && !parts.includes(nicheWord)) {
      parts.push(nicheWord);
    }
  }

  // Keep at most 5 terms for a tight, useful query
  return parts.slice(0, 5).join(" ").trim();
}

/**
 * Build a short style descriptor for enriching Pollinations AI image prompts.
 *
 * Returns an empty string when no visual fields are set so the caller can
 * decide not to pre-fill the prompt.
 */
export function buildImagePromptContext(brand: SavedBrand): string {
  const parts: string[] = [];

  if (brand.imageStyle) parts.push(brand.imageStyle);
  if (brand.photographyStyle) parts.push(brand.photographyStyle);
  if (brand.illustrationStyle) parts.push(brand.illustrationStyle);

  // Add up to 2 preferred colors as tone descriptors
  if (brand.preferredColors && brand.preferredColors.length > 0) {
    const colorDesc = brand.preferredColors.slice(0, 2).join(" and ") + " tones";
    parts.push(colorDesc);
  } else if (brand.primaryColor) {
    parts.push(`${brand.primaryColor} color palette`);
  }

  // Add audience / industry for scene context
  if (brand.targetAudience) {
    parts.push(brand.targetAudience + " audience");
  }

  if (brand.imageInstructions) {
    parts.push(brand.imageInstructions);
  }

  return parts.join(", ").trim();
}

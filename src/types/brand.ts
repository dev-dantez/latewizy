/**
 * Brand Management Type Definitions
 *
 * SavedBrand extends the existing BrandProfile fields with extended identity,
 * visual identity, and image generation guidelines. The toBrandProfile helper
 * converts a SavedBrand into the shape the AI API route expects.
 */

import type { BrandProfile } from "./ai";

// ============================================================================
// SavedBrand
// ============================================================================

export interface SavedBrand {
  // Core identity (maps 1-to-1 to BrandProfile — REQUIRED)
  id: string;
  brandName: string;
  description: string;
  tone: string;
  voice: string;
  targetAudience: string;
  industry: string;
  hashtags: string[];
  doList: string[];
  dontList: string[];
  defaultCTA: string;

  // Extended identity
  website?: string;
  niche?: string;
  personality?: string;
  language?: string;
  writingStyle?: string;
  contentRestrictions?: string;
  additionalInstructions?: string;

  // Visual identity
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;

  // Image generation
  imageStyle?: string;
  photographyStyle?: string;
  illustrationStyle?: string;
  preferredColors?: string[];
  colorsToAvoid?: string[];
  imageInstructions?: string;

  // Settings
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert a SavedBrand to the BrandProfile shape the AI API expects. */
export function toBrandProfile(brand: SavedBrand): BrandProfile {
  return {
    brandName: brand.brandName,
    description: brand.description,
    tone: brand.tone,
    voice: brand.voice,
    targetAudience: brand.targetAudience,
    industry: brand.industry,
    hashtags: brand.hashtags,
    doList: brand.doList,
    dontList: brand.dontList,
    defaultCTA: brand.defaultCTA,
  };
}

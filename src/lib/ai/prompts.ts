/**
 * Prompt Construction Utilities
 * 
 * This file contains functions for building system and user prompts for AI content generation,
 * including brand context injection, platform constraint enforcement, and input sanitization
 * to prevent prompt injection attacks.
 * 
 * **Validates: Requirements 7.4, 7.6, 7.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7**
 */

import type { Platform } from "@/lib/late-api";
import type { BrandProfile, PlatformConstraints } from "@/types/ai";
import { getPlatformConstraints } from "./platform-validation";
import { PROMPT_LIMITS } from "./constants";

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Sanitize user input to remove control characters, null bytes, and instruction
 * injection attempts. This prevents prompt injection attacks where users might
 * try to override system instructions.
 * 
 * @param input - Raw user input string
 * @returns Sanitized string safe for inclusion in prompts
 * 
 * **Validates: Requirements 7.4, 7.6**
 */
export function sanitizeUserInput(input: string): string {
  if (!input) return "";
  
  let sanitized = input;
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");
  
  // Remove control characters (except newline, carriage return, and tab)
  // Control characters are in the range 0x00-0x1F and 0x7F-0x9F
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  
  // Remove common instruction injection attempts
  // These patterns are used to try to override the system prompt
  const injectionPatterns = [
    /ignore\s+(previous|above|all)\s+instructions?/gi,
    /disregard\s+(previous|above|all)\s+instructions?/gi,
    /forget\s+(previous|above|all)\s+instructions?/gi,
    /new\s+instructions?:/gi,
    /system\s*:/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\{system\}/gi,
    /\{assistant\}/gi,
    /\{user\}/gi,
  ];
  
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }
  
  // Normalize whitespace (replace multiple spaces/newlines with single space)
  sanitized = sanitized.replace(/\s+/g, " ").trim();
  
  return sanitized;
}

// ============================================================================
// System Prompt Construction
// ============================================================================

/**
 * Build system prompt with brand context and platform constraints.
 * The system prompt sets the AI's role, brand guidelines, tone, voice,
 * target audience, and platform-specific constraints.
 * 
 * @param brand - Brand profile with guidelines and context
 * @param platform - Target social media platform
 * @returns System prompt string (max 4000 characters)
 * 
 * **Validates: Requirements 7.7, 12.1, 12.2, 12.3, 12.4**
 */
export function buildSystemPrompt(
  brand: BrandProfile,
  platform: Platform
): string {
  const constraints = getPlatformConstraints(platform);
  
  // Sanitize all brand inputs to prevent injection
  const sanitizedBrand = {
    brandName: sanitizeUserInput(brand.brandName),
    description: sanitizeUserInput(brand.description),
    tone: sanitizeUserInput(brand.tone),
    voice: sanitizeUserInput(brand.voice),
    targetAudience: sanitizeUserInput(brand.targetAudience),
    industry: sanitizeUserInput(brand.industry),
    defaultCTA: sanitizeUserInput(brand.defaultCTA),
    doList: brand.doList.map(sanitizeUserInput),
    dontList: brand.dontList.map(sanitizeUserInput),
    hashtags: brand.hashtags.map(sanitizeUserInput),
  };
  
  // Build system prompt — keep it tight and imperative for reasoning models
  let prompt = `You are a social media copywriter. Your only job is to write finished, publish-ready post captions.

BRAND: ${sanitizedBrand.brandName}
INDUSTRY: ${sanitizedBrand.industry}
TONE: ${sanitizedBrand.tone}
VOICE: ${sanitizedBrand.voice}
AUDIENCE: ${sanitizedBrand.targetAudience}
PLATFORM: ${platform.toUpperCase()} (max ${constraints.maxCharacters} chars, max ${constraints.supportsHashtags ? constraints.maxHashtags : 0} hashtags)
`;

  if (sanitizedBrand.doList.length > 0) {
    prompt += `\nALWAYS: ${sanitizedBrand.doList.slice(0, 5).join(" | ")}\n`;
  }
  if (sanitizedBrand.dontList.length > 0) {
    prompt += `NEVER: ${sanitizedBrand.dontList.slice(0, 5).join(" | ")}\n`;
  }
  if (sanitizedBrand.defaultCTA) {
    prompt += `DEFAULT CTA: ${sanitizedBrand.defaultCTA}\n`;
  }
  if (constraints.supportsHashtags && sanitizedBrand.hashtags.length > 0) {
    prompt += `BRAND HASHTAGS (use when relevant): ${sanitizedBrand.hashtags.slice(0, constraints.maxHashtags).join(" ")}\n`;
  }

  prompt += `
CRITICAL RULES:
- Output ONLY the finished post captions. No commentary, no meta-text, no "Here is variant 1:".
- Every word you write goes directly onto ${platform}. Write accordingly.
- Stay within ${constraints.maxCharacters} characters per post.
- Each variant must have a genuinely different angle — not just rephrased.
`;
  
  // Ensure prompt doesn't exceed maximum length
  if (prompt.length > PROMPT_LIMITS.systemPrompt) {
    // Truncate to fit within limit, prioritizing core brand info
    prompt = prompt.substring(0, PROMPT_LIMITS.systemPrompt - 50) + "...";
  }
  
  return prompt;
}

// ============================================================================
// User Prompt Construction
// ============================================================================

/**
 * Build user prompt with topic, tone, platform constraints, variant count,
 * and JSON format instructions. The user prompt specifies what content to generate.
 * 
 * @param topic - Content topic or theme
 * @param tone - Optional tone override (overrides brand tone)
 * @param constraints - Platform-specific constraints
 * @param numVariants - Number of content variants to generate (default 3)
 * @returns User prompt string (max 2000 characters)
 * 
 * **Validates: Requirements 12.5, 12.6, 12.7**
 */
export function buildUserPrompt(
  topic: string,
  tone: string | undefined,
  constraints: PlatformConstraints,
  numVariants: number = 3
): string {
  // Sanitize inputs
  const sanitizedTopic = sanitizeUserInput(topic);
  const sanitizedTone = tone ? sanitizeUserInput(tone) : undefined;
  
  // Validate numVariants (default to 3 if not provided or invalid)
  const validNumVariants = numVariants >= 1 && numVariants <= 5 ? numVariants : 3;

  // Direct imperative — no "generate content about" framing
  let prompt = `Topic: ${sanitizedTopic}`;

  if (sanitizedTone) {
    prompt += `\nTone override: ${sanitizedTone}`;
  }

  prompt += `

Write ${validNumVariants} finished ${constraints.platform} caption${validNumVariants > 1 ? "s" : ""} about the topic above.
Separate each caption with a line containing only "===".

Format for EACH caption:
<the caption text — ready to post, within ${constraints.maxCharacters} characters>
HASHTAGS: #Tag1 #Tag2${!constraints.supportsHashtags ? "\n(Do NOT include a HASHTAGS line — this platform does not support hashtags)" : ` (max ${constraints.maxHashtags})`}
CTA: <call to action>

Do not write anything before the first caption or after the last one.
Do not number the captions. Do not add labels like "Variant 1:".
Start writing the first caption immediately.`;
  
  // Ensure prompt doesn't exceed maximum length
  if (prompt.length > PROMPT_LIMITS.userPrompt) {
    // Truncate topic if needed to fit within limit
    const maxTopicLength = PROMPT_LIMITS.userPrompt - 300; // Reserve 300 chars for instructions
    const truncatedTopic = sanitizedTopic.length > maxTopicLength 
      ? sanitizedTopic.substring(0, maxTopicLength) + "..."
      : sanitizedTopic;
    
    // Build minimal prompt with truncated topic
    const coreInstructions = `Generate ${validNumVariants} variants about: ${truncatedTopic}. Return JSON with variants array. Each: content (max ${constraints.maxCharacters} chars), hashtags (max ${constraints.maxHashtags}), imageSuggestion, callToAction.`;
    prompt = coreInstructions;
  }
  
  return prompt;
}

// ============================================================================
// Prompt Validation
// ============================================================================

/**
 * Validate that a prompt is within acceptable length limits.
 * 
 * @param prompt - Prompt string to validate
 * @param maxLength - Maximum allowed length
 * @returns true if prompt is valid, false otherwise
 */
export function isValidPrompt(prompt: string, maxLength: number): boolean {
  return prompt.length > 0 && prompt.length <= maxLength;
}

/**
 * Validate system prompt length.
 * 
 * @param systemPrompt - System prompt to validate
 * @returns true if valid, false otherwise
 */
export function isValidSystemPrompt(systemPrompt: string): boolean {
  return isValidPrompt(systemPrompt, PROMPT_LIMITS.systemPrompt);
}

/**
 * Validate user prompt length.
 * 
 * @param userPrompt - User prompt to validate
 * @returns true if valid, false otherwise
 */
export function isValidUserPrompt(userPrompt: string): boolean {
  return isValidPrompt(userPrompt, PROMPT_LIMITS.userPrompt);
}

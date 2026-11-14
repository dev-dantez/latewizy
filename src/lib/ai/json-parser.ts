/**
 * JSON Parsing and Fallback Utilities
 * 
 * This module provides functions to parse JSON responses from AI APIs
 * and extract structured data even when JSON parsing fails.
 * 
 * Requirements: 1.4, 1.5, 5.4, 9.8, 9.9
 */

import { randomUUID } from "crypto";
import type { ContentVariant, TrendingTopic } from "@/types/ai";

/**
 * Extracts and parses JSON from text, including from markdown code blocks.
 * 
 * Attempts to find JSON in the following order:
 * 1. Parse the entire content as JSON
 * 2. Extract JSON from markdown code blocks (```json ... ```)
 * 3. Extract JSON from any code blocks (``` ... ```)
 * 4. Find JSON objects/arrays in the text using regex
 * 
 * @param content - The text content that may contain JSON
 * @returns Parsed JSON object or null if parsing fails
 * 
 * Requirements: 1.4, 9.8
 */
export function parseJSON(content: string): unknown | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  const trimmed = content.trim();

  // Attempt 1: Parse entire content as JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to next attempt
  }

  // Attempt 2: Extract from markdown JSON code blocks
  const jsonBlockMatch = trimmed.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // Continue to next attempt
    }
  }

  // Attempt 3: Extract from any markdown code blocks
  const codeBlockMatch = trimmed.match(/```\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue to next attempt
    }
  }

  // Attempt 4: Find JSON object or array in text using regex
  // Look for patterns like { ... } or [ ... ]
  const jsonObjectMatch = trimmed.match(/(\{[\s\S]*\})/);
  if (jsonObjectMatch && jsonObjectMatch[1]) {
    try {
      return JSON.parse(jsonObjectMatch[1]);
    } catch {
      // Continue to next attempt
    }
  }

  const jsonArrayMatch = trimmed.match(/(\[[\s\S]*\])/);
  if (jsonArrayMatch && jsonArrayMatch[1]) {
    try {
      return JSON.parse(jsonArrayMatch[1]);
    } catch {
      // All attempts failed
    }
  }

  // All parsing attempts failed
  return null;
}

/**
 * Extracts ContentVariant array from raw text when JSON parsing fails.
 * 
 * This fallback parser attempts to extract structured content from unformatted
 * AI responses. It looks for common patterns in LLM responses such as:
 * - Numbered lists (1., 2., etc.)
 * - Bullet points
 * - Sections separated by blank lines
 * - Hashtags anywhere in the text
 * 
 * Always produces at least one variant from non-empty input.
 * 
 * @param content - Raw text from AI response
 * @returns Array of ContentVariant objects (at least 1 if content is non-empty)
 * 
 * Requirements: 1.5, 9.9
 */
export function extractContentFallback(content: string): ContentVariant[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const trimmed = content.trim();
  const variants: ContentVariant[] = [];

  // Extract all hashtags from the entire content
  const hashtagMatches = trimmed.match(/#[\w]+/g) || [];
  const hashtags = [...new Set(hashtagMatches)]; // Remove duplicates

  // Try to split by common variant separators
  let sections: string[] = [];

  // Attempt 1: Split by numbered list (1., 2., 3., etc.)
  const numberedSections = trimmed.split(/\n\s*\d+\.\s+/);
  if (numberedSections.length > 1) {
    // First section might be empty or contain intro text, filter it out if empty
    sections = numberedSections.filter((s) => s.trim().length > 0);
  }

  // Attempt 2: Split by bullet points if no numbered sections
  if (sections.length === 0) {
    const bulletSections = trimmed.split(/\n\s*[-*•]\s+/);
    if (bulletSections.length > 1) {
      sections = bulletSections.filter((s) => s.trim().length > 0);
    }
  }

  // Attempt 3: Split by double line breaks
  if (sections.length === 0) {
    const paragraphs = trimmed.split(/\n\s*\n/);
    if (paragraphs.length > 1) {
      sections = paragraphs.filter((s) => s.trim().length > 0);
    }
  }

  // Attempt 4: Treat entire content as single variant
  if (sections.length === 0) {
    sections = [trimmed];
  }

  // Build variants from extracted sections
  for (const section of sections) {
    const cleanContent = section.trim();
    
    if (cleanContent.length === 0) {
      continue;
    }

    // Remove hashtags from content to get clean text
    const contentWithoutHashtags = cleanContent.replace(/#[\w]+/g, "").trim();
    
    // Extract image suggestion (look for phrases like "image:", "visual:", etc.)
    let imageSuggestion = "";
    const imageSuggestionMatch = cleanContent.match(/(?:image|visual|photo|picture):\s*([^\n]+)/i);
    if (imageSuggestionMatch && imageSuggestionMatch[1]) {
      imageSuggestion = imageSuggestionMatch[1].trim();
    }

    // Extract CTA (look for phrases like "CTA:", "call to action:", etc.)
    let callToAction: string | undefined;
    const ctaMatch = cleanContent.match(/(?:CTA|call to action):\s*([^\n]+)/i);
    if (ctaMatch && ctaMatch[1]) {
      callToAction = ctaMatch[1].trim();
    }

    const variant: ContentVariant = {
      id: randomUUID(),
      content: contentWithoutHashtags || cleanContent,
      hashtags: hashtags,
      imageSuggestion: imageSuggestion || "relevant image for social media post",
      callToAction,
      characterCount: (contentWithoutHashtags || cleanContent).length,
      platformValid: true, // Conservative assumption, will be validated later
      warnings: [],
    };

    variants.push(variant);
  }

  // Ensure at least one variant from non-empty input (Requirement 1.5, 9.9)
  if (variants.length === 0 && trimmed.length > 0) {
    variants.push({
      id: randomUUID(),
      content: trimmed,
      hashtags: hashtags,
      imageSuggestion: "relevant image for social media post",
      characterCount: trimmed.length,
      platformValid: true,
      warnings: [],
    });
  }

  return variants;
}

/**
 * Extracts TrendingTopic array from raw text when JSON parsing fails.
 * 
 * This fallback parser attempts to extract trending topics from unformatted
 * AI responses. It looks for common patterns such as:
 * - Topic names/titles (often in bold or caps)
 * - Numbered or bulleted lists
 * - Sections with keywords like "trending", "topic", "why"
 * 
 * Always produces at least one topic from non-empty input.
 * 
 * @param content - Raw text from AI response
 * @returns Array of TrendingTopic objects (at least 1 if content is non-empty)
 * 
 * Requirements: 5.4, 9.9
 */
export function extractTopicsFallback(content: string): TrendingTopic[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const trimmed = content.trim();
  const topics: TrendingTopic[] = [];

  // Try to split by common topic separators
  let sections: string[] = [];

  // Attempt 1: Split by numbered list (1., 2., 3., etc.)
  const numberedSections = trimmed.split(/\n\s*\d+\.\s+/);
  if (numberedSections.length > 1) {
    sections = numberedSections.filter((s) => s.trim().length > 0);
  }

  // Attempt 2: Split by bullet points if no numbered sections
  if (sections.length === 0) {
    const bulletSections = trimmed.split(/\n\s*[-*•]\s+/);
    if (bulletSections.length > 1) {
      sections = bulletSections.filter((s) => s.trim().length > 0);
    }
  }

  // Attempt 3: Split by topic headers (lines that end with : or are in caps)
  if (sections.length === 0) {
    const lines = trimmed.split("\n");
    let currentSection = "";
    
    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Check if this looks like a topic header
      const isHeader = cleanLine.endsWith(":") || 
                       (cleanLine === cleanLine.toUpperCase() && cleanLine.length > 0) ||
                       /^#{1,3}\s+/.test(cleanLine); // Markdown headers
      
      if (isHeader && currentSection.length > 0) {
        sections.push(currentSection.trim());
        currentSection = cleanLine;
      } else {
        currentSection += (currentSection ? "\n" : "") + cleanLine;
      }
    }
    
    if (currentSection.trim().length > 0) {
      sections.push(currentSection.trim());
    }
  }

  // Attempt 4: Split by double line breaks
  if (sections.length === 0) {
    const paragraphs = trimmed.split(/\n\s*\n/);
    if (paragraphs.length > 1) {
      sections = paragraphs.filter((s) => s.trim().length > 0);
    }
  }

  // Attempt 5: Treat entire content as single topic
  if (sections.length === 0) {
    sections = [trimmed];
  }

  // Build topics from extracted sections
  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    
    if (lines.length === 0) {
      continue;
    }

    // First line is typically the topic name
    let topicName = lines[0].replace(/^[#*-]\s*/, "").replace(/:$/, "").trim();
    
    // Extract angle (look for "Angle:", "Approach:", etc.)
    let angle = "";
    const angleMatch = section.match(/(?:angle|approach|perspective):\s*([^\n]+)/i);
    if (angleMatch && angleMatch[1]) {
      angle = angleMatch[1].trim();
    } else if (lines.length > 1) {
      // Use second line as angle if no explicit label
      angle = lines[1];
    }

    // Extract why it trends (look for "Why:", "Trending because:", etc.)
    let whyItTrends = "";
    const whyMatch = section.match(/(?:why|trending because|reason):\s*([^\n]+)/i);
    if (whyMatch && whyMatch[1]) {
      whyItTrends = whyMatch[1].trim();
    } else {
      whyItTrends = "Currently generating engagement in the niche";
    }

    // Extract content ideas (look for "Ideas:", "Content:", bullets, etc.)
    const contentIdeas: string[] = [];
    const ideasMatch = section.match(/(?:ideas|content suggestions|post ideas):\s*([\s\S]*)/i);
    
    if (ideasMatch && ideasMatch[1]) {
      const ideasText = ideasMatch[1];
      const ideaLines = ideasText.split("\n")
        .map((l) => l.trim().replace(/^[-*•]\s*/, "").trim())
        .filter((l) => l.length > 0 && l.length < 200); // Reasonable length for an idea
      
      contentIdeas.push(...ideaLines.slice(0, 5)); // Max 5 ideas
    }

    // If no ideas found, extract from remaining lines
    if (contentIdeas.length === 0 && lines.length > 2) {
      for (let i = 2; i < lines.length && contentIdeas.length < 5; i++) {
        const line = lines[i].replace(/^[-*•]\s*/, "").trim();
        if (line.length > 0 && line.length < 200) {
          contentIdeas.push(line);
        }
      }
    }

    // Ensure at least one content idea
    if (contentIdeas.length === 0) {
      contentIdeas.push("Create engaging content about this topic");
    }

    const topic: TrendingTopic = {
      id: randomUUID(),
      topic: topicName || "Trending Topic",
      angle: angle || "Engaging perspective for your audience",
      whyItTrends: whyItTrends,
      contentIdeas: contentIdeas.slice(0, 5), // Ensure max 5 items
    };

    topics.push(topic);
  }

  // Ensure at least one topic from non-empty input (Requirement 5.4, 9.9)
  if (topics.length === 0 && trimmed.length > 0) {
    topics.push({
      id: randomUUID(),
      topic: trimmed.split("\n")[0].substring(0, 100), // First line or first 100 chars
      angle: "Relevant perspective for your niche",
      whyItTrends: "Currently generating interest in your industry",
      contentIdeas: ["Create engaging post about this topic"],
    });
  }

  // Limit to max 10 topics as per requirements
  return topics.slice(0, 10);
}

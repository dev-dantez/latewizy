/**
 * Content Generation API Route
 *
 * POST /api/ai/generate-content
 *
 * Generates social media content variants using the Groq API (Llama 3.3 70B).
 * Supports streaming (SSE) via ?stream=true query param.
 * Falls back to llama-3.1-8b-instant on 429/503 from primary model.
 * Returns X-RateLimit-Remaining and Retry-After headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateContentRequestSchema } from "@/lib/ai/validation";
import { checkRateLimit, getRateLimitStatus, getTimeUntilReset } from "@/lib/ai/rate-limiter";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts";
import { getPlatformConstraints, validateHashtags, generateWarnings } from "@/lib/ai/platform-validation";
import { parseJSON, extractContentFallback } from "@/lib/ai/json-parser";
import { GROQ_MODELS, PROVIDER_RATE_LIMITS } from "@/lib/ai/constants";
import type { ContentVariant, GenerateContentResponse } from "@/types/ai";

/**
 * Groq API chat completion request interface.
 */
interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChatCompletionRequest {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface GroqChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      reasoning?: string | null;  // reasoning models put output here
    };
    finish_reason: string;
  }>;
}

/** SSE chunk shape Groq sends when stream=true */
interface GroqStreamChunk {
  choices: Array<{
    delta: { content?: string; reasoning?: string };
    finish_reason: string | null;
  }>;
}

/**
 * Extract the usable text from a Groq response choice.
 * Standard models use `content`; reasoning models put output in `reasoning`.
 */
function extractResponseText(choice: GroqChatCompletionResponse["choices"][0]): string {
  const content = choice.message.content?.trim() ?? "";
  if (content.length > 0) return content;
  return choice.message.reasoning?.trim() ?? "";
}

/**
 * Extract client IP address from request headers.
 * Checks x-forwarded-for, x-real-ip, and falls back to "unknown".
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  return "unknown";
}

/**
 * Call Groq API for chat completion (non-streaming).
 * @param model - Groq model ID to use
 */
async function callGroqAPI(
  messages: GroqChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
  model: string = GROQ_MODELS.LLAMA_3_3_70B
): Promise<GroqChatCompletionResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set");

  const requestBody: GroqChatCompletionRequest = { model, messages, temperature, max_tokens: maxTokens };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Groq API error: ${response.status} ${errorText}`) as Error & { status: number };
    err.status = response.status;
    // Surface a human-readable message for common statuses
    if (response.status === 401) {
      (err as Error & { status: number; userMessage: string }).userMessage =
        "Invalid Groq API key. Check GROQ_API_KEY in your .env.local file.";
    } else if (response.status === 429) {
      (err as Error & { status: number; userMessage: string }).userMessage =
        "Groq rate limit reached. Retrying with fallback model…";
    } else if (response.status === 503) {
      (err as Error & { status: number; userMessage: string }).userMessage =
        "Groq service temporarily unavailable. Retrying…";
    }
    throw err;
  }

  return response.json();
}

/**
 * Call Groq with automatic fallback: tries primary model, retries with small
 * model on 429 or 503.
 */
async function callGroqWithFallback(
  messages: GroqChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<GroqChatCompletionResponse> {
  try {
    return await callGroqAPI(messages, temperature, maxTokens, GROQ_MODELS.LLAMA_3_3_70B);
  } catch (err) {
    const typedErr = err as Error & { status?: number; userMessage?: string };
    const status = typedErr.status;
    if (status === 429 || status === 503) {
      // Retry with smaller, faster model — clear the userMessage since we're recovering
      return await callGroqAPI(messages, temperature, maxTokens, GROQ_MODELS.LLAMA_3_1_8B);
    }
    throw err;
  }
}

/**
 * Stream Groq response as SSE to the client.
 * Sends each token delta as `data: <token>` and ends with `data: [DONE]`.
 */
async function streamGroqResponse(
  messages: GroqChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not set" }), { status: 500 });
  }

  let groqRes: Response;
  try {
    groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODELS.LLAMA_3_3_70B,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to connect to Groq" }), { status: 502 });
  }

  if (!groqRes.ok || !groqRes.body) {
    return new Response(JSON.stringify({ error: "Groq streaming error" }), { status: 502 });
  }

  const upstream = groqRes.body;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const chunk = JSON.parse(data) as GroqStreamChunk;
              // reasoning models stream into delta.reasoning; standard into delta.content
              const token = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.delta?.reasoning ?? "";
              if (token) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Build rate-limit response headers.
 */
function buildRateLimitHeaders(provider: "groq", clientIP: string): Record<string, string> {
  const status = getRateLimitStatus(provider, clientIP);
  const limits = PROVIDER_RATE_LIMITS[provider];
  const remaining = status ? Math.max(0, limits.requests - status.count) : limits.requests;
  const retryAfterMs = getTimeUntilReset(provider, clientIP);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limits.requests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window": String(limits.windowSeconds),
  };
  if (retryAfterMs > 0) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  return headers;
}

/**
 * Parse plain-text response with === separators into ContentVariant array.
 * Format per variant:
 *   <post text>
 *   HASHTAGS: #tag1 #tag2
 *   CTA: some call to action
 *   ===
 */
function parsePlainTextVariants(
  text: string,
  platform: string,
  brandDefaultCTA: string
): ContentVariant[] {
  const constraints = getPlatformConstraints(platform as never);
  const blocks = text.split(/\n\s*===\s*\n?/).map((b) => b.trim()).filter(Boolean);
  const variants: ContentVariant[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const hashtagLine = lines.find((l) => l.trim().toUpperCase().startsWith("HASHTAGS:"));
    const ctaLine = lines.find((l) => l.trim().toUpperCase().startsWith("CTA:"));

    // Content = all lines except HASHTAGS: and CTA: lines
    const contentLines = lines.filter(
      (l) => l !== hashtagLine && l !== ctaLine
    );
    const content = contentLines.join("\n").trim();

    if (!content) continue;

    // Parse hashtags from the HASHTAGS: line
    const rawHashtags = hashtagLine
      ? hashtagLine.replace(/^HASHTAGS:\s*/i, "").trim().split(/\s+/).filter((t) => t.startsWith("#"))
      : [];
    const hashtags = validateHashtags(rawHashtags, platform as never);

    const callToAction = ctaLine
      ? ctaLine.replace(/^CTA:\s*/i, "").trim() || brandDefaultCTA
      : brandDefaultCTA;

    const characterCount = content.length;
    const platformValid = characterCount <= constraints.maxCharacters;

    const variant: ContentVariant = {
      id: randomUUID(),
      content,
      hashtags,
      imageSuggestion: "relevant image for this post",
      callToAction: callToAction || undefined,
      characterCount,
      platformValid,
      warnings: [],
    };
    variant.warnings = generateWarnings(variant, platform as never);
    variants.push(variant);
  }

  return variants;
}

/**
 * Parse Groq response and build ContentVariant array.
 * Tries plain-text === format first, then JSON, then fallback extraction.
 */
function buildVariantsFromResponse(
  responseContent: string,
  platform: string,
  brandDefaultCTA: string
): ContentVariant[] {
  // Try plain-text === format first (what our prompt now requests)
  const plainVariants = parsePlainTextVariants(responseContent, platform, brandDefaultCTA);
  if (plainVariants.length > 0) return plainVariants;

  // Fall back to JSON parsing (for any model that still returns JSON)
  const parsed = parseJSON(responseContent);
  
  let rawVariants: Array<{
    content: string;
    hashtags?: string[];
    imageSuggestion?: string;
    callToAction?: string;
  }> = [];
  
  if (parsed && typeof parsed === "object") {
    // Check if parsed response has "variants" field
    if ("variants" in parsed && Array.isArray(parsed.variants)) {
      rawVariants = parsed.variants;
    } else if (Array.isArray(parsed)) {
      // Response is an array directly
      rawVariants = parsed;
    } else if ("content" in parsed) {
      // Single variant returned as object
      rawVariants = [parsed as never];
    }
  }
  
  // If JSON parsing failed or produced no variants, use fallback extraction
  if (rawVariants.length === 0) {
    return extractContentFallback(responseContent);
  }
  
  // Build ContentVariant objects from parsed data
  const constraints = getPlatformConstraints(platform as never);
  const variants: ContentVariant[] = [];
  
  for (const raw of rawVariants) {
    if (!raw.content || typeof raw.content !== "string" || raw.content.trim().length === 0) {
      continue; // Skip invalid variants
    }
    
    const content = raw.content.trim();
    const hashtags = Array.isArray(raw.hashtags) ? raw.hashtags : [];
    const validatedHashtags = validateHashtags(hashtags, platform as never);
    const characterCount = content.length;
    const platformValid = characterCount <= constraints.maxCharacters;
    
    const variant: ContentVariant = {
      id: randomUUID(),
      content,
      hashtags: validatedHashtags,
      imageSuggestion: raw.imageSuggestion || "relevant image for social media post",
      callToAction: raw.callToAction || brandDefaultCTA || undefined,
      characterCount,
      platformValid,
      warnings: [],
    };
    
    // Generate warnings for constraint violations
    variant.warnings = generateWarnings(variant, platform as never);
    
    variants.push(variant);
  }
  
  // Ensure at least one variant (fallback if all variants were invalid)
  if (variants.length === 0) {
    return extractContentFallback(responseContent);
  }
  
  return variants;
}

/**
 * POST handler for content generation.
 * Add ?stream=true to get a text/event-stream response with token deltas.
 */
export async function POST(request: NextRequest) {
  try {
    // Check API key early so the error is actionable
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey || groqKey === "your_groq_api_key_here") {
      return NextResponse.json(
        { error: "Configuration error", message: "GROQ_API_KEY is not configured. Get a free key at console.groq.com and add it to .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const validationResult = generateContentRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { topic, platform, tone, brandContext, numVariants = 3 } = validationResult.data;
    const clientIP = getClientIP(request);

    // Rate limit check
    const rateLimitAllowed = checkRateLimit("groq", clientIP);
    const rateLimitHeaders = buildRateLimitHeaders("groq", clientIP);

    if (!rateLimitAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many requests to Groq API. Please try again in a minute." },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const systemPrompt = buildSystemPrompt(brandContext, platform as import("@/lib/late-api").Platform);
    const constraints = getPlatformConstraints(platform as import("@/lib/late-api").Platform);
    const userPrompt = buildUserPrompt(topic, tone, constraints, numVariants);
    const messages: GroqChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Streaming mode — client passes ?stream=true
    const wantsStream = request.nextUrl.searchParams.get("stream") === "true";
    if (wantsStream) {
      return streamGroqResponse(messages, 0.7, 1024);
    }

    // Non-streaming with fallback
    let groqResponse: GroqChatCompletionResponse;
    try {
      groqResponse = await callGroqWithFallback(messages, 0.7, 1024);
    } catch (error) {
      console.error("Groq API call failed:", error);
      const userMessage =
        (error as Error & { userMessage?: string }).userMessage ??
        "Failed to generate content. Please try again.";
      return NextResponse.json(
        { error: "External API error", message: userMessage },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    if (!groqResponse.choices?.length) {
      return NextResponse.json(
        { error: "External API error", message: "No response from content generation service." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    const responseContent = extractResponseText(groqResponse.choices[0]);
    if (!responseContent) {
      return NextResponse.json(
        { error: "External API error", message: "Empty response from content generation service." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    const variants = buildVariantsFromResponse(responseContent, platform, brandContext.defaultCTA);
    if (variants.length === 0) {
      return NextResponse.json(
        { error: "External API error", message: "Failed to generate content variants. Please try again." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    const response: GenerateContentResponse = { variants };
    return NextResponse.json(response, { status: 200, headers: rateLimitHeaders });

  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

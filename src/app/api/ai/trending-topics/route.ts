/**
 * Trending Topics API Route
 *
 * POST /api/ai/trending-topics
 *
 * Generates trending content topics for a niche using Groq. Brand context
 * (name/audience/industry) is included when provided so topics fit the brand.
 * Returns a TrendingTopic[] (max 10), each with a fresh angle, why it trends,
 * and up to 5 content ideas.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { trendingTopicsRequestSchema } from "@/lib/ai/validation";
import { checkRateLimit, getRateLimitStatus, getTimeUntilReset } from "@/lib/ai/rate-limiter";
import { parseJSON, extractTopicsFallback } from "@/lib/ai/json-parser";
import { GROQ_MODELS, PROVIDER_RATE_LIMITS } from "@/lib/ai/constants";
import type { TrendingTopic, TrendingTopicsResponse, BrandProfile } from "@/types/ai";

function getClientIP(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function buildRateLimitHeaders(clientIP: string): Record<string, string> {
  const status = getRateLimitStatus("groq", clientIP);
  const limits = PROVIDER_RATE_LIMITS.groq;
  const remaining = status ? Math.max(0, limits.requests - status.count) : limits.requests;
  const retryAfterMs = getTimeUntilReset("groq", clientIP);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limits.requests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window": String(limits.windowSeconds),
  };
  if (retryAfterMs > 0) headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  return headers;
}

/**
 * Call Groq with one fallback retry on 429/503. Returns the raw text content.
 */
async function callGroq(
  messages: Array<{ role: "system" | "user"; content: string }>
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const request = (model: string) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 2048, include_reasoning: false }),
    });

  let res: Response;
  try {
    res = await request(GROQ_MODELS.LLAMA_3_3_70B);
  } catch (err) {
    throw new Error(`Failed to reach Groq: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (res.status === 429 || res.status === 503) {
    res = await request(GROQ_MODELS.LLAMA_3_1_8B);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from Groq");
  return content;
}

/** System prompt for trend analysis. */
function buildTrendingSystemPrompt(): string {
  return `You are a social media trend analyst. Given a niche, you identify currently trending content topics and return them as structured JSON.

Rules:
- Return ONLY a JSON array. No markdown, no commentary, no code fences.
- Maximum 10 topics, ranked by relevance and recency.
- Each topic must be genuinely distinct (not a rephrasing of another).
- "angle" = a fresh, specific content angle a creator could take.
- "whyItTrends" = one sentence on why this is gaining traction now.
- "contentIdeas" = up to 5 concrete post ideas (short strings).`;
}

/** User prompt with the niche + optional brand context. */
function buildTrendingUserPrompt(niche: string, brand?: BrandProfile): string {
  let prompt = `Niche: ${niche}`;

  if (brand) {
    prompt += `\nBrand: ${brand.brandName}`;
    if (brand.targetAudience) prompt += `\nAudience: ${brand.targetAudience}`;
    if (brand.industry) prompt += `\nIndustry: ${brand.industry}`;
  }

  prompt += `

Return a JSON array of up to 10 trending topics for this niche${
    brand ? ", tailored to the brand above" : ""
  }.

Each element must be:
{ "topic": string, "angle": string, "whyItTrends": string, "contentIdeas": string[] }

Respond with only the JSON array.`;

  return prompt;
}

/** Normalize a parsed value into a TrendingTopic[] (max 10, ideas max 5). */
function toTrendingTopics(parsed: unknown): TrendingTopic[] {
  const raw = Array.isArray(parsed) ? parsed : [];
  const topics: TrendingTopic[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const topic = typeof r.topic === "string" ? r.topic.trim() : "";
    if (!topic) continue;

    const ideas = Array.isArray(r.contentIdeas)
      ? r.contentIdeas
          .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
          .slice(0, 5)
      : [];

    topics.push({
      id: randomUUID(),
      topic,
      angle: typeof r.angle === "string" ? r.angle.trim() : "",
      whyItTrends: typeof r.whyItTrends === "string" ? r.whyItTrends.trim() : "",
      contentIdeas: ideas.length ? ideas : ["Create engaging content about this topic"],
    });
    if (topics.length >= 10) break;
  }

  return topics;
}

export async function POST(request: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey || groqKey === "your_groq_api_key_here") {
      return NextResponse.json(
        { error: "Configuration error", message: "GROQ_API_KEY is not configured. Get a free key at console.groq.com and add it to .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const result = trendingTopicsRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation error", details: result.error.format() },
        { status: 400 }
      );
    }

    const { niche, brandContext } = result.data;
    const clientIP = getClientIP(request);

    if (!checkRateLimit("groq", clientIP)) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many requests to Groq API. Please try again in a minute." },
        { status: 429, headers: buildRateLimitHeaders(clientIP) }
      );
    }

    const messages = [
      { role: "system" as const, content: buildTrendingSystemPrompt() },
      { role: "user" as const, content: buildTrendingUserPrompt(niche, brandContext) },
    ];

    let raw: string;
    try {
      raw = await callGroq(messages);
    } catch (err) {
      console.error("Trending topics Groq error:", err);
      return NextResponse.json(
        { error: "External API error", message: "Failed to fetch trending topics. Please try again." },
        { status: 502, headers: buildRateLimitHeaders(clientIP) }
      );
    }

    // Try JSON first, then the text fallback extractor.
    let topics = toTrendingTopics(parseJSON(raw));
    if (topics.length === 0) {
      topics = extractTopicsFallback(raw);
    }

    if (topics.length === 0) {
      return NextResponse.json(
        { error: "External API error", message: "Could not extract trending topics from the response." },
        { status: 502, headers: buildRateLimitHeaders(clientIP) }
      );
    }

    const response: TrendingTopicsResponse = { topics };
    return NextResponse.json(response, { status: 200, headers: buildRateLimitHeaders(clientIP) });
  } catch (error) {
    console.error("Trending topics error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

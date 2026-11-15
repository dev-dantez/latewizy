/**
 * POST /api/analytics/ai-insights
 *
 * Accepts a sanitized analytics snapshot and returns AI-generated insights
 * using the existing Groq infrastructure (openai/gpt-oss-20b).
 *
 * The client passes only the already-fetched analytics summary — the server
 * never re-fetches from Zernio here. API keys stay server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GROQ_MODELS } from "@/lib/ai/constants";
import { sanitizeUserInput } from "@/lib/ai/prompts";
import { checkRateLimit } from "@/lib/ai/rate-limiter";

// ============================================================================
// Request validation
// ============================================================================

const MetricSchema = z.record(z.string(), z.union([z.number(), z.string(), z.null()]));

const InsightRequestSchema = z.object({
  profileId: z.string().min(1).max(100),
  platform: z.string().max(50).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  question: z.string().max(500).optional(),
  /** Sanitized analytics snapshot — the client serialises this from TanStack Query cache */
  analyticsSnapshot: z.object({
    totalPosts: z.number().optional(),
    publishedPosts: z.number().optional(),
    topPostsByEngagement: z
      .array(
        z.object({
          content: z.string().max(300),
          platform: z.string().max(50).optional(),
          metrics: MetricSchema.optional(),
        })
      )
      .max(10)
      .optional(),
    platformBreakdown: z
      .array(
        z.object({
          platform: z.string().max(50),
          postCount: z.number().optional(),
          avgEngagementRate: z.number().optional(),
          totalImpressions: z.number().optional(),
          totalReach: z.number().optional(),
          totalLikes: z.number().optional(),
        })
      )
      .max(20)
      .optional(),
    followerStats: z
      .array(
        z.object({
          platform: z.string().max(50).optional(),
          username: z.string().max(100).optional(),
          currentFollowers: z.number().optional(),
          growth: z.number().optional(),
          growthPercentage: z.number().optional(),
        })
      )
      .max(20)
      .optional(),
  }),
  brandContext: z
    .object({
      brandName: z.string().max(100).optional(),
      industry: z.string().max(100).optional(),
      tone: z.string().max(50).optional(),
      targetAudience: z.string().max(200).optional(),
    })
    .optional(),
});

type InsightRequest = z.infer<typeof InsightRequestSchema>;

// ============================================================================
// Groq call
// ============================================================================

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function buildInsightPrompt(req: InsightRequest): {
  system: string;
  user: string;
} {
  const { analyticsSnapshot, brandContext, fromDate, toDate, platform, question } = req;

  const brandStr = brandContext
    ? `Brand: ${brandContext.brandName ?? "Unknown"} | Industry: ${brandContext.industry ?? "Unknown"} | Tone: ${brandContext.tone ?? "Professional"} | Audience: ${brandContext.targetAudience ?? "General"}`
    : "No brand context provided.";

  const system = `You are an expert social media analytics consultant. You analyse real performance data and generate specific, evidence-based recommendations. Never invent metrics. If data is insufficient, say so. Keep language professional and actionable.`;

  const snapshotStr = JSON.stringify(analyticsSnapshot, null, 2);
  const platformStr = platform && platform !== "all" ? ` on ${platform}` : " across all platforms";

  let user = `Analyse this social media performance data${platformStr} for the period ${fromDate} to ${toDate}.\n\n${brandStr}\n\nData:\n${snapshotStr}\n\n`;

  if (question) {
    // Sanitize user question to prevent prompt injection
    const safeQuestion = sanitizeUserInput(question);
    user += `User question: ${safeQuestion}\n\nAnswer the question using only the data provided above. `;
  } else {
    user += `Generate 3-5 specific, actionable insights. For each insight:\n- State a clear finding with the supporting metric\n- Provide one concrete recommendation\n- Keep each insight to 2-3 sentences\n\nFormat as a JSON array: [{"type": "trend"|"recommendation"|"anomaly"|"comparison"|"summary", "title": "...", "body": "...", "metric": "optional metric name", "evidence": "optional supporting stat"}]`;
  }

  return { system, user };
}

// ============================================================================
// Route handler
// ============================================================================

export async function POST(request: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey === "your_groq_api_key_here") {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = InsightRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const clientIP = getClientIP(request);
  if (!checkRateLimit("groq", clientIP)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429 }
    );
  }

  const { system, user } = buildInsightPrompt(parsed.data);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODELS.LLAMA_3_3_70B,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 2048,
        // gpt-oss is a reasoning model: return only the final answer, not the chain-of-thought.
        include_reasoning: false,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Groq API." },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Groq API error: ${response.status}`, detail: text.slice(0, 200) },
      { status: 502 }
    );
  }

  const json = await response.json();
  // gpt-oss puts chain-of-thought in `reasoning`; we request include_reasoning:false
  // so only `content` (the answer) is returned. Never fall back to `reasoning`.
  const content: string = json?.choices?.[0]?.message?.content ?? "";

  if (!content) {
    return NextResponse.json(
      { error: "Empty response from AI." },
      { status: 502 }
    );
  }

  // If the user asked a free-form question, return the text directly
  if (parsed.data.question) {
    return NextResponse.json({ answer: content });
  }

  // Otherwise parse the JSON insights array
  let insights: unknown[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      insights = JSON.parse(match[0]);
    }
  } catch {
    // Fall back to returning the raw text as a single summary insight
    insights = [
      {
        type: "summary",
        title: "Analytics Summary",
        body: content.slice(0, 600),
      },
    ];
  }

  return NextResponse.json({ insights });
}

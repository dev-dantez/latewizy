/**
 * Image Generation API Route
 *
 * GET /api/ai/generate-image?prompt={text}&width={n}&height={n}&model={flux|turbo}
 *
 * Generates an AI image via Pollinations (free, no API key required).
 * Rate-limited to 10 req/min per IP. Returns X-RateLimit-* headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateImageRequestSchema } from "@/lib/ai/validation";
import { checkRateLimit, getRateLimitStatus, getTimeUntilReset } from "@/lib/ai/rate-limiter";
import { EXTERNAL_API_URLS, PROVIDER_RATE_LIMITS } from "@/lib/ai/constants";
import type { GenerateImageResponse } from "@/types/ai";

function getClientIP(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function buildRateLimitHeaders(clientIP: string): Record<string, string> {
  const limits = PROVIDER_RATE_LIMITS.pollinations;
  const status = getRateLimitStatus("pollinations", clientIP);
  const remaining = status ? Math.max(0, limits.requests - status.count) : limits.requests;
  const retryAfterMs = getTimeUntilReset("pollinations", clientIP);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limits.requests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window": String(limits.windowSeconds),
  };
  if (retryAfterMs > 0) headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const validationResult = generateImageRequestSchema.safeParse({
      prompt: sp.get("prompt"),
      width: sp.get("width") ? parseInt(sp.get("width")!, 10) : undefined,
      height: sp.get("height") ? parseInt(sp.get("height")!, 10) : undefined,
      model: sp.get("model") ?? undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { prompt, width = 1024, height = 1024, model = "flux" } = validationResult.data;
    const clientIP = getClientIP(request);
    const allowed = checkRateLimit("pollinations", clientIP);
    const rateLimitHeaders = buildRateLimitHeaders(clientIP);

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many image generation requests. Please try again in a minute." },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    // Pollinations URL: https://image.pollinations.ai/prompt/{encoded_prompt}?width=&height=&model=&nologo=true
    const encodedPrompt = encodeURIComponent(prompt);
    const pollinationsUrl = new URL(`${EXTERNAL_API_URLS.pollinations}/${encodedPrompt}`);
    pollinationsUrl.searchParams.set("width", String(width));
    pollinationsUrl.searchParams.set("height", String(height));
    pollinationsUrl.searchParams.set("model", model);
    pollinationsUrl.searchParams.set("nologo", "true");
    pollinationsUrl.searchParams.set("nofeed", "true");

    // Fetch the image from Pollinations and proxy it back (avoids CORS issues on the client)
    let pollinationsRes: Response;
    try {
      pollinationsRes = await fetch(pollinationsUrl.toString(), { method: "GET" });
    } catch (err) {
      console.error("Pollinations fetch error:", err);
      return NextResponse.json(
        { error: "External API error", message: "Failed to connect to image generation service." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    if (!pollinationsRes.ok) {
      return NextResponse.json(
        { error: "External API error", message: "Image generation service returned an error." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    // Return the image URL as JSON (client uses it in an <img> tag)
    // We return the final URL so the client can display/cache it without re-proxying large blobs.
    const imageUrl = pollinationsUrl.toString();
    const response: GenerateImageResponse = { url: imageUrl, type: "image", width, height };

    return NextResponse.json(response, { status: 200, headers: rateLimitHeaders });

  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Image Search API Route
 * 
 * GET /api/ai/search-images?q={query}&per_page={n}&image_type={type}
 * 
 * Searches for royalty-free stock images using the Pixabay API.
 * All inputs are validated, rate-limited, and sanitized before processing.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */

import { NextRequest, NextResponse } from "next/server";
import { searchImagesRequestSchema } from "@/lib/ai/validation";
import { checkRateLimit, getRateLimitStatus, getTimeUntilReset } from "@/lib/ai/rate-limiter";
import { EXTERNAL_API_URLS, PROVIDER_RATE_LIMITS } from "@/lib/ai/constants";
import type { StockImage, SearchImagesResponse } from "@/types/ai";

/**
 * Pixabay API response interface.
 */
interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  likes: number;
  comments: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

/**
 * Extract client IP address from request headers.
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return "unknown";
}

/** Build Pixabay rate-limit response headers. */
function buildRateLimitHeaders(clientIP: string): Record<string, string> {
  const limits = PROVIDER_RATE_LIMITS.pixabay;
  const status = getRateLimitStatus("pixabay", clientIP);
  const remaining = status ? Math.max(0, limits.requests - status.count) : limits.requests;
  const retryAfterMs = getTimeUntilReset("pixabay", clientIP);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limits.requests),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Window": String(limits.windowSeconds),
  };
  if (retryAfterMs > 0) headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  return headers;
}

/**
 * Sanitize search query by URL-encoding and removing control characters.
 * Requirements: 2.6
 */
function sanitizeQuery(query: string): string {
  // Remove control characters (ASCII 0-31 and 127)
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = query.replace(/[\x00-\x1F\x7F]/g, "");
  
  // URL-encode the query
  return encodeURIComponent(withoutControlChars.trim());
}

/**
 * Normalize Pixabay response to StockImage array.
 * Requirements: 2.2, 2.3
 */
function normalizePixabayResponse(pixabayResponse: PixabayResponse): StockImage[] {
  return pixabayResponse.hits.map((hit) => ({
    id: String(hit.id),
    url: hit.webformatURL,
    previewUrl: hit.previewURL,
    tags: hit.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    width: hit.webformatWidth,
    height: hit.webformatHeight,
    source: "pixabay" as const,
  }));
}

/**
 * GET handler for image search.
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey || apiKey === "your_pixabay_api_key_here") {
      console.error("PIXABAY_API_KEY is not configured");
      return NextResponse.json(
        { error: "Configuration error", message: "PIXABAY_API_KEY is not configured. Get a free key at pixabay.com/api/docs and add it to .env.local." },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const perPageStr = searchParams.get("per_page");
    const imageType = searchParams.get("image_type") || "photo";
    const perPage = perPageStr ? parseInt(perPageStr, 10) : 10;

    const validationResult = searchImagesRequestSchema.safeParse({ q: query, per_page: perPage, image_type: imageType });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { q: validatedQuery, per_page: validatedPerPage } = validationResult.data;
    const clientIP = getClientIP(request);
    const rateLimitAllowed = checkRateLimit("pixabay", clientIP);
    const rateLimitHeaders = buildRateLimitHeaders(clientIP);

    if (!rateLimitAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many requests to image search service. Please try again in a minute." },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const sanitizedQuery = sanitizeQuery(validatedQuery);
    const pixabayUrl = new URL(EXTERNAL_API_URLS.pixabay);
    pixabayUrl.searchParams.set("key", apiKey);
    pixabayUrl.searchParams.set("q", sanitizedQuery);
    pixabayUrl.searchParams.set("per_page", String(validatedPerPage));
    pixabayUrl.searchParams.set("image_type", "photo");
    pixabayUrl.searchParams.set("safesearch", "true");
    pixabayUrl.searchParams.set("orientation", "horizontal");

    let pixabayResponse: Response;
    try {
      pixabayResponse = await fetch(pixabayUrl.toString(), { method: "GET", headers: { "Content-Type": "application/json" } });
    } catch (error) {
      console.error("Pixabay API network error:", error);
      return NextResponse.json(
        { error: "External API error", message: "Failed to connect to image search service. Please try again." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    if (!pixabayResponse.ok) {
      console.error(`Pixabay API error: ${pixabayResponse.status}`);
      return NextResponse.json(
        { error: "External API error", message: "Image search service returned an error. Please try again." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    let pixabayData: PixabayResponse;
    try {
      pixabayData = await pixabayResponse.json();
    } catch (error) {
      console.error("Failed to parse Pixabay response:", error);
      return NextResponse.json(
        { error: "External API error", message: "Failed to parse image search results. Please try again." },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    const images = normalizePixabayResponse(pixabayData);
    const response: SearchImagesResponse = { images, total: pixabayData.totalHits };

    return NextResponse.json(response, { status: 200, headers: rateLimitHeaders });

  } catch (error) {
    console.error("Image search error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Stock image lookup for the autopilot pipeline.
 *
 * Searches Pixabay for a royalty-free image matching a query and returns the
 * first result's direct image URL. Used by the generate-content worker to
 * attach a relevant image to autopilot-generated calendar entries.
 *
 * Server-side only — reads PIXABAY_API_KEY from env. Never throws: image
 * attachment is best-effort, so a missing key or a failed request just means
 * the entry is published without an image rather than failing the job.
 */

import { EXTERNAL_API_URLS } from "./constants";

export interface StockImageHit {
  url: string; // webformatURL — directly usable by Zernio
  previewUrl: string;
  tags: string[];
}

/**
 * Search Pixabay for stock images. Returns up to `perPage` hits, or an empty
 * array on any error / missing key. Never throws.
 */
export async function searchStockImages(
  query: string,
  perPage = 3
): Promise<StockImageHit[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey || !query.trim()) return [];

  try {
    // Remove control chars and encode (mirrors /api/ai/search-images sanitization)
    const clean = query.replace(/[\x00-\x1F\x7F]/g, "").trim();
    const url = new URL(EXTERNAL_API_URLS.pixabay);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", encodeURIComponent(clean));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("orientation", "horizontal");

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      hits?: Array<{
        webformatURL?: string;
        previewURL?: string;
        tags?: string;
      }>;
    };

    return (data.hits ?? [])
      .filter((h) => h.webformatURL)
      .map((h) => ({
        url: h.webformatURL as string,
        previewUrl: h.previewURL ?? "",
        tags: (h.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      }));
  } catch {
    return [];
  }
}

/**
 * Best-effort: return a single image URL for a topic, or null if none found.
 */
export async function findImageForTopic(topic: string): Promise<string | null> {
  const hits = await searchStockImages(topic, 3);
  return hits[0]?.url ?? null;
}

/**
 * Rate Limiter for AI Content Generator
 * 
 * In-memory rate limiting for external API providers to protect free-tier quotas.
 * Uses Map-based counting with automatic window expiration.
 */

import { PROVIDER_RATE_LIMITS, type RateLimitProvider } from "./constants";

/**
 * Rate limit entry stored in the cache.
 */
interface RateLimitEntry {
  count: number;
  windowStart: number; // timestamp in milliseconds
}

/**
 * In-memory cache for rate limit tracking.
 * Key format: "ratelimit:{provider}:{identifier}"
 */
const rateLimitCache = new Map<string, RateLimitEntry>();

/**
 * Build a namespaced cache key for rate limiting.
 * 
 * @param provider - The API provider (groq, pixabay, pollinations)
 * @param identifier - Unique identifier for the request (e.g., user ID, IP address)
 * @returns Namespaced cache key
 */
function buildRateLimitKey(provider: RateLimitProvider, identifier: string): string {
  return `ratelimit:${provider}:${identifier}`;
}

/**
 * Check if a request is allowed under the rate limit for a given provider.
 * 
 * This function enforces per-provider, per-identifier rate limits:
 * - Groq: 30 requests per 60 seconds
 * - Pixabay: 100 requests per 60 seconds
 * - Pollinations: 10 requests per 60 seconds
 * 
 * When the 60-second window expires, the count is automatically reset.
 * 
 * @param provider - The API provider to check limits for
 * @param identifier - Unique identifier for the requester (e.g., user ID, IP)
 * @returns true if request is allowed, false if rate limit exceeded
 * 
 * @example
 * ```ts
 * const allowed = checkRateLimit("groq", "user-123");
 * if (!allowed) {
 *   return new Response("Rate limit exceeded", { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(
  provider: RateLimitProvider,
  identifier: string
): boolean {
  const key = buildRateLimitKey(provider, identifier);
  const limits = PROVIDER_RATE_LIMITS[provider];
  const now = Date.now();
  const windowMs = limits.windowSeconds * 1000;

  // Get existing entry or create new one
  const entry = rateLimitCache.get(key);

  if (!entry) {
    // First request in this window
    rateLimitCache.set(key, {
      count: 1,
      windowStart: now,
    });
    return true;
  }

  // Check if the window has expired
  const windowAge = now - entry.windowStart;
  if (windowAge >= windowMs) {
    // Window expired, reset count
    rateLimitCache.set(key, {
      count: 1,
      windowStart: now,
    });
    return true;
  }

  // Window is still active, check if limit exceeded
  if (entry.count >= limits.requests) {
    // Rate limit exceeded
    return false;
  }

  // Increment count and allow request
  entry.count += 1;
  rateLimitCache.set(key, entry);
  return true;
}

/**
 * Get the current request count for a provider and identifier.
 * Useful for debugging and monitoring.
 * 
 * @param provider - The API provider
 * @param identifier - Unique identifier for the requester
 * @returns Current count and window start time, or null if no entry exists
 */
export function getRateLimitStatus(
  provider: RateLimitProvider,
  identifier: string
): { count: number; windowStart: number; limit: number; windowSeconds: number } | null {
  const key = buildRateLimitKey(provider, identifier);
  const entry = rateLimitCache.get(key);
  const limits = PROVIDER_RATE_LIMITS[provider];

  if (!entry) {
    return null;
  }

  return {
    count: entry.count,
    windowStart: entry.windowStart,
    limit: limits.requests,
    windowSeconds: limits.windowSeconds,
  };
}

/**
 * Reset rate limit for a specific provider and identifier.
 * Useful for testing or manual override scenarios.
 * 
 * @param provider - The API provider
 * @param identifier - Unique identifier for the requester
 */
export function resetRateLimit(
  provider: RateLimitProvider,
  identifier: string
): void {
  const key = buildRateLimitKey(provider, identifier);
  rateLimitCache.delete(key);
}

/**
 * Clear all rate limit entries from the cache.
 * Useful for testing or system resets.
 */
export function clearRateLimitCache(): void {
  rateLimitCache.clear();
}

/**
 * Get the time remaining (in milliseconds) until the rate limit window resets.
 * Returns 0 if no active rate limit entry exists.
 * 
 * @param provider - The API provider
 * @param identifier - Unique identifier for the requester
 * @returns Milliseconds until window reset
 */
export function getTimeUntilReset(
  provider: RateLimitProvider,
  identifier: string
): number {
  const key = buildRateLimitKey(provider, identifier);
  const entry = rateLimitCache.get(key);
  const limits = PROVIDER_RATE_LIMITS[provider];

  if (!entry) {
    return 0;
  }

  const windowMs = limits.windowSeconds * 1000;
  const now = Date.now();
  const windowAge = now - entry.windowStart;
  const remaining = windowMs - windowAge;

  return remaining > 0 ? remaining : 0;
}

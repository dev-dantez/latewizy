/**
 * generate-content job handler
 *
 * Payload shape:
 *   { calendarEntryId: string }
 *
 * Flow:
 *   1. Load CalendarEntry — verify it belongs to job.workspaceId
 *   2. Load Brand for AI context
 *   3. Generate content via Groq, reusing the shared, sanitized prompt builders
 *      from src/lib/ai/prompts.ts (same logic as /api/ai/generate-content:
 *      platform constraints + injection sanitization + the DON'T list + CTA).
 *   4. Write generated content back to CalendarEntry (status → ready)
 *   5. If the brand's autopilot config has requireApproval=false, auto-enqueue
 *      a publish-entry job so the post publishes without a human click.
 *
 * Idempotency: if status is already "ready" or beyond, skip generation.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { brands } from "@/db/schema/brands";
import { autopilotConfigs } from "@/db/schema/autopilot-configs";
import { enqueueJob, type LockedJob } from "@/db/jobs";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts";
import { getPlatformConstraints, validateHashtags } from "@/lib/ai/platform-validation";
import { GROQ_MODELS } from "@/lib/ai/constants";
import { findImageForTopic } from "@/lib/ai/stock-image";
import type { BrandProfile } from "@/types/ai";
import type { Platform } from "@/lib/late-api";

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleGenerateContent(job: LockedJob): Promise<void> {
  const { calendarEntryId } = job.payload as { calendarEntryId: string };

  if (!calendarEntryId) {
    throw new Error("Missing calendarEntryId in job payload");
  }

  // 1. Load and verify entry
  const [entry] = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, calendarEntryId),
        eq(calendarEntries.workspaceId, job.workspaceId)
      )
    )
    .limit(1);

  if (!entry) {
    throw new Error(`CalendarEntry ${calendarEntryId} not found in workspace ${job.workspaceId}`);
  }

  // Idempotency: skip if already generated
  if (!["pending", "generating"].includes(entry.status)) {
    console.log(`[generate-content] Entry ${calendarEntryId} already at status=${entry.status}, skipping`);
    return;
  }

  // 2. Mark as generating
  await db
    .update(calendarEntries)
    .set({ status: "generating" })
    .where(eq(calendarEntries.id, calendarEntryId));

  // 3. Load brand
  const [brand] = await db
    .select()
    .from(brands)
    .where(
      and(
        eq(brands.id, entry.brandId),
        eq(brands.workspaceId, job.workspaceId)
      )
    )
    .limit(1);

  if (!brand) {
    throw new Error(`Brand ${entry.brandId} not found`);
  }

  // 4. Determine the target platform (first platform in the entry, for constraints)
  const platform = (
    (entry.platforms as Array<{ platform: string }> | null)?.[0]?.platform ?? "instagram"
  ) as Platform;

  // 5. Build prompts with the shared, sanitized builders (brand context, platform
  //    constraints, DON'T list, CTA, injection sanitization).
  const brandProfile: BrandProfile = {
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

  const constraints = getPlatformConstraints(platform);
  const systemPrompt = buildSystemPrompt(brandProfile, platform);
  const userPrompt = buildUserPrompt(entry.topic, undefined, constraints, 1);

  // 6. Call Groq (with one fallback retry on 429/503) and parse the response
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY not set");

  const { content, hashtags } = await callGroq(groqKey, systemPrompt, userPrompt, platform);

  // 7. Save generated content + parsed hashtags
  await db
    .update(calendarEntries)
    .set({
      content,
      hashtags,
      status: "ready",
      generatedAt: new Date(),
    })
    .where(eq(calendarEntries.id, calendarEntryId));

  // 8. Best-effort stock image for autopilot entries (Pixabay). Manual entries
  //    keep whatever the user attached. Never fails the job if no image found.
  if (entry.source === "autopilot") {
    const imageUrl = await findImageForTopic(entry.topic);
    if (imageUrl) {
      await db
        .update(calendarEntries)
        .set({ mediaUrls: [imageUrl] })
        .where(eq(calendarEntries.id, calendarEntryId));
    }
  }

  // 9. Autopilot entries: publish immediately or request approval, per the
  //    brand's config. Manual entries stay "ready" for the user to approve by
  //    hand (the existing flow).
  if (entry.source === "autopilot") {
    const [config] = await db
      .select({ requireApproval: autopilotConfigs.requireApproval })
      .from(autopilotConfigs)
      .where(
        and(
          eq(autopilotConfigs.brandId, entry.brandId),
          eq(autopilotConfigs.workspaceId, job.workspaceId)
        )
      )
      .limit(1);

    if (config && !config.requireApproval) {
      await enqueueJob(
        job.workspaceId,
        "publish-entry",
        { calendarEntryId: entry.id },
        {
          idempotencyKey: `publish-entry:${entry.id}`,
          priority: 10,
        }
      );
      console.log(
        `[generate-content] auto-publish enqueued for entry=${entry.id} (requireApproval=false)`
      );
    } else if (config) {
      await enqueueJob(
        job.workspaceId,
        "send-approval-request",
        { calendarEntryId: entry.id },
        {
          idempotencyKey: `send-approval-request:${entry.id}`,
          priority: 20,
        }
      );
      console.log(
        `[generate-content] approval requested for entry=${entry.id} (requireApproval=true)`
      );
    }
  }
}

// ─── Groq call + response parsing ─────────────────────────────────────────────

/**
 * Call Groq for a single post. Retries once with the fallback model on 429/503.
 * Parses the plain-text === format produced by buildUserPrompt into content +
 * hashtags.
 */
async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  platform: Platform
): Promise<{ content: string; hashtags: string[] }> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  const request = (model: string) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

  let response: Response;
  try {
    response = await request(GROQ_MODELS.LLAMA_3_3_70B);
  } catch (err) {
    throw new Error(`Failed to reach Groq: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Retry once on transient rate-limit / unavailable with the fallback model
  if (response.status === 429 || response.status === 503) {
    response = await request(GROQ_MODELS.LLAMA_3_1_8B);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };

  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty response from Groq");

  return parseGeneratedPost(raw, platform);
}

/**
 * Parse the plain-text === format from buildUserPrompt into content + hashtags.
 * Handles a single variant; falls back to the whole text if the model didn't
 * follow the HASHTAGS:/CTA: structure.
 */
function parseGeneratedPost(
  text: string,
  platform: Platform
): { content: string; hashtags: string[] } {
  const block = text.split(/\n\s*===\s*\n?/)[0]?.trim() ?? text.trim();
  const lines = block.split("\n");

  const hashtagLineIdx = lines.findIndex((l) =>
    l.trim().toUpperCase().startsWith("HASHTAGS:")
  );
  const ctaLineIdx = lines.findIndex((l) =>
    l.trim().toUpperCase().startsWith("CTA:")
  );

  const contentLines = lines.filter((_, i) => i !== hashtagLineIdx && i !== ctaLineIdx);
  let content = contentLines.join("\n").trim();

  const rawTags =
    hashtagLineIdx >= 0
      ? lines[hashtagLineIdx]
          .replace(/^HASHTAGS:\s*/i, "")
          .trim()
          .split(/\s+/)
          .filter((t) => t.startsWith("#"))
      : [];
  const hashtags = validateHashtags(rawTags, platform);

  // If the model ignored the format, use the whole block as the post content
  if (!content) content = block;

  return { content, hashtags };
}

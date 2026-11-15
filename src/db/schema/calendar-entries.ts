import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  json,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { workspaces } from "./workspaces";
import { brands } from "./brands";
import { relations } from "drizzle-orm";

/**
 * calendar_entries — a planned post managed by LateWiz.
 *
 * Status flow:
 *   pending → generating → ready → approved → publishing → published
 *                                           ↘ rejected
 *                                                        ↘ failed
 *
 * zernioPostId is null until the publish job fires. The job checks this
 * field before calling Zernio, so retries are safe (idempotent).
 */
export const calendarEntries = mysqlTable(
  "calendar_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandId: varchar("brand_id", { length: 36 })
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),

    // ── Content ───────────────────────────────────────────────────────────
    topic: varchar("topic", { length: 500 }).notNull(),
    content: text("content"),                     // set after generation
    hashtags: json("hashtags").$type<string[]>().default([]),
    mediaUrls: json("media_urls").$type<string[]>().default([]),

    // ── Targeting ─────────────────────────────────────────────────────────
    /** Platforms and account IDs; shape mirrors PlatformPost[] */
    platforms: json("platforms").$type<
      Array<{ platform: string; accountId: string; customContent?: string }>
    >().default([]),

    // ── Scheduling ────────────────────────────────────────────────────────
    scheduledFor: timestamp("scheduled_for"),

    // ── Status ────────────────────────────────────────────────────────────
    status: mysqlEnum("status", [
      "pending",
      "generating",
      "ready",
      "approved",
      "publishing",
      "published",
      "rejected",
      "failed",
    ])
      .notNull()
      .default("pending"),

    // ── Zernio reference ──────────────────────────────────────────────────
    /** Set once the post is created in Zernio. Used as idempotency key. */
    zernioPostId: varchar("zernio_post_id", { length: 255 }),

    // ── Audit ─────────────────────────────────────────────────────────────
    generatedAt: timestamp("generated_at"),
    approvedAt: timestamp("approved_at"),
    publishedAt: timestamp("published_at"),
    rejectedAt: timestamp("rejected_at"),
    failureReason: text("failure_reason"),

    /** Latest analytics snapshot pulled by the collect-analytics job. */
    analytics: json("analytics").$type<{ snapshot: unknown; collectedAt: string }>(),

    /** Source: manual calendar entry or autopilot-generated */
    source: mysqlEnum("source", ["manual", "autopilot"]).notNull().default("manual"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("ce_workspace_idx").on(t.workspaceId),
    index("ce_brand_idx").on(t.brandId),
    index("ce_status_idx").on(t.status),
    index("ce_scheduled_idx").on(t.scheduledFor),
    index("ce_workspace_status_idx").on(t.workspaceId, t.status),
    index("ce_workspace_scheduled_idx").on(t.workspaceId, t.scheduledFor),
  ]
);

export const calendarEntriesRelations = relations(calendarEntries, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [calendarEntries.workspaceId],
    references: [workspaces.id],
  }),
  brand: one(brands, {
    fields: [calendarEntries.brandId],
    references: [brands.id],
  }),
}));

export type CalendarEntry = typeof calendarEntries.$inferSelect;
export type NewCalendarEntry = typeof calendarEntries.$inferInsert;
export type CalendarEntryStatus = CalendarEntry["status"];

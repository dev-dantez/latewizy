import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";
import { calendarEntries } from "./calendar-entries";
import { workspaces } from "./workspaces";
import { relations } from "drizzle-orm";

/**
 * publishing_results — one row per publish attempt per platform.
 *
 * Written by the publish-entry job handler after each Zernio API call.
 * Provides a full audit trail of what was published, when, and any errors.
 */
export const publishingResults = mysqlTable(
  "publishing_results",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    calendarEntryId: varchar("calendar_entry_id", { length: 36 })
      .notNull()
      .references(() => calendarEntries.id, { onDelete: "cascade" }),

    /** Zernio post ID returned on success. Null on failure. */
    zernioPostId: varchar("zernio_post_id", { length: 255 }),

    platform: varchar("platform", { length: 50 }).notNull(),
    accountId: varchar("account_id", { length: 255 }).notNull(),

    outcome: mysqlEnum("outcome", ["success", "failure"]).notNull(),
    error: text("error"),

    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("pr_workspace_idx").on(t.workspaceId),
    index("pr_entry_idx").on(t.calendarEntryId),
    index("pr_outcome_idx").on(t.outcome),
  ]
);

export const publishingResultsRelations = relations(publishingResults, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [publishingResults.workspaceId],
    references: [workspaces.id],
  }),
  calendarEntry: one(calendarEntries, {
    fields: [publishingResults.calendarEntryId],
    references: [calendarEntries.id],
  }),
}));

export type PublishingResult = typeof publishingResults.$inferSelect;
export type NewPublishingResult = typeof publishingResults.$inferInsert;

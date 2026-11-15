import {
  mysqlTable,
  varchar,
  boolean,
  timestamp,
  json,
  int,
  index,
} from "drizzle-orm/mysql-core";
import { brands } from "./brands";
import { workspaces } from "./workspaces";
import { relations } from "drizzle-orm";

/**
 * autopilot_configs — per-brand Autopilot settings.
 *
 * When enabled, the autopilot-cycle job runs on the configured schedule
 * and generates + schedules content automatically, subject to the
 * requireApproval flag.
 */
export const autopilotConfigs = mysqlTable(
  "autopilot_configs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandId: varchar("brand_id", { length: 36 })
      .notNull()
      .unique() // one config per brand
      .references(() => brands.id, { onDelete: "cascade" }),

    enabled: boolean("enabled").notNull().default(false),

    /**
     * Posting schedule: days of week (0-6) + times in "HH:mm" format.
     * [{ dayOfWeek: 1, time: "09:00" }, ...]
     */
    schedule: json("schedule")
      .$type<Array<{ dayOfWeek: number; time: string }>>()
      .notNull()
      .default([]),

    /** Content themes with weights. Must sum to 1.0. */
    themes: json("themes")
      .$type<Array<{ id: string; name: string; description: string; weight: number }>>()
      .notNull()
      .default([]),

    /**
     * Platforms to publish to (references Zernio account IDs).
     * [{ platform: "instagram", accountId: "..." }]
     */
    targetPlatforms: json("target_platforms")
      .$type<Array<{ platform: string; accountId: string }>>()
      .notNull()
      .default([]),

    /**
     * If true, generated posts wait for human approval before publishing.
     * If false, Autopilot publishes immediately.
     */
    requireApproval: boolean("require_approval").notNull().default(true),

    /** How many posts to generate per autopilot cycle. */
    postsPerCycle: int("posts_per_cycle").notNull().default(3),

    /** How many days ahead to generate content. */
    lookaheadDays: int("lookahead_days").notNull().default(7),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("ac_workspace_idx").on(t.workspaceId),
    index("ac_brand_idx").on(t.brandId),
  ]
);

export const autopilotConfigsRelations = relations(autopilotConfigs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [autopilotConfigs.workspaceId],
    references: [workspaces.id],
  }),
  brand: one(brands, {
    fields: [autopilotConfigs.brandId],
    references: [brands.id],
  }),
}));

export type AutopilotConfig = typeof autopilotConfigs.$inferSelect;
export type NewAutopilotConfig = typeof autopilotConfigs.$inferInsert;

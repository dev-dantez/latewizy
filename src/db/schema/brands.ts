import {
  mysqlTable,
  varchar,
  text,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/mysql-core";
import { workspaces } from "./workspaces";
import { relations } from "drizzle-orm";

/**
 * brands — server-side mirror of the existing SavedBrand shape.
 *
 * The JSON columns store arrays (hashtags, doList, dontList, preferredColors,
 * colorsToAvoid) so the shape stays compatible with the existing TypeScript
 * types without requiring junction tables.
 *
 * Migration path: on first authenticated request, the client reads
 * localStorage("latewiz-brands") and POSTs them to /api/brands/migrate.
 */
export const brands = mysqlTable(
  "brands",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // ── Core identity (matches SavedBrand) ───────────────────────────────
    brandName: varchar("brand_name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    tone: varchar("tone", { length: 100 }).notNull(),
    voice: varchar("voice", { length: 100 }).notNull(),
    targetAudience: text("target_audience").notNull(),
    industry: varchar("industry", { length: 100 }).notNull(),
    hashtags: json("hashtags").$type<string[]>().notNull().default([]),
    doList: json("do_list").$type<string[]>().notNull().default([]),
    dontList: json("dont_list").$type<string[]>().notNull().default([]),
    defaultCTA: text("default_cta").notNull(),

    // ── Extended identity ─────────────────────────────────────────────────
    website: varchar("website", { length: 500 }),
    niche: varchar("niche", { length: 255 }),
    personality: text("personality"),
    language: varchar("language", { length: 50 }),
    writingStyle: text("writing_style"),
    contentRestrictions: text("content_restrictions"),
    additionalInstructions: text("additional_instructions"),

    // ── Visual identity ───────────────────────────────────────────────────
    logoUrl: varchar("logo_url", { length: 1000 }),
    primaryColor: varchar("primary_color", { length: 20 }),
    secondaryColor: varchar("secondary_color", { length: 20 }),
    accentColor: varchar("accent_color", { length: 20 }),
    backgroundColor: varchar("background_color", { length: 20 }),
    headingFont: varchar("heading_font", { length: 100 }),
    bodyFont: varchar("body_font", { length: 100 }),

    // ── Image generation ──────────────────────────────────────────────────
    imageStyle: text("image_style"),
    photographyStyle: text("photography_style"),
    illustrationStyle: text("illustration_style"),
    preferredColors: json("preferred_colors").$type<string[]>().default([]),
    colorsToAvoid: json("colors_to_avoid").$type<string[]>().default([]),
    imageInstructions: text("image_instructions"),

    // ── Settings ──────────────────────────────────────────────────────────
    isDefault: boolean("is_default").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("brands_workspace_idx").on(t.workspaceId),
    index("brands_workspace_default_idx").on(t.workspaceId, t.isDefault),
  ]
);

export const brandsRelations = relations(brands, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [brands.workspaceId],
    references: [workspaces.id],
  }),
}));

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

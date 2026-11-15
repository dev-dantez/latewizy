import {
  mysqlTable,
  varchar,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/mysql-core";
import { users } from "./users";
import { relations } from "drizzle-orm";

/**
 * workspaces — the primary tenant boundary.
 *
 * Maps 1:1 to a Zernio "profile". The profileId stored here lets us
 * scope all Zernio API calls without reading it from localStorage.
 */
export const workspaces = mysqlTable(
  "workspaces",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerId: varchar("owner_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Zernio profile ID that backs this workspace
    zernioProfileId: varchar("zernio_profile_id", { length: 255 }),
    name: varchar("name", { length: 255 }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("workspaces_owner_idx").on(t.ownerId),
    index("workspaces_zernio_profile_idx").on(t.zernioProfileId),
  ]
);

export const workspacesRelations = relations(workspaces, ({ one }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

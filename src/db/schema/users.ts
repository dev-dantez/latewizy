import {
  mysqlTable,
  varchar,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

/**
 * users — one row per LateWiz account.
 *
 * Authentication is currently API-key based (Zernio key = identity).
 * This table stores the mapping so the server can issue a session JWT
 * and scope all data to a workspace without touching the Zernio key
 * on every request.
 */
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(), // nanoid
    // The Zernio API key is the primary credential today.
    // Stored here so we can look up the user from the JWT subject.
    zernioApiKey: varchar("zernio_api_key", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("users_zernio_key_idx").on(t.zernioApiKey),
    index("users_email_idx").on(t.email),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

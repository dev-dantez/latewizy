/**
 * Drizzle ORM MySQL client
 *
 * Singleton pattern — reuses the connection pool across hot-reloads in dev
 * and across requests in production. The pool is shared between the Next.js
 * server and the worker process (each process gets its own pool).
 *
 * Usage:
 *   import { db } from "@/db/client";
 *   const users = await db.select().from(schema.users);
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// ─── connection pool ──────────────────────────────────────────────────────────

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local before starting the server."
    );
  }

  return mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Keep-alive so idle connections survive load balancer timeouts
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
  });
}

// Reuse pool across Next.js hot-reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
}

const pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (globalThis.__mysqlPool ??= createPool());

// ─── Drizzle instance ─────────────────────────────────────────────────────────

export const db = drizzle(pool, { schema, mode: "default" });

export type DB = typeof db;

/** Expose the raw pool for transactions that need a dedicated connection. */
export { pool };

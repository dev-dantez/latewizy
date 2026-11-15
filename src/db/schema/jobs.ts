import {
  mysqlTable,
  varchar,
  text,
  int,
  timestamp,
  json,
  mysqlEnum,
  index,
  bigint,
} from "drizzle-orm/mysql-core";
import { workspaces } from "./workspaces";
import { relations } from "drizzle-orm";

/**
 * jobs — durable async job queue backed by MySQL.
 *
 * The worker polls this table with SELECT ... FOR UPDATE SKIP LOCKED
 * so multiple worker processes can run safely without double-processing.
 *
 * Status flow:
 *   pending → running → completed
 *                    ↘ failed  (retried up to maxAttempts, then permanently failed)
 *
 * Idempotency: callers may set idempotencyKey. The worker skips a job if
 * a completed job with the same key already exists.
 */

export const JOB_TYPES = [
  "generate-content",       // AI generation for a CalendarEntry
  "generate-calendar",      // Batch calendar plan generation
  "publish-entry",          // Submit a CalendarEntry to Zernio
  "retry-publish",          // Explicit retry after failure
  "send-approval-request",  // Notify approver that content is ready
  "collect-analytics",      // Pull analytics from Zernio
  "autopilot-cycle",        // Autopilot: generate + schedule a batch
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const jobs = mysqlTable(
  "jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    type: mysqlEnum("type", JOB_TYPES).notNull(),

    /** JSON payload passed to the job handler. */
    payload: json("payload").$type<Record<string, unknown>>().notNull(),

    status: mysqlEnum("status", [
      "pending",
      "running",
      "completed",
      "failed",
    ])
      .notNull()
      .default("pending"),

    /** How many times we have attempted this job (including current). */
    attempts: int("attempts").notNull().default(0),

    /** Maximum retry attempts before permanently failing. */
    maxAttempts: int("max_attempts").notNull().default(5),

    /** Last error message, for debugging. */
    lastError: text("last_error"),

    /**
     * Full history of attempts as JSON array.
     * [{ attempt, startedAt, finishedAt, error? }]
     */
    history: json("history")
      .$type<
        Array<{
          attempt: number;
          startedAt: string;
          finishedAt: string;
          error?: string;
        }>
      >()
      .notNull()
      .default([]),

    /**
     * Idempotency key. If set, the queue will not create a duplicate job
     * with the same key while a pending/running/completed one exists.
     */
    idempotencyKey: varchar("idempotency_key", { length: 255 }),

    /**
     * Earliest time the job may be picked up. Null = pick up immediately.
     * Used for delayed/scheduled jobs and exponential back-off.
     */
    runAfter: timestamp("run_after"),

    /** Set when a worker locks the job. */
    lockedAt: timestamp("locked_at"),

    /** Worker instance ID that locked this job (for debugging). */
    lockedBy: varchar("locked_by", { length: 100 }),

    /** Set when job finishes (success or permanent failure). */
    completedAt: timestamp("completed_at"),

    /** Priority: lower number = higher priority. Default 100. */
    priority: int("priority").notNull().default(100),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index("jobs_workspace_idx").on(t.workspaceId),
    index("jobs_status_idx").on(t.status),
    index("jobs_type_idx").on(t.type),
    index("jobs_idempotency_idx").on(t.idempotencyKey),
    // The worker's polling query: pending jobs not yet due, ordered by priority
    index("jobs_poll_idx").on(t.status, t.runAfter, t.priority),
  ]
);

export const jobsRelations = relations(jobs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [jobs.workspaceId],
    references: [workspaces.id],
  }),
}));

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobStatus = Job["status"];

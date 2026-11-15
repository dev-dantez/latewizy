/**
 * Job queue helpers
 *
 * Thin wrapper around the jobs table. All job dispatch goes through
 * enqueueJob() so idempotency and workspace scoping are always enforced.
 *
 * The worker polls with SELECT … FOR UPDATE SKIP LOCKED so multiple
 * worker processes can coexist without double-processing.
 */

import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import { jobs, type JobType, type NewJob } from "./schema/jobs";

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export interface EnqueueOptions {
  /** If set, skip enqueue when a pending/running/completed job with this key exists. */
  idempotencyKey?: string;
  /** Delay execution until this timestamp. */
  runAfter?: Date;
  /** Lower = higher priority. Default 100. */
  priority?: number;
  /** Override default max retry attempts (5). */
  maxAttempts?: number;
}

export async function enqueueJob(
  workspaceId: string,
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<string | null> {
  const { idempotencyKey, runAfter, priority = 100, maxAttempts = 5 } = options;

  // Idempotency check: skip if a live job with this key already exists
  if (idempotencyKey) {
    const existing = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.idempotencyKey, idempotencyKey),
          or(
            eq(jobs.status, "pending"),
            eq(jobs.status, "running"),
            eq(jobs.status, "completed")
          )
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id; // Return existing job id, don't create duplicate
    }
  }

  const id = nanoid();

  const newJob: NewJob = {
    id,
    workspaceId,
    type,
    payload,
    status: "pending",
    attempts: 0,
    maxAttempts,
    idempotencyKey: idempotencyKey ?? null,
    runAfter: runAfter ?? null,
    priority,
    history: [],
  };

  await db.insert(jobs).values(newJob);
  return id;
}

// ─── Poll (worker use only) ───────────────────────────────────────────────────

export interface LockedJob {
  id: string;
  workspaceId: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  history: NonNullable<typeof jobs.$inferSelect.history>;
}

/**
 * Atomically lock and return one pending job.
 * Uses SELECT … FOR UPDATE SKIP LOCKED so concurrent workers are safe.
 * Returns null if no job is available.
 */
export async function pollNextJob(workerId: string): Promise<LockedJob | null> {
  const now = new Date();

  // We need a raw connection to do SELECT FOR UPDATE SKIP LOCKED
  // Drizzle doesn't have a fluent API for this yet, so we use sql``
  const [rows] = await db.execute(sql`
    SELECT id, workspace_id, type, payload, attempts, max_attempts, history
    FROM jobs
    WHERE status = 'pending'
      AND (run_after IS NULL OR run_after <= ${now})
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return null;

  const jobId = row.id as string;

  // Lock it
  await db
    .update(jobs)
    .set({
      status: "running",
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`attempts + 1`,
    })
    .where(eq(jobs.id, jobId));

  return {
    id: jobId,
    workspaceId: row.workspace_id as string,
    type: row.type as JobType,
    payload: (typeof row.payload === "string"
      ? JSON.parse(row.payload)
      : row.payload) as Record<string, unknown>,
    attempts: (row.attempts as number) + 1,
    maxAttempts: row.max_attempts as number,
    history: (typeof row.history === "string"
      ? JSON.parse(row.history)
      : row.history) as LockedJob["history"],
  };
}

// ─── Complete / Fail ──────────────────────────────────────────────────────────

export async function completeJob(
  jobId: string,
  startedAt: Date
): Promise<void> {
  const finishedAt = new Date();
  const job = await db
    .select({ attempts: jobs.attempts, history: jobs.history })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  const existing = job[0];
  if (!existing) return;

  const newHistory = [
    ...(existing.history ?? []),
    {
      attempt: existing.attempts,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    },
  ];

  await db
    .update(jobs)
    .set({
      status: "completed",
      completedAt: finishedAt,
      lockedAt: null,
      lockedBy: null,
      history: newHistory,
    })
    .where(eq(jobs.id, jobId));
}

export async function failJob(
  jobId: string,
  error: string,
  startedAt: Date,
  retryDelayMs = 0
): Promise<void> {
  const finishedAt = new Date();
  const job = await db
    .select({ attempts: jobs.attempts, maxAttempts: jobs.maxAttempts, history: jobs.history })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  const existing = job[0];
  if (!existing) return;

  const newHistory = [
    ...(existing.history ?? []),
    {
      attempt: existing.attempts,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      error,
    },
  ];

  const permanentlyFailed = existing.attempts >= existing.maxAttempts;

  await db
    .update(jobs)
    .set({
      status: permanentlyFailed ? "failed" : "pending",
      lastError: error,
      lockedAt: null,
      lockedBy: null,
      runAfter: permanentlyFailed
        ? null
        : retryDelayMs > 0
        ? new Date(finishedAt.getTime() + retryDelayMs)
        : null,
      completedAt: permanentlyFailed ? finishedAt : null,
      history: newHistory,
    })
    .where(eq(jobs.id, jobId));
}

// ─── Exponential backoff helper ───────────────────────────────────────────────

/** Returns ms to wait before the next attempt. Base 30s, max 1h. */
export function backoffMs(attempt: number): number {
  const base = 30_000;
  const cap = 3_600_000;
  return Math.min(base * Math.pow(2, attempt - 1), cap);
}

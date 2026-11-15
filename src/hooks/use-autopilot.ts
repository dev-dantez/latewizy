/**
 * TanStack Query hooks for Autopilot config (per-brand).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AutopilotConfig } from "@/db/schema/autopilot-configs";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const autopilotKeys = {
  config: (brandId: string) => ["autopilot", "config", brandId] as const,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutopilotUpsertInput = {
  enabled?: boolean;
  schedule?: Array<{ dayOfWeek: number; time: string }>;
  themes?: Array<{ id: string; name: string; description: string; weight: number }>;
  targetPlatforms?: Array<{ platform: string; accountId: string }>;
  requireApproval?: boolean;
  postsPerCycle?: number;
  lookaheadDays?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAutopilotConfig(brandId: string) {
  return useQuery({
    queryKey: autopilotKeys.config(brandId),
    queryFn: () =>
      apiFetch<{ config: AutopilotConfig | null }>(`/api/autopilot/${brandId}`).then(
        (r) => r.config
      ),
    enabled: !!brandId,
  });
}

export function useUpsertAutopilotConfig(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutopilotUpsertInput) =>
      apiFetch<{ config: AutopilotConfig }>(`/api/autopilot/${brandId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }).then((r) => r.config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autopilotKeys.config(brandId) });
    },
  });
}

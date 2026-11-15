"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProfiles } from "@/hooks";
import { useAuthStore } from "@/stores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Layers, Check } from "lucide-react";

export function WorkspaceSwitcher() {
  const { data: profilesData, isLoading } = useProfiles();
  const { activeProfileId, setActiveProfileId } = useAuthStore();
  const qc = useQueryClient();
  const [switching, setSwitching] = useState<string | null>(null);

  const profiles = (profilesData?.profiles ?? []) as Array<{
    _id: string;
    name?: string;
    timezone?: string;
  }>;

  if (profiles.length <= 1) return null; // No switcher needed for single-profile users

  const handleSwitch = async (profile: { _id: string; name?: string }) => {
    if (profile._id === activeProfileId) return;
    setSwitching(profile._id);
    try {
      // Tell server to find/create the workspace for this Zernio profile
      // and re-issue the session JWT with the new workspaceId
      const res = await fetch("/api/auth/switch-workspace-by-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zernioProfileId: profile._id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to switch workspace");
      }

      // Update client-side profile selection
      setActiveProfileId(profile._id);

      // Invalidate all workspace-scoped queries so they refetch
      await qc.invalidateQueries();

      toast.success(`Switched to ${profile.name ?? "workspace"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch workspace");
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Workspaces
        </CardTitle>
        <CardDescription>
          Switch between your Zernio profiles. Each profile is a separate workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          profiles.map((p) => {
            const isActive = p._id === activeProfileId;
            const isSwitching = switching === p._id;
            return (
              <div
                key={p._id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  isActive
                    ? "border-primary bg-muted/50"
                    : "border-border hover:bg-muted/30"
                }`}
                onClick={() => handleSwitch(p)}
              >
                <div className="flex items-center gap-2">
                  {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                  <span className="text-sm font-medium">{p.name ?? "Unnamed Profile"}</span>
                  {isActive && (
                    <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  )}
                </div>
                {isSwitching && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

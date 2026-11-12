"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Key, Loader2 } from "lucide-react";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyModal({ open, onOpenChange }: ApiKeyModalProps) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const { setApiKey: storeApiKey, setUsageStats } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error("Please enter your API key");
      return;
    }

    if (!trimmedKey.startsWith("sk_")) {
      toast.error("Invalid API key format. It should start with 'sk_'");
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmedKey }),
      });

      const result = await response.json();

      if (!response.ok || !result.data) {
        toast.error(result.error || "Invalid API key. Please check and try again.");
        return;
      }

      // Store the API key and usage stats
      storeApiKey(trimmedKey);
      setUsageStats(result.data);

      toast.success(`Connected to ${result.data.planName} plan`);
      onOpenChange(false);
      router.push("/dashboard");
    } catch (err) {
      console.error("API key validation error:", err);
      toast.error("Failed to validate API key. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Connect your Zernio API Key
          </DialogTitle>
          <DialogDescription>
            Enter your Zernio API key to start scheduling posts across 13
            platforms.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isValidating}
              autoComplete="off"
            />
            <p className="text-sm text-muted-foreground">
              Your API key is stored locally in your browser and never sent to
              our servers.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Connect"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              asChild
            >
              <a
                href="https://zernio.com/dashboard/api-keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get an API Key
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores";
import { useMigrateBrands } from "@/hooks/use-brands";
import { useBrandStore } from "@/stores/brand-store";
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
  const { addAccount, accounts } = useAuthStore();
  const migrateBrands = useMigrateBrands();
  const storeBrands = useBrandStore((s) => s.brands);

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

      addAccount(trimmedKey, result.data);

      // Migrate localStorage brands to the server (fires-and-forgets;
      // idempotent — server skips IDs that already exist)
      if (storeBrands.length > 0) {
        migrateBrands.mutate(storeBrands);
      }

      const isFirstAccount = accounts.length === 0;
      toast.success(`Connected to ${result.data.planName} plan`);
      onOpenChange(false);
      setApiKey("");
      if (isFirstAccount) {
        router.push("/dashboard");
      }
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
            Add Zernio Account
          </DialogTitle>
          <DialogDescription>
            Enter a Zernio API key to add an account. You can add multiple accounts and switch between them.
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
              Your API key is validated against Zernio's servers and stored
              encrypted in your session. It is never logged or shared.
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

"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Late from "@getlatedev/node";
import {
  useAccounts,
  useAccountsHealth,
  useConnectAccount,
  useDeleteAccount,
} from "@/hooks";
import { useAuthStore } from "@/stores";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountAvatar } from "@/components/accounts";
import { ConnectPlatformGrid } from "./_components/connect-platform-grid";
import { getPlatformName, type Platform } from "@/lib/late-api";
import { Users, Plus, Loader2, AlertCircle, RefreshCw, Trash2, UserCircle2 } from "lucide-react";

export default function AccountsPage() {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const { accounts, activeAccountIndex } = useAuthStore();

  // Which Zernio account to connect under (defaults to active)
  const [connectAccountIndex, setConnectAccountIndex] = useState<number>(activeAccountIndex);
  // Keep in sync when active account changes outside the dialog
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | undefined>();

  // Hooks for data fetching
  const { data: accountsData, isLoading } = useAccounts();
  const { data: healthData } = useAccountsHealth();

  // Mutations
  const deleteMutation = useDeleteAccount();
  const connectMutation = useConnectAccount(); // used for reconnect (active account only)

  const socialAccounts = (accountsData?.accounts || []) as any[];
  const healthMap = useMemo(
    () => new Map<string, any>(
      healthData?.accounts?.map((a: any) => [a.accountId, a] as [string, any]) || []
    ),
    [healthData]
  );

  const openConnectDialog = () => {
    setConnectAccountIndex(activeAccountIndex);
    setShowConnectDialog(true);
  };

  const handleConnect = async (platform: Platform) => {
    try {
      setIsConnecting(true);
      setConnectingPlatform(platform);

      // Build a client for the selected Zernio account (may differ from active)
      const selectedZernioKey = accounts[connectAccountIndex]?.apiKey;
      if (!selectedZernioKey) throw new Error("No API key for selected account");

      const late = new Late({ apiKey: selectedZernioKey, baseURL: "https://zernio.com/api" });

      // Resolve the profile ID for the selected account.
      // accounts[connectAccountIndex].defaultProfileId is set once the user has
      // visited that account at least once. If it's null (e.g. a freshly added
      // account that was never switched to), fetch profiles directly with its key.
      let selectedProfileId = accounts[connectAccountIndex]?.defaultProfileId;
      if (!selectedProfileId) {
        const { data: profilesData, error: profilesError } = await late.profiles.listProfiles();
        if (profilesError) throw profilesError;
        selectedProfileId = profilesData?.profiles?.[0]?._id ?? null;
      }
      if (!selectedProfileId) throw new Error("No profile found for this account. Make sure the API key is valid.");

      const late = new Late({ apiKey: selectedZernioKey, baseURL: "https://zernio.com/api" });
      const redirectUrl = `${window.location.origin}/callback`;
      const { data, error } = await late.connect.getConnectUrl({
        path: { platform },
        query: { profileId: selectedProfileId, redirect_url: redirectUrl, headless: true },
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      const msg = (err as Error)?.message || "Failed to start connection. Please try again.";
      toast.error(msg);
      console.error("Connect error:", err);
    } finally {
      setIsConnecting(false);
      setConnectingPlatform(undefined);
    }
  };

  const handleReconnect = async (platform: Platform) => {
    try {
      const data = await connectMutation.mutateAsync({ platform });
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      const msg = (err as Error)?.message || "Failed to start reconnection.";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    try {
      await deleteMutation.mutateAsync(accountToDelete);
      toast.success("Account disconnected successfully");
      setAccountToDelete(null);
    } catch {
      toast.error("Failed to disconnect account");
    }
  };

  const connectedPlatforms = new Set<string>(socialAccounts.map((a: any) => a.platform as string));

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Accounts</h1>
        <p className="text-muted-foreground">
          Manage your connected social media accounts.
        </p>
      </div>

      {/* Connected Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              {socialAccounts.length} {socialAccounts.length === 1 ? "account" : "accounts"} connected
            </CardDescription>
          </div>
          <Button size="sm" onClick={openConnectDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Connect New
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <AccountsLoadingSkeleton />
          ) : socialAccounts.length === 0 ? (
            <EmptyAccountsState onConnect={openConnectDialog} />
          ) : (
            socialAccounts.map((account: any) => {
              const health = healthMap.get(account._id);
              const needsReconnect = health?.status === "needs_reconnect";

              return (
                <div
                  key={account._id}
                  className="flex items-center justify-between rounded-lg bg-muted p-3"
                >
                  <div className="flex items-center gap-3">
                    <AccountAvatar account={account} size="sm" />
                    <div>
                      <p className="text-sm font-medium">
                        {account.displayName || account.username}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getPlatformName(account.platform)}
                        </Badge>
                        {needsReconnect && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3" /> Needs reconnect
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {needsReconnect && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconnect(account.platform)}
                        disabled={connectMutation.isPending}
                      >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Reconnect
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setAccountToDelete(account._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Connect Account Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect a Social Account</DialogTitle>
            <DialogDescription>
              Choose a platform to connect. You&apos;ll be redirected to authorize access.
            </DialogDescription>
          </DialogHeader>

          {/* Account selector — only shown when multiple Zernio API accounts exist */}
          {accounts.length > 1 && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Connect under:</span>
              <Select
                value={String(connectAccountIndex)}
                onValueChange={(v) => setConnectAccountIndex(Number(v))}
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc, i) => (
                    <SelectItem key={acc.apiKey} value={String(i)}>
                      <span className="font-medium">{acc.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {acc.apiKey.slice(0, 10)}…
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ConnectPlatformGrid
            onConnect={handleConnect}
            connectedPlatforms={connectedPlatforms}
            isConnecting={isConnecting}
            connectingPlatform={connectingPlatform}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!accountToDelete}
        onOpenChange={() => setAccountToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this account? You&apos;ll need to
              reconnect it to schedule posts to this account again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountsLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-muted p-3 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-background" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-background" />
            <div className="h-2 w-20 rounded bg-background" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyAccountsState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="rounded-lg bg-muted p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background">
        <Plus className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 text-sm font-medium">No accounts connected</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect your first account to start scheduling.
      </p>
      <Button size="sm" className="mt-4" onClick={onConnect}>
        Connect Account
      </Button>
    </div>
  );
}

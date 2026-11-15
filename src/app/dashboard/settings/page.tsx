"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuthStore, useAppStore } from "@/stores";
import { getTimezoneOptions } from "@/lib/timezones";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiKeyModal } from "@/components/shared/api-key-modal";
import { Key, Moon, Sun, Globe, LogOut, ExternalLink, Plus, Trash2, Check } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { accounts, activeAccountIndex, switchAccount, removeAccount, logout } = useAuthStore();
  const { timezone, setTimezone } = useAppStore();
  const [showAddAccount, setShowAddAccount] = useState(false);

  const timezoneOptions = useMemo(
    () => getTimezoneOptions(timezone),
    [timezone]
  );

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const activeAccount = accounts[activeAccountIndex] ?? null;
  const usageStats = activeAccount?.usageStats ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your accounts and preferences.
        </p>
      </div>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Accounts
          </CardTitle>
          <CardDescription>
            Each account uses a separate Zernio API key with its own limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.map((acc, i) => {
            const isActive = i === activeAccountIndex;
            const stats = acc.usageStats;
            return (
              <div
                key={acc.apiKey}
                className={`rounded-lg border p-4 space-y-3 cursor-pointer transition-colors ${
                  isActive ? "border-primary bg-muted/50" : "border-border hover:bg-muted/30"
                }`}
                onClick={() => switchAccount(i)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <span className="font-medium text-sm">{acc.label}</span>
                    {isActive && <Badge variant="secondary" className="text-[10px]">Active</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {acc.apiKey.slice(0, 10)}…{acc.apiKey.slice(-4)}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove <strong>{acc.label}</strong> from this device?
                            {accounts.length === 1 && " You will be signed out."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              removeAccount(i);
                              if (accounts.length === 1) router.push("/");
                            }}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {isActive && stats && (
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Uploads</span>
                      <span className="text-foreground">
                        {stats.limits.uploads < 0
                          ? <>{stats.usage.uploads.toLocaleString()} / ∞</>
                          : <>{stats.usage.uploads.toLocaleString()} / {stats.limits.uploads.toLocaleString()}</>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profiles</span>
                      <span className="text-foreground">
                        {stats.limits.profiles < 0
                          ? <>{stats.usage.profiles.toLocaleString()} / ∞</>
                          : <>{stats.usage.profiles.toLocaleString()} / {stats.limits.profiles.toLocaleString()}</>}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddAccount(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
            <Button variant="outline" asChild>
              <a href="https://zernio.com/dashboard/api-keys" target="_blank" rel="noopener noreferrer">
                Get API Key
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how LateWiz looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            Timezone
          </CardTitle>
          <CardDescription>
            Set your default timezone for scheduling posts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Default Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Current timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="h-4 w-4" />
            Session
          </CardTitle>
          <CardDescription>
            Sign out of all accounts on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Sign Out All</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign Out</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all {accounts.length} account{accounts.length !== 1 ? "s" : ""} from this device.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>
                  Sign Out All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>LateWiz - Your social media scheduling wizard</p>
            <p className="mt-1">
              Powered by{" "}
              <a
                href="https://zernio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Zernio
              </a>
            </p>
            <p className="mt-2">
              <a
                href="https://github.com/zernio-dev/latewiz"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                View on GitHub
              </a>
              {" · "}
              <a
                href="https://github.com/zernio-dev/latewiz/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Report Issue
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      <ApiKeyModal open={showAddAccount} onOpenChange={setShowAddAccount} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores";
import { useProfiles } from "@/hooks";
import { useServerBrands } from "@/hooks/use-brands";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/avatar";
import { Logo, ErrorBoundary } from "@/components/shared";
import { ApiKeyModal } from "@/components/shared/api-key-modal";
import {
  LayoutDashboard,
  PenSquare,
  Calendar,
  Users,
  ListOrdered,
  Layers,
  BarChart2,
  Inbox,
  Settings,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  Check,
  ExternalLink,
  Plus,
  UserCircle2,
  Loader2,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Compose",
    href: "/dashboard/compose",
    icon: PenSquare,
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: Calendar,
  },
  {
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: Users,
  },
  {
    label: "Queue",
    href: "/dashboard/queue",
    icon: ListOrdered,
  },
  {
    label: "Brands",
    href: "/dashboard/brands",
    icon: Layers,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart2,
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { apiKey, usageStats, logout, hasHydrated, accounts, activeAccountIndex, activeProfileId, setActiveProfileId, switchAccount } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { data: profilesData } = useProfiles();
  const qc = useQueryClient();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState<string | null>(null);

  // Fetch brands from DB and hydrate the brand store
  useServerBrands();

  const profiles = profilesData?.profiles || [];
  const currentProfile = profiles.find((p: any) => p._id === activeProfileId) || profiles[0];

  // Redirect to home if not authenticated (only after hydration)
  useEffect(() => {
    if (hasHydrated && accounts.length === 0) {
      router.push("/");
    }
  }, [accounts.length, hasHydrated, router]);

  // Re-issue the server-side session cookie whenever the active API key changes.
  // This covers two cases:
  //   1. Page reload: Zustand rehydrates from localStorage but the HttpOnly cookie
  //      may have expired — calling /api/validate-key re-sets it.
  //   2. Account switch: a different apiKey becomes active, so the cookie must be
  //      updated or API routes will reject with 401 ("Unauthorized").
  useEffect(() => {
    if (!apiKey) return;
    fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }).catch(() => {
      // Non-fatal — the user will get a 401 on the next API call and can re-auth
    });
  }, [apiKey]);

  const handleLogout = async () => {
    // Clear server-side session cookie
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Non-fatal — cookie will expire on its own
    }
    logout();
    router.push("/");
  };

  // Switch the active Zernio profile: tells the server to find/create the
  // workspace for that profile and re-issue the session JWT, then updates the
  // client store and invalidates all workspace-scoped queries.
  const handleProfileSwitch = async (profile: { _id: string; name?: string }) => {
    if (profile._id === activeProfileId) return;
    setSwitchingProfile(profile._id);
    try {
      const res = await fetch("/api/auth/switch-workspace-by-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zernioProfileId: profile._id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to switch workspace");
      }

      setActiveProfileId(profile._id);
      await qc.invalidateQueries();
      toast.success(`Switched to ${profile.name ?? "workspace"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch workspace");
    } finally {
      setSwitchingProfile(null);
    }
  };

  // Don't render until hydrated to avoid flash
  if (!hasHydrated || accounts.length === 0) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Desktop only */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-border px-4">
          <Logo size="sm" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <Separator className="my-3" />

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard/settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Plan info */}
        {usageStats && (
          <div className="border-t border-border p-3">
            <div className="rounded-md bg-muted p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{usageStats.planName}</span>
                <a
                  href="https://zernio.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open Zernio dashboard"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Uploads</span>
                  <span>
                    {usageStats.limits.uploads < 0 ? (
                      <>{usageStats.usage.uploads.toLocaleString()} / ∞</>
                    ) : (
                      <>{usageStats.usage.uploads.toLocaleString()} / {usageStats.limits.uploads.toLocaleString()}</>
                    )}
                  </span>
                </div>
                {usageStats.limits.uploads >= 0 && (
                  <div className="h-1 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          (usageStats.usage.uploads / usageStats.limits.uploads) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            {/* Logo on mobile (since sidebar is hidden) */}
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Profile Selector */}
            {profiles.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: currentProfile?.color || '#888' }}
                    />
                    <span className="max-w-24 truncate">
                      {currentProfile?.name || 'Select Profile'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {profiles.map((profile: any) => (
                    <DropdownMenuItem
                      key={profile._id}
                      onClick={() => handleProfileSwitch(profile)}
                      disabled={switchingProfile !== null}
                      className="gap-2"
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: profile.color || '#888' }}
                      />
                      <span className="flex-1 truncate">{profile.name}</span>
                      {switchingProfile === profile._id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : profile._id === activeProfileId && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Separator orientation="vertical" className="h-6" />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                  <img
                    src={getAvatarUrl(apiKey || "user", "bottts")}
                    alt="User avatar"
                    className="h-7 w-7 rounded-full"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Account list */}
                {accounts.map((acc, i) => (
                  <DropdownMenuItem
                    key={acc.apiKey}
                    onClick={() => switchAccount(i)}
                    className="gap-2"
                  >
                    <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm">{acc.label}</p>
                      <p className="truncate text-[10px] text-muted-foreground font-mono">
                        {acc.apiKey.slice(0, 10)}…
                      </p>
                    </div>
                    {i === activeAccountIndex && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowAddAccount(true)} className="gap-2 text-sm">
                  <Plus className="mr-1 h-3 w-3" />
                  Add Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-sm">
                  <a
                    href="https://zernio.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Zernio Dashboard
                    <ExternalLink className="ml-auto h-3 w-3" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-sm">
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-3 w-3" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-sm text-destructive">
                  <LogOut className="mr-2 h-3 w-3" />
                  Sign Out All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ApiKeyModal open={showAddAccount} onOpenChange={setShowAddAccount} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-safe lg:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

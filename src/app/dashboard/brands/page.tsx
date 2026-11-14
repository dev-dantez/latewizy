"use client";

import { useState } from "react";
import { Plus, Search, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrands } from "@/hooks/use-brands";
import { BrandCard } from "./_components/brand-card";
import { BrandForm } from "./_components/brand-form";
import type { SavedBrand } from "@/types/brand";

function BrandGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <Skeleton className="h-1.5 w-full rounded-none -mx-4 -mt-4 mb-2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <Layers className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No brands yet</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Create a brand to give the AI your voice, guidelines, and visual identity.
        </p>
      </div>
      <Button size="sm" onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-2" />
        Create Brand
      </Button>
    </div>
  );
}

function ArchivedEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm text-muted-foreground">No archived brands.</p>
    </div>
  );
}

export default function BrandsPage() {
  const { activeBrands, archivedBrands, isLoading } = useBrands();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SavedBrand | undefined>();

  const filteredActive = activeBrands.filter((b) =>
    b.brandName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredArchived = archivedBrands.filter((b) =>
    b.brandName.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditTarget(undefined);
    setFormOpen(true);
  };

  const openEdit = (brand: SavedBrand) => {
    setEditTarget(brand);
    setFormOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Brands</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage brand identities for AI content generation.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Brand
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active">
          <TabsList className="h-8">
            <TabsTrigger value="active" className="text-xs h-7">
              Active
              {activeBrands.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
                  {activeBrands.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs h-7">
              Archived
              {archivedBrands.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
                  {archivedBrands.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {isLoading ? (
              <BrandGridSkeleton />
            ) : filteredActive.length === 0 ? (
              search ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No brands match &ldquo;{search}&rdquo;.
                </p>
              ) : (
                <EmptyState onCreateClick={openCreate} />
              )
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredActive.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} onEdit={openEdit} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-4">
            {filteredArchived.length === 0 ? (
              <ArchivedEmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredArchived.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} onEdit={openEdit} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BrandForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialValues={editTarget}
      />
    </>
  );
}

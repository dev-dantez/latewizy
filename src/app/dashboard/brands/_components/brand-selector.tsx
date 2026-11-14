"use client";

/**
 * BrandSelector — compact dropdown for the AI Assistant Panel.
 * Shows the selected brand, lists active brands, and links to /dashboard/brands.
 */

import Link from "next/link";
import { Check, ChevronDown, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrands, useBrandActions } from "@/hooks/use-brands";
import type { SavedBrand } from "@/types/brand";

interface BrandSelectorProps {
  /** Called whenever the selected brand changes (for the parent to react). */
  onBrandChange?: (brand: SavedBrand | null) => void;
}

export function BrandSelector({ onBrandChange }: BrandSelectorProps) {
  const { activeBrands, selectedBrand } = useBrands();
  const { setSelectedBrandId } = useBrandActions();

  const handleSelect = (brand: SavedBrand) => {
    setSelectedBrandId(brand.id);
    onBrandChange?.(brand);
  };

  const color = selectedBrand?.primaryColor ?? "#6366f1";

  if (activeBrands.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
        <Layers className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">No brands yet.</span>
        <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs">
          <Link href="/dashboard/brands">
            <Plus className="h-3 w-3 mr-1" />
            Create
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full justify-between text-xs font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">
              {selectedBrand?.brandName ?? "Select brand"}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        {activeBrands.map((brand) => (
          <DropdownMenuItem
            key={brand.id}
            onClick={() => handleSelect(brand)}
            className="gap-2"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: brand.primaryColor ?? "#6366f1" }}
            />
            <span className="flex-1 truncate">{brand.brandName}</span>
            {brand.id === selectedBrand?.id && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/brands" className="gap-2 text-xs text-muted-foreground">
            <Plus className="h-3.5 w-3.5" />
            Manage Brands
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Star, Archive, ArchiveRestore, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useBrandActions } from "@/hooks/use-brands";
import type { SavedBrand } from "@/types/brand";

interface BrandCardProps {
  brand: SavedBrand;
  onEdit: (brand: SavedBrand) => void;
}

export function BrandCard({ brand, onEdit }: BrandCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { deleteBrand, duplicateBrand, archiveBrand, restoreBrand, setDefaultBrand } =
    useBrandActions();

  const color = brand.primaryColor ?? "#6366f1";
  const updatedAgo = formatDistanceToNow(new Date(brand.updatedAt), {
    addSuffix: true,
  });

  const handleDuplicate = () => {
    duplicateBrand(brand.id);
    toast.success(`Duplicated "${brand.brandName}".`);
  };

  const handleSetDefault = () => {
    setDefaultBrand(brand.id);
    toast.success(`"${brand.brandName}" is now the default brand.`);
  };

  const handleArchive = () => {
    archiveBrand(brand.id);
    toast.success(`"${brand.brandName}" archived.`);
  };

  const handleRestore = () => {
    restoreBrand(brand.id);
    toast.success(`"${brand.brandName}" restored.`);
  };

  const handleDelete = () => {
    deleteBrand(brand.id);
    toast.success(`"${brand.brandName}" deleted.`);
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
        {/* Color stripe */}
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{brand.brandName}</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {brand.industry}
                </Badge>
                {brand.isDefault && (
                  <Badge variant="default" className="text-xs gap-1">
                    <Star className="h-2.5 w-2.5" />
                    Default
                  </Badge>
                )}
                {brand.isArchived && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Archived
                  </Badge>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Brand actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onEdit(brand)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Duplicate
                </DropdownMenuItem>
                {!brand.isArchived && !brand.isDefault && (
                  <DropdownMenuItem onClick={handleSetDefault}>
                    <Star className="mr-2 h-3.5 w-3.5" />
                    Set as Default
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {brand.isArchived ? (
                  <DropdownMenuItem onClick={handleRestore}>
                    <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          {brand.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {brand.description}
            </p>
          )}

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground">Updated {updatedAgo}</p>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{brand.brandName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any content generated with this brand will
              not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

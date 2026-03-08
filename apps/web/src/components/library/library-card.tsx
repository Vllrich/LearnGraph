"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Youtube,
  Globe,
  Presentation,
  FileAudio,
  Image as ImageIcon,
  FileType2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { toast } from "sonner";

type LibraryCardProps = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  summaryTldr: string | null;
  createdAt: Date | string | null;
};

export function LibraryCard({
  id,
  title,
  sourceType,
  status,
  summaryTldr,
  createdAt,
}: LibraryCardProps) {
  const utils = trpc.useUtils();
  const deleteMutation = trpc.library.delete.useMutation({
    onSuccess: () => {
      utils.library.list.invalidate();
      toast.success("Content deleted.");
    },
    onError: () => toast.error("Failed to delete."),
  });

  const isReady = status === "ready";

  const card = (
    <div className="card-modern group relative flex gap-4 p-5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
        {sourceType === "youtube" ? (
          <Youtube className="size-5 text-red-500" />
        ) : sourceType === "url" ? (
          <Globe className="size-5 text-blue-500" />
        ) : sourceType === "pptx" ? (
          <Presentation className="size-5 text-orange-500" />
        ) : sourceType === "audio" ? (
          <FileAudio className="size-5 text-purple-500" />
        ) : sourceType === "image" ? (
          <ImageIcon className="size-5 text-green-500" />
        ) : sourceType === "docx" ? (
          <FileType2 className="size-5 text-primary" />
        ) : (
          <FileText className="size-5 text-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-snug">{title}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 shrink-0 rounded-lg p-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isReady && (
                <DropdownMenuItem asChild>
                  <Link href={`/library/${id}`}>
                    <ExternalLink className="mr-2 size-4" />
                    Open
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  deleteMutation.mutate({ id });
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {summaryTldr && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {summaryTldr}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`status-dot ${
                status === "processing"
                  ? "status-dot-processing"
                  : status === "ready"
                    ? "status-dot-ready"
                    : "status-dot-failed"
              }`}
            />
            <span className="text-xs text-muted-foreground capitalize">{status}</span>
          </div>
          {createdAt && (
            <>
              <span className="text-xs text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">
                {new Date(createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (isReady) {
    return (
      <Link href={`/library/${id}`} className="block">
        {card}
      </Link>
    );
  }

  return card;
}

export function LibraryCardSkeleton() {
  return (
    <div className="card-modern flex gap-4 p-5">
      <Skeleton className="size-11 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

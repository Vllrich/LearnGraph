"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  FileText,
  CirclePlay,
  Search,
  Loader2,
  Trash2,
  Grid3x3,
  List,
  FileType2,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { UploadDialog } from "@/components/library/upload-dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
type ViewMode = "grid" | "list";

export default function LibraryPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  const { data, isLoading } = trpc.library.list.useQuery(
    { limit: 100, offset: 0 },
    { refetchInterval: 10_000 }
  );

  const prevStatusRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!data?.items) return;
    for (const item of data.items) {
      const prev = prevStatusRef.current[item.id];
      if (prev === "processing" && item.status === "failed") {
        toast.error(`Processing failed: "${item.title}". The document may be empty or unreadable.`);
      } else if (prev === "processing" && item.status === "ready") {
        toast.success(`"${item.title}" is ready!`);
      }
      prevStatusRef.current[item.id] = item.status;
    }
  }, [data?.items]);

  const utils = trpc.useUtils();
  const deleteMutation = trpc.library.delete.useMutation({
    onSuccess: () => utils.library.list.invalidate(),
    onError: (err) => toast.error(err.message ?? "Failed to delete"),
  });

  const items = (data?.items ?? []).filter(
    (i) => !search || i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-6 pb-6 pt-16 lg:px-10 lg:pt-20">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Library</h1>
          <p className="text-[13px] text-muted-foreground">
            {data?.total ?? 0} learning material{(data?.total ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Upload
        </Button>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/30" />
          <input
            type="text"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm rounded-lg border-0 bg-muted/30 pl-9 pr-4 text-[13px] placeholder:text-muted-foreground/40 focus:bg-muted/50 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border/40 p-0.5">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "grid"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Grid3x3 className="size-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          {search ? (
            <p className="text-sm text-muted-foreground">No results for &ldquo;{search}&rdquo;</p>
          ) : (
            <>
              <FileText className="mb-3 size-10 text-muted-foreground/20" />
              <h2 className="text-sm font-medium">No materials yet</h2>
              <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
                Upload a PDF or paste a YouTube link to start learning.
              </p>
              <Button onClick={() => setUploadOpen(true)} size="sm" className="mt-4 gap-1.5">
                <Plus className="size-3.5" />
                Upload your first material
              </Button>
            </>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-xl border border-border/30">
          {items.map((item) => (
            <LibraryListItem
              key={item.id}
              item={item}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

type ContentItem = {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  summaryTldr: string | null;
  createdAt: Date | string | null;
};

function LibraryCard({ item, onDelete }: { item: ContentItem; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const isReady = item.status === "ready";
  const isProcessing = item.status === "processing";

  const card = (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/40 shadow-sm bg-card transition-all hover:border-border/60 hover:shadow-md",
        isReady && "cursor-pointer"
      )}
    >
      <div className="flex h-28 items-center justify-center bg-muted/30">
        {item.sourceType === "youtube" ? (
          <CirclePlay className="size-8 text-red-500/40" />
        ) : item.sourceType === "pdf" ? (
          <FileType2 className="size-8 text-red-600/40" />
        ) : (
          <FileText className="size-8 text-muted-foreground/20" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[14px] font-medium leading-snug">{item.title}</h3>
        {item.summaryTldr && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {item.summaryTldr}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center gap-2">
            {isProcessing && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Loader2 className="size-2.5 animate-spin" />
                Processing
              </Badge>
            )}
            {item.status === "failed" && (
              <Badge variant="destructive" className="text-[10px]">
                Failed
              </Badge>
            )}
            {isReady && item.createdAt && (
              <span className="text-[11px] text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delete button — visible on hover */}
      {!confirming ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(true);
          }}
          className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition-all hover:bg-destructive hover:text-white group-hover:opacity-100"
          title="Delete material"
        >
          <Trash2 className="size-3" />
        </button>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/90 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <p className="text-sm font-medium">Delete this material?</p>
          <p className="text-[11px] text-muted-foreground px-6 text-center">
            This cannot be undone.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setConfirming(false);
              }}
              className="rounded-lg border border-border/50 px-3 py-1.5 text-xs hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(item.id);
              }}
              className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="size-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isReady) {
    return (
      <Link href={`/library/${item.id}`} className="block">
        {card}
      </Link>
    );
  }
  return card;
}

function LibraryListItem({
  item,
  onDelete,
}: {
  item: ContentItem;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isReady = item.status === "ready";
  const isProcessing = item.status === "processing";
  const Icon =
    item.sourceType === "youtube" ? CirclePlay : item.sourceType === "pdf" ? FileType2 : FileText;
  const iconColor =
    item.sourceType === "youtube"
      ? "text-red-500/80"
      : item.sourceType === "pdf"
        ? "text-red-600/80"
        : "text-muted-foreground/50";

  const row = (
    <div
      className={cn(
        "group relative flex items-center gap-4 px-4 py-3 transition-colors",
        isReady && "cursor-pointer hover:bg-muted/30"
      )}
    >
      {confirming ? (
        <div
          className="absolute inset-0 flex items-center justify-center gap-3 bg-background/90 backdrop-blur-sm px-4"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <p className="text-sm font-medium">Delete this material?</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setConfirming(false);
            }}
            className="rounded-lg border border-border/50 px-3 py-1.5 text-xs hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete(item.id);
            }}
            className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="size-3" />
            Delete
          </button>
        </div>
      ) : null}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/40">
        <Icon className={cn("size-4", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="truncate text-[13px] font-medium">{item.title}</h3>
        {item.summaryTldr && (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.summaryTldr}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isProcessing && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Loader2 className="size-2.5 animate-spin" />
            Processing
          </Badge>
        )}
        {item.status === "failed" && (
          <Badge variant="destructive" className="text-[10px]">
            Failed
          </Badge>
        )}
        {isReady && item.createdAt && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {isReady && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirming(true);
            }}
            className="rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  if (isReady) {
    return (
      <Link href={`/library/${item.id}`} className="block">
        {row}
      </Link>
    );
  }
  return row;
}

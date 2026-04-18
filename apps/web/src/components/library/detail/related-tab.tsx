"use client";

import Link from "next/link";
import {
  FileAudio,
  FileText,
  FileType2,
  Globe,
  Image as ImageIcon,
  Loader2,
  Presentation,
  Youtube,
} from "lucide-react";
import { trpc } from "@/trpc/client";

export function RelatedContentTab({ learningObjectId }: { learningObjectId: string }) {
  const { data: related, isLoading } = trpc.library.relatedContent.useQuery({ learningObjectId });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!related || related.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[13px] font-medium text-foreground/70">No connections yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">
          Upload more content to discover cross-source knowledge connections.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-1.5">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
        Shared Concepts
      </p>
      {related.map((lo) => {
        const Icon =
          lo.sourceType === "youtube"
            ? Youtube
            : lo.sourceType === "url"
              ? Globe
              : lo.sourceType === "pptx"
                ? Presentation
                : lo.sourceType === "audio"
                  ? FileAudio
                  : lo.sourceType === "image"
                    ? ImageIcon
                    : lo.sourceType === "docx"
                      ? FileType2
                      : FileText;
        return (
          <Link
            key={lo.id}
            href={`/library/${lo.id}`}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground/85">{lo.title}</p>
              {lo.summaryTldr && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/60">
                  {lo.summaryTldr}
                </p>
              )}
              <p className="mt-1 text-[10px] text-primary/60">
                {lo.sharedConceptCount} shared concept{lo.sharedConceptCount !== 1 ? "s" : ""}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

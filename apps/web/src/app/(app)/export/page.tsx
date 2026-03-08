"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  FileText,
  Brain,
  MessageSquare,
  Loader2,
  Archive,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ExportType = "summary" | "flashcards" | "graph" | "conversations" | "bulk";
type ExportFormat = "markdown" | "json" | "csv";

const EXPORT_OPTIONS: {
  type: ExportType;
  label: string;
  description: string;
  icon: typeof FileText;
  formats: { value: ExportFormat; label: string }[];
}[] = [
  {
    type: "summary",
    label: "Summaries",
    description: "All your learning material summaries with key points",
    icon: FileText,
    formats: [
      { value: "markdown", label: "Markdown" },
      { value: "json", label: "JSON" },
    ],
  },
  {
    type: "flashcards",
    label: "Flashcards",
    description: "All quiz questions — CSV is Anki-compatible for easy import",
    icon: CreditCard,
    formats: [
      { value: "csv", label: "Anki (TSV)" },
      { value: "markdown", label: "Markdown" },
      { value: "json", label: "JSON" },
    ],
  },
  {
    type: "graph",
    label: "Knowledge Graph",
    description: "Concepts, edges, mastery states, and connections",
    icon: Brain,
    formats: [
      { value: "json", label: "JSON" },
      { value: "csv", label: "CSV" },
      { value: "markdown", label: "Markdown" },
    ],
  },
  {
    type: "conversations",
    label: "Conversations",
    description: "AI mentor chat history with citations preserved",
    icon: MessageSquare,
    formats: [
      { value: "markdown", label: "Markdown" },
      { value: "json", label: "JSON" },
    ],
  },
  {
    type: "bulk",
    label: "All Data",
    description: "Complete data export — everything in one JSON file (GDPR)",
    icon: Archive,
    formats: [{ value: "json", label: "JSON" }],
  },
];

export default function ExportPage() {
  const { data: stats, isLoading } = trpc.export.getExportStats.useQuery();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (type: ExportType, format: ExportFormat) => {
    const key = `${type}-${format}`;
    setDownloading(key);

    try {
      const params = new URLSearchParams({ type, format });
      const res = await fetch(`/api/export?${params.toString()}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }

      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+?)"/);
      const filename =
        filenameMatch?.[1] ??
        `export-${type}.${format === "csv" ? "txt" : format === "json" ? "json" : "md"}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${EXPORT_OPTIONS.find((o) => o.type === type)?.label} exported successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/more"
          className="text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Export Your Data</h1>
          <p className="text-[13px] text-muted-foreground/60">
            Download your learning data in various formats. Your data is always yours.
          </p>
        </div>
      </div>

      {/* Stats summary */}
      {!isLoading && stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Materials", value: stats.learningObjects },
            { label: "Flashcards", value: stats.flashcards },
            { label: "Concepts", value: stats.concepts },
            { label: "Conversations", value: stats.conversations },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/30 bg-muted/20 px-4 py-3">
              <p className="text-[22px] font-semibold tabular-nums">{s.value}</p>
              <p className="text-[11px] text-muted-foreground/50">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Export options */}
      <div className="space-y-3">
        {EXPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <div
              key={opt.type}
              className="rounded-xl border border-border/30 bg-background p-4 transition-colors hover:border-border/50"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted/40 p-2">
                  <Icon className="size-4 text-muted-foreground/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium">{opt.label}</p>
                  <p className="text-[12px] text-muted-foreground/60">{opt.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opt.formats.map((fmt) => {
                      const key = `${opt.type}-${fmt.value}`;
                      const isDownloading = downloading === key;
                      return (
                        <Button
                          key={fmt.value}
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(opt.type, fmt.value)}
                          disabled={isDownloading || downloading !== null}
                          className="h-8 rounded-lg text-[12px]"
                        >
                          {isDownloading ? (
                            <Loader2 className="mr-1.5 size-3 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 size-3" />
                          )}
                          {fmt.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}

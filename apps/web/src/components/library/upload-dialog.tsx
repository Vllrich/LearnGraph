"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/trpc/client";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Youtube,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@repo/shared";
import { toast } from "sonner";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [tab, setTab] = useState<"file" | "youtube">("file");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const utils = trpc.useUtils();
  const createMutation = trpc.library.create.useMutation();

  const reset = useCallback(() => {
    setFile(null);
    setYoutubeUrl("");
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMessage("");
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && uploadState !== "uploading") reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, uploadState],
  );

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }
      if (f.type !== "application/pdf") {
        setErrorMessage("Only PDF files are supported for now.");
        return;
      }
      setFile(f);
      setErrorMessage("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE_BYTES,
    noClick: !!file,
  });

  const handleUploadFile = async () => {
    if (!file) return;
    setUploadState("uploading");
    setUploadProgress(20);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileId = crypto.randomUUID();
      const filePath = `${user.id}/${fileId}.pdf`;
      setUploadProgress(40);

      const { error: storageError } = await supabase.storage
        .from("content-uploads")
        .upload(filePath, file, { contentType: "application/pdf" });
      if (storageError) throw new Error(storageError.message);
      setUploadProgress(60);

      const item = await createMutation.mutateAsync({
        title: file.name.replace(/\.pdf$/i, ""),
        sourceType: "pdf",
        filePath,
      });
      setUploadProgress(80);

      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningObjectId: item.id, sourceType: "pdf", filePath }),
      });
      if (!ingestRes.ok) {
        const body = await ingestRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start processing");
      }

      setUploadProgress(100);
      setUploadState("processing");
      toast.success("Upload complete — processing your document...");
      utils.library.list.invalidate();
      setTimeout(() => handleClose(false), 1500);
    } catch (err) {
      setUploadState("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      toast.error("Upload failed. Please try again.");
    }
  };

  const handleUploadYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    const ytRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!ytRegex.test(youtubeUrl)) {
      setErrorMessage("Please enter a valid YouTube URL.");
      return;
    }

    setUploadState("uploading");
    setUploadProgress(30);

    try {
      const item = await createMutation.mutateAsync({
        title: "YouTube Video",
        sourceType: "youtube",
        sourceUrl: youtubeUrl.trim(),
      });
      setUploadProgress(60);

      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningObjectId: item.id, sourceType: "youtube", sourceUrl: youtubeUrl.trim() }),
      });
      if (!ingestRes.ok) {
        const body = await ingestRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start processing");
      }

      setUploadProgress(100);
      setUploadState("processing");
      toast.success("Processing your YouTube video...");
      utils.library.list.invalidate();
      setTimeout(() => handleClose(false), 1500);
    } catch (err) {
      setUploadState("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      toast.error("Upload failed. Please try again.");
    }
  };

  const isUploading = uploadState === "uploading";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg sm:rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">Add Learning Material</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload a PDF or paste a YouTube link to get started.
          </DialogDescription>
        </DialogHeader>

        {/* Tab selector */}
        <div className="mx-6 flex gap-1 rounded-xl bg-muted/60 p-1">
          {(["file", "youtube"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); reset(); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "file" ? <FileText className="size-4" /> : <Youtube className="size-4" />}
              {t === "file" ? "PDF" : "YouTube"}
            </button>
          ))}
        </div>

        <div className="p-6 pt-4">
          {tab === "file" && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition-all ${
                  isDragActive
                    ? "border-primary/60 bg-primary/5"
                    : file
                      ? "border-success/40 bg-success/5"
                      : "border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]"
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-success/10 p-2.5">
                      <FileText className="size-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="ml-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 rounded-2xl bg-primary/10 p-3">
                      <Upload className="size-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">
                      {isDragActive ? "Drop your PDF here" : "Drop a PDF here, or click to browse"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Up to {MAX_FILE_SIZE_MB} MB
                    </p>
                  </>
                )}
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              {uploadState !== "idle" && uploadState !== "error" && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {uploadState === "uploading" && <><Loader2 className="size-3.5 animate-spin" /> Uploading...</>}
                    {uploadState === "processing" && <><CheckCircle2 className="size-3.5 text-success" /> Processing in background...</>}
                  </div>
                </div>
              )}

              <Button onClick={handleUploadFile} disabled={!file || isUploading} className="w-full rounded-xl">
                {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                {isUploading ? "Uploading..." : "Upload PDF"}
              </Button>
            </div>
          )}

          {tab === "youtube" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url" className="text-sm">YouTube URL</Label>
                <Input
                  id="youtube-url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); setErrorMessage(""); }}
                  disabled={isUploading}
                  className="rounded-xl"
                />
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              {uploadState !== "idle" && uploadState !== "error" && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {uploadState === "uploading" && <><Loader2 className="size-3.5 animate-spin" /> Processing...</>}
                    {uploadState === "processing" && <><CheckCircle2 className="size-3.5 text-success" /> Fetching transcript...</>}
                  </div>
                </div>
              )}

              <Button onClick={handleUploadYoutube} disabled={!youtubeUrl.trim() || isUploading} className="w-full rounded-xl">
                {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Youtube className="mr-2 size-4" />}
                {isUploading ? "Processing..." : "Add Video"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

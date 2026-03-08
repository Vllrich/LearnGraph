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
  Globe,
  Presentation,
  FileAudio,
  Image as ImageIcon,
  FileType2,
} from "lucide-react";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  FILE_SOURCE_TYPE_MAP,
  SOURCE_TYPE_ACCEPT,
} from "@repo/shared";
import { toast } from "sonner";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "file" | "url";
};

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";
type TabType = "file" | "youtube" | "web";

const FORMAT_LABELS: Record<string, { label: string; icon: typeof FileText }> = {
  "application/pdf": { label: "PDF", icon: FileText },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    label: "PowerPoint",
    icon: Presentation,
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    label: "Word",
    icon: FileType2,
  },
  "audio/mpeg": { label: "Audio", icon: FileAudio },
  "audio/mp4": { label: "Audio", icon: FileAudio },
  "audio/wav": { label: "Audio", icon: FileAudio },
  "audio/x-m4a": { label: "Audio", icon: FileAudio },
  "audio/webm": { label: "Audio", icon: FileAudio },
  "image/png": { label: "Image", icon: ImageIcon },
  "image/jpeg": { label: "Image", icon: ImageIcon },
  "image/webp": { label: "Image", icon: ImageIcon },
};

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function getSourceTypeFromFile(file: File): string {
  return FILE_SOURCE_TYPE_MAP[file.type] ?? "pdf";
}

function getFileIcon(file: File) {
  const fmt = FORMAT_LABELS[file.type];
  return fmt?.icon ?? FileText;
}

function getStorageExtension(file: File): string {
  const ext = getFileExtension(file.name);
  if (ext) return ext;
  const extMap: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  return extMap[file.type] ?? "bin";
}

export function UploadDialog({ open, onOpenChange, defaultTab }: UploadDialogProps) {
  const [tab, setTab] = useState<TabType>(defaultTab === "url" ? "youtube" : "file");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const utils = trpc.useUtils();
  const createMutation = trpc.library.create.useMutation();

  const reset = useCallback(() => {
    setFile(null);
    setYoutubeUrl("");
    setWebUrl("");
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMessage("");
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && uploadState !== "uploading") reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, uploadState]
  );

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }
      const sourceType = FILE_SOURCE_TYPE_MAP[f.type];
      if (!sourceType) {
        setErrorMessage(
          "Unsupported file type. Supported: PDF, PPTX, DOCX, MP3, WAV, M4A, PNG, JPG, WebP."
        );
        return;
      }
      setFile(f);
      setErrorMessage("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SOURCE_TYPE_ACCEPT.file,
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const sourceType = getSourceTypeFromFile(file);
      const ext = getStorageExtension(file);
      const fileId = crypto.randomUUID();
      const filePath = `${user.id}/${fileId}.${ext}`;
      setUploadProgress(40);

      const { error: storageError } = await supabase.storage
        .from("content-uploads")
        .upload(filePath, file, { contentType: file.type });
      if (storageError) throw new Error(storageError.message);
      setUploadProgress(60);

      const titleFromName = file.name.replace(/\.[^.]+$/i, "");
      const item = await createMutation.mutateAsync({
        title: titleFromName,
        sourceType: sourceType as "pdf" | "youtube" | "docx" | "pptx" | "audio" | "url" | "image",
        filePath,
      });
      setUploadProgress(80);

      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningObjectId: item.id,
          sourceType,
          filePath,
          fileName: file.name,
        }),
      });
      if (!ingestRes.ok) {
        const body = await ingestRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start processing");
      }

      setUploadProgress(100);
      setUploadState("processing");
      toast.success("Upload complete — processing your content...");
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
    const ytRegex =
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
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
        body: JSON.stringify({
          learningObjectId: item.id,
          sourceType: "youtube",
          sourceUrl: youtubeUrl.trim(),
        }),
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

  const handleUploadWebUrl = async () => {
    const trimmed = webUrl.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setErrorMessage("Please enter a valid URL (e.g. https://example.com/article).");
      return;
    }

    setUploadState("uploading");
    setUploadProgress(30);

    try {
      const item = await createMutation.mutateAsync({
        title: "Web Article",
        sourceType: "url",
        sourceUrl: trimmed,
      });
      setUploadProgress(60);

      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningObjectId: item.id,
          sourceType: "url",
          sourceUrl: trimmed,
        }),
      });
      if (!ingestRes.ok) {
        const body = await ingestRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start processing");
      }

      setUploadProgress(100);
      setUploadState("processing");
      toast.success("Processing web article...");
      utils.library.list.invalidate();
      setTimeout(() => handleClose(false), 1500);
    } catch (err) {
      setUploadState("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      toast.error("Upload failed. Please try again.");
    }
  };

  const isUploading = uploadState === "uploading";
  const FileIcon = file ? getFileIcon(file) : Upload;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg sm:rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">Add Learning Material</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload files, paste a YouTube link, or add a web article.
          </DialogDescription>
        </DialogHeader>

        {/* Tab selector */}
        <div className="mx-6 flex gap-1 rounded-xl bg-muted/60 p-1">
          {[
            { key: "file" as const, icon: Upload, label: "File" },
            { key: "youtube" as const, icon: Youtube, label: "YouTube" },
            { key: "web" as const, icon: Globe, label: "Web URL" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                reset();
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                tab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
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
                      : "border-border/50 hover:border-primary/40 hover:bg-primary/2"
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-success/10 p-2.5">
                      <FileIcon className="size-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
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
                      {isDragActive
                        ? "Drop your file here"
                        : "Drop a file here, or click to browse"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF, PPTX, DOCX, MP3, WAV, PNG, JPG — up to {MAX_FILE_SIZE_MB} MB
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

              <ProgressIndicator uploadState={uploadState} uploadProgress={uploadProgress} />

              <Button
                onClick={handleUploadFile}
                disabled={!file || isUploading}
                className="w-full rounded-xl"
              >
                {isUploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          )}

          {tab === "youtube" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url" className="text-sm">
                  YouTube URL
                </Label>
                <Input
                  id="youtube-url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setErrorMessage("");
                  }}
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

              <ProgressIndicator uploadState={uploadState} uploadProgress={uploadProgress} />

              <Button
                onClick={handleUploadYoutube}
                disabled={!youtubeUrl.trim() || isUploading}
                className="w-full rounded-xl"
              >
                {isUploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Youtube className="mr-2 size-4" />
                )}
                {isUploading ? "Processing..." : "Add Video"}
              </Button>
            </div>
          )}

          {tab === "web" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="web-url" className="text-sm">
                  Web Article URL
                </Label>
                <Input
                  id="web-url"
                  placeholder="https://example.com/article..."
                  value={webUrl}
                  onChange={(e) => {
                    setWebUrl(e.target.value);
                    setErrorMessage("");
                  }}
                  disabled={isUploading}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground/60">
                  We&apos;ll extract the main article content from the page.
                </p>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <ProgressIndicator uploadState={uploadState} uploadProgress={uploadProgress} />

              <Button
                onClick={handleUploadWebUrl}
                disabled={!webUrl.trim() || isUploading}
                className="w-full rounded-xl"
              >
                {isUploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Globe className="mr-2 size-4" />
                )}
                {isUploading ? "Processing..." : "Add Article"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressIndicator({
  uploadState,
  uploadProgress,
}: {
  uploadState: UploadState;
  uploadProgress: number;
}) {
  if (uploadState === "idle" || uploadState === "error") return null;

  return (
    <div className="space-y-2">
      <Progress value={uploadProgress} className="h-1.5" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {uploadState === "uploading" && (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Uploading...
          </>
        )}
        {uploadState === "processing" && (
          <>
            <CheckCircle2 className="size-3.5 text-success" /> Processing in background...
          </>
        )}
      </div>
    </div>
  );
}

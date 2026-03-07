import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function LibraryPage() {
  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-bold tracking-tight">Library</h1>
          <p className="text-muted-foreground">Your uploaded learning materials</p>
        </div>
        <Button>
          <Upload className="mr-1.5 size-4" />
          Upload
        </Button>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Upload className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">No content yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Drag and drop PDFs here, or paste a YouTube URL to start learning.
        </p>
        <Button className="mt-2">
          <Upload className="mr-1.5 size-4" />
          Upload your first document
        </Button>
      </div>
    </PageContainer>
  );
}

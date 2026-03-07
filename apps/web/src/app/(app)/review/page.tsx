import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function ReviewPage() {
  return (
    <PageContainer>
      <h1 className="text-h1 font-bold tracking-tight">Review</h1>
      <p className="text-muted-foreground">Spaced repetition keeps knowledge sharp</p>

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <Zap className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No reviews due</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Once you upload content and extract concepts, your review queue will appear here.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

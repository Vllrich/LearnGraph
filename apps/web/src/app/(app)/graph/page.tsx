import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Globe } from "lucide-react";

export default function GraphPage() {
  return (
    <PageContainer>
      <h1 className="text-h1 font-bold tracking-tight">Knowledge Graph</h1>
      <p className="text-muted-foreground">Visualize how your concepts connect</p>

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="rounded-full bg-muted p-4">
            <Globe className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No concepts to visualize</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Upload learning materials to extract concepts and see them as an interactive graph.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

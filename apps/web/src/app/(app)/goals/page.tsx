import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function GoalsPage() {
  return (
    <PageContainer>
      <h1 className="text-h1 font-bold tracking-tight">Goals</h1>
      <p className="text-muted-foreground">Set learning objectives and track progress</p>

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <Target className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No goals yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create a learning goal to get a personalized curriculum path.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

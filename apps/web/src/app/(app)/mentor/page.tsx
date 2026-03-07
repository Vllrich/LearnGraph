import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export default function MentorPage() {
  return (
    <PageContainer>
      <h1 className="text-h1 font-bold tracking-tight">AI Mentor</h1>
      <p className="text-muted-foreground">Chat with your personal learning assistant</p>

      <Card className="mt-8">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <MessageCircle className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No conversations yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Upload content first, then ask your AI mentor questions about it.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

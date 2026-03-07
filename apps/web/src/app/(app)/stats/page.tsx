import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, BookOpen, BrainCircuit, Flame } from "lucide-react";

export default function StatsPage() {
  return (
    <PageContainer>
      <h1 className="text-h1 font-bold tracking-tight">Stats</h1>
      <p className="text-muted-foreground">Your learning analytics at a glance</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Flame} label="Streak" value="0 days" />
        <StatCard icon={BookOpen} label="Content" value="0 items" />
        <StatCard icon={BrainCircuit} label="Concepts" value="0 learned" />
        <StatCard icon={BarChart3} label="Reviews" value="0 total" />
      </div>

      <Card className="mt-6">
        <CardContent className="flex items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Charts will appear here once you start learning.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

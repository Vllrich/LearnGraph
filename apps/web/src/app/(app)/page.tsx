"use client";

import { PageContainer } from "@/components/layout/page-container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Flame,
  Upload,
  BookOpen,
  BrainCircuit,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";

export default function DashboardPage() {
  const { displayName } = useUser();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h1 font-bold tracking-tight">
              {greeting}, {displayName}.
            </h1>
            <p className="text-muted-foreground">
              Ready to learn something today?
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-badge bg-brand-accent/10 px-3 py-1.5">
            <Flame className="size-4 text-brand-accent" />
            <span className="text-sm font-semibold">0 day streak</span>
          </div>
        </div>

        {/* Top cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Daily Review</CardTitle>
                <CardDescription>No concepts due yet</CardDescription>
              </div>
              <Zap className="size-5 text-brand-primary" />
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-2xl font-bold">0 <span className="text-sm font-normal text-muted-foreground">concepts due</span></p>
              <Button asChild className="w-full">
                <Link href="/review">Start Review</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Knowledge Snapshot</CardTitle>
                <CardDescription>Your concept mastery overview</CardDescription>
              </div>
              <BrainCircuit className="size-5 text-brand-secondary" />
            </CardHeader>
            <CardContent>
              <div className="flex h-24 items-center justify-center rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Upload content to see your knowledge graph
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent content */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Content</CardTitle>
              <CardDescription>Your uploaded learning materials</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/library">
                <BookOpen className="mr-1.5 size-3.5" />
                View Library
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="rounded-full bg-muted p-3">
                <Upload className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No content yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload your first document to get started
                </p>
              </div>
              <Button asChild>
                <Link href="/library">Upload Content</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

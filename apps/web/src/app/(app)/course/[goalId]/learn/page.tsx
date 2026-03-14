"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/trpc/client";
import { LessonPlayer } from "@/components/course/lesson-player";
import { Loader2 } from "lucide-react";

export default function CourseLessonPage() {
  const params = useParams();
  const goalId = params.goalId as string;

  const { data, isLoading } = trpc.goals.getNextLesson.useQuery({ goalId });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.type === "no_modules") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No lessons available yet.</p>
      </div>
    );
  }

  if (data.type === "course_complete") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Course Complete!</h1>
        <p className="text-muted-foreground">You&apos;ve finished all modules. Great work!</p>
      </div>
    );
  }

  if (data.type === "remedial_needed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-xl font-semibold">Review needed</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Module &quot;{data.lockedModule.title}&quot; requires stronger mastery of some concepts.
          Review your weak areas to unlock it.
        </p>
      </div>
    );
  }

  return <LessonPlayer goalId={goalId} lessonId={data.lesson.id} />;
}

"use client";

import { useParams } from "next/navigation";
import { CourseRoadmap } from "@/components/course/course-roadmap";
import { PageContainer } from "@/components/layout/page-container";

export default function CourseRoadmapPage() {
  const params = useParams();
  const goalId = params.goalId as string;

  return (
    <PageContainer>
      <CourseRoadmap goalId={goalId} />
    </PageContainer>
  );
}

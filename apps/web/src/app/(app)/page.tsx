import { trpc, HydrateClient } from "@/trpc/server";
import { HomeContent } from "@/components/home/home-content";

export default async function HomePage() {
  void trpc.goals.getActive.prefetch();
  void trpc.review.getStats.prefetch();
  void trpc.review.getDailyQueue.prefetch({ mode: "standard" });
  void trpc.discovery.getSuggestions.prefetch();
  void trpc.user.getProfile.prefetch();

  return (
    <HydrateClient>
      <HomeContent />
    </HydrateClient>
  );
}

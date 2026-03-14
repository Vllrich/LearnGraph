"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  Puzzle,
  ChevronDown,
  TrendingUp,
  Loader2,
  Dices,
} from "lucide-react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import {
  SuggestionCard,
  SuggestionCardSkeleton,
  type SuggestionVariant,
} from "./suggestion-card";

const STATIC_TOPICS: Record<string, { title: string; subtitle: string }[]> = {
  Programming: [
    { title: "Python", subtitle: "Beginner friendly" },
    { title: "JavaScript", subtitle: "Web development" },
    { title: "TypeScript", subtitle: "Type-safe JS" },
    { title: "Rust", subtitle: "Systems programming" },
    { title: "SQL", subtitle: "Databases" },
    { title: "Go", subtitle: "Cloud native" },
  ],
  "AI & Data": [
    { title: "Machine Learning", subtitle: "Core concepts" },
    { title: "Deep Learning", subtitle: "Neural networks" },
    { title: "Statistics", subtitle: "Data science" },
    { title: "Data Analysis", subtitle: "Pandas & NumPy" },
    { title: "LLMs & Prompting", subtitle: "Generative AI" },
    { title: "Computer Vision", subtitle: "Image models" },
  ],
  Technology: [
    { title: "AWS Cloud", subtitle: "Certification" },
    { title: "Docker & K8s", subtitle: "DevOps" },
    { title: "System Design", subtitle: "Architecture" },
    { title: "Networking", subtitle: "TCP/IP & DNS" },
    { title: "Linux", subtitle: "Command line" },
    { title: "Git", subtitle: "Version control" },
  ],
  Science: [
    { title: "Calculus", subtitle: "Exam prep" },
    { title: "Linear Algebra", subtitle: "Foundations" },
    { title: "Physics", subtitle: "Mechanics & more" },
    { title: "Chemistry", subtitle: "Core concepts" },
    { title: "Biology", subtitle: "Life sciences" },
    { title: "Probability", subtitle: "Theory & practice" },
  ],
  Business: [
    { title: "Product Management", subtitle: "PM fundamentals" },
    { title: "Marketing", subtitle: "Growth & strategy" },
    { title: "Finance", subtitle: "Basics & valuation" },
    { title: "Entrepreneurship", subtitle: "Build a startup" },
    { title: "Economics", subtitle: "Micro & macro" },
    { title: "Leadership", subtitle: "People & teams" },
  ],
};

type DiscoveryFeedProps = {
  onSelectTopic: (topic: string) => void;
};

export function DiscoveryFeed({ onSelectTopic }: DiscoveryFeedProps) {
  const [activeStaticTab, setActiveStaticTab] = useState(
    Object.keys(STATIC_TOPICS)[0]!
  );

  const utils = trpc.useUtils();

  const {
    data: suggestions,
    isLoading,
    error,
  } = trpc.discovery.getSuggestions.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const dismissMutation = trpc.discovery.dismiss.useMutation({
    onSuccess: () => {
      void utils.discovery.getSuggestions.invalidate();
    },
  });

  const {
    data: randomTopic,
    refetch: refetchRandom,
    isFetching: randomLoading,
  } = trpc.discovery.getRandomTopic.useQuery(undefined, {
    enabled: false,
    staleTime: 0,
  });

  const [surpriseVisible, setSurpriseVisible] = useState(false);

  const handleDismiss = useCallback(
    (type: SuggestionVariant, key: string) => {
      const typeMap: Record<SuggestionVariant, string> = {
        ai: "ai_topic",
        trending: "trending",
        gap: "gap",
        random: "random",
      };
      dismissMutation.mutate({
        suggestionType: typeMap[type] as "ai_topic" | "trending" | "gap" | "random",
        suggestionKey: key,
      });
    },
    [dismissMutation]
  );

  const handleSurpriseMe = useCallback(async () => {
    setSurpriseVisible(false);
    await refetchRandom();
    setSurpriseVisible(true);
  }, [refetchRandom]);

  const hasForYou = (suggestions?.forYou?.length ?? 0) > 0;
  const hasTrending = (suggestions?.trending?.length ?? 0) > 0;
  const hasGaps = (suggestions?.gaps?.length ?? 0) > 0;
  const hasAnySuggestion = hasForYou || hasTrending || hasGaps;

  if (error && !suggestions) {
    return <StaticBrowse
      activeTab={activeStaticTab}
      onTabChange={setActiveStaticTab}
      onSelect={onSelectTopic}
      defaultOpen
    />;
  }

  return (
    <div className="mt-8 w-full max-w-2xl space-y-6 pt-4">
      {/* Loading state */}
      {isLoading && (
        <section>
          <SectionHeader
            icon={Sparkles}
            label="Discovering topics for you..."
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SuggestionCardSkeleton key={i} />
            ))}
          </div>
        </section>
      )}

      {/* For You (AI-personalized) */}
      {!isLoading && hasForYou && (
        <section>
          <SectionHeader icon={Sparkles} label="For you" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggestions!.forYou.map((topic) => (
              <SuggestionCard
                key={topic.title}
                title={topic.title}
                subtitle={topic.subtitle}
                reason={topic.reason}
                variant="ai"
                onSelect={onSelectTopic}
                onDismiss={() => handleDismiss("ai", topic.title)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {!isLoading && hasTrending && (
        <section>
          <SectionHeader icon={TrendingUp} label="Trending this month" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggestions!.trending.map((topic) => (
              <SuggestionCard
                key={topic.title}
                title={topic.title}
                subtitle={`${topic.enrollCount} learners`}
                variant="trending"
                enrollCount={topic.enrollCount}
                onSelect={onSelectTopic}
                onDismiss={() => handleDismiss("trending", topic.title)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fill the Gap */}
      {!isLoading && hasGaps && (
        <section>
          <SectionHeader icon={Puzzle} label="Fill the gap" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggestions!.gaps.map((gap) => (
              <SuggestionCard
                key={gap.conceptId}
                title={gap.conceptName}
                subtitle={gap.domain ?? "Strengthen foundations"}
                variant="gap"
                prerequisiteFor={gap.prerequisiteFor}
                onSelect={onSelectTopic}
                onDismiss={() => handleDismiss("gap", gap.conceptName)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Surprise Me */}
      <section className="flex flex-col items-center gap-3">
        <button
          onClick={handleSurpriseMe}
          disabled={randomLoading}
          className="flex items-center gap-2 rounded-full border border-border/40 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
        >
          {randomLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Dices className="size-4" />
          )}
          Surprise me
        </button>

        {surpriseVisible && randomTopic && (
          <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SuggestionCard
              title={randomTopic.title}
              subtitle={randomTopic.subtitle}
              reason={randomTopic.hook}
              variant="random"
              onSelect={onSelectTopic}
              onDismiss={() => {
                handleDismiss("random", randomTopic.title);
                setSurpriseVisible(false);
              }}
            />
          </div>
        )}
      </section>

      {/* Browse All Categories (collapsible fallback) */}
      <StaticBrowse
        activeTab={activeStaticTab}
        onTabChange={setActiveStaticTab}
        onSelect={onSelectTopic}
        defaultOpen={!hasAnySuggestion && !isLoading}
      />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground/60" />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function StaticBrowse({
  activeTab,
  onTabChange,
  onSelect,
  defaultOpen = false,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelect: (topic: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center gap-1.5 text-left"
      >
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Browse all categories
        </p>
      </button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="mb-3 flex flex-wrap justify-center gap-1.5">
            {Object.keys(STATIC_TOPICS).map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all",
                  activeTab === tab
                    ? "border border-primary/40 bg-primary/10 text-primary"
                    : "border border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(STATIC_TOPICS[activeTab] ?? []).map((topic) => (
              <button
                key={topic.title}
                onClick={() => onSelect(topic.title)}
                className="flex flex-col items-start rounded-xl border border-border/30 bg-card px-5 py-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <span className="text-sm font-medium">{topic.title}</span>
                <span className="text-[11px] text-muted-foreground/60">
                  {topic.subtitle}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

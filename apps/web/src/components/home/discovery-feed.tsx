"use client";

import { useState, useCallback, useMemo } from "react";
import { Sparkles, Puzzle, TrendingUp, Loader2, Dices, LayoutGrid } from "lucide-react";
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

type Tab = {
  id: string;
  label: string;
  icon: typeof Sparkles;
};

type DiscoveryFeedProps = {
  onSelectTopic: (topic: string) => void;
};

export function DiscoveryFeed({ onSelectTopic }: DiscoveryFeedProps) {
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
  const [browseCategory, setBrowseCategory] = useState(
    Object.keys(STATIC_TOPICS)[0]!
  );

  const hasForYou = (suggestions?.forYou?.length ?? 0) > 0;
  const hasTrending = (suggestions?.trending?.length ?? 0) > 0;
  const hasGaps = (suggestions?.gaps?.length ?? 0) > 0;

  const tabs = useMemo<Tab[]>(() => {
    const t: Tab[] = [];
    if (hasForYou || isLoading) t.push({ id: "for-you", label: "For you", icon: Sparkles });
    if (hasTrending) t.push({ id: "trending", label: "Trending", icon: TrendingUp });
    if (hasGaps) t.push({ id: "gaps", label: "Fill gaps", icon: Puzzle });
    t.push({ id: "browse", label: "Browse", icon: LayoutGrid });
    return t;
  }, [hasForYou, hasTrending, hasGaps, isLoading]);

  const [activeTab, setActiveTab] = useState("for-you");
  const resolvedTab = tabs.find((t) => t.id === activeTab) ? activeTab : tabs[0]?.id ?? "browse";

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

  if (error && !suggestions) {
    return (
      <div className="mt-8 w-full max-w-2xl pt-4">
        <BrowseContent
          activeCategory={browseCategory}
          onCategoryChange={setBrowseCategory}
          onSelect={onSelectTopic}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 w-full max-w-2xl pt-4">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Explore topics
      </p>

      {/* Tab pills */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                resolvedTab === tab.id
                  ? "border border-primary/40 bg-primary/10 text-primary"
                  : "border border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
              )}
            >
              <Icon className="size-3" />
              {tab.label}
            </button>
          );
        })}

        <button
          onClick={handleSurpriseMe}
          disabled={randomLoading}
          className="flex items-center gap-1 rounded-full border border-border/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
        >
          {randomLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Dices className="size-3" />
          )}
          Surprise me
        </button>
      </div>

      {/* Tab content */}
      <div className="min-h-[52px]">
        {/* Loading */}
        {isLoading && resolvedTab === "for-you" && (
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SuggestionCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* For You */}
        {!isLoading && resolvedTab === "for-you" && hasForYou && (
          <div className="flex flex-wrap justify-center gap-2">
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
        )}

        {/* Trending */}
        {resolvedTab === "trending" && hasTrending && (
          <div className="flex flex-wrap justify-center gap-2">
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
        )}

        {/* Fill the Gap */}
        {resolvedTab === "gaps" && hasGaps && (
          <div className="flex flex-wrap justify-center gap-2">
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
        )}

        {/* Browse */}
        {resolvedTab === "browse" && (
          <BrowseContent
            activeCategory={browseCategory}
            onCategoryChange={setBrowseCategory}
            onSelect={onSelectTopic}
          />
        )}

        {/* Surprise Me result */}
        {surpriseVisible && randomTopic && (
          <div className="mt-3 flex justify-center animate-in fade-in slide-in-from-bottom-1 duration-200">
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
      </div>
    </div>
  );
}

function BrowseContent({
  activeCategory,
  onCategoryChange,
  onSelect,
}: {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  onSelect: (topic: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-center gap-1.5">
        {Object.keys(STATIC_TOPICS).map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
              activeCategory === cat
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {(STATIC_TOPICS[activeCategory] ?? []).map((topic) => (
          <button
            key={topic.title}
            onClick={() => onSelect(topic.title)}
            className="rounded-full border border-border/30 px-3 py-1 text-xs font-medium transition-all hover:border-primary/30 hover:bg-primary/5"
          >
            {topic.title}
          </button>
        ))}
      </div>
    </div>
  );
}

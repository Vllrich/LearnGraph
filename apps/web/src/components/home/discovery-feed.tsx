"use client";

import { useState, useCallback, useMemo } from "react";
import { Puzzle, TrendingUp, Loader2, Dices, LayoutGrid, Settings2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { SuggestionCard, SuggestionCardSkeleton, type SuggestionVariant } from "./suggestion-card";
import { TopicPreferencesModal } from "./topic-preferences-modal";
import { TOPIC_CATEGORIES } from "@/config/topics";

type Tab = {
  id: string;
  label: string;
  icon: typeof TrendingUp;
};

type DiscoveryFeedProps = {
  onSelectTopic: (topic: string) => void;
};

export function DiscoveryFeed({ onSelectTopic }: DiscoveryFeedProps) {
  const utils = trpc.useUtils();

  const { data: suggestions, isLoading } = trpc.discovery.getSuggestions.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const { data: profile } = trpc.user.getProfile.useQuery();
  const interestTopics = useMemo(() => {
    const prefs = profile?.preferences as Record<string, unknown> | null | undefined;
    const raw = prefs?.interestTopics;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [profile]);

  const dismissMutation = trpc.discovery.dismiss.useMutation({
    onSuccess: () => void utils.discovery.getSuggestions.invalidate(),
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
  const [browseCategory, setBrowseCategory] = useState(TOPIC_CATEGORIES[0]!.id);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const hasTrending = (suggestions?.trending?.length ?? 0) > 0;
  const hasGaps = (suggestions?.gaps?.length ?? 0) > 0;

  const tabs = useMemo<Tab[]>(() => {
    const t: Tab[] = [];
    if (hasTrending) t.push({ id: "trending", label: "Trending", icon: TrendingUp });
    if (hasGaps) t.push({ id: "gaps", label: "Fill gaps", icon: Puzzle });
    t.push({ id: "browse", label: "Browse", icon: LayoutGrid });
    return t;
  }, [hasTrending, hasGaps]);

  const [activeTab, setActiveTab] = useState("browse");
  const resolvedTab = tabs.find((t) => t.id === activeTab) ? activeTab : (tabs[0]?.id ?? "browse");

  const handleDismiss = useCallback(
    (type: SuggestionVariant, key: string) => {
      const typeMap: Record<SuggestionVariant, string> = {
        trending: "trending",
        gap: "gap",
        random: "random",
      };
      dismissMutation.mutate({
        suggestionType: typeMap[type] as "trending" | "gap" | "random",
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

  return (
    <div className="mt-8 w-full max-w-2xl pt-4">
      <div className="mb-3 flex items-center justify-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Explore topics
        </p>
        <button
          onClick={() => setPrefsOpen(true)}
          title="Edit interests"
          className="rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
        </button>
      </div>

      {/* Tab pills */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
        {isLoading && (
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-muted/50" />
            ))}
          </div>
        )}
        {!isLoading &&
          tabs.map((tab) => {
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
          {randomLoading ? <Loader2 className="size-3 animate-spin" /> : <Dices className="size-3" />}
          Surprise me
        </button>
      </div>

      {/* Tab content */}
      <div className="min-h-[52px]">
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

        {resolvedTab === "browse" && (
          <BrowseContent
            activeCategory={browseCategory}
            onCategoryChange={setBrowseCategory}
            onSelect={onSelectTopic}
            interestTopicIds={interestTopics}
          />
        )}

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

      <TopicPreferencesModal
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        initialSelected={interestTopics}
      />
    </div>
  );
}

function BrowseContent({
  activeCategory,
  onCategoryChange,
  onSelect,
  interestTopicIds,
}: {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  onSelect: (topic: string) => void;
  interestTopicIds: string[];
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-center gap-1.5">
        {TOPIC_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all",
              activeCategory === cat.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {(TOPIC_CATEGORIES.find((c) => c.id === activeCategory)?.topics ?? []).map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelect(topic.label)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
              interestTopicIds.includes(topic.id)
                ? "border-foreground/20 bg-foreground/5 hover:border-primary/40 hover:bg-primary/5"
                : "border-border/30 hover:border-primary/30 hover:bg-primary/5"
            )}
          >
            <topic.icon className="size-3 shrink-0" />
            {topic.label}
          </button>
        ))}
      </div>
    </div>
  );
}

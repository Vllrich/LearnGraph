"use client";

import { cn } from "@/lib/utils";
import { TOPIC_CATEGORIES, type Topic } from "@/config/topics";

type TopicPickerProps = {
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
};

export function TopicPicker({ selected, onChange, max = 20 }: TopicPickerProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-5">
      {TOPIC_CATEGORIES.map((category) => (
        <div key={category.id}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            {category.label}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {category.topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                selected={selected.includes(topic.id)}
                onToggle={() => toggle(topic.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicCard({
  topic,
  selected,
  onToggle,
}: {
  topic: Topic;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = topic.icon;
  return (
    <button
      onClick={onToggle}
      type="button"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-all",
        selected
          ? "border-foreground/50 bg-foreground/5 text-foreground"
          : "border-border/30 text-muted-foreground/60 hover:border-border/60 hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-[10px] font-medium leading-tight">{topic.label}</span>
    </button>
  );
}

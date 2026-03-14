"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TopicPicker } from "./topic-picker";
import { trpc } from "@/trpc/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type TopicPreferencesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelected?: string[];
};

export function TopicPreferencesModal({
  open,
  onOpenChange,
  initialSelected = [],
}: TopicPreferencesModalProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const utils = trpc.useUtils();

  const saveMutation = trpc.user.saveTopicPreferences.useMutation({
    onSuccess: () => {
      toast.success("Interests saved");
      void utils.user.getProfile.invalidate();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to save interests");
    },
  });

  function handleSave() {
    saveMutation.mutate({ interestTopics: selected });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/30 px-6 py-4">
          <DialogTitle className="text-base font-semibold">Your Interests</DialogTitle>
          <p className="text-[12px] text-muted-foreground/70">
            Select topics you want to explore. These shape your recommendations.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TopicPicker selected={selected} onChange={setSelected} />
        </div>

        <div className="shrink-0 border-t border-border/30 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-muted-foreground/60">
              {selected.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-border/40 px-4 py-2 text-[13px] transition-all hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-50 transition-opacity"
              >
                {saveMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

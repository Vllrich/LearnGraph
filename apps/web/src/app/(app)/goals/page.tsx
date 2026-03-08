"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Target, Plus, Loader2, Trash2, Check, Pause, Play, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GoalsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: goals, isLoading } = trpc.goals.list.useQuery();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.goals.delete.useMutation({
    onSuccess: () => utils.goals.list.invalidate(),
  });

  const updateMutation = trpc.goals.update.useMutation({
    onSuccess: () => utils.goals.list.invalidate(),
  });

  const activeGoals = (goals ?? []).filter((g) => g.status === "active");
  const completedGoals = (goals ?? []).filter((g) => g.status === "completed");
  const pausedGoals = (goals ?? []).filter((g) => g.status === "paused");

  return (
    <div className="px-6 pb-6 pt-16 lg:px-10 lg:pt-20">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Goals</h1>
          <p className="text-[13px] text-muted-foreground">
            Set learning objectives and track your progress
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          New Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (goals ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-3 rounded-full bg-muted p-4">
            <Target className="size-8 text-muted-foreground/40" />
          </div>
          <h2 className="text-sm font-medium">No goals yet</h2>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
            Create a learning goal to stay focused and track what you want to master.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Create your first goal
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeGoals.length > 0 && (
            <GoalSection
              title="Active"
              goals={activeGoals}
              onDelete={(id) => deleteMutation.mutate({ id })}
              onUpdate={(id, data) => updateMutation.mutate({ id, ...data })}
            />
          )}
          {pausedGoals.length > 0 && (
            <GoalSection
              title="Paused"
              goals={pausedGoals}
              onDelete={(id) => deleteMutation.mutate({ id })}
              onUpdate={(id, data) => updateMutation.mutate({ id, ...data })}
            />
          )}
          {completedGoals.length > 0 && (
            <GoalSection
              title="Completed"
              goals={completedGoals}
              onDelete={(id) => deleteMutation.mutate({ id })}
              onUpdate={(id, data) => updateMutation.mutate({ id, ...data })}
            />
          )}
        </div>
      )}

      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

type Goal = {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: string | null;
  createdAt: Date | string | null;
};

function GoalSection({
  title,
  goals,
  onDelete,
  onUpdate,
}: {
  title: string;
  goals: Goal[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { status?: "active" | "completed" | "paused" }) => void;
}) {
  return (
    <div>
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
        {title} ({goals.length})
      </h2>
      <div className="space-y-2">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onDelete={() => onDelete(goal.id)}
            onUpdate={(data) => onUpdate(goal.id, data)}
          />
        ))}
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onDelete,
  onUpdate,
}: {
  goal: Goal;
  onDelete: () => void;
  onUpdate: (data: { status?: "active" | "completed" | "paused" }) => void;
}) {
  const isActive = goal.status === "active";
  const isCompleted = goal.status === "completed";
  const isPaused = goal.status === "paused";

  return (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-xl border border-border/30 bg-card p-4 transition-all hover:border-border/50",
        isCompleted && "opacity-60"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          isActive && "bg-green-500/10",
          isCompleted && "bg-muted",
          isPaused && "bg-amber-500/10"
        )}
      >
        <Target
          className={cn(
            "size-4",
            isActive && "text-green-600",
            isCompleted && "text-muted-foreground",
            isPaused && "text-amber-600"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={cn("text-[14px] font-medium", isCompleted && "line-through")}>
            {goal.title}
          </h3>
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px]",
              isActive && "bg-green-500/10 text-green-700 dark:text-green-400",
              isPaused && "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            )}
          >
            {goal.status}
          </Badge>
        </div>
        {goal.description && (
          <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">{goal.description}</p>
        )}
        {goal.targetDate && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="size-3" />
            Target:{" "}
            {new Date(goal.targetDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {isActive && (
          <>
            <button
              onClick={() => onUpdate({ status: "completed" })}
              className="rounded p-1.5 text-muted-foreground hover:bg-green-500/10 hover:text-green-600"
              title="Mark complete"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => onUpdate({ status: "paused" })}
              className="rounded p-1.5 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
              title="Pause"
            >
              <Pause className="size-3.5" />
            </button>
          </>
        )}
        {isPaused && (
          <button
            onClick={() => onUpdate({ status: "active" })}
            className="rounded p-1.5 text-muted-foreground hover:bg-green-500/10 hover:text-green-600"
            title="Resume"
          >
            <Play className="size-3.5" />
          </button>
        )}
        {isCompleted && (
          <button
            onClick={() => onUpdate({ status: "active" })}
            className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            title="Reactivate"
          >
            <Play className="size-3.5" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function CreateGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.goals.create.useMutation({
    onSuccess: () => {
      utils.goals.list.invalidate();
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setTargetDate("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      targetDate: targetDate || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Learning Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Goal</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Master machine learning fundamentals"'
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-desc">Description (optional)</Label>
            <textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What do you want to achieve?"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-date">Target date (optional)</Label>
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Create Goal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

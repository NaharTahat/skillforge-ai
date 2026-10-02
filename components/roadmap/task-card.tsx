"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, CircleDot, Circle, Loader2, Lock } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateTaskStatusAction } from "@/app/dashboard/roadmap/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MyRoadmapTask } from "@/lib/data/roadmap";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Priority,
  type TaskStatus,
} from "@/lib/roadmap/constants";
import type { UserSettableStatus } from "@/lib/roadmap/task-status";
import { effortSize } from "@/lib/roadmap/time";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TaskStatus, { icon: typeof Circle; tone: string }> = {
  LOCKED: { icon: Lock, tone: "text-muted-foreground" },
  AVAILABLE: { icon: Circle, tone: "text-muted-foreground" },
  IN_PROGRESS: { icon: CircleDot, tone: "text-brand" },
  COMPLETED: { icon: CircleCheck, tone: "text-success" },
};

const PRIORITY_STYLES: Record<Priority, string> = {
  CRITICAL: "border-destructive/40 text-destructive",
  HIGH: "border-warning/50 text-warning",
  MEDIUM: "text-foreground",
  LOW: "text-muted-foreground",
};

export function TaskCard({ task }: { task: MyRoadmapTask }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const status = STATUS_STYLES[task.status];

  function setStatus(next: UserSettableStatus) {
    startTransition(async () => {
      try {
        const result = await updateTaskStatusAction({ taskId: task.id, status: next });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        // Re-render from the server: dependent tasks may have been unlocked.
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  const actionClass = "h-9 sm:h-8";
  return (
    <li
      className={cn(
        "min-w-0 rounded-xl border bg-card p-4",
        task.status === "COMPLETED" && "bg-success/5",
        task.status === "LOCKED" && "bg-muted/30",
      )}
      data-testid="roadmap-task"
      data-task-id={task.id}
      data-status={task.status}
    >
      <div className="flex items-start gap-3">
        <status.icon className={cn("mt-0.5 size-5 shrink-0", status.tone)} aria-hidden />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium break-words">{task.title}</h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("font-medium", status.tone)}>
              Status: {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <Badge variant="outline" className={cn("font-normal", PRIORITY_STYLES[task.priority])}>
              {PRIORITY_LABELS[task.priority]} priority
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {CATEGORY_LABELS[task.category]}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {effortSize(task.estimatedHours)} · ~{task.estimatedHours}h over {task.estimatedDays}{" "}
              day{task.estimatedDays === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{task.description}</p>
      <dl className="mt-3 grid gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Skill</dt>
          <dd className="mt-0.5">{task.skill}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Practical outcome</dt>
          <dd className="mt-0.5">{task.practicalOutcome}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">How to verify</dt>
          <dd className="mt-0.5">{task.verificationMethod}</dd>
        </div>
        {task.prerequisites.length > 0 && (
          <div>
            <dt className="text-muted-foreground">Prerequisites</dt>
            <dd className="mt-0.5">{task.prerequisites.join(" · ")}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {task.status === "LOCKED" ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Locked — complete the prerequisites first.
          </p>
        ) : (
          <>
            {task.status === "AVAILABLE" && (
              <Button
                size="sm"
                variant="outline"
                className={actionClass}
                disabled={pending}
                aria-label={`Mark "${task.title}" as in progress`}
                onClick={() => setStatus("IN_PROGRESS")}
              >
                Mark as in progress
              </Button>
            )}
            {task.status !== "COMPLETED" && (
              <Button
                size="sm"
                className={actionClass}
                disabled={pending}
                aria-label={`Mark "${task.title}" as completed`}
                onClick={() => setStatus("COMPLETED")}
              >
                Mark as completed
              </Button>
            )}
            {task.status !== "AVAILABLE" && (
              <Button
                size="sm"
                variant="ghost"
                className={actionClass}
                disabled={pending}
                aria-label={`Reopen "${task.title}"`}
                onClick={() => setStatus("AVAILABLE")}
              >
                Reopen
              </Button>
            )}
            {pending && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />
            )}
          </>
        )}
      </div>
    </li>
  );
}

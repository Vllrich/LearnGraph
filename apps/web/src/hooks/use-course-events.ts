"use client";

import { useEffect, useRef, useState } from "react";
import { isProgressiveCourseGenEnabled } from "@repo/shared";

/**
 * Per-module generation state as pushed over SSE. Mirrors the
 * `course_modules.generation_*` columns.
 */
export type CourseModuleEvent = {
  id: string;
  sequenceOrder: number;
  title: string;
  generationStatus: "pending" | "generating" | "ready" | "failed";
  generationAttempt: number;
  generationError?: string | null;
};

export type ScaffoldEvent = {
  goalId: string;
  goalStatus: "generating" | "ready" | "failed";
  modules: Omit<CourseModuleEvent, "generationError">[];
};

export type CourseEventsState = {
  scaffold: ScaffoldEvent | null;
  modulesById: Map<string, CourseModuleEvent>;
  goalStatus: "generating" | "ready" | "failed" | null;
  connected: boolean;
  error: string | null;
};

/**
 * Subscribe to the backend's progressive-generation SSE stream.
 *
 * Design notes:
 * - Uses the browser-native `EventSource` so the user agent handles
 *   reconnect + `Last-Event-ID` replay automatically. We don't need to
 *   write our own reconnect loop.
 * - State is kept keyed by `moduleId` and merged on every event, so
 *   out-of-order delivery (possible after a reconnect) converges on the
 *   most-recent state per module without manual sequencing.
 * - `REST is the source of truth`: this hook never *replaces* tRPC's
 *   `getCourseRoadmap` — it only pushes deltas on top of it. Callers
 *   should keep using tRPC for initial load and authoritative state.
 * - When `enabled === false` no connection is opened; pass `false` once
 *   the goal is ready so we don't keep an idle stream alive.
 */
export function useCourseEvents(
  goalId: string | null,
  enabled: boolean,
): CourseEventsState {
  const [state, setState] = useState<CourseEventsState>({
    scaffold: null,
    modulesById: new Map(),
    goalStatus: null,
    connected: false,
    error: null,
  });
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!goalId || !enabled) return;
    if (typeof window === "undefined") return;
    // Respect the kill-switch. Server also returns 410 when disabled, but
    // gating here avoids the round-trip + `EventSource`'s automatic
    // reconnect attempts against a dead endpoint.
    if (!isProgressiveCourseGenEnabled()) return;

    const es = new EventSource(`/api/learn/course-events/${goalId}`);
    sourceRef.current = es;

    const onScaffold = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as ScaffoldEvent;
        setState((prev) => {
          const next = new Map(prev.modulesById);
          for (const m of data.modules) {
            // Only seed if we don't already have a newer (higher-attempt)
            // snapshot for this module. Prevents a reconnect's scaffold
            // from clobbering a `ready` event that arrived first.
            const existing = next.get(m.id);
            if (!existing || existing.generationAttempt <= m.generationAttempt) {
              next.set(m.id, { ...m, generationError: null });
            }
          }
          return {
            ...prev,
            scaffold: data,
            modulesById: next,
            goalStatus: data.goalStatus,
            connected: true,
            error: null,
          };
        });
      } catch {
        /* malformed frame — ignore */
      }
    };

    const mergeModule = (ev: MessageEvent) => {
      try {
        const m = JSON.parse(ev.data) as CourseModuleEvent;
        setState((prev) => {
          const next = new Map(prev.modulesById);
          next.set(m.id, m);
          return { ...prev, modulesById: next };
        });
      } catch {
        /* ignore */
      }
    };

    const onCourseComplete = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { goalStatus: "ready" | "failed" };
        setState((prev) => ({ ...prev, goalStatus: data.goalStatus }));
      } catch {
        /* ignore */
      }
    };

    const onError = () => {
      // `EventSource` calls `onerror` both on transient disconnects (before
      // it auto-reconnects) and on fatal errors (after which
      // `readyState === CLOSED`). We surface the transient case as
      // `connected: false` but do nothing else — the browser reconnects.
      setState((prev) => ({ ...prev, connected: false }));
    };

    const onOpen = () => {
      setState((prev) => ({ ...prev, connected: true, error: null }));
    };

    es.addEventListener("scaffold", onScaffold);
    es.addEventListener("module.ready", mergeModule);
    es.addEventListener("module.failed", mergeModule);
    es.addEventListener("module.retry", mergeModule);
    es.addEventListener("course.complete", onCourseComplete);
    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);

    return () => {
      es.removeEventListener("scaffold", onScaffold);
      es.removeEventListener("module.ready", mergeModule);
      es.removeEventListener("module.failed", mergeModule);
      es.removeEventListener("module.retry", mergeModule);
      es.removeEventListener("course.complete", onCourseComplete);
      es.removeEventListener("open", onOpen);
      es.removeEventListener("error", onError);
      es.close();
      sourceRef.current = null;
    };
  }, [goalId, enabled]);

  return state;
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SynthObjectController, TuneObjectArray } from "abcjs";
import { cn } from "@/lib/utils";
import { Music, Play, Pause, RotateCcw, Loader2 } from "lucide-react";

type MusicScoreProps = {
  abc: string;
  className?: string;
};

export function MusicScore({ abc, className }: MusicScoreProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const synthControlRef = useRef<SynthObjectController | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);

  const initAudio = useCallback(async (ABCJS: typeof import("abcjs"), visualObj: TuneObjectArray) => {
    if (!ABCJS.synth.supportsAudio()) return;
    setAudioSupported(true);

    const synthControl = new ABCJS.synth.SynthController();
    synthControl.load(audioRef.current!, null, {
      displayPlay: false,
      displayProgress: true,
      displayRestart: false,
      displayLoop: false,
      displayWarp: false,
    });
    synthControlRef.current = synthControl;

    const createSynth = new ABCJS.synth.CreateSynth();
    try {
      await createSynth.init({ visualObj: visualObj[0] });
      await synthControl.setTune(visualObj[0], false);
      setAudioReady(true);
    } catch (e) {
      console.warn("MusicScore: audio init failed", e);
    }
  }, []);

  useEffect(() => {
    if (!paperRef.current) return;
    let cancelled = false;

    import("abcjs").then((ABCJS) => {
      if (cancelled || !paperRef.current) return;

      const isDark = document.documentElement.classList.contains("dark");

      const visualObj = ABCJS.renderAbc(paperRef.current!, abc.trim(), {
        responsive: "resize",
        add_classes: true,
        foregroundColor: isDark
          ? "hsl(220, 20%, 90%)"
          : "hsl(224, 28%, 12%)",
        paddingtop: 8,
        paddingbottom: 8,
        paddingleft: 0,
        paddingright: 0,
      });

      setIsLoading(false);

      if (visualObj?.[0]) {
        initAudio(ABCJS, visualObj);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [abc, initAudio]);

  function handlePlayPause() {
    const ctrl = synthControlRef.current;
    if (!ctrl) return;
    if (isPlaying) {
      ctrl.pause();
      setIsPlaying(false);
    } else {
      ctrl.play();
      setIsPlaying(true);
    }
  }

  function handleRestart() {
    const ctrl = synthControlRef.current;
    if (!ctrl) return;
    ctrl.restart();
    setIsPlaying(true);
  }

  return (
    <div
      className={cn(
        "group relative my-4 overflow-hidden rounded-lg border border-border/40",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-4 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/60">
          <Music className="size-3" />
          Sheet Music
        </span>

        {audioSupported && audioReady && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleRestart}
              className="flex items-center justify-center rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
              aria-label="Restart"
            >
              <RotateCcw className="size-3" />
            </button>
            <button
              onClick={handlePlayPause}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-3" />
              ) : (
                <Play className="size-3" />
              )}
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        )}
      </div>

      {/* Score */}
      <div className="relative px-4 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground/40" />
          </div>
        )}
        <div
          ref={paperRef}
          className={cn(
            "[&_svg]:w-full",
            isLoading && "hidden",
          )}
        />
      </div>

      {/* Hidden synth controller (we use its progress bar but custom play/pause) */}
      <div
        ref={audioRef}
        className={cn(
          "border-t border-border/30 px-4 py-1.5",
          "[&_.abcjs-inline-audio]:flex [&_.abcjs-inline-audio]:items-center [&_.abcjs-inline-audio]:gap-2",
          "[&_.abcjs-btn]:hidden",
          "[&_.abcjs-midi-current-tempo]:hidden",
          "[&_.abcjs-midi-tempo]:hidden",
          "[&_.abcjs-midi-clock]:text-[11px] [&_.abcjs-midi-clock]:font-mono [&_.abcjs-midi-clock]:text-muted-foreground/50",
          "[&_.abcjs-midi-progress-background]:h-1 [&_.abcjs-midi-progress-background]:flex-1 [&_.abcjs-midi-progress-background]:rounded-full [&_.abcjs-midi-progress-background]:bg-muted",
          "[&_.abcjs-midi-progress-indicator]:h-1 [&_.abcjs-midi-progress-indicator]:rounded-full [&_.abcjs-midi-progress-indicator]:bg-primary/60",
          !audioSupported && "hidden",
        )}
      />
    </div>
  );
}

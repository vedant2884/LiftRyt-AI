import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import ExercisePlaceholder from "./ExercisePlaceholder";
import type { ExerciseCategory, PreviewMediaType } from "../../types/exercise";

const FADE_MS = 250;

export interface ExerciseMediaSource {
  name: string;
  category: ExerciseCategory;
  thumbnail_url?: string | null;
  preview_media_url?: string | null;
  preview_media_type?: PreviewMediaType | null;
}

interface ExerciseMediaProps {
  exercise: ExerciseMediaSource;
  /** "card" only reveals the preview on hover and stays static otherwise;
   * "hero" (the detail modal) plays it immediately, since the user has
   * already committed to looking at this one exercise. */
  variant?: "card" | "hero";
  className?: string;
}

/** Future-proof media surface: today this only ever renders a static image
 * or an ExercisePlaceholder, but the gif/mp4/webm branches are wired and
 * tested against the same crossfade/hover contract so richer media (slow-mo,
 * multiple angles, AI-generated demos) can be dropped in later without
 * touching any card or modal layout. */
export default function ExerciseMedia({ exercise, variant = "card", className = "" }: ExerciseMediaProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [previewMounted, setPreviewMounted] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const unmountTimer = useRef<number | undefined>(undefined);

  const hasThumbnail = !!exercise.thumbnail_url;
  const canPreview = !reduceMotion && !!exercise.preview_media_url;
  const active = variant === "hero" ? canPreview : canPreview && hovered;

  useEffect(() => {
    window.clearTimeout(unmountTimer.current);
    if (active) {
      setPreviewMounted(true);
      const raf = requestAnimationFrame(() => setPreviewVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setPreviewVisible(false);
    // Delay unmount until the fade-out finishes so the video/gif element is
    // fully released (paused, dropped from the DOM) rather than lingering.
    unmountTimer.current = window.setTimeout(() => setPreviewMounted(false), FADE_MS);
    return undefined;
  }, [active]);

  useEffect(() => () => window.clearTimeout(unmountTimer.current), []);

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      onMouseEnter={variant === "card" ? () => setHovered(true) : undefined}
      onMouseLeave={variant === "card" ? () => setHovered(false) : undefined}
    >
      {hasThumbnail ? (
        <>
          {!thumbLoaded && <div className="absolute inset-0 animate-pulse bg-surface-hover" />}
          <img
            src={exercise.thumbnail_url ?? undefined}
            alt={exercise.name}
            loading="lazy"
            onLoad={() => setThumbLoaded(true)}
            onError={(e) => {
              // Never show a broken-image glyph — collapse to the designed
              // placeholder by hiding the failed <img> permanently.
              e.currentTarget.style.display = "none";
            }}
            className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out ${
              variant === "card" && hovered && !reduceMotion ? "scale-105" : "scale-100"
            } ${thumbLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        <ExercisePlaceholder
          category={exercise.category}
          name={exercise.name}
          scaled={variant === "card" && hovered && !reduceMotion}
        />
      )}

      {previewMounted && exercise.preview_media_url && (
        <div
          className="absolute inset-0 transition-opacity ease-out"
          style={{ opacity: previewVisible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          {exercise.preview_media_type === "gif" ? (
            <img src={exercise.preview_media_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <video
              src={exercise.preview_media_url}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}

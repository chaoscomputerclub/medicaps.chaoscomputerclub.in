/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * useChunkedList Hook — Progressive List Slicing & Frame Scheduling
 * Prevents main-thread layout thrashing and frame drops by progressively
 * mounting data chunks across requestAnimationFrame/requestIdleCallback ticks.
 */

import { useEffect, useState } from "react";

export interface UseChunkedListOptions {
  initialChunkSize?: number;
  chunkSize?: number;
  delayMs?: number;
}

export function useChunkedList<T>(
  items: T[],
  options: UseChunkedListOptions = {}
): {
  visibleItems: T[];
  isChunking: boolean;
  totalItems: number;
  renderedCount: number;
} {
  const { initialChunkSize = 25, chunkSize = 25, delayMs = 16 } = options;
  const [renderedCount, setRenderedCount] = useState<number>(() =>
    Math.min(items.length, initialChunkSize)
  );

  useEffect(() => {
    // Reset or re-evaluate whenever source items change
    setRenderedCount(Math.min(items.length, initialChunkSize));

    if (items.length <= initialChunkSize) {
      return;
    }

    let timeoutId: number | undefined;
    let cancelled = false;

    const scheduleNextChunk = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setRenderedCount((prev) => {
          const next = prev + chunkSize;
          if (next < items.length) {
            scheduleNextChunk();
          }
          return Math.min(items.length, next);
        });
      }, delayMs);
    };

    scheduleNextChunk();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [items, initialChunkSize, chunkSize, delayMs]);

  return {
    visibleItems: items.slice(0, renderedCount),
    isChunking: renderedCount < items.length,
    totalItems: items.length,
    renderedCount,
  };
}

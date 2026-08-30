// Shared windowing for ChangesList/ArchiveList (see
// openspec/changes/virtualize-change-lists/design.md). A hook, not a
// wrapper component, so each caller keeps its own per-item markup and
// data-testids untouched — only which rows to map over is shared.
// Below VIRTUALIZE_THRESHOLD, every item renders exactly as before
// (just inside a new, always-bounded scroll container); above it, only
// the currently visible window of rows is mounted as real DOM nodes.

import { useRef, type CSSProperties, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export const VIRTUALIZE_THRESHOLD = 50;

const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_CONTAINER_HEIGHT = 480;
const OVERSCAN = 8;

export interface VirtualRow<T> {
  item: T;
  key: string;
  style?: CSSProperties;
}

export interface UseVirtualListOptions {
  itemHeight?: number;
  containerHeight?: number;
  threshold?: number;
}

export interface UseVirtualListResult<T> {
  containerRef: RefObject<HTMLDivElement>;
  containerStyle: CSSProperties;
  listStyle: CSSProperties;
  rows: VirtualRow<T>[];
}

export function useVirtualList<T>(
  items: T[],
  itemKey: (item: T) => string,
  options?: UseVirtualListOptions,
): UseVirtualListResult<T> {
  const itemHeight = options?.itemHeight ?? DEFAULT_ITEM_HEIGHT;
  const containerHeight = options?.containerHeight ?? DEFAULT_CONTAINER_HEIGHT;
  const threshold = options?.threshold ?? VIRTUALIZE_THRESHOLD;
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = items.length > threshold;

  // Always called unconditionally (React's rules of hooks) — only
  // whether its output is used depends on shouldVirtualize below.
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => itemHeight,
    overscan: OVERSCAN,
  });

  const containerStyle: CSSProperties = { maxHeight: containerHeight, overflowY: "auto" };

  if (!shouldVirtualize) {
    return {
      containerRef,
      containerStyle,
      listStyle: {},
      rows: items.map((item) => ({ item, key: itemKey(item) })),
    };
  }

  return {
    containerRef,
    containerStyle,
    listStyle: { position: "relative", height: virtualizer.getTotalSize() },
    rows: virtualizer.getVirtualItems().map((virtualRow) => {
      const item = items[virtualRow.index] as T;
      return {
        item,
        key: itemKey(item),
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: virtualRow.size,
          transform: `translateY(${virtualRow.start}px)`,
        },
      };
    }),
  };
}

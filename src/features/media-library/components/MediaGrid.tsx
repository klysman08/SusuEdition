import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";

import { useScrollContainer } from "@/lib/scroll-container";

import { useElementWidth, useLibrary } from "../hooks";
import type { MediaLibraryStore } from "../store";
import { MediaTile, TileContent } from "./MediaTile";

function useGridLayout(width: number) {
  const compact = width < 640;
  const gap = compact ? 4 : 8;
  const minTile = compact ? 96 : 136;
  const cols = Math.max(3, Math.floor((width + gap) / (minTile + gap)));
  const tile = width > 0 ? (width - gap * (cols - 1)) / cols : minTile;
  return { gap, cols, rowHeight: tile + gap };
}

/**
 * Grade virtualizada e ordenável. Só as linhas visíveis (+ overscan) existem no DOM,
 * então 1.000 itens custam o mesmo que 50. Arrastar: mouse direto; toque com pressão longa.
 */
export function MediaGrid({ store }: { store: MediaLibraryStore }) {
  const order = useLibrary(store, (s) => s.order);
  const selectMode = useLibrary(store, (s) => s.selectMode);
  const scrollRef = useScrollContainer();
  const gridRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(gridRef);
  const { gap, cols, rowHeight } = useGridLayout(width);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Distância do topo da grade até o topo do conteúdo rolável.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scroller = scrollRef.current;
    if (!grid || !scroller) return;
    const margin = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    setScrollMargin(Math.round(margin));
  }, [scrollRef, width]);

  const rows = Math.ceil(order.length / cols);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual retorna funções não memoizáveis; uso intencional.
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over && e.active.id !== e.over.id) store.getState().move(String(e.active.id), String(e.over.id));
  };

  const activeItem = activeId ? store.getState().items[activeId] : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div ref={gridRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const start = row.index * cols;
            return (
              <div
                key={row.key}
                className="absolute top-0 left-0 grid w-full"
                style={{
                  transform: `translateY(${row.start - scrollMargin}px)`,
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap,
                }}
              >
                {order.slice(start, start + cols).map((id, j) => (
                  <MediaTile key={id} store={store} id={id} index={start + j} selectMode={selectMode} />
                ))}
              </div>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className="aspect-square w-full scale-105">
            <TileContent item={activeItem} index={order.indexOf(activeItem.id)} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ImageOff, Play, TriangleAlert } from "lucide-react";
import { memo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useLibrary } from "../hooks";
import type { LibraryItem, MediaLibraryStore } from "../store";

interface TileContentProps {
  item: LibraryItem;
  index: number;
  selected?: boolean;
  selectMode?: boolean;
  overlay?: boolean;
}

/** Conteúdo visual do tile — compartilhado pelo tile da grade e pelo "fantasma" do arraste. */
export function TileContent({ item, index, selected, selectMode, overlay }: TileContentProps) {
  const { t } = useTranslation();
  const notDecodable = item.kind === "video" && item.meta?.decodable === false;

  return (
    <div
      className={cn(
        "relative size-full overflow-hidden rounded-md bg-muted",
        overlay && "shadow-2xl ring-2 ring-primary",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {item.thumbUrl ? (
        <img
          src={item.thumbUrl}
          alt={item.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={(e) => (e.currentTarget.dataset.loaded = "true")}
          className={cn(
            "size-full object-cover opacity-0 transition-[opacity,transform] duration-300 data-[loaded=true]:opacity-100",
            selected && "scale-[0.92]",
          )}
        />
      ) : item.status === "pending" ? (
        <Skeleton className="size-full rounded-none" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
          <ImageOff className="size-5" aria-hidden />
          <span className="line-clamp-2 text-[10px] leading-tight">
            {item.status === "error" ? t("mediaLibrary.error") : item.name}
          </span>
        </div>
      )}

      <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums backdrop-blur-sm">
        {index + 1}
      </span>

      {item.kind === "video" && (
        <span className="pointer-events-none absolute right-1 bottom-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums backdrop-blur-sm">
          <Play className="size-2.5 fill-current" aria-hidden />
          {item.meta?.durationSec !== undefined ? formatDuration(item.meta.durationSec) : "…"}
        </span>
      )}

      {notDecodable && !selectMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="absolute top-1 right-1 rounded-full bg-amber-500 p-1 text-white">
              <TriangleAlert className="size-3" aria-label={t("mediaLibrary.notDecodable")} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("mediaLibrary.notDecodable")}</TooltipContent>
        </Tooltip>
      )}

      {selectMode && (
        <span
          className={cn(
            "absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border-2 border-white shadow transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "bg-black/25",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3} aria-hidden />}
        </span>
      )}
    </div>
  );
}

interface MediaTileProps {
  store: MediaLibraryStore;
  id: string;
  index: number;
  selectMode: boolean;
  onOpen?: (id: string) => void;
}

/** Tile ordenável. Assina apenas o próprio item: atualizar um item não re-renderiza a grade inteira. */
export const MediaTile = memo(function MediaTile({ store, id, index, selectMode, onOpen }: MediaTileProps) {
  const { t } = useTranslation();
  const item = useLibrary(store, (s) => s.items[id]);
  const selected = useLibrary(store, (s) => s.selected[id] === true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: selectMode,
  });

  if (!item) return null;

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(selectMode ? {} : listeners)}
      role={selectMode ? "checkbox" : "button"}
      aria-checked={selectMode ? selected : undefined}
      aria-label={`${t("mediaLibrary.position", { n: index + 1 })}: ${item.name}`}
      title={selectMode ? item.name : `${item.name} — ${t("mediaLibrary.dragHint")}`}
      onClick={selectMode ? () => store.getState().toggleSelected(id) : onOpen ? () => onOpen(id) : undefined}
      onKeyDown={(e) => {
        if (selectMode && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          store.getState().toggleSelected(id);
        } else if (onOpen && e.key === "Enter") {
          e.preventDefault();
          onOpen(id);
        } else {
          listeners?.onKeyDown?.(e);
        }
      }}
      className={cn(
        "aspect-square touch-manipulation rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
        selectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <TileContent item={item} index={index} selected={selected} selectMode={selectMode} />
    </div>
  );
});

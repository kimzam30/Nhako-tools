import { useRef, useState } from 'react';

/**
 * Drag to reorder, with the feedback that makes it legible.
 *
 * Extracted from Organize PDF, where the interaction was first built and then
 * fixed. Merge PDF, Split PDF and JPG to PDF all stage an ordered list of
 * things and all need the same gestures, and three more copies of this would
 * be three more chances to reintroduce the two defects it exists to prevent:
 *
 *   NO FEEDBACK. The original marked only the card being dragged. Nothing said
 *   where it would land, so the page simply appeared somewhere else on release
 *   and the numbers changed. `over` names the card being hovered and which
 *   side of it, and the caller draws the gap.
 *
 *   OFF-BY-ONE. The original inserted at the target's index in the ORIGINAL
 *   list, having already removed the dragged item, so dragging rightwards
 *   landed one place short of the pointer. The index here is computed against
 *   the list with the dragged item taken out, which is the only frame in which
 *   "before this card" and "after this card" mean the same thing from both
 *   directions.
 *
 * Nothing here touches the DOM or renders. The caller spreads `props(item)`
 * onto its card and decides what a lifted card and a live gap look like.
 */

export interface DragHandlers<T> {
  /** The new order, the item that moved, and its zero-based landing index. */
  onDrop(next: T[], moved: T, at: number): void;
  /** The drag began. Used to announce it; the visual state is handled here. */
  onLift?(item: T): void;
  /** The drag ended without a drop, e.g. Escape or a release off the grid. */
  onCancel?(): void;
}

/** How long a just-dropped card stays marked, in ms. */
const LANDED_MS = 900;

export function useDragOrder<T extends { id: string }>(
  items: readonly T[],
  handlers: DragHandlers<T>,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  /**
   * The dragged id, readable from the very next event.
   *
   * `dragId` state has not flushed when the first dragover arrives, so that
   * event read "nothing is being dragged" and marked no target. A long drag
   * corrects itself within a frame because dragover repeats, but a flick that
   * starts and ends over one card got no marker at all and fell back to
   * dropping before the target rather than where the pointer actually was.
   */
  const dragRef = useRef<string | null>(null);
  const landedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function clear() {
    dragRef.current = null;
    setDragId(null);
    setOver(null);
  }

  /** Call from the owner's unmount effect. */
  function dispose() {
    clearTimeout(landedTimer.current);
  }

  function reset() {
    clear();
    clearTimeout(landedTimer.current);
    setLanded(null);
  }

  function drop(targetId: string, after: boolean) {
    setOver(null);
    const id = dragRef.current;
    // Cleared before the early returns, so the dragEnd that follows every drop
    // does not then report the completed move as cancelled.
    dragRef.current = null;
    setDragId(null);
    if (!id || id === targetId) return;

    const moving = items.find((it) => it.id === id);
    if (!moving) return;
    const without = items.filter((it) => it.id !== id);
    const target = without.findIndex((it) => it.id === targetId);
    if (target < 0) return;

    const at = after ? target + 1 : target;
    const next = [...without];
    next.splice(at, 0, moving);
    handlers.onDrop(next, moving, at);

    // A short mark on the card that moved. Without it the grid reflows and
    // nothing says which of them is the one just dropped.
    setLanded(moving.id);
    clearTimeout(landedTimer.current);
    landedTimer.current = setTimeout(() => setLanded(null), LANDED_MS);
  }

  /** Spread onto each sortable card. */
  function props(item: T) {
    const dragging = dragId === item.id;
    const target = over?.id === item.id && dragRef.current !== null && dragRef.current !== item.id;

    return {
      draggable: true,
      'data-dragging': dragging || undefined,
      'data-drop-edge': target ? (over!.after ? 'after' : 'before') : undefined,

      onDragStart(e: React.DragEvent) {
        dragRef.current = item.id;
        setDragId(item.id);
        e.dataTransfer.effectAllowed = 'move';
        // Firefox starts no drag at all unless some data is set.
        try { e.dataTransfer.setData('text/plain', item.id); } catch { /* not fatal */ }
        handlers.onLift?.(item);
      },

      onDragOver(e: React.DragEvent) {
        if (!dragRef.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Which half of the card the pointer is over decides which side of it
        // the item lands on, so a drop goes where the gap is being drawn
        // rather than always before the target.
        const box = e.currentTarget.getBoundingClientRect();
        const after = e.clientX > box.left + box.width / 2;
        setOver((current) =>
          current?.id === item.id && current.after === after ? current : { id: item.id, after });
      },

      onDragLeave(e: React.DragEvent) {
        // Only once the pointer has actually left the card, not when it
        // crosses onto one of the buttons inside it.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver((current) => (current?.id === item.id ? null : current));
      },

      onDrop(e: React.DragEvent) {
        e.preventDefault();
        drop(item.id, over?.id === item.id ? over.after : false);
      },

      onDragEnd() {
        // Fires on a cancelled drag too, which is the only signal that the
        // item was picked up and put back down again.
        if (dragRef.current) handlers.onCancel?.();
        clear();
      },
    };
  }

  return { dragId, over, landed, props, clear, reset, dispose };
}

/** The class names for a card's drag states, shared so all four look alike. */
export function dragClass(dragging: boolean, landed: boolean): string {
  if (dragging) return 'border-dashed border-accent opacity-40';
  if (landed) return 'border-accent shadow-[0_0_0_2px_var(--accent-subtle)]';
  return 'border-border';
}

/** Position and colour of the gap an item will drop into. */
export const DROP_GAP = 'absolute inset-y-0 w-0.5 rounded-full bg-accent';

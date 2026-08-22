import type { WorldIntent } from './types';

/** Horizontal pixels the pointer must travel to advance the active piece by one column. */
export const CANVAS_DRAG_STEP_PX = 22;
/** Maximum pointer travel (in pixels) that still counts as a click rather than a drag. */
export const CANVAS_CLICK_MAX_PX = 8;

/**
 * Returns the ordered move intents produced by a horizontal drag of `deltaPx`.
 * Each full step dispatches one discrete column move in the dragged direction.
 */
export function canvasDragMoves(deltaPx: number, step: number = CANVAS_DRAG_STEP_PX): WorldIntent[] {
  if (step <= 0 || Math.abs(deltaPx) < step) return [];
  const direction: WorldIntent = deltaPx > 0 ? 'moveRight' : 'moveLeft';
  return Array.from({ length: Math.floor(Math.abs(deltaPx) / step) }, () => direction);
}

/** True when the pointer travel is small enough to count as a click (rotate) instead of a drag. */
export function isCanvasClick(deltaX: number, deltaY: number, max: number = CANVAS_CLICK_MAX_PX): boolean {
  return Math.abs(deltaX) <= max && Math.abs(deltaY) <= max;
}

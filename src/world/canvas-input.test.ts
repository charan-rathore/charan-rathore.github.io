import { describe, expect, it } from 'vitest';
import { CANVAS_DRAG_STEP_PX, canvasDragMoves, isCanvasClick } from './canvas-input';

describe('canvas pointer input', () => {
  it('emits one discrete move per full horizontal step in the dragged direction', () => {
    expect(canvasDragMoves(0)).toEqual([]);
    expect(canvasDragMoves(10)).toEqual([]);
    expect(canvasDragMoves(CANVAS_DRAG_STEP_PX)).toEqual(['moveRight']);
    expect(canvasDragMoves(CANVAS_DRAG_STEP_PX * 2 + 5)).toEqual(['moveRight', 'moveRight']);
    expect(canvasDragMoves(-CANVAS_DRAG_STEP_PX)).toEqual(['moveLeft']);
    expect(canvasDragMoves(-CANVAS_DRAG_STEP_PX * 3)).toEqual(['moveLeft', 'moveLeft', 'moveLeft']);
  });

  it('treats small pointer travel as a click and larger travel as a drag', () => {
    expect(isCanvasClick(0, 0)).toBe(true);
    expect(isCanvasClick(6, -7)).toBe(true);
    expect(isCanvasClick(9, 0)).toBe(false);
    expect(isCanvasClick(0, 12)).toBe(false);
  });
});

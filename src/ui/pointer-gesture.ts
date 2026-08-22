export type PointerGesture = 'moveLeft' | 'moveRight' | 'rotateClockwise' | null;

export function pointerGesture(deltaX: number, deltaY: number): PointerGesture {
  if (Math.abs(deltaX) >= 28 && Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'moveRight' : 'moveLeft';
  }
  return Math.hypot(deltaX, deltaY) < 12 ? 'rotateClockwise' : null;
}

import { describe, expect, it } from 'vitest';
import { pointerGesture } from './pointer-gesture';

describe('pointer gesture routing', () => {
  it('routes a stationary tap to rotation', () => {
    expect(pointerGesture(3, 4)).toBe('rotateClockwise');
  });

  it('routes deliberate horizontal drags without stealing vertical scroll', () => {
    expect(pointerGesture(-35, 5)).toBe('moveLeft');
    expect(pointerGesture(35, 5)).toBe('moveRight');
    expect(pointerGesture(8, 36)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { selectRendererProfile } from './renderer-profile';

describe('selectRendererProfile', () => {
  it('uses a one-device-pixel mobile tier without continuous presentation animation', () => {
    expect(selectRendererProfile('auto', 390)).toEqual({
      quality: 'low',
      dprCap: 1,
      animateTransitions: false,
      showCircuitDetails: false,
    });
  });

  it('keeps desktop detail unless reduced motion disables transitions', () => {
    expect(selectRendererProfile('auto', 1440, true)).toEqual({
      quality: 'high',
      dprCap: 1.75,
      animateTransitions: false,
      showCircuitDetails: true,
    });
  });

  it('honors explicit quality overrides', () => {
    expect(selectRendererProfile('high', 390).quality).toBe('high');
    expect(selectRendererProfile('low', 1440).quality).toBe('low');
  });
});

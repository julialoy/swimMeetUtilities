import { describe, it, expect } from 'vitest';
import { resolveLigatures } from '../ligatures';

describe('resolveLigatures', () => {
  it('restores lowercase "f" in an event name (Butterfly)', () => {
    expect(resolveLigatures('Girls 11-12 50 SC Meter Butterϐly')).toBe('Girls 11-12 50 SC Meter Butterfly');
  });

  it('restores lowercase "f" in swimmer names', () => {
    expect(resolveLigatures('Soϐia')).toBe('Sofia');
    expect(resolveLigatures('Crutchϐield')).toBe('Crutchfield');
    expect(resolveLigatures('Weisϐlog')).toBe('Weisflog');
  });

  it('handles multiple occurrences in one string', () => {
    expect(resolveLigatures('ϐlu ϐy')).toBe('flu fy');
  });

  it('leaves text without the substitute character unchanged', () => {
    expect(resolveLigatures('Boys 13-14 100 SC Meter IM')).toBe('Boys 13-14 100 SC Meter IM');
    expect(resolveLigatures('Freestyle')).toBe('Freestyle'); // uppercase F is unaffected
  });
});

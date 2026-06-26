import { describe, it, expect } from 'vitest';
import { Bottle } from '@/core/models/Bottle';

describe('Bottle', () => {
  it('reports size, free space and emptiness', () => {
    const b = new Bottle(0, 4, false, ['red', 'red']);
    expect(b.size).toBe(2);
    expect(b.freeSpace).toBe(2);
    expect(b.isEmpty).toBe(false);
    expect(b.isFull).toBe(false);
  });

  it('exposes the top color and top run length', () => {
    const b = new Bottle(0, 4, false, ['red', 'blue', 'blue']);
    expect(b.topColor).toBe('blue');
    expect(b.topRunLength).toBe(2);
  });

  it('detects monochrome and completeness', () => {
    const partial = new Bottle(0, 4, false, ['red', 'red']);
    expect(partial.isMonochrome).toBe(true);
    expect(partial.isComplete).toBe(false);

    const complete = new Bottle(1, 2, false, ['red', 'red']);
    expect(complete.isComplete).toBe(true);
  });

  it('adds and removes from the top', () => {
    const b = new Bottle(0, 4, false, ['red']);
    b.addTop('blue', 2);
    expect(b.segments).toEqual(['red', 'blue', 'blue']);
    const removed = b.removeTop(2);
    expect(removed).toEqual(['blue', 'blue']); // top-most first
    expect(b.segments).toEqual(['red']);
  });

  it('throws on overflow and over-removal', () => {
    const b = new Bottle(0, 2, false, ['red']);
    expect(() => b.addTop('blue', 5)).toThrow();
    expect(() => b.removeTop(5)).toThrow();
  });

  it('caps and uncaps', () => {
    const b = new Bottle(0, 2, false, ['red', 'red']);
    expect(b.capped).toBe(false);
    b.cap();
    expect(b.capped).toBe(true);
    b.uncap();
    expect(b.capped).toBe(false);
  });

  it('clones independently', () => {
    const b = new Bottle(0, 4, false, ['red']);
    const c = b.clone();
    c.addTop('blue', 1);
    expect(b.segments).toEqual(['red']);
    expect(c.segments).toEqual(['red', 'blue']);
  });
});

/**
 * SHEHSWAR ONE360 - UUIDv7 Generator Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { uuidv7, isUuidv7, extractUuidv7Timestamp } from './uuidv7.js';

describe('UUIDv7 Generator (RFC 9562)', () => {
  it('should generate valid UUIDv7 format matching standard regex', () => {
    const id = uuidv7();
    expect(isUuidv7(id)).toBe(true);
    // Check version 7 at position 14
    expect(id.charAt(14)).toBe('7');
    // Check RFC variant [8, 9, a, b] at position 19
    expect(['8', '9', 'a', 'b'].includes(id.charAt(19).toLowerCase())).toBe(true);
  });

  it('should generate lexicographically sorted identifiers over time', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      ids.push(uuidv7());
      if (i % 10 === 0) {
        await new Promise((r) => setTimeout(r, 2));
      }
    }

    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
  });

  it('should preserve monotonicity within the exact same millisecond', () => {
    const id1 = uuidv7();
    const id2 = uuidv7();
    const id3 = uuidv7();

    expect(id1 < id2).toBe(true);
    expect(id2 < id3).toBe(true);
  });

  it('should extract correct approximate millisecond timestamp from UUIDv7', () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();

    const extracted = extractUuidv7Timestamp(id);
    expect(extracted).toBeGreaterThanOrEqual(before);
    expect(extracted).toBeLessThanOrEqual(after);
  });
});

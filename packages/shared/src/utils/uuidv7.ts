/**
 * SHEHSWAR ONE360 - Cryptographically Secure UUIDv7 Generator (RFC 9562)
 *
 * Combines 48-bit timestamp (milliseconds since Unix epoch) with random bits
 * to produce time-ordered 128-bit UUIDs. Guarantees B-tree index insertion locality
 * in PostgreSQL while remaining globally unique and collision-free.
 */
import { randomBytes } from 'node:crypto';

let lastTimestamp = -1;
let sequenceCounter = 0;

export function uuidv7(): string {
  let timestamp = Date.now();

  // Handle same-millisecond ordering via 12-bit monotonic counter
  if (timestamp === lastTimestamp) {
    sequenceCounter = (sequenceCounter + 1) & 0xfff;
    if (sequenceCounter === 0) {
      // Counter overflow within same millisecond; wait for next millisecond
      while (timestamp <= lastTimestamp) {
        timestamp = Date.now();
      }
    }
  } else {
    lastTimestamp = timestamp;
    sequenceCounter = Math.floor(Math.random() * 0x400); // randomize initial counter offset
  }

  // 16 bytes (128 bits)
  const bytes = new Uint8Array(16);

  // Bytes 0-5: 48-bit timestamp (big-endian)
  bytes[0] = (timestamp / 0x10000000000) & 0xff;
  bytes[1] = (timestamp / 0x100000000) & 0xff;
  bytes[2] = (timestamp / 0x1000000) & 0xff;
  bytes[3] = (timestamp / 0x10000) & 0xff;
  bytes[4] = (timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;

  // Bytes 6-7: 4-bit version (0b0111 = 0x7) + 12-bit sequence counter
  bytes[6] = 0x70 | ((sequenceCounter >> 8) & 0x0f);
  bytes[7] = sequenceCounter & 0xff;

  // Bytes 8-15: 2-bit variant (0b10) + 62 random bits
  const randomPart = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    bytes[8 + i] = randomPart[i]!;
  }
  bytes[8] = 0x80 | (bytes[8]! & 0x3f); // Variant 10xxxxxx

  // Format as 8-4-4-4-12 hex string
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Validates whether a given string is a valid UUIDv7
 */
export function isUuidv7(uuid: string): boolean {
  if (typeof uuid !== 'string' || uuid.length !== 36) {
    return false;
  }
  // Format check: 8-4-4-4-12 with '7' at position 14 and [89abAB] at position 19
  const uuidv7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv7Regex.test(uuid);
}

/**
 * Extracts the millisecond timestamp embedded in a UUIDv7
 */
export function extractUuidv7Timestamp(uuid: string): number {
  if (!isUuidv7(uuid)) {
    throw new Error(`Invalid UUIDv7 identifier: ${uuid}`);
  }
  const cleanHex = uuid.replace(/-/g, '').slice(0, 12);
  return parseInt(cleanHex, 16);
}

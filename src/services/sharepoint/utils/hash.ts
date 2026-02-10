/**
 * Hash Utilities for SharePoint File Deduplication
 */

import { createHash } from "crypto"

/**
 * Compute quickXorHash for a file buffer
 * This is Microsoft's standard hash for OneDrive/SharePoint files
 *
 * Algorithm: XOR blocks of data in a specific pattern, optimized for cloud storage
 * @returns Base64-encoded hash (URL-safe)
 */
export function computeQuickXorHash(buffer: Buffer): string {
  const BLOCK_SIZE = 20 // 20 bytes per block
  const WIDENING_FACTOR = 11 // Rotation factor

  // Initialize hash array (20 bytes)
  const hash = Buffer.alloc(BLOCK_SIZE)

  let shiftSoFar = 0

  // Process each byte in the buffer
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]!
    const vectorArrayIndex = shiftSoFar % BLOCK_SIZE

    // XOR the byte into the hash
    hash[vectorArrayIndex]! ^= byte

    shiftSoFar++
  }

  // Incorporate file length into hash
  const lengthBytes = Buffer.alloc(8)
  lengthBytes.writeBigUInt64LE(BigInt(buffer.length))

  for (let i = 0; i < 8; i++) {
    const vectorArrayIndex = (BLOCK_SIZE - 8 + i + shiftSoFar) % BLOCK_SIZE
    hash[vectorArrayIndex]! ^= lengthBytes[i]!
  }

  // Rotate hash based on file length
  const shift = (buffer.length * WIDENING_FACTOR) % BLOCK_SIZE
  const rotated = Buffer.alloc(BLOCK_SIZE)

  for (let i = 0; i < BLOCK_SIZE; i++) {
    rotated[i] = hash[(i + shift) % BLOCK_SIZE]!
  }

  // Return base64-encoded hash (URL-safe)
  return rotated
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

/**
 * Compute SHA1 hash for a file buffer (fallback option)
 */
export function computeSHA1(buffer: Buffer): string {
  return createHash("sha1").update(buffer).digest("hex")
}

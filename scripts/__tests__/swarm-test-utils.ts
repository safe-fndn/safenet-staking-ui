export const text = (s: string) => new TextEncoder().encode(s)
export const hex = (b: Uint8Array) => Buffer.from(b).toString("hex")

/** Deterministic pseudo-random bytes (xorshift32). */
export function pseudoRandom(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length)
  let x = seed
  for (let i = 0; i < length; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    out[i] = x & 0xff
  }
  return out
}

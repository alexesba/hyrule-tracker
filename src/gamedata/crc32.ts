// CRC-32 (IEEE, as zlib), the hash the game's play log uses for actor names.
// Checked against option.sav: crc32("Player_Child") is the attacker of every
// "enemy defeated" entry in two real logs. See docs/save-format.md, "Play log".
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(input: string | Uint8Array): number {
  const d = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

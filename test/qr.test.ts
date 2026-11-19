import { describe, expect, it } from 'vitest';
import { qrPath, qrTarget } from '../src/renderer/qr.js';

describe('second screen QR', () => {
  const urls = ['http://192.168.0.10:8787/', 'http://10.0.0.5:8787/', 'http://172.20.0.1:8787/'];
  it('encodes the first (best ranked) address until the user picks another', () => {
    expect(qrTarget(urls, undefined)).toBe(urls[0]);
    expect(qrTarget(urls, urls[1])).toBe(urls[1]);
  });
  it('falls back to the first address when the picked one is gone', () => {
    expect(qrTarget(urls, 'http://192.168.1.99:8787/')).toBe(urls[0]);
    expect(qrTarget([], urls[0])).toBeUndefined();
  });
  it('draws the code inside a 4-module quiet zone', () => {
    const { size, d } = qrPath(urls[0]);
    expect(size).toBeGreaterThanOrEqual(21 + 8);
    expect(d.startsWith('M4 4h7v1h-7z')).toBe(true); // top edge of the top-left finder pattern
  });
});

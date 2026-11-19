// QR code for the Second Screen page, built offline in the renderer (no network, no image service).
import qrcode from 'qrcode-generator';

/** The address the QR encodes: the one the user picked while it's still offered, else the first (the best ranked). */
export function qrTarget(urls: readonly string[], chosen: string | undefined): string | undefined {
  return chosen && urls.includes(chosen) ? chosen : urls[0];
}

/** Quiet zone the QR spec asks for around the code, in modules. */
const QUIET = 4;

/** Side of the square (quiet zone included) and one SVG path with the dark modules, one rectangle per horizontal run. */
export function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      let run = 1;
      while (col + run < count && qr.isDark(row, col + run)) run++;
      d += `M${col + QUIET} ${row + QUIET}h${run}v1h-${run}z`;
      col += run - 1;
    }
  }
  return { size: count + QUIET * 2, d };
}

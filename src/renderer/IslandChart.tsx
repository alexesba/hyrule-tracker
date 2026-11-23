import { useEffect, useRef } from 'react';
import { islandMapPoint, islandShrines, type IslandPoint } from '../core/totk-island';

const areas: { fill: string; points: IslandPoint[] }[] = [
  { fill: '#4b5239', points: [[34, 9], [48, 7], [55, 4], [66, 6], [67, 21], [60, 30], [48, 31], [42, 26], [35, 28], [26, 23], [30, 19]] },
  { fill: '#4a5941', points: [[30, 29], [42, 35], [47, 42], [48, 47], [59, 51], [65, 60], [61, 66], [49, 64], [40, 61], [31, 64], [28, 59], [19, 58], [21, 49], [17, 43], [22, 34]] },
  { fill: '#515a3e', points: [[10, 50], [18, 51], [27, 61], [28, 70], [38, 76], [42, 82], [40, 89], [23, 89], [12, 82], [11, 73], [14, 67], [5, 59]] },
  { fill: '#576247', points: [[31, 69], [43, 66], [49, 67], [63, 70], [67, 74], [75, 77], [76, 86], [65, 91], [55, 96], [48, 94], [49, 86], [40, 84], [38, 77]] },
  { fill: '#657367', points: [[71, 33], [80, 40], [87, 46], [92, 55], [91, 66], [85, 72], [76, 71], [73, 64], [67, 61], [67, 53], [70, 48], [65, 42]] },
  { fill: '#747864', points: [[47, 77], [53, 76], [57, 80], [56, 85], [58, 91], [54, 96], [48, 94], [44, 87], [45, 80]] },
];

const routeToTemple: IslandPoint[] = [
  islandShrines[0].at!, [205, 1030], [125, 1165], [25, 1315], islandShrines[1].at!,
  [180, 1635], [350, 1620], [470, 1670], [592, 1610], [690, 1450], islandShrines[2].at!, [750, 1210], [453, 800],
];

export function IslandChart({ route = false }: { route?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(8, 0, 0, 8, 0, 0);
    ctx.clearRect(0, 0, 100, 100);
    const trace = (points: IslandPoint[], close = false) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      if (close) ctx.closePath();
    };
    if (route) {
      trace(routeToTemple.map(islandMapPoint));
      ctx.setLineDash([1.1, 0.7]);
      ctx.lineWidth = 0.53;
      ctx.strokeStyle = '#261c15';
      ctx.stroke();
      ctx.lineWidth = 0.30;
      ctx.strokeStyle = '#ffe3a0';
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    for (const { fill, points } of areas) {
      trace(points.map(([x, y]) => [x + 0.8, y + 2]), true);
      ctx.fillStyle = '#172524';
      ctx.fill();
      trace(points, true);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 0.24;
      ctx.strokeStyle = '#92957a';
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
      const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
      ctx.lineWidth = 0.14;
      ctx.strokeStyle = '#b9b68d66';
      for (const scale of [0.48, 0.62, 0.76, 0.9, 1.03]) {
        trace(points.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]), true);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [route]);
  return <canvas className="island-chart" ref={canvas} width={800} height={800} aria-hidden="true" />;
}

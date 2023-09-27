import { Image, Point } from "../src";

export function randomWithSeed(seed: number): number {
  // Jumble seed
  seed = seed ^ 61 ^ (seed >> 16);
  seed += seed << 3;
  seed ^= seed >> 4;

  return Math.sin(seed) / 2 + 0.5;
}

export class Profiler {
  private start = process.hrtime.bigint();

  public get elapsed(): number {
    const elapsed = process.hrtime.bigint() - this.start;
    return Number(elapsed) / 1_000_000;
  }

  public reset(): void {
    this.start = process.hrtime.bigint();
  }

  public log(message: string): void {
    console.log(`[${this.elapsed.toFixed(3)}ms] ${message}`);
    this.reset();
  }
}

const profiler = new Profiler();
const profilerTotal = new Profiler();

const image = new Image(1000, 1000);
const drawer = image.drawer;
profiler.log('Image initialized');

drawer.fill('#000000');
profiler.log('Image filled');

drawer.drawCircle([50, 50], 50, '#FFFFFF');
drawer.drawFilledCircle([160, 50], 50, '#FFFFFF');
drawer.drawRectangle([220, 0], [320, 100], '#FFFFFF');
drawer.drawFilledRectangle([330, 0], [430, 100], '#FFFFFF');
drawer.drawLine([440, 0], [540, 100], '#FFFFFF');
drawer.drawTriangle([[550, 0], [550, 100], [650, 100]], '#FFFFFF');
profiler.log('Primitive shapes drawn');


drawer.drawFilledCircle([50, 170], 50, '#FF000088');
drawer.drawFilledCircle([100, 200], 50, '#0000FF88');

drawer.blending = false;
drawer.drawFilledRectangle([160, 105], [625, 250], '#00000000');
for (let i = 0; i < 10; i++) {
  const r = 20;
  drawer.drawFilledCircle([i * (r*2 + 2) + 200, 135], r, `hsl(${i * 36}, 100, 100)`);
  drawer.drawFilledCircle([i * (r*2 + 2) + 200, 177], r, `hsl(360, ${i * 10}, 100)`);
  drawer.drawFilledCircle([i * (r*2 + 2) + 200, 219], r, `hsl(360, 100, ${i * 10})`);
}
drawer.blending = true;
profiler.log('Filled circles drawn (hsl)');

let linesDrawn = 0;
for (let alpha = 0; alpha < Math.PI * 2; alpha += Math.PI / 10) {
  const cx = 900;
  const cy = 100;
  const r = 100;
  drawer.drawLine(
    [cx + Math.cos(alpha) * r, cy + Math.sin(alpha) * r],
    [cx + Math.cos(alpha + Math.PI) * r, cy + Math.sin(alpha + Math.PI) * r],
    '#FF00FF'
  );
  linesDrawn++;
}

profiler.log(`Lines drawn (${linesDrawn} lines)`);

drawer.blending = false;
for (let i = 0; i <= 1; i += 0.1) {
  drawer.drawFilledCircle([i * 900 + 50, 300], 40, [255, 255, 255, i * 255]);
}
drawer.blending = true;

profiler.log('Circle array drawn (11 circles)');

let bezierPoints: Point[] = [];
for (let i = 0; i <= 1000; i += 100) {
  bezierPoints.push([i, randomWithSeed(i) * 200 + 350]);
}
profiler.log('Bezier points generated');

drawer.lineThickness = 3;
drawer.drawPath(bezierPoints, '#AAAAAA88');
drawer.lineThickness = 1;

profiler.log('Bezier points drawn');

drawer.drawBezier(bezierPoints, '#FFFFFF');

profiler.log('Bezier curve drawn');
for (let j = 0; j < 3; j++) {
  const polygonPoints: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const r = randomWithSeed(i*(j + 2)) * 100 + 50;
    polygonPoints.push([
      Math.cos(i / 10 * Math.PI * 2) * r + 150 + (j * 300),
      Math.sin(i / 10 * Math.PI * 2) * r + 750,
    ])
  }
  polygonPoints.push(polygonPoints[0])
  drawer.drawFilledPath(polygonPoints, '#FFFFFF');
  profiler.log(`Polygon ${j + 1} drawn`);
}

profilerTotal.log('Total time');

await image.writeImage(Bun.file('_temp.png'), 'png');
profiler.log('Image written');


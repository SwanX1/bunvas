import { Color, Image, ImageDrawer, Point } from "../src";

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

const benchmarks: { name: string, width: number, height: number, exec: (drawer: ImageDrawer) => void }[] = [
  {
    name: 'Image creation (1000x1000) [3.9MB]',
    width: 1000,
    height: 1000,
    exec: (drawer: ImageDrawer) => { new Image(1000, 1000); },
  },
  {
    name: 'Image creation (10000x10000) [390MB]',
    width: 10000,
    height: 10000,
    exec: (drawer: ImageDrawer) => { new Image(10000, 10000); },
  },
  {
    name: 'Clear image [#00000000] (1000x1000)',
    width: 1000,
    height: 1000,
    exec: (drawer: ImageDrawer) => {
      drawer.fill('#00000000');
    },
  },
  {
    name: 'Clear image [Random color] (1000x1000)',
    width: 1000,
    height: 1000,
    exec: (drawer: ImageDrawer) => {
      drawer.fill(`hsl(${Math.floor(Math.random() * 360)}, 100, 50)`);
    },
  },
  {
    name: 'Draw 100 random lines (1000x1000)',
    width: 1000,
    height: 1000,
    exec: (drawer: ImageDrawer) => {
      for (let i = 0; i < 100; i++) {
        const color = `hsl(${Math.floor(Math.random() * 360)}, 100, 50)` as Color;
        const start = [Math.random() * 1000, Math.random() * 1000] as Point;
        const end = [Math.random() * 1000, Math.random() * 1000] as Point;
        drawer.drawLine(start, end, color);
      }
    },
  },
  {
    name: 'Draw 10 random filled rectangles (1000x1000)',
    width: 1000,
    height: 1000,
    exec: (drawer: ImageDrawer) => {
      for (let i = 0; i < 10; i++) {
        const color = `hsl(${Math.floor(Math.random() * 360)}, 100, 50)` as Color;
        const start = [Math.random() * 1000, Math.random() * 1000] as Point;
        const end = [Math.random() * 1000, Math.random() * 1000] as Point;
        drawer.drawFilledRectangle(start, end, color);
      }
    },
  },
  {
    name: 'Draw 10 random filled circles (1000x1000)',
    width: 1000,
    height: 1000,
    exec: (drawer: ImageDrawer) => {
      for (let i = 0; i < 10; i++) {
        const color = `hsl(${Math.floor(Math.random() * 360)}, 100, 50)` as Color;
        const center = [Math.random() * 1000, Math.random() * 1000] as Point;
        const radius = Math.random() * 10;
        drawer.drawFilledCircle(center, radius, color);
      }
    },
  },
];

const benchmarkResults: { name: string, ms: number }[] = [];

for (const benchmark of benchmarks) {
  console.log(`Benchmark: ${benchmark.name}`);
  let total = 0;
  let count = 0;
  for (let i = 0; i < 10; i++) {
    const image = new Image(benchmark.width, benchmark.height);
    const drawer = image.drawer;
    profiler.reset();
    benchmark.exec(drawer);
    total += profiler.elapsed;
    count++;
  }
  const average = total / count;
  console.log(`Average: ${average.toFixed(3)}ms`);
  console.log();
  benchmarkResults.push({ name: benchmark.name, ms: average });
}

console.log('Benchmark results:');
const largestName = benchmarkResults.reduce((prev, curr) => Math.max(prev, curr.name.length), 0);
for (const result of benchmarkResults) {
  console.log(`  ${(result.name + ':').padEnd(largestName + 1, ' ')} ${result.ms.toFixed(3)}ms`);
}
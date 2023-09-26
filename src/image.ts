import { SpawnOptions } from 'bun';

export type Color = ColorArray | HexColor | HSLColor;
export type ColorArray = [r: number, g: number, b: number, a?: number];
export type FullColorArray = [r: number, g: number, b: number, a: number];
export type HexColor = `#${string}`;
export type HSLColor = `hsl(${number}, ${number}, ${number})` | `hsl(${number},${number},${number})`;
export type Point = [x: number, y: number];
export type Triangle = [a: Point, b: Point, c: Point];

export class Image {
  private readonly buffer: Uint8ClampedArray;
  private readonly ffmpegPath: string;
  public readonly unsafe: { readonly buffer: Uint8ClampedArray, readonly util: typeof Image.util };

  constructor(
    public readonly width: number,
    public readonly height: number,
    options: {
      ffmpegPath?: string;
    } = {}
  ) {
    this.buffer = new Uint8ClampedArray(width * height * 4);
    this.ffmpegPath = options.ffmpegPath ?? 'ffmpeg';

    const unsafeBuffer = this.buffer;
    const unsafeUtil = Image.util;
    this.unsafe = {
      get buffer() { return unsafeBuffer },
      get util() { return unsafeUtil },
    };
  }

  private _drawer?: ImageDrawer;
  public get drawer(): ImageDrawer {
    return this._drawer ??= new ImageDrawer(this);
  }

  public get(pixel: Point): FullColorArray {
    const [x, y] = pixel;
    const index = (y * this.width + x) * 4;
    return [
      this.buffer[index + 0],
      this.buffer[index + 1],
      this.buffer[index + 2],
      this.buffer[index + 3],
    ];
  }

  public set(pixel: Point, color: Color): void {
    const colorNormalized = this.unsafe.util.toColor(color);
    const [x, y] = pixel.map(Math.round);

    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }

    const index = (y * this.width + x) * 4;
    this.buffer[index + 0] = colorNormalized[0];
    this.buffer[index + 1] = colorNormalized[1];
    this.buffer[index + 2] = colorNormalized[2];
    this.buffer[index + 3] = colorNormalized[3];
  }

  /** Sets a pixel with alpha blending */
  public add(pixel: Point, color: Color): void {
    const currentColor = this.get(pixel);
    const colorNormalized = this.unsafe.util.toColor(color);

    const alpha = colorNormalized[3] / 255;
    const alphaComplement = 1 - alpha;

    const [r, g, b, a] = currentColor;
    const [r2, g2, b2, a2] = colorNormalized;

    const r3 = Math.round(r * alphaComplement + r2 * alpha);
    const g3 = Math.round(g * alphaComplement + g2 * alpha);
    const b3 = Math.round(b * alphaComplement + b2 * alpha);
    const a3 = a + a2 * alphaComplement;

    this.set(pixel, [r3, g3, b3, a3]);
  }

  public writeImage(output: SpawnOptions.Readable, codec?: 'png' | 'mjpeg' | 'libwebp'): Promise<void> {
    return this.unsafe.util.writeImage(this.buffer, output, { width: this.width, height: this.height, codec, ffmpegPath: this.ffmpegPath });
  }

  private static util = {
    toColor(color: Color): FullColorArray {
      if (typeof color !== 'string') {
        if (!Array.isArray(color) || color.length !== 3 && color.length !== 4) {
          throw new Error('Invalid color');
        }

        return (color.length === 3 ? [...color, 255] : color) as [number, number, number, number];
      }

      if (color.startsWith('hsl(')) {
        const match = color.match(/^hsl\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) {
          throw new Error('Invalid color');
        }

        const h = parseInt(match[1]);
        const s = parseInt(match[2]);
        const l = parseInt(match[3]);

        const c = l / 100 * s / 100;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l / 100 - c;

        let r = 0;
        let g = 0;
        let b = 0;

        if (h < 60) {
          r = c;
          g = x;
        } else if (h < 120) {
          r = x;
          g = c;
        } else if (h < 180) {
          g = c;
          b = x;
        } else if (h < 240) {
          g = x;
          b = c;
        } else if (h < 300) {
          r = x;
          b = c;
        } else if (h < 360) {
          r = c;
          b = x;
        }

        return [
          Math.round((r + m) * 255),
          Math.round((g + m) * 255),
          Math.round((b + m) * 255),
          255,
        ];
      } else if (color.startsWith('#')) {
        if (color.length !== 7 && color.length !== 9) {
          throw new Error('Invalid color');
        }
        
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
  
        return [r, g, b, a];
      } else {
        throw new Error('Invalid color');
      }
    },

    async writeImage(buffer: Uint8ClampedArray, output: SpawnOptions.Readable, options: { width: number, height: number, codec?: 'png' | 'mjpeg' | 'libwebp', ffmpegPath?: string }): Promise<void> {
      if (Bun.which('ffmpeg') === null) {
        throw new Error('ffmpeg is not installed');
      }
      if (Number.isInteger(options.width) === false || options.width <= 0) {
        throw new Error('Invalid width');
      }

      if (Number.isInteger(options.height) === false || options.height <= 0) {
        throw new Error('Invalid height');
      }

      options.codec ??= 'png';

      if (!['png', 'mjpeg', 'libwebp'].includes(options.codec)) {
        throw new Error('Invalid codec');
      }

      const child = Bun.spawn({
        cmd: [
          options.ffmpegPath ?? 'ffmpeg',
          '-hide_banner',
          '-v', 'quiet',

          // Input options
          '-f', 'rawvideo',
          '-pixel_format', 'rgba',
          '-video_size', `${options.width}x${options.height}`,
          '-r', '1',
          '-i', '-',

          // Output options
          '-f', 'image2',
          '-codec:v', options.codec,
          '-frames:v', '1',
          '-'
        ],
        stdin: buffer,
        stdout: output,
        stderr: 'ignore',
      });

      if ((await child.exited) !== 0) {
        throw new Error('Failed to write image');
      }
    }
  };
}

export class ImageDrawer {
  public blending: boolean = true;
  public lineThickness: number = 1;
  private temporaryBuffer: Map<number, Color> = new Map();
  private flushDisablers: number = 0;
  
  constructor(public readonly image: Image) {}

  private setPixel(pixel: Point, color: Color): void {
    if (pixel[0] < 0 || pixel[0] >= this.image.width || pixel[1] < 0 || pixel[1] >= this.image.height) {
      return;
    }

    if (this.temporaryBuffer === null) {
      this.temporaryBuffer = new Map();
    }

    const [x, y] = pixel.map(Math.round);
    const index = (y * this.image.width + x);
    this.temporaryBuffer.set(index + 0, color);
  }

  protected flush(): void {
    if (this.flushDisablers !== 0) {
      return;
    }

    for (const [index, color] of this.temporaryBuffer) {
      const pixel = [index % this.image.width, Math.floor(index / this.image.width)] as Point;

      if (this.blending) {
        this.image.add(pixel, color);
      } else {
        this.image.set(pixel, color);
      }
    }

    this.temporaryBuffer.clear();
  }

  /** Implements [Bresenham's line algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm) */
  public drawLine(start: Point, end: Point, color: Color): void {
    let [x0, y0] = start.map(Math.round);
    const [x1, y1] = end.map(Math.round);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);

    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;

    while (true) {
      if (this.lineThickness > 1) {
        this.flushDisablers++;
        this.drawFilledCircle([x0, y0], this.lineThickness / 2, color);
        this.flushDisablers--;
      } else {
        this.setPixel([x0, y0], color);
      }

      if (x0 === x1 && y0 === y1) {
        break;
      }

      const e2 = 2 * err;

      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }

      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    this.flush();
  }

  public drawFilledRectangle(start: Point, end: Point, color: Color): void {
    const [x0, y0] = start;
    const [x1, y1] = end;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        this.setPixel([x, y], color);
      }
    }

    this.flush();
  }

  public drawRectangle(start: Point, end: Point, color: Color): void {
    const [x0, y0] = start;
    const [x1, y1] = end;

    for (let x = x0; x <= x1; x++) {
      this.setPixel([x, y0], color);
      this.setPixel([x, y1], color);
    }

    for (let y = y0; y <= y1; y++) {
      this.setPixel([x0, y], color);
      this.setPixel([x1, y], color);
    }

    this.flush();
  }

  /** Implements Bresenham's circle algorithm */
  public drawCircle(center: Point, radius: number, color: Color): void {
    const [xc, yc] = center;
    let y = radius;
    let d = 3 - 2 * radius;

    for (let x = 0; x <= y; x++) {
      this.setPixel([xc + x, yc + y], color);
      this.setPixel([xc - x, yc + y], color);
      this.setPixel([xc + x, yc - y], color);
      this.setPixel([xc - x, yc - y], color);
      this.setPixel([xc + y, yc + x], color);
      this.setPixel([xc - y, yc + x], color);
      this.setPixel([xc + y, yc - x], color);
      this.setPixel([xc - y, yc - x], color);

      if (d > 0) {
        y--;
        d = d + 4 * (x - y) + 10;
      } else {
        d = d + 4 * x + 6;
      }
    }

    this.flush();
  }

  public drawFilledCircle(center: Point, radius: number, color: Color): void {
    const [xc, yc] = center;
    let y = radius;
    let d = 3 - 2 * radius;

    for (let x = 0; x <= y; x++) {
      for (let i = xc - x; i <= xc + x; i++) {
        this.setPixel([i, yc + y], color);
        this.setPixel([i, yc - y], color);
      }

      for (let i = xc - y; i <= xc + y; i++) {
        this.setPixel([i, yc + x], color);
        this.setPixel([i, yc - x], color);
      }

      if (d > 0) {
        y--;
        d = d + 4 * (x - y) + 10;
      } else {
        d = d + 4 * x + 6;
      }
    }

    this.flush();
  }

  /** This function implements scanline rasterization */
  public drawTriangle(triangle: Triangle, color: Color): void {
    const [a, b, c] = triangle;

    const [x0, y0] = a;
    const [x1, y1] = b;
    const [x2, y2] = c;

    let dx1 = (x1 - x0) / (y1 - y0);
    const dx2 = (x2 - x0) / (y2 - y0);

    let xStart = x0;
    let xEnd = x0;

    for (let y = y0; y < y1; y++) {
      for (let x = Math.round(xStart); x <= Math.round(xEnd); x++) {
        this.setPixel([x, y], color);
      }

      xStart += dx1;
      xEnd += dx2;
    }

    dx1 = (x2 - x1) / (y2 - y1);
    xEnd = x1;

    for (let y = y1; y < y2; y++) {
      for (let x = Math.round(xStart); x <= Math.round(xEnd); x++) {
        this.setPixel([x, y], color);
      }

      xStart += dx1;
      xEnd += dx2;
    }

    this.flush();
  }

  public drawPath(points: Point[], color: Color): void {
    if (points.length < 2) {
      throw new Error('Invalid points');
    }

    let lastPoint = points[0];

    this.flushDisablers++;
    for (const point of points.slice(1)) {
      this.drawLine(lastPoint, point, color);
      lastPoint = point;
    }
    this.flushDisablers--;

    this.flush();
  }

  public drawBezier(points: Point[], color: Color, step?: number): void {
    if (points.length < 2) {
      throw new Error('Invalid points');
    }

    let lastPoint = points[0];

    const [x0, y0] = points.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1])]);
    const [x1, y1] = points.reduce((a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
    step ??= 1 / Math.abs(Math.abs(x1 - x0) - Math.abs(y1 - y0));

    this.flushDisablers++;
    for (let t = step; t <= 1; t += step) {
      const point = lerpPoints(points, t);
      this.drawLine(lastPoint, point, color);
      lastPoint = point;
    }
    this.flushDisablers--;

    this.flush();
  }
  
  /** Fills the whole image */
  public fill(color: Color): void {
    // Force flush without writing
    this.temporaryBuffer.clear();
    // Fill the image
    const normalizedColor = this.image.unsafe.util.toColor(color);
    for (let i = 0; i < this.image.unsafe.buffer.length; i += 4) {
      this.image.unsafe.buffer.set(normalizedColor, i);
    }
  }
}

function lerpPoints(points: Point[], t: number): Point {
  let result: Point[] = [];

  while (points.length > 1) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];

      result.push([
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t,
      ]);
    }

    points = result;
    result = [];
  }

  return points[0];
}

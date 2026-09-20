// `gifenc` ships no type declarations. Only what tour-recording.ts calls is
// declared here.
declare module "gifenc" {
  export type Palette = number[][];

  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number; repeat?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  const gifenc: {
    GIFEncoder(): GifEncoder;
    quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: "rgb565" | "rgb444" | "rgba4444" }): Palette;
    applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: "rgb565" | "rgb444" | "rgba4444"): Uint8Array;
  };
  export default gifenc;
}

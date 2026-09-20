import { spawn } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import gifenc from "gifenc";
import { PNG } from "pngjs";

// `gifenc` is a CommonJS bundle whose exports Node cannot see by name.
const { GIFEncoder, applyPalette, quantize } = gifenc;

// A recording built from photographs. The screen is photographed at each
// step of a story and every photograph is held for as long as a reader
// needs to take it in, so the recording is as long as the story and not as
// long as the waits between its steps: a stage that takes forty seconds to
// start costs one photograph.
//
// It is not a video of the browser. The browser's own video would carry
// the waits, and it could not be masked, so a path covered in a still would
// be printed in the moving picture. A photograph is masked as the
// documentation stills are.

/** What a recording may be. The README carries the GIF, where a video does
 * not play, and GitHub is slow to load a large one. The site limits its
 * video to 8 MB. */
export const LIMITS = {
  gifBytes: 3 * 1024 * 1024,
  webmBytes: 8 * 1024 * 1024,
  width: 1280,
  seconds: 20,
  framesPerSecond: 12,
} as const;

/** One photograph and how long the recording holds it. */
export interface Photograph {
  png: Buffer;
  /** The same screen as a JPEG, for the WebM: see writeWebm. */
  jpeg: Buffer;
  holdMs: number;
}

/** Milliseconds a photograph may be held for at the frame rate the limit
 * allows: below it, the recording would show more frames a second than it
 * may. */
const SHORTEST_HOLD_MS = Math.ceil(1000 / LIMITS.framesPerSecond);

export function durationSeconds(photographs: Photograph[]): number {
  return photographs.reduce((total, photograph) => total + photograph.holdMs, 0) / 1000;
}

/** The problems with a recording's photographs, before anything is
 * encoded. Empty when it may be written. */
export function problemsWith(photographs: Photograph[]): string[] {
  const problems: string[] = [];
  if (photographs.length === 0) problems.push("no photographs");
  if (durationSeconds(photographs) > LIMITS.seconds) {
    problems.push(`${durationSeconds(photographs)} s long, at most ${LIMITS.seconds}`);
  }
  for (const [index, photograph] of photographs.entries()) {
    if (photograph.holdMs < SHORTEST_HOLD_MS) {
      problems.push(`photograph ${index + 1} is held for ${photograph.holdMs} ms, at least ${SHORTEST_HOLD_MS} (${LIMITS.framesPerSecond} frames a second)`);
    }
    const { width } = PNG.sync.read(photograph.png);
    if (width !== LIMITS.width) problems.push(`photograph ${index + 1} is ${width} px wide, not ${LIMITS.width}`);
  }
  return problems;
}

/** A GIF of the photographs. One palette a photograph: a story that changes
 * colour between steps (a card turning from one state to another) would
 * lose it under a shared one. */
export async function writeGif(photographs: Photograph[], file: string): Promise<number> {
  const encoder = GIFEncoder();
  for (const photograph of photographs) {
    const { width, height, data } = PNG.sync.read(photograph.png);
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const palette = quantize(rgba, 256);
    encoder.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay: photograph.holdMs });
  }
  encoder.finish();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, encoder.bytes());
  return (await stat(file)).size;
}

/** The ffmpeg Playwright installs for its own videos. It can write WebM
 * and nothing else, which is all the site needs: this repository does not
 * depend on an ffmpeg of its own. */
async function playwrightFfmpeg(): Promise<string> {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? (process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "ms-playwright")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
        : path.join(os.homedir(), ".cache", "ms-playwright"));
  const installed = (await readdir(root)).filter((name) => name.startsWith("ffmpeg-")).sort();
  const latest = installed.at(-1);
  if (!latest) throw new Error(`Playwright's ffmpeg is not installed under ${root}; run "npx playwright install ffmpeg"`);
  const binary = path.join(root, latest, process.platform === "win32" ? "ffmpeg-win64.exe" : process.platform === "darwin" ? "ffmpeg-mac" : "ffmpeg-linux");
  await stat(binary);
  return binary;
}

/** A WebM of the photographs, at the frame rate the limit allows: each
 * photograph is sent to ffmpeg as many times as its hold covers. Sent as
 * JPEG, because the ffmpeg Playwright installs can decode nothing else of
 * the formats a screenshot comes in. */
export async function writeWebm(photographs: Photograph[], file: string): Promise<number> {
  const ffmpeg = await playwrightFfmpeg();
  await mkdir(path.dirname(file), { recursive: true });
  const child = spawn(ffmpeg, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(LIMITS.framesPerSecond), "-i", "pipe:0",
    "-c:v", "libvpx", "-b:v", "600k", "-crf", "30", "-pix_fmt", "yuv420p",
    file,
  ], { stdio: ["pipe", "ignore", "pipe"] });
  let errors = "";
  child.stderr.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
  const finished = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${errors}`))));
  });
  for (const photograph of photographs) {
    const copies = Math.max(1, Math.round((photograph.holdMs / 1000) * LIMITS.framesPerSecond));
    for (let copy = 0; copy < copies; copy += 1) {
      if (!child.stdin.write(photograph.jpeg)) await new Promise<void>((resolve) => child.stdin.once("drain", resolve));
    }
  }
  child.stdin.end();
  await finished;
  return (await stat(file)).size;
}
// A delivery test: no workspace symlinks or development dependencies can help.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import WebSocket from "ws";

const cliRoot = fileURLToPath(new URL("../", import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, "Run this through npm run smoke:package so it uses the selected npm runtime.");
const execute = promisify(execFile);
const area = await mkdtemp(path.join(os.tmpdir(), "osw-npm-workbench-"));
const cleanupTarget = path.resolve(area);
assert.equal(path.dirname(cleanupTarget), path.resolve(os.tmpdir()));
assert.ok(path.basename(cleanupTarget).startsWith("osw-npm-workbench-"));
const consumer = path.join(area, "consumer"), workspace = path.join(area, "workspace");
const environment = { ...process.env, NODE_PATH: "" };
const npmRun = async (args, cwd) => (await execute(process.execPath, [npm, ...args], { cwd, env: environment, windowsHide: true, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 })).stdout;
const deadline = (promise, milliseconds, label) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label)), milliseconds); })]).finally(() => clearTimeout(timer));
};
let child, exited;
const sockets = [];
try {
  await mkdir(consumer); await mkdir(workspace);
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ name: "isolated-workbench-smoke", private: true, version: "0.0.0" }));
  const packed = JSON.parse(await npmRun(["pack", "--json", "--pack-destination", area], cliRoot));
  assert.equal(packed.length, 1); assert.equal(packed[0].name, "@openspec-ui/cli");
  const archive = path.resolve(area, packed[0].filename);
  assert.equal(path.dirname(archive), path.resolve(area));
  await npmRun(["install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", archive], consumer);
  const installed = path.join(consumer, "node_modules/@openspec-ui/cli/dist/cli.js");
  const requireFromInstall = createRequire(installed);
  for (const name of ["@openspec-ui/core", "@openspec-ui/server"]) assert.throws(() => requireFromInstall.resolve(name), { code: "MODULE_NOT_FOUND" });
  const helpStarted = performance.now();
  const help = await execute(process.execPath, [installed, "--help"], { cwd: consumer, env: environment, windowsHide: true, timeout: 30_000 });
  const helpMilliseconds = Math.round(performance.now() - helpStarted);
  assert.match(help.stdout, /open workbench/u); assert.match(help.stdout, /validate changes/u);
  child = spawn(process.execPath, [installed, "open", "workbench", "--cwd", workspace, "--port", "0", "--format", "json"], { cwd: consumer, env: environment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  exited = new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code, signal) => resolve({ code, signal })); });
  let output = "", errors = "";
  child.stderr.on("data", (chunk) => { errors = (errors + chunk.toString()).slice(-8000); });
  const ready = new Promise((resolve, reject) => child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (output.length > 64 * 1024) reject(Error("Unexpected unbounded launcher output"));
    const newline = output.indexOf("\n");
    if (newline !== -1) { try { resolve(JSON.parse(output.slice(0, newline))); } catch (error) { reject(error); } }
  }));
  const launch = await deadline(Promise.race([ready, exited.then(({ code, signal }) => { throw Error(`Launcher exited before ready: ${code}/${signal}: ${errors}`); })]), 30_000, "Launcher did not become ready");
  const url = new URL(launch.url);
  assert.equal(url.hostname, "127.0.0.1");
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  assert.ok(token);
  const headers = { "x-openspec-ui-token": token };
  const request = (route, options) => fetch(url.origin + route, { ...options, signal: AbortSignal.timeout(5000) });
  const html = await request("/"); assert.equal(html.status, 200); assert.match(await html.text(), /OpenSpec Workbench/u);
  const app = await request("/app.js"); assert.equal(app.status, 200); assert.ok((await app.text()).length > 1000);
  const assets = path.join(consumer, "node_modules/@openspec-ui/cli/dist/workbench");
  const chunks = (await readdir(path.join(assets, "chunks"))).filter((name) => name.endsWith(".js"));
  assert.ok(chunks.length > 0);
  for (const chunk of chunks) { const result = await request(`/chunks/${chunk}`); assert.equal(result.status, 200); assert.ok((await result.text()).length > 0); }
  assert.equal((await request("/api/versions")).status, 401);
  assert.equal((await request("/api/versions", { headers: { ...headers, Origin: "https://untrusted.invalid" } })).status, 403);
  assert.equal((await request("/api/overview", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ cwd: consumer }) })).status, 403);
  const expected = {};
  for (const name of ["core", "server"]) expected[name] = JSON.parse(await readFile(path.resolve(cliRoot, `../${name}/package.json`), "utf8")).version;
  assert.deepEqual(await (await request("/api/versions", { headers })).json(), expected);
  assert.deepEqual(launch.versions, expected);
  const socketUrl = url.origin.replace("http:", "ws:") + "/api/ws";
  const socket = new WebSocket(socketUrl, ["openspec-ui", `openspec-ui-token.${token}`], { origin: url.origin }); sockets.push(socket);
  socket.on("error", () => {});
  await deadline(once(socket, "open"), 5000, "Authenticated WebSocket did not open");
  const denied = new WebSocket(socketUrl, ["openspec-ui"], { origin: url.origin }); sockets.push(denied);
  denied.on("error", () => {});
  const deniedStatus = await deadline(new Promise((resolve) => denied.once("unexpected-response", (_req, response) => { response.resume(); denied.terminate(); resolve(response.statusCode); })), 5000, "Unauthenticated WebSocket was not refused");
  assert.equal(deniedStatus, 401);
  const socketClosed = once(socket, "close");
  child.kill("SIGTERM");
  const stopped = await deadline(exited, 5000, "Launcher did not stop with a browser socket open");
  if (process.platform !== "win32") assert.equal(stopped.code, 0);
  await deadline(socketClosed, 5000, "Browser socket remained open after stop");
  assert.notEqual(socket.readyState, WebSocket.OPEN);
  console.log(`Production tarball smoke passed: ${packed[0].filename}; help ${helpMilliseconds}ms; ${chunks.length} browser chunks; API/WS auth and cwd/Origin policy; Core ${expected.core}, server ${expected.server}.`);
  if (process.platform === "win32") console.log("Windows child termination verified; real graceful SIGTERM exit is asserted on POSIX CI. Orderly launcher close is tested separately.");
} finally {
  for (const socket of sockets) socket.terminate();
  if (child && child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await deadline(exited, 5000, "Could not terminate the owned smoke process"); }
  await rm(cleanupTarget, { recursive: true, maxRetries: 10, retryDelay: 200 });
}

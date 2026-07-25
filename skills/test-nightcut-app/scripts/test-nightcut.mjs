#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const root = process.cwd();
const baseUrl = value("--url", "http://localhost:4180");
const videoPath = path.resolve(root, value("--video", "videos/kiro_sample_video.mp4"));
const paidAnalysis = has("--allow-paid-analysis");
const startServer = has("--start-server");
const skipStatic = has("--skip-static");
const artifacts = path.resolve(value("--artifacts", path.join(os.tmpdir(), `nightcut-test-${Date.now()}`)));
const serverOutput = [];
const observations = {
  profile: paidAnalysis ? "paid-analysis" : "free-smoke",
  baseUrl,
  videoPath,
  artifacts,
  startedAt: new Date().toISOString(),
  assertions: [],
  browserExceptions: [],
  consoleErrors: [],
  failedRequests: [],
  analysisResponses: [],
  progress: [],
  serverOutput
};

let server;
let chrome;
let chromeProfile;
let cdp;

function record(name, pass, detail = "") {
  observations.assertions.push({ name, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
  return pass;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(check, timeoutMs, label) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`${label} timed out${lastError instanceof Error ? `: ${lastError.message}` : ""}`);
}

async function run(command, commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd: root, env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code: code ?? 1, output: output.trim().slice(-8_000) }));
  });
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isReachable(baseUrl)) {
    record("app server reachable", true, "reused existing server");
    return;
  }
  if (!startServer) throw new Error(`App is not reachable at ${baseUrl}; pass --start-server or start it first.`);

  const parsed = new URL(baseUrl);
  const port = parsed.port || "4180";
  const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextCli, "dev", "--webpack", "-p", port], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const capture = (chunk) => {
    serverOutput.push(String(chunk));
    if (serverOutput.length > 200) serverOutput.shift();
  };
  server.stdout.on("data", capture);
  server.stderr.on("data", capture);
  server.on("error", (error) => capture(`Server spawn error: ${error.message}\n`));
  server.on("exit", (code, signal) => capture(`Server exited: code=${code} signal=${signal}\n`));
  await waitFor(() => isReachable(baseUrl), 30_000, "Next server startup");
  record("app server reachable", true, `started harness-owned server on ${port}`);
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Chrome was not found. Set CHROME_PATH to a Chromium-compatible browser.");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.pending = new Map();
    this.listeners = [];
    this.nextId = 1;
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message.method, message.params ?? {});
    });
  }

  onEvent(listener) {
    this.listeners.push(listener);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  return result.result?.value;
}

async function screenshot(filename) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.join(artifacts, filename), Buffer.from(result.data, "base64"));
}

async function launchBrowser() {
  const chromePath = await findChrome();
  chromeProfile = await mkdtemp(path.join(os.tmpdir(), "nightcut-chrome-"));
  chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${chromeProfile}`,
    baseUrl
  ], { stdio: "ignore" });

  const activePortFile = path.join(chromeProfile, "DevToolsActivePort");
  const contents = await waitFor(async () => {
    try { return await readFile(activePortFile, "utf8"); } catch { return null; }
  }, 15_000, "Chrome DevTools startup");
  const [port] = contents.trim().split("\n");
  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const list = await response.json();
    return list.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  }, 10_000, "Chrome page target");
  cdp = new CdpClient(targets.webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("Network.enable"),
    cdp.send("Log.enable")
  ]);
  cdp.onEvent((method, params) => {
    if (method === "Runtime.exceptionThrown") observations.browserExceptions.push(params.exceptionDetails?.text ?? "unknown exception");
    if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      observations.consoleErrors.push(params.args?.map((arg) => arg.value ?? arg.description).join(" ") ?? "console error");
    }
    if (method === "Network.loadingFailed") observations.failedRequests.push({ url: params.url, errorText: params.errorText });
    if (method === "Network.responseReceived" && params.response?.url?.includes("/api/analyze")) {
      observations.analysisResponses.push({ url: params.response.url, status: params.response.status });
    }
  });
}

async function runBrowserSmoke() {
  await waitFor(() => evaluate("document.readyState === 'complete' && Boolean(document.querySelector('.editor-shell'))"), 20_000, "editor render");
  const shell = await evaluate(`(() => ({
    editor: Boolean(document.querySelector('.editor-shell')),
    media: Boolean(document.querySelector('.media-panel')),
    preview: Boolean(document.querySelector('[aria-label="Video preview"]')),
    agent: Boolean(document.querySelector('.agent-panel')),
    timeline: Boolean(document.querySelector('.timeline-panel')),
    fileInput: Boolean(document.querySelector('input[type="file"]'))
  }))()`);
  for (const [name, present] of Object.entries(shell)) record(`UI ${name}`, Boolean(present));

  const workerResponse = await fetch(`${baseUrl}/ffmpeg-worker.js`);
  record("FFmpeg worker served", workerResponse.ok, `HTTP ${workerResponse.status}`);

  const documentNode = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await cdp.send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector: "input[type=file]" });
  if (!input.nodeId) throw new Error("Upload input was not found");
  await cdp.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [videoPath] });
  const fileState = await evaluate(`(() => {
    const input = document.querySelector('input[type=file]');
    const file = input?.files?.[0];
    return file ? { name: file.name, size: file.size } : null;
  })()`);
  record("file input populated", fileState?.name === path.basename(videoPath), JSON.stringify(fileState));
  await evaluate("document.querySelector('input[type=file]')?.dispatchEvent(new Event('change', { bubbles: true }))");
  await sleep(500);
  const nativeImportHandled = await evaluate(`Array.from(document.querySelectorAll('.asset-copy strong')).some((node) => node.textContent === ${JSON.stringify(path.basename(videoPath))})`);
  if (!nativeImportHandled) {
    const bridged = await evaluate(`(() => {
      const input = document.querySelector('input[type=file]');
      const propsKey = input && Object.keys(input).find((key) => key.startsWith('__reactProps$'));
      const handler = propsKey && input[propsKey]?.onChange;
      if (typeof handler !== 'function') return false;
      handler({ target: input, currentTarget: input });
      return true;
    })()`);
    record("React upload automation bridge", Boolean(bridged), "CDP populated the file input but emitted no framework change event");
  }
  const imported = await waitFor(() => evaluate(`Array.from(document.querySelectorAll('.asset-copy strong')).some((node) => node.textContent === ${JSON.stringify(path.basename(videoPath))})`), 15_000, "media import");
  record("sample media imported", Boolean(imported), path.basename(videoPath));
  await screenshot("before-analysis.png");

  if (!paidAnalysis) return;
  await evaluate("document.querySelector('.analyze-source-button')?.click()");
  let prior = "";
  const result = await waitFor(async () => {
    const state = await evaluate(`(() => {
      const card = document.querySelector('.analysis-progress-card');
      return card ? { className: card.className, text: card.textContent?.trim() ?? '' } : null;
    })()`);
    if (state?.text && state.text !== prior) {
      prior = state.text;
      observations.progress.push({ at: new Date().toISOString(), ...state });
      process.stdout.write(`PROGRESS ${state.text}\n`);
    }
    return state && (state.className.includes("done") || state.className.includes("error")) ? state : null;
  }, 420_000, "paid analysis");
  record("analysis completed", result.className.includes("done"), result.text);
  record("single successful analysis request", observations.analysisResponses.length === 1 && observations.analysisResponses[0].status === 200, JSON.stringify(observations.analysisResponses));
  const generatedClips = await evaluate("document.querySelectorAll('.timeline-clip.kind-video').length");
  record("generated video clips", generatedClips > 0, String(generatedClips));
  await screenshot("after-analysis.png");
}

async function cleanup() {
  try { cdp?.close(); } catch {}
  if (chrome && !chrome.killed) {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill("SIGTERM");
    await Promise.race([exited, sleep(3_000)]);
  }
  if (server?.pid) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, sleep(3_000)]);
  }
  if (chromeProfile) {
    await rm(chromeProfile, { recursive: true, force: true }).catch(async () => {
      await sleep(500);
      await rm(chromeProfile, { recursive: true, force: true });
    });
  }
}

let exitCode = 0;
try {
  await access(videoPath);
  await mkdir(artifacts, { recursive: true });
  if (!skipStatic) {
    const lint = await run("npm", ["run", "lint"]);
    record("lint", lint.code === 0, lint.output);
    const types = await run("npm", ["run", "typecheck"]);
    record("typecheck", types.code === 0, types.output);
  }
  await ensureServer();
  await launchBrowser();
  await runBrowserSmoke();
  const requiredFailures = observations.assertions.filter((assertion) => !assertion.pass);
  if (requiredFailures.length || observations.browserExceptions.length) exitCode = 1;
} catch (error) {
  exitCode = 1;
  observations.fatalError = error instanceof Error ? error.message : String(error);
  process.stderr.write(`FATAL ${observations.fatalError}\n`);
} finally {
  observations.finishedAt = new Date().toISOString();
  observations.serverOutput = serverOutput.join("").slice(-12_000);
  await mkdir(artifacts, { recursive: true });
  await writeFile(path.join(artifacts, "report.json"), `${JSON.stringify(observations, null, 2)}\n`);
  await cleanup();
  process.stdout.write(`REPORT ${path.join(artifacts, "report.json")}\n`);
}

process.exitCode = exitCode;

// Kept outside the application bundle so browser-native dynamic import can load
// FFmpeg's generated blob module. Bundlers otherwise rewrite import(coreURL).
const MessageType = {
  LOAD: "LOAD",
  EXEC: "EXEC",
  WRITE_FILE: "WRITE_FILE",
  READ_FILE: "READ_FILE",
  DELETE_FILE: "DELETE_FILE",
  ERROR: "ERROR",
  PROGRESS: "PROGRESS",
  LOG: "LOG"
};

let ffmpeg;

async function load({ coreURL, wasmURL, workerURL }) {
  const firstLoad = !ffmpeg;
  const coreModule = await import(coreURL);
  const createFFmpegCore = coreModule.default;
  if (!createFFmpegCore) throw new Error("Failed to import ffmpeg-core.js");

  const resolvedWasmURL = wasmURL || coreURL.replace(/\.js$/g, ".wasm");
  const resolvedWorkerURL = workerURL || coreURL.replace(/\.js$/g, ".worker.js");
  ffmpeg = await createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({
      wasmURL: resolvedWasmURL,
      workerURL: resolvedWorkerURL
    }))}`
  });
  ffmpeg.setLogger((data) => self.postMessage({ type: MessageType.LOG, data }));
  ffmpeg.setProgress((data) => self.postMessage({ type: MessageType.PROGRESS, data }));
  return firstLoad;
}

function execute({ args, timeout = -1 }) {
  ffmpeg.setTimeout(timeout);
  ffmpeg.exec(...args);
  const result = ffmpeg.ret;
  ffmpeg.reset();
  return result;
}

self.onmessage = async ({ data: { id, type, data: payload } }) => {
  const transfers = [];
  try {
    if (type !== MessageType.LOAD && !ffmpeg) {
      throw new Error("FFmpeg is not loaded");
    }

    let data;
    switch (type) {
      case MessageType.LOAD:
        data = await load(payload);
        break;
      case MessageType.EXEC:
        data = execute(payload);
        break;
      case MessageType.WRITE_FILE:
        ffmpeg.FS.writeFile(payload.path, payload.data);
        data = true;
        break;
      case MessageType.READ_FILE:
        data = ffmpeg.FS.readFile(payload.path, { encoding: payload.encoding });
        break;
      case MessageType.DELETE_FILE:
        ffmpeg.FS.unlink(payload.path);
        data = true;
        break;
      default:
        throw new Error(`Unknown FFmpeg message type: ${type}`);
    }

    if (data instanceof Uint8Array) transfers.push(data.buffer);
    self.postMessage({ id, type, data }, transfers);
  } catch (error) {
    self.postMessage({
      id,
      type: MessageType.ERROR,
      data: error instanceof Error ? error.message : String(error)
    });
  }
};

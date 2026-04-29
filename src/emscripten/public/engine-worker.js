importScripts("./stockfish-single.js");

let enginePromise = null;
let engine = null;
let pendingCommands = [];
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
let consolePatched = false;

function forward(line) {
  self.postMessage({ type: "line", line });
}

function patchConsole() {
  if (consolePatched) {
    return;
  }

  const relay = (writer, args) => {
    const line = args
      .map((value) => (typeof value === "string" ? value : String(value)))
      .join(" ");
    forward(line);
    writer(...args);
  };

  console.log = (...args) => relay(originalConsoleLog, args);
  console.error = (...args) => relay(originalConsoleError, args);
  consolePatched = true;
}

async function initEngine() {
  if (!enginePromise) {
    patchConsole();
    enginePromise = Stockfish({ print: forward, printErr: forward }).then((instance) => {
      engine = instance;
      if (typeof engine.addMessageListener === "function") {
        engine.addMessageListener(forward);
      }

      for (const command of pendingCommands) {
        engine.postMessage(command);
      }
      pendingCommands = [];

      self.postMessage({ type: "ready" });
      return engine;
    });
  }

  return enginePromise;
}

async function restartEngine() {
  if (engine && typeof engine.terminate === "function") {
    engine.terminate();
  }

  enginePromise = null;
  engine = null;
  pendingCommands = [];

  await initEngine();
}

self.onmessage = async (event) => {
  const data = event.data;

  if (data && data.type === "init") {
    await initEngine();
    return;
  }

  if (data && data.type === "restart") {
    await restartEngine();
    return;
  }

  const command = typeof data === "string" ? data : data && data.command;
  if (!command) {
    return;
  }

  if (engine) {
    engine.postMessage(command);
    return;
  }

  pendingCommands.push(command);
  await initEngine();
};

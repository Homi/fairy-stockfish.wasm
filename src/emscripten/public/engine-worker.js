importScripts("./stockfish-single.js");

let enginePromise = null;
let engine = null;
let pendingCommands = [];

function forward(line) {
  self.postMessage({ type: "line", line });
}

async function initEngine() {
  if (!enginePromise) {
    enginePromise = Stockfish().then((instance) => {
      engine = instance;
      engine.addMessageListener(forward);

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

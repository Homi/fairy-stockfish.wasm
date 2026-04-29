const pendingCustomMessages = [];
let pendingCustomMessagesTimer = null;

function getRunningWorkers() {
  if (typeof PThread === "object" && Array.isArray(PThread.runningWorkers)) {
    return PThread.runningWorkers;
  }
  return [];
}

function postToWorkers(data) {
  const workers = getRunningWorkers();
  if (workers.length === 0) {
    return false;
  }

  // TODO: Actually want to post only to main worker
  for (let worker of workers) {
    // prettier-ignore
    worker.postMessage({ "cmd": "custom", "userData": data });
  }
  return true;
}

function flushPendingCustomMessages() {
  if (pendingCustomMessages.length === 0) {
    pendingCustomMessagesTimer = null;
    return;
  }

  if (!postToWorkers(pendingCustomMessages[0])) {
    pendingCustomMessagesTimer = setTimeout(flushPendingCustomMessages, 10);
    return;
  }

  for (let i = 1; i < pendingCustomMessages.length; i += 1) {
    postToWorkers(pendingCustomMessages[i]);
  }
  pendingCustomMessages.length = 0;
  pendingCustomMessagesTimer = null;
}

//
// Post custom message to all workers (including main worker)
//
Module["postCustomMessage"] = (data) => {
  if (postToWorkers(data)) {
    return;
  }

  if (typeof PThread === "object") {
    pendingCustomMessages.push(data);
    if (!pendingCustomMessagesTimer) {
      pendingCustomMessagesTimer = setTimeout(flushPendingCustomMessages, 10);
    }
    return;
  }

  if (typeof Module["onCustomMessage"] === "function") {
    Module["onCustomMessage"](data);
  }
};

//
// Simple queue with async get (assume single consumer)
//
class Queue {
  constructor() {
    this.getter = null;
    this.list = [];
  }
  async get() {
    if (this.list.length > 0) {
      return this.list.shift();
    }
    return await new Promise((resolve) => (this.getter = resolve));
  }
  put(x) {
    if (this.getter) {
      this.getter(x);
      this.getter = null;
      return;
    }
    this.list.push(x);
  }
}

//
// TODO: This is used only by main worker
//
Module["queue"] = new Queue();

Module["onCustomMessage"] = (data) => {
  Module["queue"].put(data);
};

function handleCustomMessageEvent(event) {
  const messageData = event?.["data"];
  if (!messageData || messageData["cmd"] !== "custom") {
    return false;
  }

  if (typeof Module["onCustomMessage"] === "function") {
    Module["onCustomMessage"](messageData["userData"]);
  }

  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
  return true;
}

// Emscripten 5 no longer emits a separate pthread worker file by default,
// so custom messages need to be intercepted in this shared runtime file.
if (typeof addEventListener === "function") {
  addEventListener("message", handleCustomMessageEvent, true);
}

//
// API
//

// Align to the same API as niklasf's stockfish
Module["postMessage"] = Module["postCustomMessage"];

const listeners = [];

Module["addMessageListener"] = (listener) => {
  listeners.push(listener);
};

Module["removeMessageListener"] = (listener) => {
  const i = listeners.indexOf(listener);
  if (i >= 0) {
    listeners.splice(i, 1);
  }
};

Module["print"] = Module["printErr"] = (data) => {
  if (listeners.length === 0) {
    console.log(data);
    return;
  }
  for (let listener of listeners) {
    listener(data);
  }
};

Module["terminate"] = () => {
  if (typeof PThread === "object" && typeof PThread.terminateAllThreads === "function") {
    PThread.terminateAllThreads();
  }
};

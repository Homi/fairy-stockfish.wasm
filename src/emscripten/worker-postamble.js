//
// Patch `onmessage` to support custom message
//
const oldOnmessage = self.onmessage;

self.onmessage = (e) => {
  const messageData = e?.["data"];
  if (messageData?.["cmd"] === "custom") {
    if (typeof Module["onCustomMessage"] === "function") {
      Module["onCustomMessage"](messageData["userData"]);
    }
  } else {
    oldOnmessage(e);
  }
};

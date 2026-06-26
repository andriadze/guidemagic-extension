import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: [
    "http://localhost:3000/*",
    "http://localhost:3001/*",
    "http://localhost:5173/*",
    "https://www.guidemagic.ai/*",
    "https://app.guidemagic.ai/*",
  ],
};

const dispatchExtensionPresent = () => {
  document.dispatchEvent(
    new CustomEvent("$$_guidemagic_extension_present_$$", {
      detail: {
        isPinned: false,
        openPopupAvailable: true,
        appendRecordingAvailable: true,
      },
    }),
  );
};

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "OPEN_POPUP") {
    return;
  }

  chrome.runtime.sendMessage(
    { type: "OPEN_POPUP", appendRecording: event.data.appendRecording },
    (response) => {
      window.postMessage(
        {
          type: "OPEN_POPUP_ACK",
          requestId: event.data.requestId,
          opened: Boolean(response?.opened),
        },
        "*",
      );
    },
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "APPEND_RECORDING_COMPLETE") return;

  window.postMessage(
    {
      type: "APPEND_RECORDING_COMPLETE",
      guideId: message.guideId,
    },
    "*",
  );
});

setTimeout(dispatchExtensionPresent, 100);
setInterval(dispatchExtensionPresent, 2000);

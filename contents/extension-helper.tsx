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

  console.info("[GuideMagic popup] content received OPEN_POPUP", {
    requestId: event.data.requestId,
    appendRecording: event.data.appendRecording,
  });

  chrome.runtime.sendMessage(
    { type: "OPEN_POPUP", appendRecording: event.data.appendRecording },
    (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        console.error("[GuideMagic popup] content sendMessage failed", {
          requestId: event.data.requestId,
          error: runtimeError.message,
        });
      } else {
        console.info("[GuideMagic popup] content received background response", {
          requestId: event.data.requestId,
          response,
        });
      }

      window.postMessage(
        {
          type: "OPEN_POPUP_ACK",
          requestId: event.data.requestId,
          opened: Boolean(response?.opened),
          error: runtimeError?.message || response?.error,
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

import { Storage } from "@plasmohq/storage";

import type { PendingAppendRecordingContext } from "~ts/AppendRecording";

const storage = new Storage();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_POPUP") {
    return;
  }

  const openPopup = async () => {
    const context = message.appendRecording;
    let persistContext: Promise<void> = Promise.resolve();
    if (context) {
      const guideId = Number(context.guideId);
      const insertBeforeStepId =
        context.insertBeforeStepId == null
          ? undefined
          : Number(context.insertBeforeStepId);
      if (
        !Number.isInteger(guideId) ||
        (insertBeforeStepId != null && !Number.isInteger(insertBeforeStepId))
      ) {
        sendResponse({ opened: false });
        return;
      }

      const pending: PendingAppendRecordingContext = {
        guideId,
        guideName: String(context.guideName || "Untitled guide").slice(0, 200),
        insertBeforeStepId,
        returnTabId: sender.tab?.id,
      };
      persistContext = storage.set("pendingAppendRecording", pending);
    }

    if (!chrome.action.openPopup) {
      sendResponse({ opened: false });
      return;
    }

    try {
      const popupRequest = chrome.action.openPopup();
      await Promise.all([persistContext, popupRequest]);
      sendResponse({ opened: true });
    } catch {
      sendResponse({ opened: false });
    }
  };

  void openPopup();

  return true;
});

export {};

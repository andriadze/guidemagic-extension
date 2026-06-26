import { finishAppendRecordingApi, stopRecordingApi } from "~api/guide.api";
import { sendMessageToActivePage } from "./messaging";
import type { Guide } from "~ts/Guide";
import { Storage } from "@plasmohq/storage";

const storage = new Storage();

export async function stopRecording() {
  const guide = await storage.get<Guide>("guide");

  const stoppedGuide = { ...guide, active: false };
  sendMessageToActivePage("stopRecording");

  if (guide.recordingMode === "append" && guide.appendRecording) {
    await finishAppendRecordingApi(
      guide.id,
      guide.appendRecording.recordedStepIds,
    );
    await storage.set("guide", stoppedGuide);
    await storage.remove("pendingAppendRecording");

    const returnTabId = guide.appendRecording.returnTabId;
    if (returnTabId != null) {
      try {
        await chrome.tabs.get(returnTabId);
        await chrome.tabs.update(returnTabId, { active: true });
        await chrome.tabs.sendMessage(returnTabId, {
          type: "APPEND_RECORDING_COMPLETE",
          guideId: guide.id,
        });
        return;
      } catch {
        // The original guide tab was closed; open a replacement below.
      }
    }

    await chrome.tabs.create({
      url: `${process.env.PLASMO_PUBLIC_APP_ROUTE}/guides/${guide.id}`,
    });
    return;
  }

  await storage.set("guide", stoppedGuide);
  await stopRecordingApi(guide.id);

  if (guide.stepCount > 0) {
    chrome.tabs.create({
      url: `${process.env.PLASMO_PUBLIC_APP_ROUTE}/guides/${stoppedGuide.id}`,
    });
  }
}

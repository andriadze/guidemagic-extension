import { Storage } from "@plasmohq/storage";
import { markRecordedVideoUploadFailedApi } from "~api/guide.api";
import type { VideoRecordingOptions } from "~ts/VideoRecording";
import AuthHandler from "~util/AuthHandler";

const storage = new Storage();
const OFFSCREEN_DOCUMENT_PATH = "tabs/video-recorder.html";
const VIDEO_UPLOAD_TIMEOUT_ALARM = "guidemagic-video-upload-timeout";
const VIDEO_UPLOAD_TIMEOUT_MINUTES = 20;

async function failVideoUpload(guideId: number, message: string) {
  await markRecordedVideoUploadFailedApi(guideId, message).catch(() => undefined);
  await storage.set("videoRecording", {
    guideId,
    active: false,
    status: "failed",
    options: { microphone: false, webcam: false },
    error: message,
  });
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts?.length) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [
      chrome.offscreen.Reason.USER_MEDIA,
      chrome.offscreen.Reason.DISPLAY_MEDIA,
    ],
    justification: "Record GuideMagic videos from a user-selected screen source",
  });
}

async function startVideoRecording(
  guideId: number,
  options: VideoRecordingOptions,
) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    target: "video-recorder",
    type: "START_VIDEO_RECORDING",
    guideId,
    options,
  });

  if (!response?.success) {
    throw new Error(response?.error || "Could not start video recording");
  }

  await storage.set("videoRecording", {
    guideId,
    active: true,
    status: "recording",
    options,
  });
}

async function stopVideoRecording() {
  const response = await chrome.runtime.sendMessage({
    target: "video-recorder",
    type: "STOP_VIDEO_RECORDING",
  });

  if (!response?.success) {
    throw new Error(response?.error || "Could not stop video recording");
  }
}

async function stopVideoRecordingWithFailureGuard() {
  const state = await storage.get<any>("videoRecording");
  try {
    await stopVideoRecording();
  } catch (error) {
    if (state?.guideId) {
      await failVideoUpload(
        state.guideId,
        error instanceof Error ? error.message : "Could not stop video recording",
      );
    }
    throw error;
  }
}

async function retryVideoUpload() {
  const response = await chrome.runtime.sendMessage({
    target: "video-recorder",
    type: "RETRY_VIDEO_UPLOAD",
  });

  if (!response?.success) {
    throw new Error(response?.error || "Could not retry video upload");
  }
}

async function getAccessToken(refresh?: boolean) {
  if (refresh) {
    const refreshed = await AuthHandler.refreshToken();
    if (!refreshed?.access_token) {
      throw new Error("User session is no longer valid");
    }
    return refreshed.access_token;
  }

  const token = await AuthHandler.getAccessToken();
  if (!token) {
    throw new Error("User session is no longer valid");
  }
  return token;
}

export function registerVideoRecordingBackground() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "START_GUIDEMAGIC_VIDEO_RECORDING") {
      startVideoRecording(message.guideId, message.options)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      return true;
    }

    if (message?.type === "STOP_GUIDEMAGIC_VIDEO_RECORDING") {
      stopVideoRecordingWithFailureGuard()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      return true;
    }

    if (message?.type === "RETRY_GUIDEMAGIC_VIDEO_UPLOAD") {
      retryVideoUpload()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      return true;
    }

    if (message?.type === "GET_GUIDEMAGIC_ACCESS_TOKEN") {
      getAccessToken(Boolean(message.refresh))
        .then((accessToken) => sendResponse({ success: true, accessToken }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      return true;
    }

    if (message?.type === "VIDEO_RECORDING_COMPLETE") {
      void chrome.alarms.clear(VIDEO_UPLOAD_TIMEOUT_ALARM);
      void storage.remove("videoRecording");
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== VIDEO_UPLOAD_TIMEOUT_ALARM) {
      return;
    }

    void (async () => {
      const state = await storage.get<any>("videoRecording");
      if (state?.status !== "uploading" || !state.guideId) {
        return;
      }
      await failVideoUpload(
        state.guideId,
        "Video upload timed out. Please try recording again.",
      );
    })();
  });
}

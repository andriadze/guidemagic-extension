import { Storage } from "@plasmohq/storage"

import type { PendingAppendRecordingContext } from "~ts/AppendRecording"
import { registerVideoRecordingBackground } from "~background/video-recording"

const storage = new Storage()
const POPUP_DEBUG_VERSION = "2026-06-28-active-background-popup-handler"

registerVideoRecordingBackground()

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_POPUP") {
    return
  }

  console.info("[GuideMagic popup] background received OPEN_POPUP", {
    debugVersion: POPUP_DEBUG_VERSION,
    appendRecording: message.appendRecording,
    senderTabId: sender.tab?.id,
    senderUrl: sender.tab?.url
  })

  const openPopup = async () => {
    const context = message.appendRecording
    let persistContext: Promise<void> = Promise.resolve()

    if (context) {
      const guideId = Number(context.guideId)
      const insertBeforeStepId =
        context.insertBeforeStepId == null
          ? undefined
          : Number(context.insertBeforeStepId)

      if (
        !Number.isInteger(guideId) ||
        (insertBeforeStepId != null && !Number.isInteger(insertBeforeStepId))
      ) {
        console.error("[GuideMagic popup] background invalid append context", {
          context,
          guideId,
          insertBeforeStepId
        })
        sendResponse({ opened: false, error: "Invalid append context" })
        return
      }

      const pending: PendingAppendRecordingContext = {
        guideId,
        guideName: String(context.guideName || "Untitled guide").slice(0, 200),
        insertBeforeStepId,
        returnTabId: sender.tab?.id
      }

      console.info("[GuideMagic popup] background saving append context", pending)
      persistContext = storage.set("pendingAppendRecording", pending)
    }

    const openPopupWindow = async () => {
      await chrome.windows.create({
        url: chrome.runtime.getURL("popup.html"),
        type: "popup",
        width: 380,
        height: 640,
        focused: true
      })
    }

    try {
      await persistContext
      console.info("[GuideMagic popup] background append context saved")

      if (chrome.action.openPopup) {
        try {
          console.info("[GuideMagic popup] background trying chrome.action.openPopup")
          await withTimeout(
            chrome.action.openPopup(),
            700,
            "chrome.action.openPopup"
          )
          console.info("[GuideMagic popup] background chrome.action.openPopup succeeded")
          sendResponse({ opened: true })
          return
        } catch (error) {
          console.error("[GuideMagic popup] background chrome.action.openPopup failed", {
            error
          })
          console.info("[GuideMagic popup] background trying chrome.windows fallback")
          await withTimeout(
            openPopupWindow(),
            2000,
            "chrome.windows.create fallback"
          )
          console.info("[GuideMagic popup] background chrome.windows fallback succeeded")
          sendResponse({ opened: true })
          return
        }
      }

      console.info(
        "[GuideMagic popup] background chrome.action.openPopup unavailable; trying chrome.windows fallback"
      )
      await withTimeout(
        openPopupWindow(),
        2000,
        "chrome.windows.create fallback"
      )
      console.info("[GuideMagic popup] background chrome.windows fallback succeeded")
      sendResponse({ opened: true })
    } catch (error) {
      console.error("[GuideMagic popup] background failed to open popup", {
        error
      })
      sendResponse({ opened: false, error: String(error) })
    }
  }

  void openPopup()

  return true
})

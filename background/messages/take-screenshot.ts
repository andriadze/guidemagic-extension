import type { PlasmoMessaging } from "@plasmohq/messaging";
import { Storage } from "@plasmohq/storage";
import { createStep, uploadImage } from "~api/step.api";
import type { Guide } from "~ts/Guide";
import { AuthApiError } from "~util/AuthApi";

const storage = new Storage();

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  chrome.tabs.captureVisibleTab(null, {}, async (image) => {
    try {
      const currentGuide = await storage.get<Guide>("guide");
      if (!currentGuide?.active || !currentGuide.id) {
        res.send({ success: false, error: "No active recording" });
        return;
      }

      const step = await createStep(currentGuide.id, {
        ...req.body,
        ...(currentGuide.recordingMode === "append"
          ? {
              appendRecording: true,
              insertBeforeStepId:
                currentGuide.appendRecording?.insertBeforeStepId,
            }
          : {}),
      });
      if (!step?.id) {
        throw new Error("Step creation returned no step");
      }

      const updatedGuide: Guide = {
        ...currentGuide,
        stepCount: (currentGuide.stepCount || 0) + 1,
        ...(currentGuide.appendRecording
          ? {
              appendRecording: {
                ...currentGuide.appendRecording,
                recordedStepIds: [
                  ...currentGuide.appendRecording.recordedStepIds,
                  step.id,
                ],
              },
            }
          : {}),
      };
      await storage.set("guide", updatedGuide);

      const imageUploaded = image ? await uploadImage(step, image) : false;
      res.send({ success: true, imageUploaded });
    } catch (error) {
      const status = error instanceof AuthApiError ? error.status : undefined;
      const shouldStopRecording =
        status !== undefined && status >= 400 && status < 500;

      if (shouldStopRecording) {
        const currentGuide = await storage.get<Guide>("guide");
        if (currentGuide) {
          await storage.set("guide", { ...currentGuide, active: false });
        }
      }

      console.error("Could not capture recording step", error);
      res.send({
        success: false,
        stopRecording: shouldStopRecording,
        status,
        error: error instanceof Error ? error.message : "Step capture failed",
      });
    }
  });
};

export default handler;

import { useEffect, useState } from "react";
import { Storage } from "@plasmohq/storage";
import {
  startAppendRecordingApi,
  startRecordingApi,
} from "../../api/guide.api";
import type { Guide } from "~ts/Guide";
import type { PendingAppendRecordingContext } from "~ts/AppendRecording";
import { sendMessageToActivePage } from "~util/messaging";
import { stopRecording as handleStopRecording } from "~util/stopRecording";

const storage = new Storage();

export function useGuide() {
  const [guide, setGuide] = useState<null | Guide>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAppend, setPendingAppend] =
    useState<PendingAppendRecordingContext | null>(null);

  const initGuide = async () => {
    try {
      const currGuide = await storage.get<Guide>("guide");
      let appendContext = await storage.get<PendingAppendRecordingContext>(
        "pendingAppendRecording",
      );
      if (!appendContext) {
        await new Promise((resolve) => setTimeout(resolve, 75));
        appendContext = await storage.get<PendingAppendRecordingContext>(
          "pendingAppendRecording",
        );
      }
      setGuide(currGuide || null);
      setPendingAppend(appendContext || null);
    } catch {
      setError("Could not load the current recording");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (actionPending) {
      return false;
    }

    setActionPending(true);
    setError(null);

    try {
      if (guide?.active) {
        throw new Error("Stop the current recording before starting another");
      }

      sendMessageToActivePage("recordingStarting");
      if (pendingAppend) {
        const validated = await startAppendRecordingApi(
          pendingAppend.guideId,
          pendingAppend.insertBeforeStepId,
        );
        const appendGuide: Guide = {
          id: validated.guideId,
          name: validated.guideName,
          active: true,
          stepCount: 0,
          recordingMode: "append",
          appendRecording: {
            ...pendingAppend,
            guideId: validated.guideId,
            guideName: validated.guideName,
            insertBeforeStepId: validated.insertBeforeStepId,
            recordedStepIds: [],
          },
        };
        await storage.set("guide", appendGuide);
        await storage.remove("pendingAppendRecording");
        setPendingAppend(null);
        setGuide(appendGuide);
        sendMessageToActivePage("startRecording");
        return true;
      }

      const newGuide = await startRecordingApi();
      if (!newGuide) {
        throw new Error("Guide creation failed");
      }

      const recordingGuide = { ...newGuide, recordingMode: "new-guide" };
      await storage.set("guide", recordingGuide);
      setGuide(recordingGuide);
      sendMessageToActivePage("startRecording");
      return true;
    } catch {
      sendMessageToActivePage("stopRecording");
      setError("Could not start recording. Please try again.");
      return false;
    } finally {
      setActionPending(false);
    }
  };

  const cancelPendingAppend = async () => {
    await storage.remove("pendingAppendRecording");
    setPendingAppend(null);
  };

  const stopRecording = async () => {
    if (!guide || actionPending) {
      return false;
    }

    setActionPending(true);
    setError(null);

    try {
      const stoppedGuide = { ...guide, active: false };
      await handleStopRecording();
      setGuide(stoppedGuide);
      return true;
    } catch {
      setGuide(guide);
      setError("Could not stop recording. Please try again.");
      return false;
    } finally {
      setActionPending(false);
    }
  };

  useEffect(() => {
    initGuide();
  }, []);

  return {
    guide,
    loading,
    actionPending,
    error,
    pendingAppend,
    cancelPendingAppend,
    startRecording,
    stopRecording,
  };
}

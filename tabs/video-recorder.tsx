import { Storage } from "@plasmohq/storage";
import type {
  VideoRecordingOptions,
  VideoRecordingState,
} from "~ts/VideoRecording";

const storage = new Storage();
const MAX_RECORDING_MS = 15 * 60 * 1000;

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let activeStreams: MediaStream[] = [];
let animationFrameId: number | null = null;
let stopTimerId: number | null = null;
let activeGuideId: number | null = null;
let activeOptions: VideoRecordingOptions | null = null;
let retryBlob: Blob | null = null;

async function setRecordingState(
  patch: Partial<VideoRecordingState> & { guideId?: number },
) {
  const current = await storage.get<VideoRecordingState>("videoRecording");
  const guideId = patch.guideId || current?.guideId || activeGuideId;
  if (!guideId) return;
  await storage.set("videoRecording", {
    guideId,
    active: current?.active ?? true,
    status: current?.status || "starting",
    options: current?.options || activeOptions || { microphone: false, webcam: false },
    ...patch,
  });
}

function stopTracks() {
  activeStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  activeStreams = [];
  if (animationFrameId != null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (stopTimerId != null) {
    window.clearTimeout(stopTimerId);
    stopTimerId = null;
  }
}

function getRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function describeError(error: unknown) {
  if (error instanceof DOMException) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function getAccessToken(refresh = false) {
  const response = await chrome.runtime.sendMessage({
    type: "GET_GUIDEMAGIC_ACCESS_TOKEN",
    refresh,
  });
  if (!response?.success || !response.accessToken) {
    throw new Error(response?.error || "User session is no longer valid");
  }
  return response.accessToken as string;
}

async function fetchWithToken(
  path: string,
  options: RequestInit,
  refresh = false,
) {
  const token = await getAccessToken(refresh);
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${process.env.PLASMO_PUBLIC_API_ROUTE}${path}`, {
    ...options,
    headers,
  });
}

async function uploadRecordedVideo(guideId: number, blob: Blob) {
  const createFormData = () => {
    const formData = new FormData();
    formData.append("file", blob, `guide-${guideId}.webm`);
    return formData;
  };

  let response = await fetchWithToken(`/guides/${guideId}/video/upload`, {
    method: "POST",
    body: createFormData(),
  });

  if (response.status === 401) {
    response = await fetchWithToken(
      `/guides/${guideId}/video/upload`,
      {
        method: "POST",
        body: createFormData(),
      },
      true,
    );
  }

  if (!response.ok) {
    throw new Error(`Video upload failed with status ${response.status}`);
  }

  return response.json();
}

async function markRecordedVideoUploadFailed(guideId: number, message: string) {
  const response = await fetchWithToken(`/guides/${guideId}/video/upload/fail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Could not mark video upload failed: ${response.status}`);
  }
}

async function getDisplayStream() {
  return navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: {
      frameRate: { ideal: 30, max: 30 },
    },
  });
}

async function getUserStream(options: VideoRecordingOptions) {
  if (!options.microphone && !options.webcam) {
    console.info("[GuideMagic video] mic/webcam disabled");
    return null;
  }

  console.info("[GuideMagic video] requesting mic/webcam media", options);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: options.microphone,
      video: options.webcam
        ? {
            width: { ideal: 640 },
            height: { ideal: 360 },
          }
        : false,
    });
    console.info("[GuideMagic video] mic/webcam media granted", {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });
    return stream;
  } catch (error) {
    console.warn("[GuideMagic video] mic/webcam media unavailable", {
      options,
      error,
      message: describeError(error),
    });
    return null;
  }
}

function composeVideoStream(tabStream: MediaStream, userStream: MediaStream | null) {
  const tabVideoTrack = tabStream.getVideoTracks()[0];
  const webcamTrack = userStream?.getVideoTracks()[0];
  if (!webcamTrack) {
    return new MediaStream([tabVideoTrack]);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) {
    return new MediaStream([tabVideoTrack]);
  }

  const tabVideo = document.createElement("video");
  tabVideo.srcObject = new MediaStream([tabVideoTrack]);
  tabVideo.muted = true;
  tabVideo.playsInline = true;
  void tabVideo.play();

  const webcamVideo = document.createElement("video");
  webcamVideo.srcObject = new MediaStream([webcamTrack]);
  webcamVideo.muted = true;
  webcamVideo.playsInline = true;
  void webcamVideo.play();

  const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  };

  const draw = () => {
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(tabVideo, 0, 0, canvas.width, canvas.height);

    const bubbleWidth = 240;
    const bubbleHeight = 135;
    const margin = 28;
    const x = canvas.width - bubbleWidth - margin;
    const y = canvas.height - bubbleHeight - margin;
    context.save();
    context.shadowColor = "rgba(15, 23, 42, 0.42)";
    context.shadowBlur = 24;
    context.shadowOffsetY = 8;
    drawRoundedRect(x, y, bubbleWidth, bubbleHeight, 18);
    context.clip();
    context.drawImage(webcamVideo, x, y, bubbleWidth, bubbleHeight);
    context.restore();

    context.save();
    drawRoundedRect(x, y, bubbleWidth, bubbleHeight, 18);
    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 3;
    context.stroke();
    context.restore();

    animationFrameId = requestAnimationFrame(draw);
  };
  draw();

  return canvas.captureStream(30);
}

function composeAudioStream(tabStream: MediaStream, userStream: MediaStream | null) {
  const tabAudioTracks = tabStream.getAudioTracks();
  const userAudioTracks = userStream?.getAudioTracks() || [];
  const audioTracks = [...tabAudioTracks, ...userAudioTracks];
  if (!audioTracks.length) {
    return null;
  }

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  tabAudioTracks.forEach((track) => {
    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    source.connect(destination);
    source.connect(audioContext.destination);
  });
  userAudioTracks.forEach((track) => {
    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    source.connect(destination);
  });
  return destination.stream;
}

async function uploadBlob(guideId: number, blob: Blob) {
  console.info("[GuideMagic video] uploading recorded video", {
    guideId,
    size: blob.size,
    type: blob.type,
  });
  await setRecordingState({
    guideId,
    active: false,
    status: "uploading",
    error: undefined,
  });
  await uploadRecordedVideo(guideId, blob);
  console.info("[GuideMagic video] recorded video uploaded", {
    guideId,
    size: blob.size,
  });
  await storage.remove("videoRecording");
  await storage.remove("guide");
  retryBlob = null;
  activeGuideId = null;
}

async function finishRecording() {
  if (!activeGuideId) return;
  const guideId = activeGuideId;
  const blob = new Blob(chunks, { type: "video/webm" });
  console.info("[GuideMagic video] recorder finalized", {
    guideId,
    chunks: chunks.length,
    size: blob.size,
  });
  retryBlob = blob;
  stopTracks();
  recorder = null;
  chunks = [];

  try {
    await uploadBlob(guideId, blob);
    chrome.runtime.sendMessage({ type: "VIDEO_RECORDING_COMPLETE", guideId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Video upload failed. Please try recording again.";
    await markRecordedVideoUploadFailed(guideId, message).catch(
      () => undefined,
    );
    console.error("[GuideMagic video] recorded video upload failed", {
      guideId,
      error,
      message,
    });
    await setRecordingState({
      guideId,
      active: false,
      status: "failed",
      error: message,
    });
  }
}

async function startRecording(
  guideId: number,
  options: VideoRecordingOptions,
) {
  activeGuideId = guideId;
  activeOptions = options;
  chunks = [];
  retryBlob = null;
  await setRecordingState({
    guideId,
    active: true,
    status: "starting",
    options,
    error: undefined,
  });

  try {
    console.info("[GuideMagic video] requesting display media", {
      guideId,
      options,
    });
    const tabStream = await getDisplayStream();
    console.info("[GuideMagic video] display media granted", {
      guideId,
      videoTracks: tabStream.getVideoTracks().length,
      audioTracks: tabStream.getAudioTracks().length,
    });
    const userStream = await getUserStream(options);
    activeStreams = [tabStream, ...(userStream ? [userStream] : [])];
    const videoStream = composeVideoStream(tabStream, userStream);
    const audioStream = composeAudioStream(tabStream, userStream);
    const outputStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...(audioStream?.getAudioTracks() || []),
    ]);
    const mimeType = getRecorderMimeType();
    recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      console.info("[GuideMagic video] recorder stopped", { guideId });
      void finishRecording();
    };
    recorder.start(1000);
    stopTimerId = window.setTimeout(() => {
      void stopRecording();
    }, MAX_RECORDING_MS);
    await setRecordingState({
      guideId,
      active: true,
      status: "recording",
      options,
      error: undefined,
    });
  } catch (error) {
    console.error("[GuideMagic video] failed to start recorder", {
      guideId,
      error,
    });
    stopTracks();
    await setRecordingState({
      guideId,
      active: false,
      status: "failed",
      error: describeError(error),
    });
    throw error;
  }
}

async function stopRecording() {
  if (!recorder || recorder.state === "inactive") {
    console.warn("[GuideMagic video] stop requested without active recorder", {
      hasRecorder: Boolean(recorder),
      recorderState: recorder?.state,
      activeStreams: activeStreams.length,
    });
    stopTracks();
    return;
  }
  console.info("[GuideMagic video] stop requested", {
    guideId: activeGuideId,
    recorderState: recorder.state,
    chunks: chunks.length,
  });
  await setRecordingState({ active: false, status: "stopping" });
  try {
    recorder.requestData();
  } catch (error) {
    console.warn("[GuideMagic video] requestData failed before stop", { error });
  }
  recorder.stop();
  stopTracks();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "video-recorder") {
    return;
  }

  if (message.type === "START_VIDEO_RECORDING") {
    startRecording(message.guideId, message.options)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: describeError(error),
        }),
      );
    return true;
  }

  if (message.type === "STOP_VIDEO_RECORDING") {
    stopRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  if (message.type === "RETRY_VIDEO_UPLOAD") {
    if (!activeGuideId || !retryBlob) {
      sendResponse({ success: false, error: "No video upload is available to retry" });
      return;
    }
    uploadBlob(activeGuideId, retryBlob)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }
});

function VideoRecorderPage() {
  return null;
}

export default VideoRecorderPage;
export {};

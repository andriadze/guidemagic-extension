import fetchWithAuth from "~util/AuthApi";

export async function startRecordingApi() {
  try {
    const res = await fetchWithAuth("/guides", {
      method: "POST",
    });

    const json = await res.json();

    return json;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function stopRecordingApi(guideId: number) {
  try {
    const res = await fetchWithAuth(`/guides/${guideId}/stop`, {
      method: "POST",
    });

    const json = await res.json();

    return json;
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function startAppendRecordingApi(
  guideId: number,
  insertBeforeStepId?: number,
) {
  const res = await fetchWithAuth(`/guides/${guideId}/step-recording/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ insertBeforeStepId }),
  });

  return res.json();
}

export async function finishAppendRecordingApi(
  guideId: number,
  stepIds: number[],
) {
  const res = await fetchWithAuth(`/guides/${guideId}/step-recording/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stepIds }),
  });

  return res.json();
}

export async function uploadRecordedVideoApi(guideId: number, video: Blob) {
  const formData = new FormData();
  formData.append("file", video, `guide-${guideId}.webm`);
  const res = await fetchWithAuth(`/guides/${guideId}/video/upload`, {
    method: "POST",
    body: formData,
  });

  return res.json();
}

export async function markRecordedVideoUploadStartedApi(guideId: number) {
  const res = await fetchWithAuth(`/guides/${guideId}/video/upload/start`, {
    method: "POST",
  });

  return res.json();
}

export async function markRecordedVideoUploadFailedApi(
  guideId: number,
  message?: string,
) {
  const res = await fetchWithAuth(`/guides/${guideId}/video/upload/fail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  return res.json();
}

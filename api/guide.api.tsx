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

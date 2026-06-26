import type { Step } from "~ts/Step";
import fetchWithAuth from "~util/AuthApi";
import { dataURItoBlob } from "~util/dataUriToBlob";

export async function createStep(guideId: number, stepInfo: Step): Promise<Step> {
  const stepCreationResp = await fetchWithAuth("/steps", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      guideId,
      ...stepInfo,
    }),
  });

  return stepCreationResp.json();
}

export async function uploadImage(
  step: Step,
  image: string,
  retry = 0
): Promise<boolean> {
  if (!step?.id || !image) {
    return false;
  }

  try {
    const blob = dataURItoBlob(image);
    const formData = new FormData();
    formData.append("file", blob);
    const res = await fetchWithAuth(`/steps/${step.id}/upload`, {
      method: "POST",
      body: formData,
    });

    await res.json();
    return true;
  } catch (exc) {
    console.log(exc);
    if (retry < 3) {
      return uploadImage(step, image, retry + 1);
    }
    return false;
  }
}

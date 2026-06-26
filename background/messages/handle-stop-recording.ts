import type { PlasmoMessaging } from "@plasmohq/messaging";
import { stopRecording } from "~util/stopRecording";

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    await stopRecording();
    res.send({ success: true });
  } catch (error) {
    console.error("Could not stop recording", error);
    res.send({ success: false });
  }
};

export default handler;

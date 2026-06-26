import type { Step } from "./Step";
import type { AppendRecordingContext } from "./AppendRecording";

export interface Guide {
  id: number;
  name?: string;
  description?: string;
  active?: boolean;
  steps?: Step[];
  stepCount?: number;
  recordingMode?: "new-guide" | "append";
  appendRecording?: AppendRecordingContext;
}

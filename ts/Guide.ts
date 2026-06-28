import type { Step } from "./Step";
import type { AppendRecordingContext } from "./AppendRecording";
import type { VideoRecordingOptions } from "./VideoRecording";

export interface Guide {
  id: number;
  name?: string;
  description?: string;
  active?: boolean;
  steps?: Step[];
  stepCount?: number;
  recordingMode?: "new-guide" | "append" | "video";
  recordingTabId?: number;
  appendRecording?: AppendRecordingContext;
  videoRecording?: VideoRecordingOptions;
}

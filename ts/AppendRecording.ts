export interface AppendRecordingContext {
  guideId: number;
  guideName: string;
  insertBeforeStepId?: number;
  returnTabId?: number;
  recordedStepIds: number[];
}

export interface PendingAppendRecordingContext
  extends Omit<AppendRecordingContext, "recordedStepIds"> {}

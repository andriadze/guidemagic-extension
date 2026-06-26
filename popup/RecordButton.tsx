import "./rec-button.css";

interface Props {
  isRecording?: boolean;
  pending?: boolean;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}
export function RecordButton(props: Props) {
  const label = props.pending
    ? props.isRecording
      ? "Stopping..."
      : "Starting..."
    : props.isRecording
      ? "Stop Recording"
      : "Start Recording";

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled || props.pending}
      className={`record-button ${props.isRecording ? "is-recording" : ""}`}
    >
      <span
        className={`record-button-icon ${props.pending ? "is-pending" : ""}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}

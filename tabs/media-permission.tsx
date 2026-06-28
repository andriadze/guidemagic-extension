import { useMemo, useState } from "react";

function describeError(error: unknown) {
  if (error instanceof DOMException) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function MediaPermissionPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestId = params.get("requestId") || "";
  const microphone = params.get("microphone") === "true";
  const webcam = params.get("webcam") === "true";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const sendResult = async (success: boolean, message?: string) => {
    await chrome.runtime.sendMessage({
      type: "GUIDEMAGIC_MEDIA_PERMISSION_RESULT",
      requestId,
      success,
      error: message,
    });
  };

  const requestPermission = async () => {
    setPending(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: microphone,
        video: webcam
          ? {
              width: { ideal: 640 },
              height: { ideal: 360 },
            }
          : false,
      });
      stream.getTracks().forEach((track) => track.stop());
      await sendResult(true);
      window.close();
    } catch (err) {
      const message = describeError(err);
      setError(message);
      await sendResult(false, message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <h1 style={styles.title}>Enable recording devices</h1>
        <p style={styles.copy}>
          GuideMagic needs access to your {webcam ? "camera" : ""}
          {webcam && microphone ? " and " : ""}
          {microphone ? "microphone" : ""} for this recording.
        </p>
        <button
          type="button"
          style={styles.button}
          disabled={pending}
          onClick={requestPermission}
        >
          {pending ? "Waiting..." : "Allow access"}
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </section>
    </main>
  );
}

const styles = {
  page: {
    display: "grid",
    minHeight: "100vh",
    margin: 0,
    placeItems: "center",
    background: "#f8fafc",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  panel: {
    width: "min(360px, calc(100vw - 32px))",
    padding: 24,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#ffffff",
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
  },
  title: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 700,
  },
  copy: {
    margin: "0 0 18px",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  },
  button: {
    width: "100%",
    minHeight: 42,
    border: 0,
    borderRadius: 6,
    background: "#4f46e5",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  error: {
    margin: "12px 0 0",
    color: "#b91c1c",
    fontSize: 13,
    lineHeight: 1.4,
  },
} satisfies Record<string, React.CSSProperties>;

export default MediaPermissionPage;

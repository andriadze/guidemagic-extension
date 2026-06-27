import { useEffect, useState } from "react";
import guideImage from "data-base64:~/assets/guideList.png";
import logoImage from "data-base64:~/assets/logo.png";
import type { TeamRole } from "~ts/Team";
import AuthHandler from "~util/AuthHandler";
import { LoginButton } from "./LoginButton";
import { RecordButton } from "./RecordButton";
import { useGuide } from "./hooks/useGuide";
import { useTeams } from "./hooks/useTeams";
import "./popup.css";

function getRoleLabel(role?: TeamRole) {
  if (!role) {
    return "";
  }

  const normalizedRole = role === "member" ? "viewer" : role;
  return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
}

function canRecordForRole(role?: TeamRole) {
  return !role || ["owner", "admin", "editor"].includes(role);
}

function IndexPopup() {
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const {
    guide,
    loading: guideLoading,
    actionPending,
    error: guideError,
    pendingAppend,
    cancelPendingAppend,
    startRecording,
    stopRecording,
  } = useGuide();
  const [activeTabLabel, setActiveTabLabel] = useState("this tab");
  const {
    teams,
    currentTeam,
    loading: teamsLoading,
    loaded: teamsLoaded,
    switching,
    error: teamError,
    selectTeam,
  } = useTeams(authReady && isLoggedIn);

  useEffect(() => {
    let mounted = true;
    const syncAuthState = (state?: "login" | "logout") => {
      if (mounted) {
        setIsLoggedIn(AuthHandler.isLoggedIn());
        if (state === "logout") {
          setSessionExpired(true);
        } else if (state === "login") {
          setSessionExpired(false);
        }
        setAuthReady(true);
      }
    };

    AuthHandler.addLoginListener(syncAuthState);
    AuthHandler.waitUntilLoaded().finally(syncAuthState);

    return () => {
      mounted = false;
      AuthHandler.removeLoginListener(syncAuthState);
    };
  }, []);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.title) setActiveTabLabel(tab.title);
    });
  }, []);

  const isRecording = Boolean(guide?.active);
  const isAppending = isRecording && guide?.recordingMode === "append";
  const hasTeamPicker = teams.length > 1;
  const teamSelectionPending = teamsLoading || switching || !teamsLoaded;
  const workspaceLoading = guideLoading || !teamsLoaded;
  const hasRecordingAccess = pendingAppend
    ? true
    : canRecordForRole(currentTeam?.role);
  const recordingDisabled =
    !authReady ||
    guideLoading ||
    actionPending ||
    teamSelectionPending ||
    (!isRecording && !hasRecordingAccess);

  const handleRecordingAction = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }

    const started = await startRecording();
    if (started) {
      window.close();
    }
  };

  const openGuides = () => {
    chrome.tabs.create({ url: process.env.PLASMO_PUBLIC_APP_ROUTE });
  };

  return (
    <div className={`popup-shell ${hasTeamPicker ? "has-team-picker" : ""}`}>
      <header className="popup-header">
        <button
          type="button"
          className="close-button"
          onClick={() => window.close()}
          aria-label="Close popup"
        >
          ×
        </button>
        <img className="brand-logo" src={logoImage} alt="GuideMagic" />
      </header>

      <main className="popup-content">
        {!authReady ? (
          <section className="recording-hero is-loading" aria-busy="true">
            <div className="record-visual" aria-hidden="true">
              <span className="record-visual-shape" />
            </div>
            <h1>Loading GuideMagic</h1>
            <p>Getting your recording workspace ready.</p>
            <div className="loading-bar" aria-hidden="true" />
          </section>
        ) : !isLoggedIn ? (
          <section className="recording-hero login-hero">
            <div className="record-visual" aria-hidden="true">
              <span className="record-visual-shape" />
            </div>
            <h1>{sessionExpired ? "Session expired" : "Sign in to record"}</h1>
            <p>
              {sessionExpired
                ? "Your session is no longer valid. Log in again to continue."
                : "Capture your workflow and turn it into a step-by-step guide."}
            </p>
            <LoginButton />
          </section>
        ) : workspaceLoading ? (
          <section className="recording-hero is-loading" aria-busy="true">
            <div className="record-visual" aria-hidden="true">
              <span className="record-visual-shape" />
            </div>
            <h1>Loading your workspace</h1>
            <p>Checking your recording and team access.</p>
            <div className="loading-bar" aria-hidden="true" />
          </section>
        ) : (
          <>
            <section
              className={`recording-hero ${isRecording ? "is-recording" : ""} ${
                !isRecording && !hasRecordingAccess ? "is-unavailable" : ""
              }`}
            >
              <div className="record-visual" aria-hidden="true">
                <span className="record-visual-shape" />
              </div>
              <h1>
                {isAppending
                  ? `Adding steps to “${guide?.name || "Untitled guide"}”`
                  : isRecording
                  ? "Recording in progress"
                  : pendingAppend
                  ? `Adding steps to “${pendingAppend.guideName}”`
                  : hasRecordingAccess
                  ? "Ready to record"
                  : "Recording unavailable"}
              </h1>
              <p>
                {isAppending
                  ? "Complete the additional workflow, then stop to return to the original guide."
                  : isRecording
                  ? "Complete your workflow, then stop to generate your guide."
                  : pendingAppend
                  ? `Ready to record ${activeTabLabel}. Switch tabs and reopen GuideMagic if this is not the page you want.`
                  : hasRecordingAccess
                  ? "Capture your workflow and turn it into a step-by-step guide."
                  : hasTeamPicker
                  ? "Choose a team where you are an editor, admin, or owner."
                  : "You need editor, admin, or owner access to record for this team."}
              </p>
              <RecordButton
                isRecording={isRecording}
                pending={actionPending}
                disabled={recordingDisabled}
                onClick={handleRecordingAction}
              />
              {!isRecording && pendingAppend && (
                <button
                  type="button"
                  className="append-cancel-button"
                  disabled={actionPending}
                  onClick={cancelPendingAppend}
                >
                  Cancel adding steps
                </button>
              )}
              {(guideError || (!hasTeamPicker && teamError)) && (
                <div className="inline-error" role="alert">
                  {guideError || teamError}
                </div>
              )}
            </section>

            <button type="button" className="guides-card" onClick={openGuides}>
              <span className="card-icon" aria-hidden="true">
                <img src={guideImage} alt="" />
              </span>
              <span className="card-copy">
                <strong>My Guides</strong>
                <small>View and manage your guides</small>
              </span>
              <span className="card-arrow" aria-hidden="true">
                ›
              </span>
            </button>

            {hasTeamPicker && (
              <section className="team-section">
                <div className="section-label">Team</div>
                <label className="team-card">
                  <span className="team-icon" aria-hidden="true">
                    👥
                  </span>
                  <select
                    className="team-select"
                    aria-label="Recording team"
                    value={currentTeam?.id}
                    disabled={
                      teamsLoading || switching || actionPending || isRecording
                    }
                    onChange={(event) => selectTeam(Number(event.target.value))}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} — {getRoleLabel(team.role)}
                      </option>
                    ))}
                  </select>
                </label>
                {!teamError && !isRecording && !hasRecordingAccess && (
                  <div className="permission-warning" role="alert">
                    Viewer access is read-only. Select an editable team to
                    record.
                  </div>
                )}
                {teamError && (
                  <div className="team-error" role="alert">
                    {teamError}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default IndexPopup;

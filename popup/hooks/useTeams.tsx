import { useEffect, useMemo, useState } from "react";
import { getTeams, switchTeam } from "~api/team.api";
import type { Team } from "~ts/Team";

export function useTeams(enabled: boolean) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loaded, setLoaded] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoaded(false);

    getTeams()
      .then((loadedTeams) => {
        if (!cancelled) {
          setTeams(loadedTeams);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load teams");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const currentTeam = useMemo(
    () => teams.find((team) => team.isCurrent) || teams[0],
    [teams]
  );

  const selectTeam = async (teamId: number) => {
    if (teamId === currentTeam?.id) {
      return true;
    }

    setSwitching(true);
    setError(null);

    try {
      await switchTeam(teamId);
      setTeams((currentTeams) =>
        currentTeams.map((team) => ({
          ...team,
          isCurrent: team.id === teamId,
        }))
      );
      return true;
    } catch {
      setError("Could not switch teams");
      return false;
    } finally {
      setSwitching(false);
    }
  };

  return {
    teams,
    currentTeam,
    loading,
    loaded,
    switching,
    error,
    selectTeam,
  };
}

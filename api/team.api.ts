import type { Team } from "~ts/Team";
import fetchWithAuth from "~util/AuthApi";

export async function getTeams(): Promise<Team[]> {
  const res = await fetchWithAuth("/teams", {
    method: "GET",
  });

  return res.json();
}

export async function switchTeam(teamId: number): Promise<Team> {
  const res = await fetchWithAuth(`/teams/${teamId}/switch`, {
    method: "POST",
  });

  return res.json();
}

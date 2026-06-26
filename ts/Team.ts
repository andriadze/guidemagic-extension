export type TeamRole = "owner" | "admin" | "editor" | "viewer" | "member";

export interface Team {
  id: number;
  name: string;
  role: TeamRole;
  createdAt: string;
  isCurrent?: boolean;
}

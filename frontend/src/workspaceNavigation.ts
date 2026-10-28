// Public links select a screen only after the existing authentication gate succeeds.
export const workspaceViews = ["dashboard", "sites", "sessions", "logs", "statistics", "account"] as const;
export type WorkspaceView = typeof workspaceViews[number];
export function requestedWorkspaceView(search: string): WorkspaceView {
  const values = new URLSearchParams(search).getAll("view");
  return values.length === 1 && workspaceViews.includes(values[0] as WorkspaceView)
    ? values[0] as WorkspaceView : "dashboard";
}

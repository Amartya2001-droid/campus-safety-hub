export async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(data.message || "Request failed");
  }
  return res.json();
}

export async function apiFetch(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 401) {
      return {};
    }
    throw new Error("Request failed");
  }
  return res.json();
}

export const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
};

export interface DashboardSummary {
  active_alerts: number;
  pending_escorts: number;
  active_patrols: number;
  starrez_configured: boolean;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const data = await apiFetch("/api/dashboard/stats");
  const counts = [data?.active_alerts, data?.pending_escorts, data?.active_patrols];
  if (!counts.every(value => Number.isSafeInteger(value) && value >= 0) ||
      typeof data?.starrez_configured !== "boolean") {
    throw new Error("Dashboard summary unavailable");
  }
  return data;
}

export interface LiveMapAlert {
  id: number;
  student_name: string;
  location: string;
  lat: number;
  lng: number;
  type: string | null;
  status: string;
  created_at: string;
}
export interface LiveMapPatrol {
  id: number;
  student_name: string;
  status: string;
  started_at: string;
  current_residence: string | null;
}
export interface LiveMapData {
  active_alerts: LiveMapAlert[];
  active_patrols: LiveMapPatrol[];
}

export async function fetchLiveMapData(): Promise<LiveMapData> {
  const data = await apiFetch("/api/map/live-data");
  const validId = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (!Array.isArray(data?.active_alerts) || !Array.isArray(data?.active_patrols) ||
      !data.active_alerts.every((row: LiveMapAlert) => row && validId(row.id) &&
        typeof row.student_name === "string" && typeof row.location === "string" &&
        Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 &&
        Number.isFinite(row.lng) && Math.abs(row.lng) <= 180 &&
        (row.type === null || typeof row.type === "string") &&
        ["new", "assigned", "en_route", "on_scene"].includes(row.status) &&
        typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at))) ||
      !data.active_patrols.every((row: LiveMapPatrol) => row && validId(row.id) &&
        typeof row.student_name === "string" && row.status === "active" &&
        (row.current_residence === null || typeof row.current_residence === "string") &&
        typeof row.started_at === "string" && Number.isFinite(Date.parse(row.started_at)))) {
    throw new Error("Live map data unavailable");
  }
  return data;
}

export interface EscortRequest {
  id: number;
  student_name: string;
  pickup: string;
  destination: string;
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  assigned_officer: string | null;
  eta: string | null;
  created_at: string;
}

export async function fetchEscortRequests(): Promise<EscortRequest[]> {
  const data = await apiFetch("/api/escort-requests");
  if (!Array.isArray(data) || !data.every((row: EscortRequest) => row &&
      Number.isSafeInteger(row.id) && row.id > 0 && typeof row.student_name === "string" &&
      typeof row.pickup === "string" && typeof row.destination === "string" &&
      ["pending", "assigned", "in_progress", "completed", "cancelled"].includes(row.status) &&
      [row.notes, row.assigned_officer, row.eta].every(value => value === null || typeof value === "string") &&
      typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at)))) {
    throw new Error("Escort requests unavailable");
  }
  return data;
}

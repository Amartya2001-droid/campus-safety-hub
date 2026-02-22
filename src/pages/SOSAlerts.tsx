import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { formatTimeAgo, apiRequest, apiFetch } from "@/lib/api";
import { MapPin, Clock, Phone, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOSAlerts = () => {
  const queryClient = useQueryClient();
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ["/api/sos-alerts"],
    queryFn: () => apiFetch("/api/sos-alerts"),
    refetchInterval: 10000,
    retry: false,
  });
  const alerts = Array.isArray(alertsData) ? alertsData : [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status, assigned_officer }: { id: number; status: string; assigned_officer?: string }) =>
      apiRequest(`/api/sos-alerts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, assigned_officer }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sos-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  const activeCount = alerts.filter((a: any) => a.status === "new").length;

  return (
    <DashboardLayout title="SOS Alerts" subtitle="Real-time emergency alerts from students">
      {activeCount > 0 && (
        <div className="glass-card border-emergency/30 emergency-glow p-4 mb-6 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-emergency animate-pulse-emergency" />
            <span className="text-sm font-medium">
              <span className="text-emergency font-bold">{activeCount} new alert{activeCount !== 1 ? "s" : ""}</span>{" "}
              require immediate attention
            </span>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground" data-testid="text-no-alerts">
            No SOS alerts yet. Alerts will appear here in real time.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Time</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Student</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Assigned To</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert: any) => (
                <TableRow key={alert.id} className="border-border hover:bg-accent/30" data-testid={`row-alert-${alert.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(alert.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emergency/15 text-emergency text-xs font-bold">
                        {alert.student_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{alert.student_name}</div>
                        {alert.student_phone && <div className="text-[11px] text-muted-foreground">{alert.student_phone}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {alert.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    {alert.type && (
                      <span className="text-[11px] bg-emergency/10 text-emergency px-2 py-0.5 rounded-full">
                        {alert.type}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={alert.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {alert.assigned_officer || "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {alert.status === "new" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          data-testid={`button-assign-${alert.id}`}
                          onClick={() => updateStatus.mutate({ id: alert.id, status: "assigned", assigned_officer: "Officer on duty" })}
                        >
                          <User className="h-3.5 w-3.5 mr-1" /> Assign
                        </Button>
                      )}
                      {alert.status === "assigned" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => updateStatus.mutate({ id: alert.id, status: "en_route" })}
                        >
                          En Route
                        </Button>
                      )}
                      {(alert.status === "en_route" || alert.status === "on_scene") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-success"
                          onClick={() => updateStatus.mutate({ id: alert.id, status: "resolved" })}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="status-dot bg-emergency" /> New</span>
        <span>→</span>
        <span className="flex items-center gap-1"><span className="status-dot bg-warning" /> Assigned</span>
        <span>→</span>
        <span className="flex items-center gap-1"><span className="status-dot bg-warning" /> En Route</span>
        <span>→</span>
        <span className="flex items-center gap-1"><span className="status-dot bg-info" /> On Scene</span>
        <span>→</span>
        <span className="flex items-center gap-1"><span className="status-dot bg-success" /> Resolved</span>
      </div>
    </DashboardLayout>
  );
};

export default SOSAlerts;

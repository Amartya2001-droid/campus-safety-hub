import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatTimeAgo, apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Footprints,
  Link2,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Phone,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => apiFetch("/api/dashboard/stats"),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/sos-alerts"],
    queryFn: () => apiFetch("/api/sos-alerts"),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: escortsData } = useQuery({
    queryKey: ["/api/escort-requests"],
    queryFn: () => apiFetch("/api/escort-requests"),
    refetchInterval: 10000,
    retry: false,
  });

  const alerts = Array.isArray(alertsData) ? alertsData : [];
  const escorts = Array.isArray(escortsData) ? escortsData : [];
  const activeAlerts = alerts.filter((a: any) => a.status !== "resolved");

  return (
    <DashboardLayout title="Dashboard" subtitle="Security Operations Overview">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))
        ) : (
          <>
            <StatCard
              label="Active Alerts"
              value={stats?.active_alerts ?? 0}
              icon={AlertTriangle}
              variant="emergency"
              trend=""
            />
            <StatCard
              label="Pending Escorts"
              value={stats?.pending_escorts ?? 0}
              icon={Footprints}
              variant="warning"
              trend=""
            />
            <StatCard
              label="StarRez"
              value={stats?.starrez_connected ? "Connected" : "Offline"}
              icon={Link2}
              variant={stats?.starrez_connected ? "info" : "warning"}
              trend=""
            />
            <StatCard
              label="Campus Patrol"
              value={stats?.active_patrols ?? 0}
              icon={ShieldCheck}
              variant="success"
              trend="Active patrols"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-emergency" />
              <h2 className="text-sm font-semibold">Active SOS Alerts</h2>
            </div>
            <Link to="/alerts">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {alertsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4"><Skeleton className="h-16" /></div>
              ))
            ) : activeAlerts.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground" data-testid="text-no-alerts">
                No active SOS alerts
              </div>
            ) : (
              activeAlerts.map((alert: any) => (
                <div key={alert.id} className="p-4 hover:bg-accent/30 transition-colors" data-testid={`card-alert-${alert.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emergency/15 text-emergency text-xs font-bold shrink-0">
                        {alert.student_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{alert.student_name}</span>
                          <StatusBadge status={alert.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {alert.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatTimeAgo(alert.created_at)}
                          </span>
                        </div>
                        {alert.type && (
                          <span className="inline-block mt-1.5 text-[11px] bg-emergency/10 text-emergency px-2 py-0.5 rounded-full">
                            {alert.type}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-warning" />
                <h2 className="text-sm font-semibold">Escort Queue</h2>
              </div>
              <Link to="/escorts">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {escorts.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-escorts">
                  No escort requests
                </div>
              ) : (
                escorts.slice(0, 3).map((escort: any) => (
                  <div key={escort.id} className="p-3 hover:bg-accent/30 transition-colors" data-testid={`card-escort-${escort.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{escort.student_name}</span>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {escort.pickup} → {escort.destination}
                        </div>
                      </div>
                      <StatusBadge status={escort.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-info" />
                <h2 className="text-sm font-semibold">StarRez Reports</h2>
              </div>
              <Link to="/reports">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="p-4">
              {stats?.starrez_connected ? (
                <div className="text-center py-2" data-testid="text-starrez-status">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">StarRez Connected</p>
                  <p className="text-xs text-muted-foreground mt-1">View incident reports from StarRez</p>
                  <Link to="/reports">
                    <Button variant="outline" size="sm" className="mt-3 text-xs" data-testid="button-view-starrez-reports">
                      View Reports
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-2" data-testid="text-starrez-offline">
                  <Link2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">StarRez Not Connected</p>
                  <p className="text-xs text-muted-foreground mt-1">Configure in Settings to view reports</p>
                  <Link to="/settings">
                    <Button variant="outline" size="sm" className="mt-3 text-xs" data-testid="button-configure-starrez-dashboard">
                      Configure
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;

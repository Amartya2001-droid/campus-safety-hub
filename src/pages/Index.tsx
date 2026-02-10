import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { mockSOSAlerts, mockEscortRequests, mockIncidentReports, formatTimeAgo } from "@/lib/mock-data";
import {
  AlertTriangle,
  Footprints,
  FileText,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Index = () => {
  const activeAlerts = mockSOSAlerts.filter((a) => a.status !== "resolved");
  const pendingEscorts = mockEscortRequests.filter((e) => e.status === "pending");
  const newReports = mockIncidentReports.filter((r) => r.status === "new");

  return (
    <DashboardLayout title="Dashboard" subtitle="Security Operations Overview">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Alerts"
          value={activeAlerts.length}
          icon={AlertTriangle}
          variant="emergency"
          trend="2 in last hour"
        />
        <StatCard
          label="Pending Escorts"
          value={pendingEscorts.length}
          icon={Footprints}
          variant="warning"
          trend="Avg wait: 8 min"
        />
        <StatCard
          label="New Reports"
          value={newReports.length}
          icon={FileText}
          variant="info"
          trend="1 high priority"
        />
        <StatCard
          label="Resolved Today"
          value={7}
          icon={CheckCircle2}
          variant="success"
          trend="↑ 15% vs last week"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active SOS Alerts */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-emergency" />
              <h2 className="text-sm font-semibold">Active SOS Alerts</h2>
            </div>
            <Link to="/alerts">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emergency/15 text-emergency text-xs font-bold shrink-0">
                      {alert.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{alert.studentName}</span>
                        <StatusBadge status={alert.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {alert.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTimeAgo(alert.timestamp)}
                        </span>
                      </div>
                      {alert.type && (
                        <span className="inline-block mt-1.5 text-[11px] bg-emergency/10 text-emergency px-2 py-0.5 rounded-full">
                          {alert.type}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0">
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Pending Escorts */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-warning" />
                <h2 className="text-sm font-semibold">Escort Queue</h2>
              </div>
              <Link to="/escorts">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {mockEscortRequests.slice(0, 3).map((escort) => (
                <div key={escort.id} className="p-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{escort.studentName}</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {escort.pickup} → {escort.destination}
                      </div>
                    </div>
                    <StatusBadge status={escort.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Reports */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-info" />
                <h2 className="text-sm font-semibold">Recent Reports</h2>
              </div>
              <Link to="/reports">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {mockIncidentReports.slice(0, 3).map((report) => (
                <div key={report.id} className="p-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium capitalize">
                        {report.type.replace("_", " ")}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {report.location} · {formatTimeAgo(report.timestamp)}
                      </div>
                    </div>
                    <StatusBadge status={report.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;

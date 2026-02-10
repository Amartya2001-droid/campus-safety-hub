import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { mockSOSAlerts, formatTimeAgo } from "@/lib/mock-data";
import { MapPin, Clock, Phone, User, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOSAlerts = () => {
  return (
    <DashboardLayout title="SOS Alerts" subtitle="Real-time emergency alerts from students">
      {/* Alert Banner */}
      <div className="glass-card border-emergency/30 emergency-glow p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 rounded-full bg-emergency animate-pulse-emergency" />
          <span className="text-sm font-medium">
            <span className="text-emergency font-bold">2 active alerts</span>{" "}
            require immediate attention
          </span>
        </div>
        <Button size="sm" className="bg-emergency hover:bg-emergency/90 text-emergency-foreground text-xs">
          Assign Officers
        </Button>
      </div>

      {/* Alert Table */}
      <div className="glass-card overflow-hidden">
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
            {mockSOSAlerts.map((alert) => (
              <TableRow key={alert.id} className="border-border hover:bg-accent/30">
                <TableCell>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(alert.timestamp)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emergency/15 text-emergency text-xs font-bold">
                      {alert.studentName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{alert.studentName}</div>
                      <div className="text-[11px] text-muted-foreground">{alert.studentPhone}</div>
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
                    {alert.assignedOfficer || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <User className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Workflow Legend */}
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
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

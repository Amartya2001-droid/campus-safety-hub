import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { mockEscortRequests, formatTimeAgo } from "@/lib/mock-data";
import { Clock, MapPin, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const Escorts = () => {
  return (
    <DashboardLayout title="Escort Requests" subtitle="SafeWalk escort queue management">
      <div className="space-y-3">
        {mockEscortRequests.map((escort) => (
          <div key={escort.id} className="glass-card p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning text-sm font-bold shrink-0">
                  {escort.studentName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{escort.studentName}</span>
                    <StatusBadge status={escort.status} />
                    {escort.eta && (
                      <span className="text-[11px] bg-info/15 text-info px-2 py-0.5 rounded-full">
                        ETA: {escort.eta}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {escort.pickup}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {escort.destination}
                    </span>
                  </div>
                  {escort.notes && (
                    <p className="text-xs text-muted-foreground mt-1.5 italic">"{escort.notes}"</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatTimeAgo(escort.timestamp)}
                    </span>
                    {escort.assignedOfficer && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {escort.assignedOfficer}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {escort.status === "pending" && (
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs">
                    Assign Officer
                  </Button>
                )}
                {escort.status === "in_progress" && (
                  <Button size="sm" variant="outline" className="text-xs border-success/30 text-success hover:bg-success/10">
                    Mark Completed
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Escorts;
